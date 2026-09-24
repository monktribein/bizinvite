import request from "supertest";
import { describe, expect, it } from "vitest";
import { Membership } from "../src/modules/users/model";
import { app, createOrganization, createUser, setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

async function loginWith(email: string, password: string) {
  return request(app).post("/api/v1/auth/login").send({ email, password });
}

describe("organization team routes", () => {
  it("adds a member with a password who can sign in immediately", async () => {
    const t = await setupTenant();
    const res = await t.api.post(`/api/v1/organizations/${t.org.id}/team`, { name: "Gate Staff", email: "gate@example.com", role: "CHECK_IN_EXECUTIVE", password: "abc" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Gate Staff", email: "gate@example.com", role: "CHECK_IN_EXECUTIVE", status: "active" });
    expect((await loginWith("gate@example.com", "abc")).status).toBe(200);
  });

  it("edits name, role, status and resets the password", async () => {
    const t = await setupTenant();
    const member = await createUser(t.org.id, "GUEST_MANAGER");
    const res = await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${member.id}`, {
      name: "Renamed",
      role: "EVENT_ADMINISTRATOR",
      status: "active",
      password: "admin123",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Renamed", role: "EVENT_ADMINISTRATOR" });
    expect((await loginWith(member.email, "admin123")).status).toBe(200);

    // Editing your own name without touching role/status is allowed (the screen sends both unchanged)
    const self = await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${t.user.id}`, { name: "Kushal", role: "ORGANIZATION_OWNER", status: "active" });
    expect(self.status).toBe(200);
    expect(self.body.data.name).toBe("Kushal");
    // Actually demoting or suspending yourself is still refused
    expect((await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${t.user.id}`, { role: "READ_ONLY_VIEWER" })).status).toBe(403);
    expect((await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${t.user.id}`, { status: "suspended" })).status).toBe(403);
  });

  it("activates an invited account when an admin sets its password", async () => {
    const t = await setupTenant();
    const invited = await t.api.post(`/api/v1/organizations/${t.org.id}/team`, { name: "New", email: "new@example.com", role: "READ_ONLY_VIEWER" });
    expect(invited.body.data.status).toBe("invited");
    const res = await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${invited.body.data.id}`, { password: "pw" });
    expect(res.body.data.status).toBe("active");
    expect((await loginWith("new@example.com", "pw")).status).toBe(200);
  });

  it("refuses to reset the password of a user who also belongs to another organization", async () => {
    const t = await setupTenant();
    const member = await createUser(t.org.id, "GUEST_MANAGER");
    const other = await createOrganization();
    await Membership.create({ organizationId: other.id, userId: member.id, role: "ORGANIZATION_OWNER", status: "active" });
    const res = await t.api.patch(`/api/v1/organizations/${t.org.id}/team/${member.id}`, { password: "hijack" });
    expect(res.status).toBe(403);
  });

  it("removes members but never yourself, and only within your organization", async () => {
    const t = await setupTenant();
    const member = await createUser(t.org.id, "GUEST_MANAGER");
    expect((await t.api.delete(`/api/v1/organizations/${t.org.id}/team/${t.user.id}`)).status).toBe(403);

    const other = await setupTenant();
    expect((await other.api.delete(`/api/v1/organizations/${t.org.id}/team/${member.id}`)).status).toBe(403);

    expect((await t.api.delete(`/api/v1/organizations/${t.org.id}/team/${member.id}`)).status).toBe(200);
    const team = await t.api.get(`/api/v1/organizations/${t.org.id}/team`);
    expect(team.body.data.map((m: { id: string }) => m.id)).not.toContain(member.id);
  });
});
