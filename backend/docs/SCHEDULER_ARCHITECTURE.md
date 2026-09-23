# Scheduler architecture

Background work is stored in MongoDB and run by a small in-process scheduler. There is no separate queue server or
message broker: the backend needs only Node.js and MongoDB (`bizinvite_db`).

```
HTTP request / webhook / planner ──enqueueJob()──▶ scheduledJobs (MongoDB)
                                                        ▲   │ atomic claim (findOneAndUpdate)
                                                        │   ▼
                                  result / retry /   Scheduler (inside the API process, or `npm run worker`)
                                  reschedule ────────── runJob() → processor → WhatsApp Cloud API, S3, MongoDB
```

Code: `src/scheduler/`

| File | Role |
|------|------|
| `model.ts` | `scheduledJobs` schema, job types and statuses, indexes |
| `jobs.ts` | `enqueueJob`, `cancelPendingJobs`, and the processor result helpers (`completed`, `rescheduled`, `cancelled`, `failed`) |
| `job-lock.ts` | `claimNextJob` (atomic claim) and `releaseJob` (write the result only while holding the lock) |
| `job-runner.ts` | `runJob`: calls the processor and applies the outcome, with retry and backoff. `runDueJobs` is used by tests. |
| `scheduler.ts` | the polling loop, concurrency, wake-on-enqueue, recurring jobs, start and stop |
| `processors/` | one processor per job type: campaign, reminder, whatsapp, import, report |

## Job document (`scheduledJobs`)

| Field | Meaning |
|-------|---------|
| `organizationId` | Tenant. Absent only for system jobs (`reminder.plan`, `whatsapp.process-webhook`). |
| `type` | Job type (see below) |
| `status` | `pending` → `running` → `completed` / `failed` / `cancelled` |
| `runAt` | Earliest time the job may run |
| `attempts` / `maxAttempts` | Executions started so far (incremented on every claim) and the retry limit |
| `lockedAt` / `lockedBy` | Set while running; `lockedBy` identifies the process (`host:pid:random`) |
| `payload` | Job input (ids only; processors reload and re-check everything from the database) |
| `result` / `lastError` | Last result, or last error message (no secrets, truncated to 500 characters) |
| `dedupeKey` | Unique. A second enqueue with the same key is ignored. |
| `cancelReason`, `completedAt`, `deferrals` | Bookkeeping; `deferrals` counts reschedules without a failure |
| `expiresAt` | Set when a job finishes; a TTL index deletes it 7 days later. Never set on `reminder.send`, which is the reminder history. |
| `eventId`, `ruleId`, `eventGuestId`, `guestId`, `attempt`, `messageId`, `executedAt` | `reminder.send` references. `attempt` is the reminder number for that rule and guest (1…`maximumAttempts`), not the execution count. |

Indexes: `{status, runAt}` (claiming due jobs), `{status, lockedAt}` (reclaiming stale locks), `{dedupeKey}` unique,
`{expiresAt}` TTL, and three reminder indexes (`{organizationId, eventGuestId, status}`,
`{organizationId, ruleId, eventGuestId}` and `{organizationId, eventId, type, status}`).

## Job types

| Type | Created by | dedupeKey | maxAttempts |
|------|------------|-----------|-------------|
| `campaign.dispatch` | campaign create, send, schedule change, resume | `campaign:<id>:<generation>` | 5 |
| `reminder.plan` | the scheduler at startup (singleton, recurring) | `system:reminder.plan` | 3 (it never fails; see below) |
| `reminder.send` | the reminder planner | `reminder:<rule>:<eventGuest>:<attempt>` | 3 |
| `whatsapp.send-pass` | `POST /passes/:id/resend` | `pass-send:<pass>:<minute>` | 3 |
| `whatsapp.process-webhook` | `POST /webhooks/whatsapp` | `webhook:<webhookEvent>` | 5 |
| `import.commit` | CSV commits over 500 rows | `import:<import>` | 3 |
| `report.export` | `POST /reports/:type/exports` | random | 2 |

## Locking and duplicate prevention

**Claiming.** One `findOneAndUpdate` both selects and locks a job:

```js
filter: { $or: [ { status: "pending", runAt: { $lte: now } },
                 { status: "running", lockedAt: { $lt: now - 15 min } } ] }   // stale lock
update: { $set: { status: "running", lockedAt: now, lockedBy: WORKER_ID }, $inc: { attempts: 1 } }
sort:   { runAt: 1 }
```

MongoDB applies this atomically to a single document. Two processes, or two loops in one process, can never both
receive the same job. `tests/scheduler.test.ts` fires 8 concurrent claims at one job and checks that exactly one wins.

**Releasing.** The result is written only if the job is still `running` with the same `lockedBy` and `lockedAt`. A
process that lost its lock (a stale job reclaimed elsewhere) cannot overwrite the new owner's state.

**Duplicate business effects** are prevented in the domain, not only by the lock:

| Risk | Guard |
|------|-------|
| Same job enqueued twice | unique `dedupeKey` |
| Same reminder planned twice | `dedupeKey` `reminder:<rule>:<guest>:<attempt>` |
| Reminder re-sent after a crash mid-send | on a re-run, a `Message` already linked to the job marks it sent |
| Campaign message sent twice | unique (`campaignId`, `eventGuestId`) recipient + atomic per-recipient claim (`claimedAt`) |
| Campaign crash mid-send | a claim older than 15 minutes is marked failed ("delivery unknown") rather than re-sent |
| Webhook applied twice | unique `webhookEvents.dedupeKey` + atomic claim on the webhook event |
| Stale campaign job after pause or schedule change | `dispatchGeneration` in the payload; an older generation is cancelled |

## Retry behaviour

A processor either returns an outcome or throws:

