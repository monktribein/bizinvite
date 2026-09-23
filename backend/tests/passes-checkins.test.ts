import request from "supertest";
import { describe, expect, it } from "vitest";
import { CheckIn } from "../src/modules/check-ins/model";
import { EventGuest } from "../src/modules/guests/model";
import { signPassToken, verifyPassToken } from "../src/modules/passes/token";
import { app, createEvent, createGuest, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

async function issuePass(t: Tenant, allowedCompanions = 1, eventOverrides: Record<string, unknown> = {}) {
  const event = await createEvent(t, eventOverrides);
  const guest = await createGuest(t, event.id, { allowedCompanions });
  await t.api.patch(`/api/v1/rsvps/${guest.id}`, { status: "attending", count: 1 });
  const gen = await t.api.post("/api/v1/passes/generate", { eventId: event.id });
  expect(gen.body.data.created).toBe(1);
  const list = await t.api.get(`/api/v1/passes?eventId=${event.id}`);
  return { event, guest, pass: list.body.data[0] as { id: string; passCode: string; signedToken: string; status: string; allowedPax: number } };
}

describe("pass tokens", () => {
  it("verifies genuine tokens and rejects tampering, forgery and expiry", () => {
    const payload = { p: "p1", e: "e1", g: "g1", x: 2, exp: Math.floor(Date.now() / 1000) + 3600, n: "nonce" };
    const token = signPassToken(payload);
    expect(verifyPassToken(token)).toEqual({ valid: true, payload });

    const [v, , sig] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...payload, x: 50 })).toString("base64url");
    expect(verifyPassToken(`${v}.${tampered}.${sig}`)).toMatchObject({ valid: false, reason: "bad_signature" });
    expect(verifyPassToken(signPassToken(payload, "attacker-secret-attacker-secret-attacker"))).toMatchObject({ valid: false, reason: "bad_signature" });
    expect(verifyPassToken(signPassToken({ ...payload, exp: 1 }))).toMatchObject({ valid: false, reason: "expired" });
    expect(verifyPassToken("BIZ-2026-XXXX")).toMatchObject({ valid: false, reason: "malformed" });
  });
});

describe("passes", () => {
  it("issues backend-signed passes and validates them", async () => {
    const t = await setupTenant();
    const { pass } = await issuePass(t, 2);
    expect(pass.passCode).toMatch(/^BIZ-\d{4}-[A-Z0-9]{6}$/);
    expect(pass.signedToken.startsWith("v1.")).toBe(true);
    expect(pass.allowedPax).toBe(3);

    const ok = await t.api.post("/api/v1/passes/validate", { qrData: pass.signedToken });
    expect(ok.body.data.valid).toBe(true);
    const byCode = await t.api.post("/api/v1/passes/validate", { qrData: pass.passCode.toLowerCase() });
    expect(byCode.body.data.valid).toBe(true);
  });

  it("rejects revoked passes and passes of other organizations", async () => {
    const t = await setupTenant();
    const other = await setupTenant();
    const { pass } = await issuePass(t);

    const foreign = await other.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1" });
    expect(foreign.status).toBe(200);
    expect(foreign.body.data).toMatchObject({ success: false, reason: "INVALID_PASS" });

    const revoked = await t.api.post(`/api/v1/passes/${pass.id}/revoke`, { reason: "Lost phone" });
    expect(revoked.body.data.status).toBe("revoked");
    const scan = await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1" });
    expect(scan.body.data).toMatchObject({ success: false, isDuplicate: false, reason: "REVOKED" });
  });

  it("serves the public QR image only for valid signed tokens", async () => {
    const t = await setupTenant();
    const { pass } = await issuePass(t);
    const img = await request(app).get(`/api/v1/passes/qr/${pass.signedToken}.png`);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    const forged = await request(app).get(`/api/v1/passes/qr/${pass.signedToken.slice(0, -2)}xx.png`);
    expect(forged.status).toBe(404);
  });
});

