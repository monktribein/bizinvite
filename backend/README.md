# BizInvite backend

REST API and background job scheduler for **BizInvite™ — Event Invitation, RSVP & Reminder Automation Platform**.

Node.js · TypeScript · Express 5 · MongoDB Atlas (`bizinvite_db`) · Mongoose · WhatsApp Business Cloud API.
A modular monolith: one Node.js process serves the API and runs background jobs (campaigns, reminders, imports,
exports, webhook processing) from a MongoDB-backed scheduler. It needs only Node.js and MongoDB. Standalone: no
dependency on any other product.

## Quick start

```bash
cd backend
npm install
cp .env.example .env     # set MONGODB_URI (bizinvite_db), JWT secrets, QR_SIGNING_SECRET
npm run seed -- --org "My Org" --email owner@example.com --password 'Change-Me-123' --name "Owner"
npm run dev              # API + scheduler → http://localhost:4000  (GET /health, GET /ready)
```

Production:

```bash
npm run build
npm start                # API + scheduler
```

Optional: `npm run start:worker` runs the scheduler without HTTP, for deployments that keep background work off API
instances (`SCHEDULER_ENABLED=false` on those).

Checks: `npm run lint`, `npm run typecheck`, `npm test`.

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/API.md](docs/API.md) | Every endpoint, permission and contract clarification |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, request pipeline, tenancy, auth, idempotency |
| [docs/DATABASE.md](docs/DATABASE.md) | Collections and indexes |
| [docs/SCHEDULER_ARCHITECTURE.md](docs/SCHEDULER_ARCHITECTURE.md) | MongoDB job scheduler: locking, retries, duplicate prevention, lifecycle, campaign and reminder flows |
| [docs/WHATSAPP.md](docs/WHATSAPP.md) | Cloud API, templates, webhooks |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Environment variables |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, scripts, tests |

The API contract consumed by the frontend is [`../frontend/docs/API_CONTRACT.md`](../frontend/docs/API_CONTRACT.md).
