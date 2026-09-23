import request from "supertest";
import { describe, expect, it } from "vitest";
import { normalizeMobile } from "../src/common/utils/mobile";
import { app, createEvent, createGuest, createUser, eventPayload, login, setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

describe("events", () => {
  it("creates an event with sessions (frontend payload) and returns the contract shape", async () => {
    const t = await setupTenant();
    const start = new Date(Date.now() + 20 * 86400000);
    const res = await t.api.post(
      "/api/v1/events",
      eventPayload({
        sessions: [
          // The frontend sends client-side ids and an empty eventId: both are ignored.
          { id: "sess_custom_1", eventId: "", name: "Mehendi", startTime: start.toISOString(), endTime: new Date(start.getTime() + 4 * 3600000).toISOString() },
        ],
        hosts: [{ name: "Organizing Committee", relationship: "Host" }],
        languages: ["English", "Hindi"],
      })
    );
    expect(res.status).toBe(201);
    const event = res.body.data;
    expect(event).toMatchObject({ name: "Sharma & Verma Grand Wedding", category: "wedding", status: "upcoming", organizationId: t.org.id, totalGuestsCount: 0 });
    expect(event.sessions).toHaveLength(1);
    expect(event.sessions[0]).toMatchObject({ name: "Mehendi", eventId: event.id });
    expect(event.venue.name).toBe("Taj Aravali Resort & Spa");
    expect(event.checkInConfig.activeGates).toEqual(["Gate 1 (Main)", "Gate 2"]);
  });

  it("validates dates and required fields", async () => {
    const t = await setupTenant();
    const bad = await t.api.post("/api/v1/events", eventPayload({ endDate: new Date(Date.now() - 86400000).toISOString() }));
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.endDate).toBeDefined();
    const missing = await t.api.post("/api/v1/events", { category: "wedding" });
    expect(missing.status).toBe(422);
    expect(Object.keys(missing.body.error.fields)).toEqual(expect.arrayContaining(["name", "startDate", "venue"]));
  });

  it("lists with filters and paginated meta, gets and patches", async () => {
    const t = await setupTenant();
    const e1 = await createEvent(t, { name: "Corporate Summit", category: "corporate" });
    await createEvent(t, { name: "Beach Wedding" });

    const list = await t.api.get("/api/v1/events?category=corporate");
    expect(list.status).toBe(200);
    expect(list.body.data.map((e: { name: string }) => e.name)).toEqual(["Corporate Summit"]);
    expect(list.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });

    const search = await t.api.get("/api/v1/events?search=beach");
    expect(search.body.data).toHaveLength(1);

    const patched = await t.api.patch(`/api/v1/events/${e1.id}`, { status: "active", checkInConfig: { allowMultipleEntries: false } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.status).toBe("active");
    // Partial nested update keeps the other settings.
    expect(patched.body.data.checkInConfig).toMatchObject({ allowMultipleEntries: false, requirePassVerification: true });

    const got = await t.api.get(`/api/v1/events/${e1.id}`);
    expect(got.body.data.status).toBe("active");
    expect((await t.api.get("/api/v1/events/not-an-id")).status).toBe(404);
  });

  it("manages sessions through /sessions", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const start = new Date(Date.now() + 25 * 86400000);
    const created = await t.api.post("/api/v1/sessions", {
      eventId: event.id,
      name: "Sangeet",
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 3600000).toISOString(),
      venueName: "Grand Ballroom",
    });
    expect(created.status).toBe(201);
    const updated = await t.api.patch(`/api/v1/sessions/${created.body.data.id}`, { capacity: 300 });
    expect(updated.body.data.capacity).toBe(300);
    const list = await t.api.get(`/api/v1/sessions?eventId=${event.id}`);
    expect(list.body.data).toHaveLength(1);
  });
});

