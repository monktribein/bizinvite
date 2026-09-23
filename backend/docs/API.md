# BizInvite API reference (backend)

The request/response contract is owned by [`frontend/docs/API_CONTRACT.md`](../../frontend/docs/API_CONTRACT.md).
This file lists every endpoint the backend implements, the permission each one requires, and the places where the
backend extends or clarifies that contract. It does not redefine shapes the contract already defines.

Base path: `API_PREFIX` (default `/api/v1`). Health endpoints are at the root.

## Conventions

| Topic | Behaviour |
|-------|-----------|
| Auth | `Authorization: Bearer <accessToken>` on everything except `/auth/login`, `/auth/refresh`, `/auth/accept-invite`, `/webhooks/whatsapp`, `/passes/qr/:token.png` |
| Tenant | Taken from the session. A different `organizationId` in the body or `X-Organization-Id` header → `403 TENANT_ACCESS_DENIED`. Platform super admins select a tenant with `X-Organization-Id`. |
| Success | `{ success: true, data, message?, meta: { requestId, timestamp } }` |
| Lists | `{ success: true, data: [], meta: { page, limit, total, totalPages, requestId, timestamp } }`. `page` defaults to 1. `limit` defaults to **500** (max 1000) because the current frontend paginates client-side. |
| Errors | `{ success: false, error: { code, message, fields?, details? }, meta }`. `fields` holds field-level validation messages. |
| IDs | 24-character hex ObjectIds. A malformed id in a path returns `404`. |
| Guest id | The frontend's `Guest.id` is the **invitation** (event-guest) id. `contactId` identifies the person across events. |

### Error codes

| Code | HTTP |
|------|------|
| `VALIDATION_ERROR` | 422 (400 for malformed JSON) |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `TENANT_ACCESS_DENIED` | 403 |
| `TENANT_CONTEXT_REQUIRED` | 400 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `TEMPLATE_NOT_APPROVED` | 400 |
| `IMPORT_ERROR` | 400 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `RATE_LIMITED` | 429 |
| `WHATSAPP_ERROR` | 502 |
| `STORAGE_ERROR` | 503 |
| `SERVER_ERROR` | 500 |

## Endpoints

### Health
| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Always 200; reports `status` (`ok`/`degraded`), `api`, `mongodb` and `scheduler` (`state`, `activeJobs`, `lastPollAt`) |
| GET | `/ready` | 200 when MongoDB is connected, else 503 |

### Auth — `/auth`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/login` | public | `{ email, password, organizationId? }` → `{ user, tokens }`. Rate limited. |
| POST | `/refresh` | public | `{ refreshToken }` → new token pair. Rotating; reusing a rotated token revokes the session family. |
| POST | `/logout` | auth | Optional `{ refreshToken }`; revokes the session. |
| GET | `/me` | auth | User + `permissions` + `organizations` |
| POST | `/switch-organization` | auth | `{ organizationId }` → new tokens for another membership |
| POST | `/accept-invite` | public | `{ token, password }` → logs in |
| POST | `/change-password` | auth | `{ currentPassword, newPassword }`; ends other sessions |

### Organizations — `/organizations`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/` | platform admin |
| POST | `/` | platform admin: `{ name, slug?, plan, timezone?, owner: { name, email, password? } }` |
| GET | `/:id` | member of `:id` |
| PATCH | `/:id` | `settings:manage` (name, logoUrl, timezone, defaultCountryCode, whatsApp display/phoneNumberId/wabaId) |
| GET | `/:id/team` | `team:manage` or `settings:manage` |
| GET | `/:id/audit-logs` | `settings:manage` or `team:manage`; `page`, `limit`, `resourceType`, `action` |
| GET | `/:id/consents` | `guests:view`; `page`, `limit`, `status` |

### Users — `/users`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/` | `team:manage` or `settings:manage` |
| POST | `/invite` | `team:manage`. Returns `{ member, inviteToken? }`: email delivery is out of MVP scope, so the one-time token is returned to share. |
| PATCH | `/:id` | `team:manage`: `{ role?, status?, name? }`. No role above your own; the last active owner cannot be removed. |

