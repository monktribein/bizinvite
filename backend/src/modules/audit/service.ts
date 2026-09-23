import type { ActorContext } from "../../common/utils/context";
import { logger } from "../../common/utils/logger";
import { searchRegex } from "../../common/utils/text";
import type { Pagination } from "../../common/validators/common";
import { AuditLog } from "./model";

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an audit entry. Audit failures are logged but never break the business
 * operation that triggered them.
 */
export async function recordAudit(actor: ActorContext, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      organizationId: actor.organizationId,
      userId: actor.userId,
      userName: actor.userName ?? "system",
      userRole: actor.userRole ?? "SYSTEM",
      ipAddress: actor.ipAddress,
      requestId: actor.requestId,
      ...entry,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, action: entry.action }, "Failed to write audit log");
  }
}

export async function listAuditLogs(
  organizationId: string,
  filters: { resourceType?: string; action?: string },
  page: Pagination
) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.action) query.action = searchRegex(filters.action);
  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    AuditLog.countDocuments(query),
  ]);
  return { items: items.map((d) => d.toJSON()), total };
}
