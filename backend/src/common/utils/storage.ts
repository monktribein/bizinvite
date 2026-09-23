import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { Errors } from "../errors/app-error";

/** Object storage used for generated files (large report exports). */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  signedDownloadUrl(key: string, fileName: string, expiresInSeconds?: number): Promise<string>;
}

class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      // Path-style addressing works with MinIO and most S3-compatible providers.
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: env.S3_ENDPOINT ? undefined : "AES256" }));
  }

  async signedDownloadUrl(key: string, fileName: string, expiresInSeconds = 900) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"` }),
      { expiresIn: expiresInSeconds }
    );
  }
}

let storage: ObjectStorage | null | undefined;

export function isStorageConfigured(): boolean {
  return Boolean(env.S3_BUCKET);
}

export function getStorage(): ObjectStorage {
  if (storage === undefined) storage = env.S3_BUCKET ? new S3Storage(env.S3_BUCKET) : null;
  if (!storage) throw Errors.storage("Object storage (S3) is not configured");
  return storage;
}

export function setStorage(next: ObjectStorage | null): void {
  storage = next;
}
