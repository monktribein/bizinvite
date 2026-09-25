import mongoose, { Types } from "mongoose";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { toObjectId } from "../../common/utils/model";
import { uploadMedia } from "../conversations/whatsapp.client";
import type { TemplateDoc } from "../templates/model";
import { Campaign, CampaignDoc } from "./model";

/**
 * Invitation media (an image or video sent as the template header).
 * Files are stored in MongoDB GridFS so no external object storage is needed; each
 * campaign uploads its file to WhatsApp once and reuses the returned media id.
 */

export type CampaignMediaType = "image" | "video";

export const MEDIA_LIMITS: Record<CampaignMediaType, { maxBytes: number; mimeTypes: string[]; label: string }> = {
  image: { maxBytes: 2 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png"], label: "2 MB" },
  video: { maxBytes: 10 * 1024 * 1024, mimeTypes: ["video/mp4", "video/3gpp"], label: "10 MB" },
};

/** Largest accepted upload; multer rejects anything bigger before it is buffered. */
export const MAX_MEDIA_UPLOAD_BYTES = MEDIA_LIMITS.video.maxBytes;

/** WhatsApp keeps uploaded media for 30 days; re-upload a little before that. */
const WA_MEDIA_TTL_MS = 25 * 24 * 60 * 60 * 1000;

const BUCKET_NAME = "campaignMedia";

interface MediaFileMetadata {
  organizationId: Types.ObjectId;
  mediaType: CampaignMediaType;
  mimeType: string;
  uploadedBy?: Types.ObjectId;
}

interface MediaFile {
  _id: Types.ObjectId;
  filename: string;
  length: number;
  metadata: MediaFileMetadata;
}

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

export function mediaTypeForMime(mimeType: string): CampaignMediaType | null {
  if (MEDIA_LIMITS.image.mimeTypes.includes(mimeType)) return "image";
  if (MEDIA_LIMITS.video.mimeTypes.includes(mimeType)) return "video";
  return null;
}

function toMediaDto(file: MediaFile) {
  return {
    id: String(file._id),
    type: file.metadata.mediaType,
    mimeType: file.metadata.mimeType,
    size: file.length,
    filename: file.filename,
  };
}

export async function saveCampaignMedia(actor: ActorContext, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }) {
  const mediaType = mediaTypeForMime(file.mimetype);
  if (!mediaType) {
    throw Errors.validation("Only JPEG/PNG images or MP4/3GP videos can be attached", { file: ["Unsupported file type"] });
  }
  const limit = MEDIA_LIMITS[mediaType];
  if (file.size > limit.maxBytes) {
    throw Errors.validation(`${mediaType === "image" ? "Image" : "Video"} must be ${limit.label} or smaller`, { file: [`Maximum size is ${limit.label}`] });
  }

  const metadata: MediaFileMetadata = {
    organizationId: toObjectId(actor.organizationId),
    mediaType,
    mimeType: file.mimetype,
    ...(actor.userId ? { uploadedBy: toObjectId(actor.userId) } : {}),
  };
  const filename = file.originalname.slice(0, 200) || `invitation-${mediaType}`;
  const upload = bucket().openUploadStream(filename, { metadata });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(file.buffer);
  });
  return toMediaDto({ _id: upload.id as Types.ObjectId, filename, length: file.size, metadata });
}

async function findMediaFile(organizationId: string, mediaId: string): Promise<MediaFile> {
  if (!Types.ObjectId.isValid(mediaId)) throw Errors.notFound("Media");
  const [file] = await bucket()
    .find({ _id: toObjectId(mediaId), "metadata.organizationId": toObjectId(organizationId) })
    .limit(1)
    .toArray();
  if (!file) throw Errors.notFound("Media");
  return file as unknown as MediaFile;
}

export async function getCampaignMedia(organizationId: string, mediaId: string) {
  return toMediaDto(await findMediaFile(organizationId, mediaId));
}

