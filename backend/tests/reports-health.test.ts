import request from "supertest";
import { describe, expect, it } from "vitest";
import { extractDbName } from "../src/config/env";
import { safeCell } from "../src/modules/reports/export";
import { app, createEvent, createGuest, setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

describe("reports", () => {
  it("returns funnel, RSVP, attendance and summary reports without a fake 'clicked' stage", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const g = await createGuest(t, event.id, { allowedCompanions: 1 });
    await createGuest(t, event.id);
    await t.api.patch(`/api/v1/rsvps/${g.id}`, { status: "attending", count: 2 });
    await t.api.post("/api/v1/check-ins/manual", { guestId: g.id, gateId: "gate_1", paxCount: 2 });

    const funnel = await t.api.get(`/api/v1/reports/invitation-funnel?eventId=${event.id}`);
    expect(funnel.body.data.stages.map((s: { stage: string }) => s.stage)).toEqual(["Sent", "Delivered", "Read"]);

    const rsvp = await t.api.get(`/api/v1/reports/rsvp?eventId=${event.id}`);
    expect(rsvp.body.data).toMatchObject({ totalInvited: 2, attending: 1, expectedFootfall: 2, responseRatePercentage: 50 });

    const attendance = await t.api.get(`/api/v1/reports/attendance?eventId=${event.id}`);
    expect(attendance.body.data).toMatchObject({ totalExpected: 2, actualCheckedIn: 2, turnoutPercentage: 100 });
    expect(attendance.body.data.hourlyCheckIns).toHaveLength(1);

    const summary = await t.api.get(`/api/v1/reports/event-summary?eventId=${event.id}`);
    expect(summary.body.data).toMatchObject({ eventId: event.id, totalGuests: 2, attendingCount: 1, actualCheckedInPax: 2 });

    // The frontend sends "?eventId=" for all events.
    expect((await t.api.get("/api/v1/reports/reminders?eventId=")).status).toBe(200);
    expect((await t.api.get("/api/v1/reports/failures")).status).toBe(200);
  });

  it("exports CSV and XLSX as attachments", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id, { name: "=HYPERLINK(\"evil\")" });

    const csv = await t.api.get(`/api/v1/reports/rsvp_breakdown/export?eventId=${event.id}&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toMatch(/^attachment; filename="bizinvite_rsvp_breakdown_.*\.csv"$/);
    expect(csv.text).toContain("Guest,Mobile");
    expect(csv.text).toContain(`"'=HYPERLINK(""evil"")"`);

    const xlsx = await t.api.get(`/api/v1/reports/full_event_summary/export?eventId=${event.id}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe("PK"); // zip container

    expect((await t.api.get("/api/v1/reports/not_a_report/export")).status).toBe(422);
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(safeCell("=1+1")).toBe("'=1+1");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("Asha")).toBe("Asha");
    expect(safeCell(-5)).toBe(-5);
  });

  it("requires reports:export for downloads", async () => {
    const t = await setupTenant("COMMUNICATION_MANAGER");
    expect((await t.api.get("/api/v1/reports/rsvp")).status).toBe(200);
    expect((await t.api.get("/api/v1/reports/rsvp_breakdown/export")).status).toBe(403);
  });
});

describe("platform", () => {
  it("exposes health and readiness without secrets", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.data).toMatchObject({ status: "ok", api: "up", mongodb: "up", scheduler: { state: "disabled" } });
    expect(JSON.stringify(health.body)).not.toMatch(/mongodb:\/\/|secret/i);
    const ready = await request(app).get("/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.data).toMatchObject({ ready: true, mongodb: "up" });
  });

  it("uses the standard error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("sets security headers and a request id", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "req_test_12345678");
    expect(res.headers["x-request-id"]).toBe("req_test_12345678");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("only accepts MongoDB URIs that target bizinvite_db", () => {
    expect(extractDbName("mongodb+srv://bizinvite_app:pw@cluster0.example.net/bizinvite_db?retryWrites=true")).toBe("bizinvite_db");
    expect(extractDbName("mongodb://h1:27017,h2:27017/other_db?replicaSet=rs0")).toBe("other_db");
    expect(extractDbName("mongodb://localhost:27017")).toBeNull();
  });
});
