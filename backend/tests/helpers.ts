import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createApp } from "../src/app";
import { REQUIRED_DB_NAME } from "../src/config/env";
import type { Role } from "../src/common/constants/roles";
import type { ActorContext } from "../src/common/utils/context";
import { hashPassword } from "../src/modules/auth/password";
import { Organization } from "../src/modules/organizations/model";
import { Template } from "../src/modules/templates/model";
import { Membership, User } from "../src/modules/users/model";
import type { JobType } from "../src/scheduler/model";
import { ScheduledJob } from "../src/scheduler/model";
import { CROSS_TENANT } from "../src/common/utils/model";

export const PASSWORD = "Test-Passw0rd-123";
export const app = createApp();

/** Jobs of one type stored in scheduledJobs (tests only: reads across tenants). */
export function jobsOfType(type: JobType) {
  return ScheduledJob.find({ type }).setOptions(CROSS_TENANT).sort({ createdAt: 1 });
}

/** Connects to the shared in-memory MongoDB and wipes data between tests. */
export function useTestDatabase() {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(inject("mongoUri"), { dbName: REQUIRED_DB_NAME });
      await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    }
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
}

let seq = 0;

export async function createOrganization(name = `Org ${++seq}`) {
  return Organization.create({ name, slug: `org-${Date.now()}-${++seq}` });
}

export async function createUser(organizationId: string, role: Role, overrides: { email?: string; name?: string } = {}) {
  const email = overrides.email ?? `user${++seq}@example.com`;
  const user = await User.create({
    email,
    name: overrides.name ?? `User ${seq}`,
    passwordHash: await hashPassword(PASSWORD),
    status: "active",
    ...(role === "PLATFORM_SUPER_ADMIN" ? { platformRole: "PLATFORM_SUPER_ADMIN" } : { defaultOrganizationId: organizationId }),
  });
  if (role !== "PLATFORM_SUPER_ADMIN") {
    await Membership.create({ organizationId, userId: user._id, role, status: "active" });
  }
  return user;
}

export async function login(email: string, organizationId?: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD, organizationId });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { user: { id: string; organizationId: string; role: Role }; tokens: { accessToken: string; refreshToken: string } };
}

/** An organization with one user of the given role, logged in. */
export async function setupTenant(role: Role = "ORGANIZATION_OWNER") {
  const org = await createOrganization();
  const user = await createUser(org.id, role);
  const session = await login(user.email);
  const token = session.tokens.accessToken;
  const actor: ActorContext = { organizationId: org.id, userId: user.id, userName: user.name, userRole: role };
  return {
    org,
    user,
    token,
    actor,
    api: {
      get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body ?? {}),
      patch: (url: string, body?: object) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body ?? {}),
      delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
      /** Multipart request (no JSON body). */
      upload: (url: string) => request(app).post(url).set("Authorization", `Bearer ${token}`),
    },
  };
}

export type Tenant = Awaited<ReturnType<typeof setupTenant>>;

export function eventPayload(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * 86400000);
  return {
    name: "Sharma & Verma Grand Wedding",
    category: "wedding",
    status: "upcoming",
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 2 * 86400000).toISOString(),
    rsvpDeadline: new Date(start.getTime() - 10 * 86400000).toISOString(),
    venue: { name: "Taj Aravali Resort & Spa", address: "1 Kotiya", city: "Udaipur" },
    checkInConfig: { allowMultipleEntries: true, requirePassVerification: true, activeGates: ["Gate 1 (Main)", "Gate 2"] },
    ...overrides,
  };
}

export async function createEvent(tenant: Tenant, overrides: Record<string, unknown> = {}) {
  const res = await tenant.api.post("/api/v1/events", eventPayload(overrides));
  if (res.status !== 201) throw new Error(`event create failed: ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; sessions: Array<{ id: string }> };
}

export async function createGuest(tenant: Tenant, eventId: string, overrides: Record<string, unknown> = {}) {
  const res = await tenant.api.post("/api/v1/guests", {
    eventId,
    name: `Guest ${++seq}`,
    mobile: `98${String(10000000 + seq).slice(-8)}`,
    category: "General",
    allowedCompanions: 1,
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`guest create failed: ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; contactId: string; mobile: string; name: string };
}

export async function createApprovedTemplate(organizationId: string, overrides: Record<string, unknown> = {}) {
  return Template.create({
    organizationId,
    source: "local",
    name: `wedding_invite_${++seq}`,
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    bodyText: "Dear {{1}}, you are invited to {{2}} on {{3}}.",
    variables: ["guest_name", "event_name", "event_date"],
    buttons: [
      { type: "QUICK_REPLY", text: "Yes, attending", payload: "ACTION_RSVP_YES" },
      { type: "QUICK_REPLY", text: "Regretfully no", payload: "ACTION_RSVP_NO" },
    ],
    ...overrides,
  });
}
