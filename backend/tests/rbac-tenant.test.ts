import request from "supertest";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, ROLES } from "../src/common/constants/roles";
import { TenantGuardError } from "../src/common/utils/model";
import { Event } from "../src/modules/events/model";
import { EventGuest } from "../src/modules/guests/model";
import {
  app,
  createApprovedTemplate,
  createEvent,
  createGuest,
  createUser,
  login,
  setupTenant,
  useTestDatabase,
} from "./helpers";

useTestDatabase();

describe("RBAC", () => {
  it("defines exactly the 7 roles with the frontend permission matrix", () => {
    expect(ROLES).toHaveLength(7);
    expect(ROLE_PERMISSIONS.READ_ONLY_VIEWER).toEqual(["events:view", "guests:view", "campaigns:view", "rsvp:view", "reminders:view", "reports:view"]);
    expect(ROLE_PERMISSIONS.CHECK_IN_EXECUTIVE).toEqual(["events:view", "guests:view", "checkin:perform"]);
    expect(ROLE_PERMISSIONS.EVENT_ADMINISTRATOR).not.toContain("team:manage");
    expect(ROLE_PERMISSIONS.ORGANIZATION_OWNER).toContain("team:manage");
  });

  it("read-only viewers can list but not create events", async () => {
    const t = await setupTenant("READ_ONLY_VIEWER");
    expect((await t.api.get("/api/v1/events")).status).toBe(200);
    const res = await t.api.post("/api/v1/events", { name: "x" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("check-in executives cannot create campaigns or manage guests", async () => {
    const t = await setupTenant("CHECK_IN_EXECUTIVE");
    expect((await t.api.post("/api/v1/campaigns", {})).status).toBe(403);
    expect((await t.api.post("/api/v1/guests", {})).status).toBe(403);
    expect((await t.api.get("/api/v1/check-ins/summary")).status).toBe(200);
  });

  it("communication managers can launch campaigns but guest managers cannot", async () => {
    const owner = await setupTenant("ORGANIZATION_OWNER");
    const event = await createEvent(owner);
    const template = await createApprovedTemplate(owner.org.id);
    await createGuest(owner, event.id);

    const comms = await createUser(owner.org.id, "COMMUNICATION_MANAGER");
    const commsToken = (await login(comms.email)).tokens.accessToken;
    const ok = await request(app)
      .post("/api/v1/campaigns")
      .set("Authorization", `Bearer ${commsToken}`)
      .send({ eventId: event.id, name: "Wave 1", templateId: template.id, targetSegment: {} });
    expect(ok.status).toBe(201);

    const gm = await createUser(owner.org.id, "GUEST_MANAGER");
    const gmToken = (await login(gm.email)).tokens.accessToken;
    const denied = await request(app)
      .post("/api/v1/campaigns")
      .set("Authorization", `Bearer ${gmToken}`)
      .send({ eventId: event.id, name: "Wave 2", templateId: template.id, targetSegment: {} });
    expect(denied.status).toBe(403);
  });

  it("users cannot grant a role above their own", async () => {
    const t = await setupTenant("ORGANIZATION_OWNER");
    const ok = await t.api.post("/api/v1/users/invite", { name: "Rohan", email: "rohan@example.com", role: "EVENT_ADMINISTRATOR" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.inviteToken).toBeTruthy();
    const superAdmin = await t.api.post("/api/v1/users/invite", { name: "X", email: "x@example.com", role: "PLATFORM_SUPER_ADMIN" });
    expect(superAdmin.status).toBe(422);
  });
});

describe("tenant isolation", () => {
  it("Organization A cannot read or modify Organization B data", async () => {
    const a = await setupTenant("ORGANIZATION_OWNER");
    const b = await setupTenant("ORGANIZATION_OWNER");
    const bEvent = await createEvent(b);
    const bGuest = await createGuest(b, bEvent.id);
    const bTemplate = await createApprovedTemplate(b.org.id);

    // Reads
    expect((await a.api.get(`/api/v1/events/${bEvent.id}`)).status).toBe(404);
    expect((await a.api.get(`/api/v1/guests/${bGuest.id}`)).status).toBe(404);
    expect((await a.api.get(`/api/v1/sessions?eventId=${bEvent.id}`)).status).toBe(404);
    const aEvents = await a.api.get("/api/v1/events");
    expect(aEvents.body.data).toHaveLength(0);
    const aGuests = await a.api.get(`/api/v1/guests?eventId=${bEvent.id}`);
    expect(aGuests.body.data).toHaveLength(0);
    expect((await a.api.get(`/api/v1/organizations/${b.org.id}`)).status).toBe(403);
    expect((await a.api.get(`/api/v1/organizations/${b.org.id}/team`)).status).toBe(403);

    // Writes
    expect((await a.api.patch(`/api/v1/events/${bEvent.id}`, { name: "hijacked" })).status).toBe(404);
    expect((await a.api.patch(`/api/v1/guests/${bGuest.id}`, { name: "hijacked" })).status).toBe(404);
    expect((await a.api.patch(`/api/v1/rsvps/${bGuest.id}`, { status: "declined" })).status).toBe(404);
    expect((await a.api.post("/api/v1/check-ins/manual", { guestId: bGuest.id, gateId: "gate_1", paxCount: 1 })).status).toBe(404);
    // Cannot add a guest to, or campaign for, another tenant's event or template
    expect((await a.api.post("/api/v1/guests", { eventId: bEvent.id, name: "X", mobile: "9876543210" })).status).toBe(404);
    const aEvent = await createEvent(a);
    expect((await a.api.post("/api/v1/campaigns", { eventId: aEvent.id, name: "c", templateId: bTemplate.id })).status).toBe(404);

    const untouched = await Event.findOne({ _id: bEvent.id, organizationId: b.org.id });
    expect(untouched!.name).not.toBe("hijacked");
    const guest = await EventGuest.findOne({ _id: bGuest.id, organizationId: b.org.id });
    expect(guest!.rsvpStatus).toBe("no_response");
  });

  it("rejects an organizationId from the client that differs from the session", async () => {
    const a = await setupTenant("ORGANIZATION_OWNER");
    const b = await setupTenant("ORGANIZATION_OWNER");
    const viaHeader = await request(app).get("/api/v1/events").set("Authorization", `Bearer ${a.token}`).set("X-Organization-Id", b.org.id);
    expect(viaHeader.status).toBe(403);
    expect(viaHeader.body.error.code).toBe("TENANT_ACCESS_DENIED");

    const viaBody = await a.api.post("/api/v1/events", { organizationId: b.org.id, name: "x" });
    expect(viaBody.status).toBe(403);
    expect(viaBody.body.error.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("allows controlled cross-tenant access for platform super admins only", async () => {
    const b = await setupTenant("ORGANIZATION_OWNER");
    const bEvent = await createEvent(b);
    const admin = await createUser(b.org.id, "PLATFORM_SUPER_ADMIN", { email: "admin@platform.test" });
    const token = (await login(admin.email)).tokens.accessToken;

    const withoutOrg = await request(app).get("/api/v1/events").set("Authorization", `Bearer ${token}`);
    expect(withoutOrg.status).toBe(400);
    expect(withoutOrg.body.error.code).toBe("TENANT_CONTEXT_REQUIRED");

    const scoped = await request(app).get(`/api/v1/events/${bEvent.id}`).set("Authorization", `Bearer ${token}`).set("X-Organization-Id", b.org.id);
    expect(scoped.status).toBe(200);
  });

  it("the tenant guard refuses queries on tenant data without organizationId", async () => {
    await expect(Event.find({ name: "anything" })).rejects.toBeInstanceOf(TenantGuardError);
    await expect(EventGuest.updateMany({}, { $set: { notes: "x" } })).rejects.toBeInstanceOf(TenantGuardError);
    await expect(EventGuest.countDocuments({ rsvpStatus: "attending" })).rejects.toBeInstanceOf(TenantGuardError);
  });
});
