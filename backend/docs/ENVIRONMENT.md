# Environment variables

Copy `backend/.env.example` to `backend/.env`. `.env` files are git-ignored; never commit real values.
Configuration is validated at startup (`src/config/env.ts`); the process exits with a list of problems if anything
is invalid. The only external service the backend needs is MongoDB; the minimum `.env` is `MONGODB_URI`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `QR_SIGNING_SECRET` (plus the WhatsApp variables in production).

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | | `development` | `development`, `test` or `production` |
| `PORT` | | `4000` | API port |
| `API_PREFIX` | | `/api/v1` | |
| `MONGODB_URI` | yes | | Must target `bizinvite_db` (for example `mongodb+srv://bizinvite_app:<pw>@<host>/bizinvite_db?retryWrites=true&w=majority`). Any other database name is rejected. |
| `JWT_ACCESS_SECRET` | yes | | ≥ 32 characters |
| `JWT_REFRESH_SECRET` | yes | | ≥ 32 characters, different from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | | `15m` | `s`/`m`/`h`/`d` suffix or seconds |
| `JWT_REFRESH_EXPIRES_IN` | | `30d` | |
| `SCHEDULER_ENABLED` | | `true` | Run the MongoDB-backed job scheduler in this process. Set `false` only on API instances when a separate `npm run start:worker` process runs it. |
| `CORS_ORIGIN` | | `http://localhost:3000` | Comma-separated browser origins |
| `WHATSAPP_API_VERSION` | | `v21.0` | |
| `WHATSAPP_ACCESS_TOKEN` | production | | Empty outside production = dry-run sender |
| `WHATSAPP_PHONE_NUMBER_ID` | production | | |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | production | | |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | production | | |
| `WHATSAPP_APP_SECRET` | production | | When set, unsigned webhooks are rejected |
| `S3_ENDPOINT` | | | Leave empty for AWS; set for MinIO or another S3-compatible service |
| `S3_REGION` | | `ap-south-1` | |
| `S3_BUCKET` | | | Needed only for background report exports |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | | | Omit to use the default AWS credential chain (instance role) |
| `QR_SIGNING_SECRET` | yes | | ≥ 32 characters. HMAC key for pass tokens; rotating it invalidates every issued pass. |
| `PUBLIC_BASE_URL` | | | Public API origin (e.g. `https://api.bizinvite.io`), used in pass QR links sent to guests |
| `LOG_LEVEL` | | `info` | pino level |

Generate secrets with `openssl rand -hex 48` (or `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

The logger redacts authorization headers, cookies, passwords, tokens and secrets, and never logs query strings.

## Frontend

The frontend only needs `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:4000`) and `NEXT_PUBLIC_USE_MOCK_API=false`.
It never receives database, WhatsApp or S3 credentials.
