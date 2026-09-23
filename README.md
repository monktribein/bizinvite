# BizInvite™

**Event Invitation, RSVP & Reminder Automation Platform**: a standalone multi-tenant SaaS for invitations, guest
management, RSVP collection, WhatsApp reminders, digital passes, QR check-in and reporting.

```
BizInvite/
├── frontend/        Next.js organizer dashboard                      → frontend/README.md
├── backend/         Express API + MongoDB-backed job scheduler      → backend/README.md
├── infrastructure/  Deployment notes                                 → infrastructure/README.md
└── docs/            Index of project documentation
```

Frontend and backend are independent projects, each with its own `package.json`, and are run separately.

## Run locally

Requirements: Node.js ≥ 20 and a MongoDB Atlas database `bizinvite_db` (or a local MongoDB).

```bash
# Backend: API and background jobs in one process (see backend/docs/DEVELOPMENT.md)
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (second terminal)
cd frontend && npm install && npm run dev
# frontend/.env.local:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
#   NEXT_PUBLIC_USE_MOCK_API=false
```

The frontend only talks to the backend over HTTP. MongoDB, WhatsApp and S3 are reachable only from the backend.