### Events — `/events`, `/sessions`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/events` | `events:view`; `search`, `status`, `category` |
| POST | `/events` | `events:create`. Embedded `sessions` are created too. Extra optional fields: `timezone`, `rsvpConfig`, `reminderConfig`, `communication.passTemplateId`. |
| GET | `/events/:id` | `events:view` |
| PATCH | `/events/:id` | `events:edit`. Partial; nested configs are merged. `sessions` is ignored (use `/sessions`). Setting `status: "cancelled"` cancels pending reminders and active campaigns. |
| GET | `/sessions?eventId=` | `events:view` |
| POST | `/sessions` | `events:edit` |
| PATCH | `/sessions/:id` | `events:edit` |
| DELETE | `/sessions/:id` | `events:edit` |

### Guests — `/guests`, `/guest-groups`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/guests` | `guests:view`; `eventId`, `search`, `category`, `isVip`, `rsvpStatus`, `checkInStatus`, `groupId` |
| POST | `/guests` | `guests:manage`. Mobile normalized to E.164. The same mobile on the same event → `409` with `details.existingGuestId`. An existing contact is reused across events. |
| GET | `/guests/:id` | `guests:view` |
| PATCH | `/guests/:id` | `guests:manage` (contact and invitation fields; `rsvpStatus` is ignored, use `/rsvps`) |
| DELETE | `/guests/:id` | `guests:manage`: cancels the invitation (RSVP `cancelled`), stops reminders |
| POST | `/guests/:id/opt-out` · `/opt-in` | `guests:manage` |
| POST | `/guests/:id/suppress` · `/unsuppress` | `guests:manage` |
| GET | `/guest-groups?eventId=` | `guests:view` |
| POST | `/guest-groups` | `guests:manage` |
| PATCH | `/guest-groups/:id` | `guests:manage` |
| POST | `/guest-groups/:id/members` · `/members/remove` | `guests:manage`: `{ guestIds }` |

### Imports — `/imports`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/guests/preview` | `guests:import` | multipart `file` (.csv, ≤ 5 MB, ≤ 20,000 rows). Returns the contract preview plus `headers`. |
| POST | `/guests` | `guests:import` | `{ importId, eventId, columnMappings?, duplicateResolutions? }`. ≤ 500 rows: processed inline, **200** with counts. > 500 rows: **202** with `status: "pending"`; poll `GET /imports/:id`. Unresolved duplicates default to `skip`. |
| GET | `/:id` | `guests:import` | `status`, `totalRows`, `successfulRows`, `duplicateRows`, `invalidRows`, `createdCount`, `updatedCount`, `importedCount`, `errors` |

### Templates — `/templates`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/templates` | `campaigns:view`, `reminders:view` or `settings:manage`; `approvalStatus` |
| GET | `/templates/variables` | same; lists bindable variables and quick-reply actions |
| POST | `/templates/sync` | `settings:manage` or `campaigns:create`: pulls templates and approval status from Meta |
| GET | `/templates/:id` | view |
| PATCH | `/templates/:id` | `{ variables?, buttonPayloads?, headerMediaUrl? }`: binds placeholders to business fields |
| POST | `/templates` | dry-run mode only (no WhatsApp credentials, non-production): local test template |

### Campaigns — `/campaigns`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/` | `campaigns:view` | `eventId`, `status`; includes live `metrics` (`totalTargeted`, `sent`, `delivered`, `read`, `failed`, `suppressed`, `pending`) |
| POST | `/` | `campaigns:create` (+ `campaigns:send` unless `draft`) | No `scheduledFor` → **starts sending immediately** (matches the frontend "launch" flow). Future `scheduledFor` → `scheduled`. `draft: true` → only saved. The template must be `APPROVED` with all variables bound. |
| GET | `/:id` | `campaigns:view` | |
| PATCH | `/:id` | `campaigns:create` | draft/scheduled only |
| GET | `/:id/recipients` | `campaigns:view` | `status`, `page`, `limit` |
| POST | `/:id/send` | `campaigns:send` | start a draft/scheduled campaign now |
| POST | `/:id/pause` · `/resume` · `/cancel` | `campaigns:send` | |
| POST | `/:id/test` | `campaigns:send` | `{ mobile }` |

