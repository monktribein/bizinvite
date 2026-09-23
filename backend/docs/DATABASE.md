# Database

MongoDB Atlas, database **`bizinvite_db`**, user **`bizinvite_app`** (`readWrite@bizinvite_db` only).

Safeguards:
- `MONGODB_URI` is rejected at startup if its path names any database other than `bizinvite_db`.
- `mongoose.connect` always passes `dbName: "bizinvite_db"`, so a URI without a path cannot fall back to another database.
- After connecting, the process verifies the active database name and exits on mismatch.

Collections are created by Mongoose on first use; nothing is pre-created. Indexes are built by Mongoose `autoIndex`
when the process starts. For very large production collections, build new indexes deliberately (for example with
`Model.syncIndexes()` in a maintenance window) before deploying code that depends on them.

## Collections

`T` = tenant-owned (`organizationId` required, protected by the tenant guard). `T*` = tenant-guarded, but `organizationId` is absent on system jobs (reminder planner, webhook processing), which only the scheduler reads.

| Collection | T | Purpose | Key indexes |
|------------|---|---------|-------------|
| `organizations` | | Tenants, WhatsApp display/number config, settings (timezone, default country code) | `slug` unique, `whatsApp.phoneNumberId` |
| `users` | | Accounts; `platformRole` for super admins; bcrypt `passwordHash` (never selected by default) | `email` unique |
| `roles` | T | Membership: one user's role and status in one organization | (`organizationId`,`userId`) unique; (`userId`,`status`) |
| `refreshTokens` | | SHA-256 of refresh tokens, family, revocation | `tokenHash` unique; `familyId`; TTL on `expiresAt` |
| `events` | T | Events incl. venue snapshot, check-in, RSVP and reminder configuration | (`organizationId`,`status`,`startDate`) |
| `eventSessions` | T | Functions within an event | (`organizationId`,`eventId`,`startTime`) |
| `venues` | T | Reusable venues | (`organizationId`,`name`,`city`) unique |
| `guests` | T | Guest CRM contact (person), consent, opt-out, suppression, mobile validity | (`organizationId`,`mobile`) unique |
| `eventGuests` | T | Invitation of a guest to an event: RSVP, reminder and check-in state | (`organizationId`,`eventId`,`guestId`) unique; (`organizationId`,`eventId`,`rsvpStatus`); (`…`,`reminderStatus`); (`…`,`checkInStatus`); (`…`,`category`); (`…`,`mobile`) |
| `guestGroups` | T | Families/parties | (`organizationId`,`eventId`,`name`) unique |
| `consents` | T | Append-only opt-in/opt-out history | (`organizationId`,`guestId`,`timestamp`) |
| `imports` | T | CSV import sessions and summaries | (`organizationId`,`createdAt`); TTL on `expiresAt` (uncommitted previews expire after 24h) |
| `templates` | T | WhatsApp templates, approval status, variable bindings | (`organizationId`,`name`,`language`) unique |
| `campaigns` | T | Campaigns | (`organizationId`,`eventId`,`status`) |
| `campaignRecipients` | T | Per-recipient delivery state | (`campaignId`,`eventGuestId`) unique; (`organizationId`,`campaignId`,`status`); `waMessageId` |
| `reminderRules` | T | Reminder rules | (`organizationId`,`eventId`,`status`); `status` |
| `scheduledJobs` | T* | Background job queue (campaign dispatch, reminder planning and sends, pass sends, webhook processing, imports, exports). `reminder.send` jobs are also the reminder history (one per guest/rule/attempt). See [SCHEDULER_ARCHITECTURE.md](SCHEDULER_ARCHITECTURE.md). | `dedupeKey` unique; (`status`,`runAt`); (`status`,`lockedAt`); TTL on `expiresAt` (finished jobs, 7 days; never set on reminder sends); (`organizationId`,`eventGuestId`,`status`); (`organizationId`,`ruleId`,`eventGuestId`); (`organizationId`,`eventId`,`type`,`status`) |
| `messages` | T | Every outbound/inbound WhatsApp message | `waMessageId` unique (partial); (`organizationId`,`conversationId`,`createdAt`) |
| `conversations` | T | One thread per organization and mobile | (`organizationId`,`mobile`) unique |
| `rsvps` | T | Latest response + history per invitation | (`organizationId`,`eventGuestId`) unique; (`organizationId`,`eventId`,`status`) |
| `guestRequirements` | T | Dietary/accommodation/transport details, only when the event collects them | (`organizationId`,`eventGuestId`) unique |
| `passes` | T | Digital passes; only the SHA-256 of the signed token is stored | `tokenHash` unique; (`organizationId`,`passCode`) unique; (`organizationId`,`eventGuestId`) unique where `isCurrent` |
| `checkIns` | T | Every gate decision (admitted / duplicate / rejected) | (`organizationId`,`eventId`,`scannedAt`) |
| `webhookEvents` | | Deduplicated WhatsApp webhook items | `dedupeKey` unique; TTL 90 days on `receivedAt` |
| `subscriptions` | T | Plan and period | `organizationId` unique |
| `usageRecords` | T | Monthly usage counters | (`organizationId`,`period`,`metric`) unique |
| `invoices` | T | Invoice records (model only in the MVP) | (`organizationId`,`number`) unique |
| `auditLogs` | T | Audit trail | (`organizationId`,`timestamp`); (`organizationId`,`resourceType`,`timestamp`) |

`serviceTickets` is not implemented: the frontend contract does not use it.

## Modelling notes

- **Guest vs invitation.** `guests` holds the person (unique per organization by E.164 mobile). `eventGuests` holds
  their invitation to one event. The API's guest `id` is the invitation id. Name, mobile, category and VIP flag are
  copied onto invitations for filtering and segmentation, and kept in sync when the contact changes.
- **RSVP state** lives on the invitation (`rsvpStatus`, `confirmedCompanions`) for fast counts. `rsvps` keeps the
  source, the attending sessions and a history of the last 50 changes.
- **Passes** are re-derivable: the signed token is rebuilt from stored fields (`nonce`, `issuedAllowedPax`,
  `expiresAt`) and the server secret, so the token itself is never stored.
- **Audit**: `resourceType`/`resourceId` are the frontend's names for the entity and its id. Each entry also stores
  `action`, `userId`, `userName`, `userRole`, `details`, `metadata`, `ipAddress`, `requestId` and `timestamp`.