/** Opens the stored file for preview downloads. */
export async function openCampaignMediaStream(organizationId: string, mediaId: string) {
  const file = await findMediaFile(organizationId, mediaId);
  return { media: toMediaDto(file), stream: bucket().openDownloadStream(file._id) };
}

async function readMediaBuffer(fileId: Types.ObjectId): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of bucket().openDownloadStream(fileId)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * WhatsApp only carries media on a template message as its header, so a synced Meta
 * template must declare a matching IMAGE/VIDEO header. Local dry-run templates accept either.
 */
export function assertMediaMatchesTemplate(
  template: Pick<TemplateDoc, "name" | "source" | "headerType" | "headerMediaUrl">,
  mediaType: CampaignMediaType | undefined
) {
  if (template.source === "local") return;
  if (!mediaType) {
    // Meta rejects a template with a media header when the message carries no media.
    const header = template.headerType ?? "NONE";
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(header) && !template.headerMediaUrl) {
      const what = header === "DOCUMENT" ? "a document link on the template" : `an ${header.toLowerCase()} to the campaign (or a default media link on the template)`;
      throw Errors.validation(`Template "${template.name}" has a ${header} header: attach ${what} before sending.`, {
        mediaId: [`This template needs ${header === "DOCUMENT" ? "a DOCUMENT" : `an ${header}`} header`],
      });
    }
    return;
  }
  const expected = mediaType === "image" ? "IMAGE" : "VIDEO";
  if (template.headerType !== expected) {
    const has = template.headerType && template.headerType !== "NONE" ? `a ${template.headerType} header` : "no media header";
    throw Errors.validation(`Template "${template.name}" has ${has}. Attach media only with a template approved with an ${expected} header.`, {
      mediaId: [`Template needs an ${expected} header to send a ${mediaType}`],
    });
  }
}

/** Snapshot stored on the campaign when media is attached. */
export async function resolveCampaignMedia(organizationId: string, mediaId: string) {
  const file = await findMediaFile(organizationId, mediaId);
  return {
    fileId: file._id,
    type: file.metadata.mediaType,
    mimeType: file.metadata.mimeType,
    size: file.length,
    filename: file.filename,
  };
}

/** Uploads a stored file to WhatsApp without caching the id (test sends before a campaign exists). */
export async function uploadStoredMediaToWhatsApp(organizationId: string, mediaId: string, phoneNumberId: string | undefined) {
  const file = await findMediaFile(organizationId, mediaId);
  const id = await uploadMedia({ phoneNumberId, buffer: await readMediaBuffer(file._id), mimeType: file.metadata.mimeType, filename: file.filename });
  return { type: file.metadata.mediaType, id };
}

/**
 * Returns the WhatsApp media id for the campaign's attachment, uploading the stored file
 * the first time (or after WhatsApp's retention window, or for a different sender number).
 */
export async function ensureWhatsAppMedia(campaign: CampaignDoc, phoneNumberId: string | undefined): Promise<{ type: CampaignMediaType; id: string } | undefined> {
  const media = campaign.media;
  if (!media?.fileId || !media.type) return undefined;

  const fresh =
    media.waMediaId &&
    media.waPhoneNumberId === (phoneNumberId ?? null) &&
    media.waUploadedAt &&
    Date.now() - media.waUploadedAt.getTime() < WA_MEDIA_TTL_MS;
  if (fresh) return { type: media.type as CampaignMediaType, id: media.waMediaId! };

  const buffer = await readMediaBuffer(media.fileId);
  const waMediaId = await uploadMedia({ phoneNumberId, buffer, mimeType: media.mimeType!, filename: media.filename ?? "invitation" });
  await Campaign.updateOne(
    { _id: campaign._id, organizationId: campaign.organizationId },
    { $set: { "media.waMediaId": waMediaId, "media.waPhoneNumberId": phoneNumberId ?? null, "media.waUploadedAt": new Date() } }
  );
  campaign.set("media.waMediaId", waMediaId);
  campaign.set("media.waPhoneNumberId", phoneNumberId ?? null);
  campaign.set("media.waUploadedAt", new Date());
  return { type: media.type as CampaignMediaType, id: waMediaId };
}