### Reminder rules — `/reminder-rules`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/` | `reminders:view` | `eventId`; includes `audienceCount`, `estimatedCost`, `sentCount`, `deliveredCount`, `readCount`, `suppressedCount`, `failedCount` |
| POST | `/` | `reminders:configure` | contract body plus optional `repeatIntervalMinutes`, `scheduledAt`, `sessionId`, `targetFilters`. `maximumAttempts` defaults to the event setting (3). `requiresApproval: true` → created as `draft`. |
| PATCH | `/:id` | `reminders:configure` | |
| POST | `/:id/activate` · `/pause` | `reminders:configure` | activation approves a draft rule |

### RSVPs — `/rsvps`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/` | `rsvp:view` | one record per invitation, including guests without a response |
| GET | `/summary` | `rsvp:view` | contract fields plus `incomplete`, `checkedIn`, `noShow`, `dietaryCounts.other` |
| PATCH | `/:guestId` | `rsvp:update` | `{ status, count?, attendingSessionIds?, requirements?, source?, reason? }`. `count` includes the guest and is limited to `1 + allowedCompanions`. Requirement fields the event does not collect (`rsvpConfig`) are ignored and listed in `message`. Responding stops pending reminders. |

### Conversations — `/conversations`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/` | `campaigns:view` or `guests:manage`; `guestId`, `eventId` |
| GET | `/:id/messages` | same |
| POST | `/:id/read` | same; resets `unreadCount` |

### Passes — `/passes`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/` | `passes:manage` or `checkin:perform` | `eventId`, `status`, `search` |
| POST | `/generate` | `passes:manage` | `{ eventId, guestIds?, onlyAttending = true }` |
| POST | `/validate` | view | `{ qrData, eventId? }`: checks without admitting |
| GET | `/:id` · `/:id/qr` (PNG) | view | |
| POST | `/:id/resend` | `passes:manage` | queues WhatsApp delivery; the event needs `communication.passTemplateId` |
| POST | `/:id/revoke` | `passes:manage` | `{ reason? }` |
| POST | `/:id/reissue` | `passes:manage` | new code and token; the old pass is revoked |
| GET | `/qr/:token.png` | public | only renders a correctly signed, current pass |

### Check-ins — `/check-ins`
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/scan` | `checkin:perform` | `{ qrData, gateId, paxCount?, eventId? }`. `qrData` = signed token or pass code. **Always HTTP 200**; the gate outcome is in `data.success`, `data.isDuplicate` and `data.reason` (`DUPLICATE_CHECKIN`, `INVALID_PASS`, `REVOKED`, `EXPIRED`, `WRONG_EVENT`, `INVITATION_CANCELLED`). |
| POST | `/manual` | `checkin:perform` | `{ guestId, gateId, paxCount }`; admits up to the remaining allowance |
| POST | `/group` | `checkin:perform` | `{ groupId, gateId }` |
| GET | `/lookup` | `checkin:perform` | `eventId`, `q` (name or mobile digits) |
| GET | `/summary` | `checkin:perform` or `reports:view` | `eventId?` |

### Reports — `/reports`
| Method | Path | Permission |
|--------|------|-----------|
| GET | `/invitation-funnel` · `/rsvp` · `/attendance` · `/reminders` · `/failures` · `/event-summary` | `reports:view`; `eventId` optional (empty = all events) |
| GET | `/:type/export` | `reports:export`; `format=xlsx` (default) or `csv`; streams an attachment |
| POST | `/:type/exports` | `reports:export`; background export to S3 → `202 { jobId }` |
| GET | `/exports/:jobId` | `reports:export`; `status` (`queued`, `running`, `completed`, `failed`) and, when completed, a 15-minute `downloadUrl` |

Export types: `full_event_summary`, `invitation_funnel`, `rsvp_breakdown`, `gate_attendance`, `reminder_conversions`,
`delivery_failures`, `guest_list`. The funnel only uses states WhatsApp reports (sent, delivered, read); there is no "clicked" metric.

### Billing — `/billing` (all `settings:manage`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/usage` | `conversationsUsedThisMonth` counts billable WhatsApp template messages sent this month; `estimatedSpendInr` uses a per-plan estimate |
| GET | `/subscription` | plan, status, period, `renewalDate` |
| GET | `/invoices` | recorded invoices (none are generated in the MVP) |

### Webhooks — `/webhooks/whatsapp`
| Method | Notes |
|--------|-------|
| GET | Meta verification handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| POST | Signed with `X-Hub-Signature-256`; see [WHATSAPP.md](WHATSAPP.md) |
