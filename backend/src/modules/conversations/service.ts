import { Errors } from "../../common/errors/app-error";
import type { Pagination } from "../../common/validators/common";
import { EventGuest } from "../guests/model";
import { Conversation, Message, toMessageDto } from "./model";

export async function listConversations(
  organizationId: string,
  filters: { guestId?: string; eventId?: string },
  page: Pagination
) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.guestId) {
    // Accept either an invitation id (frontend guest id) or a contact id.
    const invitation = await EventGuest.findOne({ _id: filters.guestId, organizationId }).select("guestId");
    query.guestId = invitation ? invitation.guestId : filters.guestId;
  }
  if (filters.eventId) query.eventIds = filters.eventId;

  const [items, total] = await Promise.all([
    Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Conversation.countDocuments(query),
  ]);
  return {
    items: items.map((c) => ({
      id: c.id as string,
      guestId: c.guestId ? String(c.guestId) : undefined,
      guestName: c.guestName ?? "",
      mobile: c.mobile,
      eventIds: (c.eventIds ?? []).map(String),
      lastMessageSnippet: c.lastMessageSnippet ?? "",
      lastMessageAt: c.lastMessageAt?.toISOString(),
      lastDirection: c.lastDirection ?? undefined,
      unreadCount: c.unreadCount,
      /** WhatsApp only allows free-form replies within 24h of the guest's last message. */
      canReplyFreeForm: Boolean(c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < 24 * 3600 * 1000),
    })),
    total,
  };
}

export async function listMessages(organizationId: string, conversationId: string, page: Pagination) {
  const conversation = await Conversation.findOne({ _id: conversationId, organizationId });
  if (!conversation) throw Errors.notFound("Conversation");
  const query = { organizationId, conversationId: conversation._id };
  const [items, total] = await Promise.all([
    Message.find(query)
      .sort({ createdAt: 1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Message.countDocuments(query),
  ]);
  return { items: items.map(toMessageDto), total };
}

export async function markConversationRead(organizationId: string, conversationId: string) {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, organizationId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );
  if (!conversation) throw Errors.notFound("Conversation");
  return { id: conversation.id as string, unreadCount: 0 };
}
