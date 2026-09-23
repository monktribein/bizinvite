import type { ScheduledJobDoc } from "../model";

/** Returns the job's organization id and the requested string payload fields, or throws on a malformed job. */
export function requirePayload<K extends string>(job: ScheduledJobDoc, keys: K[], needsOrganization = true) {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof payload[key] !== "string") throw new Error(`Invalid ${job.type} payload: ${key}`);
  }
  if (needsOrganization && !job.organizationId) throw new Error(`Invalid ${job.type} job: organizationId missing`);
  return { organizationId: job.organizationId ? String(job.organizationId) : "", ...(payload as Record<K, string>) };
}