describe("check-in", () => {
  it("admits via QR with the contract response and flags a duplicate scan", async () => {
    const t = await setupTenant("ORGANIZATION_OWNER");
    const { guest, pass } = await issuePass(t, 0);

    const first = await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1", paxCount: 1 });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.data).toMatchObject({ success: true, isDuplicate: false, message: "Admitted 1 guest." });
    expect(first.body.data.guest).toMatchObject({ id: guest.id, allowedPax: 1 });
    expect(first.body.data.record).toMatchObject({ gateId: "gate_1", gateName: "Gate 1 (Main)", paxAdmitted: 1, status: "admitted" });

    const again = await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_2" });
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ success: false, isDuplicate: true });
    expect(again.body.data.message).toMatch(/^Duplicate check-in: Guest was already admitted at .* at Gate 1 \(Main\)\.$/);
    expect(again.body.data.guest.previousCheckInAt).toBeTruthy();

    const passAfter = await t.api.get(`/api/v1/passes/${pass.id}`);
    expect(passAfter.body.data).toMatchObject({ status: "used", admittedPax: 1 });
  });

  it("two simultaneous scans cannot both succeed", async () => {
    const t = await setupTenant();
    const { guest, pass } = await issuePass(t, 0);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: `gate_${i}` }))
    );
    const admitted = results.filter((r) => r.body.data.success);
    expect(admitted).toHaveLength(1);
    expect(results.filter((r) => r.body.data.isDuplicate)).toHaveLength(4);
    const invitation = await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id });
    expect(invitation!.checkedInCount).toBe(1);
    expect(await CheckIn.countDocuments({ organizationId: t.org.id, status: "admitted" })).toBe(1);
  });

  it("admits a family in parts up to the allowance, then flags duplicates", async () => {
    const t = await setupTenant();
    const { guest, pass } = await issuePass(t, 2);
    const part = await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1", paxCount: 2 });
    expect(part.body.data).toMatchObject({ success: true });
    expect((await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id }))!.checkInStatus).toBe("partially_checked_in");

    // Manual check-in of the full party only admits the remaining seat.
    const rest = await t.api.post("/api/v1/check-ins/manual", { guestId: guest.id, gateId: "gate_2", paxCount: 3 });
    expect(rest.body.data).toMatchObject({ success: true, message: "Admitted 1 of 3 requested; allowance is 3." });
    expect((await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id }))!.checkInStatus).toBe("checked_in");

    const over = await t.api.post("/api/v1/check-ins/manual", { guestId: guest.id, gateId: "gate_2", paxCount: 1 });
    expect(over.body.data.isDuplicate).toBe(true);

    const summary = await t.api.get("/api/v1/check-ins/summary");
    expect(summary.body.data).toMatchObject({ checkedInPax: 3 });
    expect(summary.body.data.recentScans.length).toBeGreaterThan(0);
  });

  it("honours single-entry events and supports mobile lookup", async () => {
    const t = await setupTenant();
    const { event, guest, pass } = await issuePass(t, 2, { checkInConfig: { allowMultipleEntries: false, requirePassVerification: true, activeGates: [] } });
    await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1", paxCount: 1 });
    const second = await t.api.post("/api/v1/check-ins/scan", { qrData: pass.signedToken, gateId: "gate_1", paxCount: 1 });
    expect(second.body.data.isDuplicate).toBe(true);

    const lookup = await t.api.get(`/api/v1/check-ins/lookup?eventId=${event.id}&q=${guest.mobile.slice(-6)}`);
    expect(lookup.body.data[0]).toMatchObject({ id: guest.id, alreadyCheckedInPax: 1 });
  });

  it("requires checkin:perform", async () => {
    const t = await setupTenant("READ_ONLY_VIEWER");
    const res = await t.api.post("/api/v1/check-ins/scan", { qrData: "BIZ-2026-ABCDEF", gateId: "gate_1" });
    expect(res.status).toBe(403);
  });
});