describe("guests", () => {
  it("normalizes mobile numbers to E.164", () => {
    expect(normalizeMobile("98110 99887")).toEqual({ valid: true, e164: "+919811099887" });
    expect(normalizeMobile("+91 98110-99887")).toEqual({ valid: true, e164: "+919811099887" });
    expect(normalizeMobile("09811099887")).toEqual({ valid: true, e164: "+919811099887" });
    expect(normalizeMobile("919811099887")).toEqual({ valid: true, e164: "+919811099887" });
    expect(normalizeMobile("981109988").valid).toBe(false);
    expect(normalizeMobile("abc").valid).toBe(false);
  });

  it("creates a guest with the frontend Guest shape", async () => {
    const owner = await setupTenant();
    const event = await createEvent(owner);
    // Guest managers cannot create events but can add guests.
    const manager = await createUser(owner.org.id, "GUEST_MANAGER");
    const token = (await login(manager.email)).tokens.accessToken;
    const res = await request(app).post("/api/v1/guests").set("Authorization", `Bearer ${token}`).send({
      eventId: event.id,
      name: "Vikramaditya Roy",
      mobile: "+919811099887",
      email: "v.roy@royholdings.com",
      category: "VIP",
      isVip: true,
      allowedCompanions: 1,
      city: "Kolkata",
      notes: "Arriving Oct 24 flight",
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      eventId: event.id,
      name: "Vikramaditya Roy",
      mobile: "+919811099887",
      category: "VIP",
      isVip: true,
      allowedCompanions: 1,
      confirmedCompanions: 0,
      rsvpStatus: "no_response",
      reminderStatus: "none",
      checkInStatus: "not_checked_in",
      consentSource: "manual_entry",
    });
  });

  it("detects duplicates on the same event and reuses the contact across events", async () => {
    const t = await setupTenant();
    const e1 = await createEvent(t);
    const e2 = await createEvent(t, { name: "Reception" });
    const g1 = await createGuest(t, e1.id, { mobile: "9820112233", name: "Sunil Singhania" });

    const dup = await t.api.post("/api/v1/guests", { eventId: e1.id, name: "Sunil", mobile: "+91 98201 12233" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");
    expect(dup.body.error.details.existingGuestId).toBe(g1.id);

    const second = await createGuest(t, e2.id, { mobile: "09820112233", name: "Sunil Singhania" });
    expect(second.contactId).toBe(g1.contactId);
    expect(second.id).not.toBe(g1.id);
  });

  it("rejects invalid mobiles with field errors", async () => {
    const t = await setupTenant();
    const e = await createEvent(t);
    const res = await t.api.post("/api/v1/guests", { eventId: e.id, name: "X", mobile: "12345" });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.mobile[0]).toMatch(/10-12 digits/);
  });

  it("updates guests, syncs denormalized fields and filters/searches", async () => {
    const t = await setupTenant();
    const e1 = await createEvent(t);
    const e2 = await createEvent(t);
    const g = await createGuest(t, e1.id, { name: "Asha", category: "Family" });
    await createGuest(t, e2.id, { name: "Asha", mobile: g.mobile });
    await createGuest(t, e1.id, { name: "Bala", category: "Corporate", isVip: true });

    const upd = await t.api.patch(`/api/v1/guests/${g.id}`, { name: "Asha Mehta", category: "VVIP", allowedCompanions: 3 });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ name: "Asha Mehta", category: "VVIP", allowedCompanions: 3 });

    const other = await t.api.get(`/api/v1/guests?eventId=${e2.id}`);
    expect(other.body.data[0].name).toBe("Asha Mehta");

    const vip = await t.api.get(`/api/v1/guests?eventId=${e1.id}&isVip=true`);
    expect(vip.body.data.map((x: { name: string }) => x.name)).toEqual(["Bala"]);
    const search = await t.api.get(`/api/v1/guests?eventId=${e1.id}&search=mehta`);
    expect(search.body.data).toHaveLength(1);
  });
});
