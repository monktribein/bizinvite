# Architecture

BizInvite's backend is a **modular monolith**: one Node.js process runs the Express API and a **MongoDB-backed job
scheduler**. It is fully standalone: its own MongoDB database (`bizinvite_db`) and the official WhatsApp Cloud API.
It needs Node.js and MongoDB only; `npm run dev` (or `npm start` in production) runs everything.

```
 frontend (Next.js) ──HTTPS/JSON──▶ ┌─ Node.js process (src/server.ts) ───────────────────────────┐
                                    │  API: auth → tenant → RBAC → controller → service → Mongoose │
 Meta WhatsApp Cloud API ─webhook─▶ │        │ enqueueJob()                                         │
                                    │        ▼                                                     │
                                    │  scheduledJobs ◀── claim / result ── Scheduler (src/scheduler)│
                                    │                                        │ campaign · reminder  │
                                    │                                        │ whatsapp · import ·  │
                                    │                                        │ report processors    │
                                    └────────────────────────────────────────┼─────────────────────┘
                                          MongoDB bizinvite_db               └──▶ WhatsApp Cloud API, S3
```

## Layout

```
src/
  config/        env validation, MongoDB, WhatsApp settings
  common/        errors, constants (roles, enums), validators, utils (logger, tenant guard, crypto, time, storage)
  middleware/    request-id, auth, tenant, rbac, rate-limit, error-handler
  modules/<name>/ model · schema (zod) · service · controller · routes (+ repository/helpers where useful)
  scheduler/     scheduledJobs model, enqueue API, atomic job locking, runner, polling loop, processors/
  routes/        API router and health endpoints
  app.ts         Express app factory
  server.ts      API + scheduler entry point
  worker.ts      optional scheduler-only entry point (no HTTP)
```

Controllers only parse input (zod) and shape responses. Business rules live in services. Services receive an
`ActorContext` (organization, user, role, request id), never the Express request.

## Request pipeline

1. `requestId`: accepts a well-formed `X-Request-Id` or generates one; echoed on the response and in logs.
2. `pino-http`: structured logs; the path is logged without the query string, and auth headers are redacted.
3. `helmet`, CORS allow-list (`CORS_ORIGIN`), JSON body ≤ 1 MB (raw body kept for webhook signatures).
4. Rate limits: 600 requests/min per IP overall; 20 per 15 min per IP and email on credential endpoints; 120/min on gate scans.
5. `authenticate`: verifies the HS256 access JWT, then **reloads the user and membership** so suspensions and role
   changes apply immediately. The role never comes from the token.
6. `resolveTenant`: the organization comes from the session. A mismatched `X-Organization-Id` or body
   `organizationId` is rejected. Platform super admins may target another tenant with `X-Organization-Id` (logged).
7. `requirePermission` / `requireAnyPermission`: centralized RBAC (`common/constants/roles.ts`, mirroring the frontend matrix).
8. Central `errorHandler`: maps AppError/Zod/Mongoose/Multer errors to the standard envelope; no stack traces in production.

## Multi-tenancy

- Every tenant-owned document has `organizationId`, and every service query filters on it.
- **Tenant guard** (`common/utils/model.ts`): a Mongoose plugin on every tenant model throws if a find, update,
  count or delete runs without an `organizationId` filter. The only exceptions are explicit
  `.setOptions({ skipTenantGuard: true })` calls: webhook routing by WhatsApp message id, the reminder planner
  scanning active rules, and the scheduler claiming jobs. Each of these re-derives the organization from the stored record.
- Cross-tenant ids are indistinguishable from missing ids (`404`), so ids from other organizations leak nothing.

## Roles

`PLATFORM_SUPER_ADMIN` is a user-level flag (`users.platformRole`) that cannot be granted through the API. The six
organization roles live in the `roles` collection (one document per user and organization). A user can belong to
several organizations. Login picks the default organization or the requested one, and `/auth/switch-organization`
issues tokens for another membership. Users can only grant roles at or below their own rank.

## Authentication

- Passwords: bcrypt, cost 12, with a policy of at least 10 characters mixing upper-case, lower-case and digits.
  Unknown emails still run a bcrypt compare, so timing does not reveal which emails exist.
- Access token: JWT (default 15 min). Refresh token: JWT (default 30 days), stored only as a SHA-256 hash and
  rotated on every refresh. Tokens from one login share a `familyId`: reusing a rotated token revokes the whole family.
- Logout, password change and membership suspension revoke refresh tokens. A password change also invalidates
  earlier access tokens.

## Background work

The API never sends WhatsApp messages inside a request, except the explicit campaign test send. Campaign fan-out,
reminders, pass delivery, webhook processing, large imports and large exports all run as `scheduledJobs` in the
MongoDB-backed scheduler. See [SCHEDULER_ARCHITECTURE.md](SCHEDULER_ARCHITECTURE.md).

## Key correctness mechanisms

| Concern | Mechanism |
|---------|-----------|
| Duplicate job / reminder | unique `scheduledJobs.dedupeKey` (reminders: `reminder:rule:guest:attempt`) + atomic `findOneAndUpdate` job claim |
| Duplicate campaign message | unique (`campaignId`, `eventGuestId`) recipient + atomic claim before sending |
| Duplicate webhook action | unique `webhookEvents.dedupeKey` + atomic claim before processing |
| Double check-in | compare-and-set update on `checkedInCount` with retry |
| Double import commit | atomic `previewed → pending` transition |
| Status regression (late "delivered" after "read") | updates only apply from earlier states |

## Deliberately out of scope (MVP)

AI concierge, seating, rooms, transport scheduling, payments, vendor marketplace, white-labeling, workflow canvas,
SMS fallback (the `fallbackChannel` field is stored but not sent) and email delivery of invitations to staff.
