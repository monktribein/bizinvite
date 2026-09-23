import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, createOrganization, createUser, login, PASSWORD, setupTenant, useTestDatabase } from "./helpers";
import { RefreshToken } from "../src/modules/auth/model";
import { User } from "../src/modules/users/model";

useTestDatabase();

describe("auth", () => {
  it("logs in with the contract response shape and never returns the password hash", async () => {
    const org = await createOrganization("Aura Events");
    const user = await createUser(org.id, "ORGANIZATION_OWNER", { email: "owner@aura.test", name: "Kabir" });

    const res = await request(app).post("/api/v1/auth/login").send({ email: "OWNER@aura.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      id: user.id,
      email: "owner@aura.test",
      name: "Kabir",
      role: "ORGANIZATION_OWNER",
      organizationId: org.id,
      organizationName: "Aura Events",
    });
    expect(res.body.data.tokens).toMatchObject({ expiresIn: 900 });
    expect(typeof res.body.data.tokens.accessToken).toBe("string");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(res.body.meta.requestId).toBeTruthy();
  });

  it("stores passwords only as bcrypt hashes", async () => {
    const org = await createOrganization();
    const user = await createUser(org.id, "ORGANIZATION_OWNER");
    const stored = await User.findById(user.id).select("+passwordHash");
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored!.passwordHash).not.toContain(PASSWORD);
  });

  it("rejects wrong passwords and unknown users with the same 401", async () => {
    const org = await createOrganization();
    const user = await createUser(org.id, "ORGANIZATION_OWNER");
    const wrong = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: "nope-nope-nope" });
    const unknown = await request(app).post("/api/v1/auth/login").send({ email: "ghost@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 422 with field errors for invalid input", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.email).toBeDefined();
    expect(res.body.error.fields.password).toBeDefined();
  });

  it("returns the current user from /me and requires a bearer token", async () => {
    const t = await setupTenant("GUEST_MANAGER");
    const me = await t.api.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: t.user.id, role: "GUEST_MANAGER", organizationId: t.org.id });
    expect(me.body.data.permissions).toContain("guests:manage");

    const anonymous = await request(app).get("/api/v1/auth/me");
    expect(anonymous.status).toBe(401);
    const garbage = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer not-a-jwt");
    expect(garbage.status).toBe(401);
  });

  it("rotates refresh tokens and revokes the whole family on reuse", async () => {
    const org = await createOrganization();
    const user = await createUser(org.id, "ORGANIZATION_OWNER");
    const session = await login(user.email);

    const first = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.tokens.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(session.tokens.refreshToken);

    // Presenting the rotated token again is treated as theft.
    const reuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.tokens.refreshToken });
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: first.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
    expect(await RefreshToken.countDocuments({ userId: user._id, revokedAt: null })).toBe(0);
  });

  it("logout revokes the session's refresh tokens", async () => {
    const org = await createOrganization();
    const user = await createUser(org.id, "ORGANIZATION_OWNER");
    const session = await login(user.email);
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${session.tokens.accessToken}`)
      .send({ refreshToken: session.tokens.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe("Logged out successfully");
    const refresh = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.tokens.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("blocks suspended members immediately, even with a valid access token", async () => {
    const t = await setupTenant("EVENT_ADMINISTRATOR");
    const { Membership } = await import("../src/modules/users/model");
    await Membership.updateOne({ organizationId: t.org._id, userId: t.user._id }, { $set: { status: "suspended" } });
    const res = await t.api.get("/api/v1/events");
    expect(res.status).toBe(401);
  });
});
