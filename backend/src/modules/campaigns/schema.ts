import { z } from "zod";
import { CAMPAIGN_STATUSES, GUEST_CATEGORIES, RECIPIENT_STATUSES, RSVP_STATUSES } from "../../common/constants/enums";
import { isoDateSchema, objectIdSchema } from "../../common/validators/common";

export const targetSegmentSchema = z
  .object({
    category: z.enum(GUEST_CATEGORIES).optional(),
    rsvpStatus: z.enum(RSVP_STATUSES).optional(),
    onlyVip: z.boolean().optional(),
    sessionIds: z.array(objectIdSchema).max(30).optional(),
    groupIds: z.array(objectIdSchema).max(100).optional(),
    onlyUninvited: z.boolean().optional(),
  })
  .default({});

export const createCampaignSchema = z.object({
  eventId: objectIdSchema,
  name: z.string().trim().min(1, "Campaign name is required").max(200),
  templateId: objectIdSchema,
  scheduledFor: isoDateSchema.optional(),
  targetSegment: targetSegmentSchema,
  /** Image or video uploaded via POST /campaigns/media, sent as the template header. */
  mediaId: objectIdSchema.optional(),
  /**
   * The frontend "launch" flow creates and sends in one call: without scheduledFor the
   * campaign starts immediately. Pass draft=true to only save it.
   */
  draft: z.boolean().optional(),
});

export const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    templateId: objectIdSchema,
    scheduledFor: isoDateSchema.nullable(),
    targetSegment: targetSegmentSchema,
    /** null removes the attachment. */
    mediaId: objectIdSchema.nullable(),
  })
  .partial();

export const listCampaignsQuerySchema = z.object({
  eventId: objectIdSchema.optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export const recipientsQuerySchema = z.object({ status: z.enum(RECIPIENT_STATUSES).optional() });

export const testSendSchema = z.object({ mobile: z.string().trim().min(8).max(32) });

/** Test send from the campaign form, before the campaign is created. */
export const draftTestSendSchema = testSendSchema.extend({
  eventId: objectIdSchema,
  templateId: objectIdSchema,
  mediaId: objectIdSchema.optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