| Processor result | New state |
|------------------|-----------|
| `completed(result)` | `completed` |
| `rescheduled(runAt)` | `pending` at `runAt`, `attempts` reset to 0, `deferrals + 1` (no failure counted) |
| `cancelled(reason)` | `cancelled` with `cancelReason` |
| `failed(error)` | `failed`, with no retry (permanent: invalid number, unapproved template, …) |
| throws | retried: `pending` at `now + backoff` with `lastError`; `failed` once `attempts` reaches `maxAttempts` |

Backoff is exponential: 15 s, 30 s, 60 s, …, capped at 30 minutes. A job whose runs keep dying (the process crashes
each time, so the lock goes stale) is claimed again until `attempts` exceeds `maxAttempts`. It is then marked failed
without running, so a poison job cannot crash-loop the process.

## Scheduler lifecycle

- **Start.** `npm run dev` / `npm start` connect to MongoDB and then start the scheduler before the API listens
  (`src/server.ts`). At start it upserts the recurring `reminder.plan` job, reviving it if it ever ended.
- **Loop.** Every 2 s, and immediately whenever a due job is enqueued in this process, the scheduler claims and runs
  jobs until 4 are running or none are due. When a job finishes it looks for the next one right away, so a backlog
  drains without waiting for the poll.
- **MongoDB outage.** A failed poll is logged at `warn` and retried at the next tick. Running jobs fail and are
  retried with backoff.
- **Stop.** On SIGTERM/SIGINT the HTTP server closes, the scheduler stops claiming, and running jobs get up to 10 s to
  finish before MongoDB disconnects. A job still running at exit keeps its lock and is reclaimed after 15 minutes.
- **Several processes.** Any number of API instances can run the scheduler against the same database; the atomic
  claim keeps each job in exactly one of them. To keep background work off API instances, run them with
  `SCHEDULER_ENABLED=false` and start `npm run start:worker` (the scheduler without HTTP) separately.
- **Health.** `GET /health` includes `scheduler: { state, activeJobs, lastPollAt }` for this process (`disabled` when
  `SCHEDULER_ENABLED=false`).

## Campaign flow

```
POST /campaigns ──▶ campaign.dispatch job (runAt = scheduledFor or now)
  run 1: recipients inserted once (unique campaignId+eventGuestId);
         opted-out / suppressed / invalid numbers → "suppressed"
  each run: take up to 50 pending recipients, send 5 at a time
    ├─ atomic claim per recipient (status pending, no claimedAt) → at most one send
    ├─ re-check opt-out, suppression, invitation, event, template
    └─ sent → "sent"; permanent error → "failed";
       transient → claim released and retried in a later batch (after 3 transient failures → "failed")
  recipients left → rescheduled now (next batch); transient errors → rescheduled in 30 s
  none left → campaign "completed", job completed
```

Pause, resume, cancel and schedule changes increment `dispatchGeneration`. A job from an older generation cancels
itself on its next run, and pending ones are cancelled when a new generation is enqueued. Resume enqueues a new job
that sends whatever is still pending. Nothing is sent inside the HTTP request.

## Reminder engine

```
reminder.plan (singleton, every 60 s)
  for each active rule whose event is live:
    firstRunAt = anchor (RSVP deadline / event start / session start / scheduledAt) + offset
    for each guest in the audience (RSVP statuses, categories, VIP, session):
      attempt = nextDueAttempt(attempts so far, max, repeat interval, last attempt time)
      enqueue reminder.send { dedupeKey: reminder:rule:guest:attempt }   ← unique: planned once, ever
  → rescheduled for +60 s (a planning error is logged and the planner still reschedules)

reminder.send
  re-run after a crash and a Message already exists? → completed (no second send)
  stop condition?            → cancelled (reason); invitation reminderStatus updated
  quiet hours (event tz)?    → rescheduled to the end of quiet hours
  template not approved      → failed
  send → completed (executedAt, messageId); invitation reminderStatus "sent"
  permanent WhatsApp error   → failed; invalid-number codes mark the mobile invalid
  transient error            → retried with backoff (3 executions), then failed
  final attempt sent         → audit "reminder.max_attempts_reached" or "reminder.escalation_required"
```

Stop conditions (`reminder-rules/stop-conditions.ts`, unit tested): event cancelled or over; rule not active; guest
opted out; organizer suppressed communication; mobile invalid; an earlier attempt failed permanently; invitation
cancelled; guest no longer in the audience (for example, responded); maximum attempts reached (default **3**).

Stopping is also eager. RSVP responses, opt-outs, suppression, invalid numbers, rule pauses and event cancellation
call `cancelPendingJobs`, which marks the guest's pending `reminder.send` jobs `cancelled` with the reason. A job
that is already running re-checks every stop condition before sending.

Reminder statistics read `reminder.send` jobs: `completed` = sent, `cancelled` = suppressed, `failed` = failed. A
later WhatsApp "failed" delivery status turns a completed attempt into `failed`.

## Imports, exports, passes and webhooks

- Imports of 500 rows or fewer are committed inside the request. Larger imports return `202` and run as an
  `import.commit` job in 500-row chunks with idempotent bulk upserts.
- `GET /reports/:type/export` streams CSV/XLSX directly. `POST /reports/:type/exports` returns `202 { jobId }` (the
  job's id). The `report.export` job uploads the file to S3, and `GET /reports/exports/:jobId` returns
  `status` (`queued`, `running`, `completed`, `failed`) and, when completed, a 15-minute signed URL.
- `POST /passes/:id/resend` enqueues `whatsapp.send-pass` (at most one per pass per minute).
- `POST /webhooks/whatsapp` verifies the signature, stores each item once in `webhookEvents` and enqueues one
  `whatsapp.process-webhook` job per new item, then answers Meta with 200 immediately.
