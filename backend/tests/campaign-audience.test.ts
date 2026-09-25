import { describe, expect, it } from "vitest";
import { NO_AUDIENCE_REASON } from "../src/modules/campaigns/service";
import { Message } from "../src/modules/conversations/model";
import { runDueJobs } from "../src/scheduler/job-runner";
import { createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

async function launch(t: Tenant, eventId: string, templateId: string, targetSegment: Record<string, unknown>) {
  const res = await t.api.post("/api/v1/campaigns", { eventId, name: "Wave", templateId, targetSegment });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; status: string; recipientsBuiltAt?: string; metrics: { totalTargeted: number } };
}

async function getCampaign(t: Tenant, id: string) {
  return (await t.api.get(`/api/v1/campaigns/${id}`)).body.data;
}

describe("campaign audience from creation to send", () => {
  it("is 'running' with no recipients until the dispatch job builds them, then reports real totals", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id);
    await createGuest(t, event.id);

    // Exactly what the stored campaign looked like: the "All guests" choice with empty id lists.
    const created = await launch(t, event.id, tpl.id, { sessionIds: [], groupIds: [] });
    // The HTTP response is a snapshot taken before the background job ran.
    expect(created).toMatchObject({ status: "running", metrics: { totalTargeted: 0 } });
    expect(created.recipientsBuiltAt).toBeUndefined();

    await runDueJobs();
    const after = await getCampaign(t, created.id);
    expect(after.status).toBe("completed");
    expect(after.recipientsBuiltAt).toEqual(expect.any(String));
    expect(after.metrics).toMatchObject({ totalTargeted: 2, sent: 2 });
  });

  it("'All guests' includes already-invited guests; 'not yet invited' excludes them", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id, { name: "Invited earlier" });
    await launch(t, event.id, tpl.id, {});
    await runDueJobs();
    await createGuest(t, event.id, { name: "Added later" });

    const preview = (segment: Record<string, unknown>) => t.api.post("/api/v1/campaigns/audience-preview", { eventId: event.id, targetSegment: segment });
    expect((await preview({})).body.data).toMatchObject({ matched: 2, eligible: 2 });
    expect((await preview({ onlyUninvited: true })).body.data).toMatchObject({ matched: 1, eligible: 1 });

    // The audience is evaluated when the dispatch job runs, so run each campaign on its own.
    const uninvited = await launch(t, event.id, tpl.id, { onlyUninvited: true });
    await runDueJobs();
    expect((await getCampaign(t, uninvited.id)).metrics).toMatchObject({ totalTargeted: 1, sent: 1 });
    const all = await launch(t, event.id, tpl.id, {});
    await runDueJobs();
    expect((await getCampaign(t, all.id)).metrics).toMatchObject({ totalTargeted: 2, sent: 2 });
  });

  it("an audience that matches nobody fails with a reason instead of finishing as an empty campaign", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id);
    await launch(t, event.id, tpl.id, {});
    await runDueJobs();
    const sentBefore = await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" });

    // Everyone is invited now, so "not yet invited" matches no one.
    const empty = await launch(t, event.id, tpl.id, { onlyUninvited: true });
    await runDueJobs();
    const result = await getCampaign(t, empty.id);
    expect(result).toMatchObject({ status: "failed", failureReason: NO_AUDIENCE_REASON, metrics: { totalTargeted: 0 } });
    expect(result.recipientsBuiltAt).toEqual(expect.any(String));
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(sentBefore);
    const job = (await jobsOfType("campaign.dispatch")).find((j) => j.payload.campaignId === empty.id);
    expect(job).toMatchObject({ status: "cancelled", cancelReason: "no_matching_guests" });

    // An event without guests behaves the same.
    const bare = await createEvent(t, { name: "No guests yet" });
    const none = await launch(t, bare.id, tpl.id, {});
    await runDueJobs();
    expect(await getCampaign(t, none.id)).toMatchObject({ status: "failed", failureReason: NO_AUDIENCE_REASON });
  });
});
