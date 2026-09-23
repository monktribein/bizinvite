/**
 * Pure decision logic for the reminder engine. Kept free of I/O so the rules can be
 * unit-tested exhaustively.
 */

export type StopReason =
  | "event_cancelled"
  | "event_over"
  | "rule_inactive"
  | "opt_out"
  | "organizer_suppressed"
  | "invalid_mobile"
  | "invitation_cancelled"
  | "rsvp_received"
  | "max_attempts"
  | "whatsapp_permanent_failure";

export interface StopContext {
  eventStatus: string;
  eventEnd: Date;
  ruleStatus: string;
  ruleTargetStatuses: string[];
  ruleStopConditions: string[];
  maximumAttempts: number;
  attempt: number;
  rsvpStatus: string;
  contact: { optedOut?: boolean | null; communicationSuppressed?: boolean | null; mobileValid?: boolean | null } | null;
  /** A previous attempt of this rule failed permanently for this guest. */
  previousPermanentFailure?: boolean;
  now: Date;
}

/** Returns why a reminder must not be sent, or null when it may proceed. */
export function evaluateStopConditions(ctx: StopContext): StopReason | null {
  if (ctx.eventStatus === "cancelled") return "event_cancelled";
  if (ctx.eventStatus === "completed" || ctx.eventEnd < ctx.now) return "event_over";
  if (ctx.ruleStatus !== "active") return "rule_inactive";
  // Opt-out, suppression and invalid numbers always stop, whatever the rule says.
  if (!ctx.contact || ctx.contact.optedOut) return "opt_out";
  if (ctx.contact.communicationSuppressed) return "organizer_suppressed";
  if (ctx.contact.mobileValid === false) return "invalid_mobile";
  if (ctx.previousPermanentFailure) return "whatsapp_permanent_failure";
  if (ctx.rsvpStatus === "cancelled") return "invitation_cancelled";
  // The guest no longer matches the audience (e.g. responded to an RSVP chase).
  if (ctx.ruleTargetStatuses.length && !ctx.ruleTargetStatuses.includes(ctx.rsvpStatus)) return "rsvp_received";
  if (ctx.attempt > ctx.maximumAttempts) return "max_attempts";
  return null;
}

/** First send time of a rule, or null if it cannot be computed yet. */
export function computeFirstRunAt(
  rule: { triggerType: string; relativeTo?: string | null; offsetMinutes?: number | null; scheduledAt?: Date | null },
  anchors: { rsvpDeadline: Date; eventStart: Date; sessionStart?: Date | null }
): Date | null {
  const offsetMs = (rule.offsetMinutes ?? 0) * 60000;
  switch (rule.triggerType) {
    case "scheduled_time":
      return rule.scheduledAt ?? null;
    case "relative_to_deadline":
      return new Date(anchors.rsvpDeadline.getTime() + offsetMs);
    case "relative_to_event": {
      const anchor = rule.relativeTo === "session_start" ? anchors.sessionStart : anchors.eventStart;
      return anchor ? new Date(anchor.getTime() + offsetMs) : null;
    }
    default:
      return null;
  }
}

/**
 * Which attempt (1-based) is due now given how many have already been made.
 * Returns null when nothing is due: before the first run, when the repeat interval
 * since the last attempt has not elapsed, or when attempts are exhausted.
 */
export function nextDueAttempt(input: {
  firstRunAt: Date;
  now: Date;
  attemptsMade: number;
  maximumAttempts: number;
  repeatIntervalMinutes: number;
  lastAttemptAt?: Date | null;
}): number | null {
  if (input.now < input.firstRunAt) return null;
  if (input.attemptsMade >= input.maximumAttempts) return null;
  const intervalMs = input.repeatIntervalMinutes * 60000;
  if (input.attemptsMade > 0) {
    if (!input.lastAttemptAt) return null;
    if (input.now.getTime() - input.lastAttemptAt.getTime() < intervalMs) return null;
  }
  return input.attemptsMade + 1;
}

/** Default audience per reminder type when the rule does not specify one. */
export function defaultTargetStatuses(reminderType: string): string[] {
  return reminderType === "event_eve" || reminderType === "event_day" || reminderType === "session_specific"
    ? ["attending"]
    : ["no_response", "maybe", "incomplete"];
}
