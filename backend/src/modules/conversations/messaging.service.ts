import type { Types } from "mongoose";
import { whatsappConfig } from "../../config/whatsapp";
import { toWhatsAppNumber } from "../../common/utils/mobile";
import { recordUsage, USAGE_METRICS } from "../billing/service";
import { Organization } from "../organizations/model";
import type { TemplateDoc } from "../templates/model";
import { buildTemplateComponents, renderBody, VariableContext } from "../templates/variables";
import { Conversation, Message, MessageDoc } from "./model";
import { sendTemplateMessage, WhatsAppSendError } from "./whatsapp.client";

type Id = string | Types.ObjectId;

export interface OutboundTemplateInput {
  organizationId: string;
  mobile: string;
  guestName?: string;
  guestId?: Id;
  eventGuestId?: Id;
  eventId?: Id;
  template: TemplateDoc;
  context: VariableContext;
  headerMediaUrl?: string;
  purpose: "campaign" | "reminder" | "pass" | "test";
  campaignId?: Id;
  campaignRecipientId?: Id;
  reminderRuleId?: Id;
  scheduledJobId?: Id;
  passId?: Id;
}

async function phoneNumberIdFor(organizationId: string): Promise<string | undefined> {
  const org = await Organization.findById(organizationId).select("whatsApp.phoneNumberId");
  return org?.whatsApp?.phoneNumberId ?? whatsappConfig.phoneNumberId;
}

export async function touchConversation(input: {
  organizationId: string;
  mobile: string;
  guestId?: Id;
  guestName?: string;
  eventId?: Id;
  direction: "inbound" | "outbound";
  snippet: string;
  at: Date;
}) {
  return Conversation.findOneAndUpdate(
    { organizationId: input.organizationId, mobile: input.mobile },
    {
      $set: {
        lastMessageAt: input.at,
        lastMessageSnippet: input.snippet.slice(0, 160),
        lastDirection: input.direction,
        ...(input.guestId ? { guestId: input.guestId } : {}),
        ...(input.guestName ? { guestName: input.guestName } : {}),
        ...(input.direction === "inbound" ? { lastInboundAt: input.at } : {}),
      },
      ...(input.eventId ? { $addToSet: { eventIds: input.eventId } } : {}),
      ...(input.direction === "inbound" ? { $inc: { unreadCount: 1 } } : {}),
      $setOnInsert: { organizationId: input.organizationId, mobile: input.mobile },
    },
    { upsert: true, new: true }
  );
}

/**
 * Sends an approved template to one guest and records the message.
 * Returns the stored message; throws WhatsAppSendError (after recording the failure)
 * when the Cloud API rejects the send.
 */
export async function sendTemplateToGuest(input: OutboundTemplateInput): Promise<MessageDoc> {
  const body = renderBody(input.template.bodyText, input.template, input.context);
  const phoneNumberId = await phoneNumberIdFor(input.organizationId);
  const now = new Date();
  const conversation = await touchConversation({
    organizationId: input.organizationId,
    mobile: input.mobile,
    guestId: input.guestId,
    guestName: input.guestName,
    eventId: input.eventId,
    direction: "outbound",
    snippet: body,
    at: now,
  });

  const message = await Message.create({
    organizationId: input.organizationId,
    conversationId: conversation?._id,
    direction: "outbound",
    type: "template",
    templateName: input.template.name,
    body,
    guestId: input.guestId,
    eventGuestId: input.eventGuestId,
    eventId: input.eventId,
    mobile: input.mobile,
    phoneNumberId,
    status: "queued",
    purpose: input.purpose,
    campaignId: input.campaignId,
    campaignRecipientId: input.campaignRecipientId,
    reminderRuleId: input.reminderRuleId,
    scheduledJobId: input.scheduledJobId,
    passId: input.passId,
  });

  try {
    const result = await sendTemplateMessage({
      phoneNumberId,
      to: toWhatsAppNumber(input.mobile),
      templateName: input.template.name,
      languageCode: input.template.language,
      components: buildTemplateComponents(input.template, input.context, {
        eventGuestId: input.eventGuestId ? String(input.eventGuestId) : undefined,
        headerMediaUrl: input.headerMediaUrl,
      }),
    });
    message.set({ waMessageId: result.waMessageId, status: "sent", sentAt: new Date(), dryRun: result.dryRun });
    await message.save();
    if (!result.dryRun && input.purpose !== "test") await recordUsage(input.organizationId, USAGE_METRICS.WHATSAPP_MESSAGES);
    return message;
  } catch (err) {
    const sendError = err instanceof WhatsAppSendError ? err : new WhatsAppSendError((err as Error).message, undefined, false);
    message.set({ status: "failed", failedAt: new Date(), errorCode: sendError.code, errorMessage: sendError.message.slice(0, 500) });
    await message.save();
    throw sendError;
  }
}
