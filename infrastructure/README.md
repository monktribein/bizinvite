# BizInvite infrastructure

Deployment notes. Application code lives in `../backend` and `../frontend`.

The backend runs directly on Node.js (≥ 20). Its only external dependency is MongoDB; WhatsApp Cloud API and S3 are
called over HTTPS.

## Backend

```bash
cd backend
npm ci
npm run build
npm start          # API + MongoDB-backed job scheduler (node dist/server.js)
```

- Run `npm start` under a process manager or platform that restarts it on exit and sends SIGTERM on shutdown (the
  API then stops accepting requests and lets running jobs finish for up to 10 s).
- **Scaling.** Any number of instances may run the scheduler against the same database; jobs are claimed atomically
  in MongoDB, so each job runs once. To keep background work off API instances, set `SCHEDULER_ENABLED=false` on them
  and run one or more `npm run start:worker` processes. See `backend/docs/SCHEDULER_ARCHITECTURE.md`.
- **MongoDB.** Atlas database `bizinvite_db`, user `bizinvite_app` with `readWrite@bizinvite_db` only. Allow the
  servers' egress IPs in the Atlas network access list.
- Put the API behind a TLS-terminating proxy or load balancer. `app.set("trust proxy", 1)` assumes exactly one proxy hop.
- Use `/ready` for readiness (503 until MongoDB is connected) and `/health` for liveness and dashboards.
- The WhatsApp webhook (`POST /api/v1/webhooks/whatsapp`) must be reachable from Meta over HTTPS.
- Secrets come from the environment (see `backend/docs/ENVIRONMENT.md`); never commit them.
