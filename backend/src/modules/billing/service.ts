import { Errors } from "../../common/errors/app-error";
import { logger } from "../../common/utils/logger";
import { currentPeriod } from "../../common/utils/time";
import { Organization } from "../organizations/model";
import { Invoice, Subscription, UsageRecord } from "./model";

export const USAGE_METRICS = {
  WHATSAPP_MESSAGES: "whatsapp_messages",
} as const;

/**
 * Plan catalogue. Billing is intentionally minimal for the MVP: quotas and an
 * estimated per-message rate. Rates are estimates for display only; actual Meta
 * charges depend on template category and destination country.
 */
export const PLAN_CATALOGUE = {
  starter: { messageQuota: 1000, estimatedRatePerMessageInr: 0.9 },
  growth: { messageQuota: 10000, estimatedRatePerMessageInr: 0.85 },
  enterprise: { messageQuota: 100000, estimatedRatePerMessageInr: 0.8 },
} as const;

type Plan = keyof typeof PLAN_CATALOGUE;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export async function ensureSubscription(organizationId: string, plan: Plan = "starter") {
  const existing = await Subscription.findOne({ organizationId });
  if (existing) return existing;
  const now = new Date();
  return Subscription.create({ organizationId, plan, status: "active", currentPeriodStart: now, currentPeriodEnd: addMonths(now, 1) });
}

/** Increments a monthly usage counter. Never throws: usage metering must not block messaging. */
export async function recordUsage(organizationId: string, metric: string, quantity = 1): Promise<void> {
  try {
    await UsageRecord.updateOne(
      { organizationId, period: currentPeriod(), metric },
      { $inc: { quantity } },
      { upsert: true }
    );
  } catch (err) {
    logger.error({ err: (err as Error).message, organizationId, metric }, "Failed to record usage");
  }
}

/** Frontend contract §14 `GET /billing/usage`. */
export async function getUsage(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) throw Errors.notFound("Organization");
  const plan = (org.plan ?? "starter") as Plan;
  const usage = await UsageRecord.findOne({ organizationId, period: currentPeriod(), metric: USAGE_METRICS.WHATSAPP_MESSAGES });
  const used = usage?.quantity ?? 0;
  const catalogue = PLAN_CATALOGUE[plan];
  return {
    plan,
    tier: org.whatsApp?.tier ?? null,
    period: currentPeriod(),
    /** Billable WhatsApp messages sent this month (Meta bills per delivered template message). */
    conversationsUsedThisMonth: used,
    conversationsQuota: catalogue.messageQuota,
    estimatedSpendInr: Math.round(used * catalogue.estimatedRatePerMessageInr * 100) / 100,
  };
}

export async function getSubscription(organizationId: string) {
  const sub = await ensureSubscription(organizationId);
  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    renewalDate: sub.cancelAtPeriodEnd ? null : sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

export async function listInvoices(organizationId: string) {
  const invoices = await Invoice.find({ organizationId }).sort({ periodStart: -1 }).limit(24);
  return invoices.map((i) => i.toJSON());
}
