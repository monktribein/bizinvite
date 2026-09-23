# Development

Requirements: **Node.js ≥ 20** and a MongoDB you can reach (Atlas `bizinvite_db`, or a local `mongod`). Nothing
else is needed: background jobs run inside the API process on MongoDB.

```bash
cd backend
npm install
cp .env.example .env          # fill in MONGODB_URI, JWT secrets, QR_SIGNING_SECRET
npm run seed -- --org "Aura Events" --email owner@example.com --password 'Change-Me-123' --name "Owner"
npm run dev                   # API + job scheduler with reload on http://localhost:4000
```

Check it: `GET http://localhost:4000/health` shows `mongodb: "up"` and `scheduler.state: "running"`, and
`GET /ready` returns 200.

Point the frontend at the API: in `frontend/.env.local` set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` and
`NEXT_PUBLIC_USE_MOCK_API=false`.

Without WhatsApp credentials the backend runs in **dry-run** mode (messages are logged, not sent). Create a test
template with `POST /api/v1/templates` (dry-run only) to exercise campaigns and reminders.

## Production

```bash
npm ci
npm run build
npm start                     # API + scheduler (node dist/server.js)
```

Run it under any Node process manager (systemd, a PaaS, …) that restarts it on exit and sends SIGTERM on stop.
Optionally run background work in its own process: start API instances with `SCHEDULER_ENABLED=false` and one or
more `npm run start:worker` processes. See [SCHEDULER_ARCHITECTURE.md](SCHEDULER_ARCHITECTURE.md).

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | API and scheduler via `tsx watch` |
| `npm run worker` | Scheduler only, without HTTP (optional; `tsx`) |
| `npm run build` | TypeScript → `dist/` |
| `npm start` | Production API and scheduler (`node dist/server.js`) |
| `npm run start:worker` | Production scheduler-only process (`node dist/worker.js`) |
| `npm run lint` | ESLint (typescript-eslint) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run seed` | First organization and owner, or `--super-admin` |

## Tests

`npm test` starts an in-memory MongoDB (`mongodb-memory-server`; the binary is downloaded on first run). Background
jobs are real `scheduledJobs` documents: tests run them with `runDueJobs(now)`, which claims and runs due jobs
through the same runner the scheduler uses. Passing `now` lets tests run jobs "at" a given time (quiet hours,
scheduled campaigns, retry backoff). WhatsApp runs in dry-run mode.

| File | Covers |
|------|--------|
| `auth.test.ts` | login shape, hashing, uniform 401s, validation errors, `/me`, refresh rotation and reuse detection, logout, immediate suspension |
| `rbac-tenant.test.ts` | role matrix, per-role access, role escalation, **Organization A cannot read or modify Organization B**, header/body tenant spoofing, super-admin access, tenant guard |
| `events-guests.test.ts` | event CRUD with sessions and validation, guest CRUD, mobile normalization, duplicate detection, denormalized sync, filters |
| `imports.test.ts` | CSV preview (mapping, issues, duplicates), commit (skip/overwrite, consent, counts), large files as an `import.commit` job, file validation, permissions |
| `campaigns-webhooks.test.ts` | template approval gate, dispatch job (no sending in the request), batching, suppression, pause/resume, scheduling, webhook verification, signature, **idempotent quick reply**, forged payloads, STOP, forward-only statuses, RSVP rules |
| `reminders.test.ts` | every stop condition, timing, quiet hours, default of 3 attempts, approval, idempotent planning, the recurring planner job, stop on response (eagerly and at execution), max-attempt cap, stops on opt-out, suppression and cancellation |
| `scheduler.test.ts` | dedupeKey, **concurrent claims**, retry with backoff and final failure, stale-lock recovery, poison jobs, lost locks, cancellation, the live scheduler loop |
| `passes-checkins.test.ts` | token tamper/forgery/expiry, pass validation, revocation, cross-tenant scan, public QR, duplicate scan, **concurrent scans**, partial parties, single-entry events, lookup |
| `reports-health.test.ts` | reports, CSV/XLSX export, formula-injection escaping, health/ready, error envelope, headers, database-name guard |

## Conventions

- One folder per module: `model.ts`, `schema.ts` (zod), `service.ts`, `controller.ts`, `routes.ts`, plus helpers
  where they earn their place.
- Services take an `ActorContext`; every tenant query includes `organizationId` (the tenant guard enforces it).
- Throw `Errors.*` from `common/errors/app-error.ts`; never send ad-hoc error bodies.
- Record significant changes with `recordAudit`.
- Background work: add a job type to `scheduler/model.ts`, a processor in `scheduler/processors/`, and enqueue it
  with `enqueueJob` using a deterministic `dedupeKey`. Processors must be safe to run more than once.
