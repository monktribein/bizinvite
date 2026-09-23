# Frontend-Backend Integration Guide

> **Target Audience**: Node.js & Express.js Backend Developers  
> **Product**: BizInvite Standalone SaaS  
> **Repository**: `bizinvite` frontend dashboard

This document provides complete instructions for connecting the separately developed Node/Express REST backend to the BizInvite Organizer Dashboard.

---

## 1. Setting Environment Variables

The frontend connects to the backend through standard environment variables defined in `.env.local` or production deployment environments:

```bash
# Set your Node.js/Express server base URL (NO trailing slash)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Set to "false" to disable the in-memory mock adapter and route all calls to the real REST API
NEXT_PUBLIC_USE_MOCK_API=false
```

When `NEXT_PUBLIC_USE_MOCK_API=false`, all service calls in `src/services/` seamlessly switch from `mock-adapter.ts` to `apiClient.ts` without touching any UI component.

---

## 2. Authentication & JWT Handling

1. **Login Flow**:
   - Frontend calls `POST /api/v1/auth/login` with `{ email, password }`.
   - The backend validates credentials and returns:
     ```json
     {
       "success": true,
       "data": {
         "user": {
           "id": "usr_...",
           "email": "...",
           "name": "...",
           "role": "ORGANIZATION_OWNER",
           "organizationId": "org_..."
         },
         "tokens": {
           "accessToken": "jwt_access_token",
           "refreshToken": "jwt_refresh_token",
           "expiresIn": 3600
         }
       }
     }
     ```
   - The frontend stores `accessToken` and `refreshToken` in `localStorage` (`bizinvite_access_token`, `bizinvite_refresh_token`).

2. **Bearer Token Injection**:
   - `src/lib/api/client.ts` automatically attaches the header to all subsequent API calls:
     ```http
     Authorization: Bearer <accessToken>
     ```

3. **Silent Token Refresh Flow**:
   - If the backend returns an HTTP `401 Unauthorized` for an expired token, the API client automatically triggers `POST /api/v1/auth/refresh` sending `{ refreshToken }`.
   - Upon receiving a fresh token pair, the client retries the original failed request once before failing over.
   - If refresh fails, tokens are evicted and the user is redirected to `/login`.

---

## 3. Standard API Envelope

Every JSON response emitted by the backend must follow the standard envelope format:

### Success:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

### Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "fields": {
      "fieldName": ["Validation error message"]
    }
  }
}
```

---

## 4. Multi-Tenant Organization Isolation

- Every user belongs to an `organizationId`.
- The frontend consumes the authenticated user's `organizationId` from `GET /api/v1/auth/me`.
- **Backend Responsibility**: The backend must never trust user-supplied parameters to access organizations other than the one encoded inside the verified JWT claim. Ensure all MongoDB queries explicitly filter `{ organizationId: req.user.organizationId }`.

---

## 5. File Uploads & CSV Import Wizard

The CSV Import Wizard operates in a two-phase workflow:

1. **Preview Phase (`POST /api/v1/imports/guests/preview`)**:
   - Frontend sends a `multipart/form-data` request with the `file` field containing the raw `.csv` upload.
   - The backend parses the headers, auto-maps them to target fields (`name`, `mobile`, `category`, `isVip`, etc.), validates phone numbers and email syntax, checks for duplicates against the MongoDB database, and returns:
     - `importId` (id of the stored import preview; previews expire after 24 hours)
     - `totalRows`, `validRows`, `errorRows`, `duplicateCount`
     - `columnMappings`
     - `previewRows` (first 5 rows)
     - `validationIssues`
     - `duplicates`
2. **Commit Phase (`POST /api/v1/imports/guests`)**:
   - Frontend sends `{ importId, eventId, columnMappings, duplicateResolutions }`.
   - The backend inserts valid rows into MongoDB, updates duplicate rows according to the resolution rule (`skip` or `overwrite`), logs the operation in the audit trail, and returns `{ importedCount, updatedCount }`.

---

## 6. Report Downloads (Excel & CSV)

- Frontend requests: `GET /api/v1/reports/:type/export?eventId=...`
- The backend should stream the binary file using:
  ```http
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (or text/csv)
  Content-Disposition: attachment; filename="bizinvite_report.xlsx"
  ```
- The frontend `downloadFile()` method consumes the binary `Blob` and initiates native browser file download.

---

## 7. WhatsApp Webhook Data Propagation

WhatsApp conversations and replies run via Meta Cloud API webhooks:
- Inbound endpoint: `POST /api/v1/webhooks/whatsapp`
- When a guest clicks Quick Reply button `ACTION_RSVP_YES` or `ACTION_RSVP_NO`:
  1. Backend updates the guest's `rsvpStatus` in MongoDB (`attending` / `declined`).
  2. Backend **immediately cancels** the guest's pending reminder jobs (MongoDB `scheduledJobs`) (`reminderStatus = 'suppressed'`).
  3. When the dashboard next refetches or polls `/api/v1/rsvps` (or `/api/v1/rsvps/summary`), the updated attendance and suppressed status appear automatically.
- When a guest texts `STOP`:
  1. Backend logs a `ConsentRecord` with status `opted_out`.
  2. Sets `reminderStatus = 'opted_out'`.

---

## 8. Digital QR Pass Security & Check-In Architecture

1. **Pass Signing**:
   - The frontend **never** generates trusted check-in tokens.
   - When passes are generated or sent, the backend issues an HMAC-SHA256 signature containing `{ guestId, eventId, allowedPax, expiresAt }` signed with a server secret (`QR_SIGNING_SECRET` in the backend environment).
2. **Gate Check-In (`POST /api/v1/check-ins/scan`)**:
   - At the entrance, the check-in executive's device captures the pass code (e.g. `BIZ-2026-X79K`) or the signed QR string and submits `{ qrData, gateId, paxCount }`.
   - The backend verifies the signature, checks that the pass is active and hasn't been revoked, verifies that the guest has not already been admitted (preventing duplicate entry), creates a `CheckInRecord`, increments the attendee count, and returns `{ success: true, isDuplicate: false }`.
   - If a duplicate scan occurs, the backend responds with HTTP 200 and the standard envelope `{ success: true, data: { success: false, isDuplicate: true, reason: "DUPLICATE_CHECKIN", message, guest: { ...prior checkin details... } } }`. Returning 200 lets `apiClient` (which throws on a top-level `success: false`) hand the prior-entry details to the scanner UI. Invalid, revoked or expired passes use the same shape with `isDuplicate: false` and `reason` set to `INVALID_PASS`, `REVOKED` or `EXPIRED`.

---

## 9. Error Code Reference

| Error Code | HTTP Status | Frontend Behavior |
|------------|-------------|-------------------|
| `UNAUTHORIZED` | 401 | Triggers silent refresh or redirects to `/login` |
| `FORBIDDEN` | 403 | Displays permission denied banner |
| `NOT_FOUND` | 404 | Displays resource empty state |
| `VALIDATION_ERROR` | 422 | Binds field-level error messages to input forms |
| `TEMPLATE_NOT_APPROVED` | 400 | Alerts user that template is awaiting Meta approval |
| `DUPLICATE_CHECKIN` | 200 (in `data.reason`, not an HTTP error) | Displays warning alert with previous entry timestamp |
| `TENANT_ACCESS_DENIED` | 403 | Displays permission denied banner |
| `CONFLICT` | 409 | Duplicate guest mobile on the event, already-committed import, invalid state change |
| `IMPORT_ERROR` | 400 | Unreadable or invalid CSV file |
| `RATE_LIMITED` | 429 | Ask the user to retry shortly |
| `SERVER_ERROR` | 500 | Shows generic retry prompt |

---

## 10. Status Enums & Accepted Values

### RSVP Statuses
- `no_response`: Default state when invite is dispatched.
- `attending`: Confirmed attendance (triggers companion count validation).
- `declined`: With regrets (companions count set to 0).
- `maybe`: Tentative response.
- `incomplete`: Partial response received.
- `cancelled`: Invitation withdrawn by the organizer (backend addition; `DELETE /api/v1/guests/:id`).

### Reminder Statuses (per guest)
- `none` (backend addition: nothing scheduled yet), `scheduled`, `sent`, `suppressed`, `failed`, `opted_out`.

### Campaign Statuses
- `draft` $\rightarrow$ `scheduled` $\rightarrow$ `running` $\rightarrow$ `paused` / `completed` / `failed` / `cancelled`.

### Campaign Recipient Delivery Statuses
- `pending` $\rightarrow$ `sent` $\rightarrow$ `delivered` $\rightarrow$ `read` $\rightarrow$ `failed` / `suppressed`.

### Pass Statuses
- `active`: Valid pass.
- `used`: Already admitted to capacity.
- `revoked`: Explicitly cancelled by organizer.
- `expired`: Event has concluded.

### Check-in Gate Statuses
- `not_checked_in`: Outside venue.
- `checked_in`: Admitted at gate.
- `partially_checked_in`: Admitted subset of total companions.

---

## 11. Role-Based Permissions Reference

The frontend enforces UI visibility and action controls using `can(user, permission)`. The backend must enforce corresponding middleware authorization:

| Role | Permitted Actions |
|------|-------------------|
| `PLATFORM_SUPER_ADMIN` | Full access across all tenants and events. |
| `ORGANIZATION_OWNER` | Full access within own organization (`events:*`, `guests:*`, `campaigns:*`, `rsvp:*`, `reminders:*`, `passes:*`, `checkin:*`, `reports:*`, `settings:*`, `team:*`). |
| `EVENT_ADMINISTRATOR` | Event creation/editing, guest management, campaign dispatch, RSVP override, reminder rules, gate check-in, reports. |
| `GUEST_MANAGER` | Guest management, CSV imports, RSVP override, pass resend/revoke, check-in, reports viewing. |
| `COMMUNICATION_MANAGER` | Campaign creation/scheduling, reminder configuration, template viewing, reports. |
| `CHECK_IN_EXECUTIVE` | Gate check-in, QR scanning, manual lookups, pass viewing. |
| `READ_ONLY_VIEWER` | Read-only access to dashboards, reports, and attendance data. |

