# BizInvite REST API Contract Specification

> **Audience**: Backend Engineering Team (Node.js + Express + MongoDB Atlas `bizinvite_db`)  
> **Version**: 1.0.0 (MVP)  
> **Base URL**: Configured via `NEXT_PUBLIC_API_BASE_URL` (e.g., `http://localhost:4000` or `https://api.bizinvite.io`)

---

## 1. Global Conventions

### 1.1 Authentication & Tenant Headers
All endpoints except `/api/v1/auth/login` and `/api/v1/auth/refresh` require:
```http
Authorization: Bearer <accessToken>
```
The backend must verify the JWT and extract `userId`, `organizationId`, and `role`. Every MongoDB query must enforce tenant isolation by strictly constraining operations to `{ organizationId: req.user.organizationId }`.

### 1.2 Standard Success Response Format
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 250,
    "totalPages": 10,
    "requestId": "req_892182012",
    "timestamp": "2026-09-23T11:00:00Z"
  }
}
```

### 1.3 Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation of error",
    "fields": {
      "mobile": ["Invalid phone number format. Must contain 10-12 digits."]
    }
  }
}
```

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "organizer@auraevents.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response `data`**:
  ```json
  {
    "user": {
      "id": "usr_123",
      "email": "organizer@auraevents.com",
      "name": "Kabir Malhotra",
      "role": "ORGANIZATION_OWNER",
      "organizationId": "org_biz_aura_001",
      "organizationName": "Aura Events & Hospitality"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 3600
    }
  }
  ```

### `POST /api/v1/auth/refresh`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response `data`**:
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 3600
  }
  ```

### `POST /api/v1/auth/logout`
- **Auth**: Bearer Token
- **Response**: `{ "success": true, "data": { "message": "Logged out successfully" } }`

### `GET /api/v1/auth/me`
- **Auth**: Bearer Token
- **Response `data`**: User profile matching login response.

---

## 3. Organizations & Team Management (`/api/v1/organizations`, `/api/v1/users`)

### `GET /api/v1/organizations/:id`
- **Auth**: Bearer Token
- **Permissions**: Any authenticated user belonging to this organization
- **Response `data`**:
  ```json
  {
    "id": "org_biz_aura_001",
    "name": "Aura Events & Hospitality",
    "slug": "aura-events",
    "plan": "enterprise",
    "whatsAppStatus": {
      "connected": true,
      "phoneNumber": "+91 98200 12345",
      "wabaId": "waba_biz_998127391",
      "businessDisplayName": "Aura Events Concierge",
      "qualityRating": "GREEN",
      "tier": "TIER_100K",
      "lastSyncAt": "2026-09-23T10:00:00Z"
    }
  }
  ```

### `GET /api/v1/organizations/:id/team`
- **Permissions**: `team:manage` or `settings:manage`
- **Response `data`**: Array of `TeamMember` objects (`id`, `name`, `email`, `role`, `status`, `createdAt`).

### `POST /api/v1/users/invite`
- **Permissions**: `team:manage`
- **Request Body**:
  ```json
  {
    "name": "Rohan Varma",
    "email": "rohan@auraevents.com",
    "role": "EVENT_ADMINISTRATOR"
  }
  ```

### `GET /api/v1/organizations/:id/audit-logs`
- **Query Params**: `page`, `limit`, `resourceType`
- **Response `data`**: Array of `AuditLog` objects (`userId`, `userName`, `userRole`, `action`, `resourceType`, `resourceId`, `details`, `ipAddress`, `timestamp`).

### `GET /api/v1/organizations/:id/consents`
- **Query Params**: `page`, `limit`, `status`
- **Response `data`**: Array of `ConsentRecord` objects (`guestId`, `guestName`, `mobile`, `channel`, `status`, `source`, `timestamp`).

---

## 4. Events & Multi-Session Functions (`/api/v1/events`, `/api/v1/sessions`)

### `GET /api/v1/events`
- **Query Params**: `page`, `limit`, `search`, `status`, `category`
- **Response `data`**: Array of `Event` objects.

### `GET /api/v1/events/:id`
- **Response `data`**: Single `Event` object with nested `sessions`, `venue`, `hosts`, and `contactPersons`.

### `POST /api/v1/events`
- **Permissions**: `events:create`
- **Request Body**:
  ```json
  {
    "name": "Sharma & Verma Grand Wedding",
    "category": "wedding",
    "status": "upcoming",
    "startDate": "2026-10-24T10:00:00Z",
    "endDate": "2026-10-26T23:00:00Z",
    "rsvpDeadline": "2026-10-10T23:59:00Z",
    "venue": {
      "name": "Taj Aravali Resort & Spa",
      "address": "1 Kotiya, Udaipur",
      "city": "Udaipur, Rajasthan",
      "googleMapsUrl": "https://maps.google.com/?q=Taj+Aravali"
    },
    "dressCode": "Royal Traditional",
    "languages": ["English", "Hindi"],
    "sessions": [
      {
        "name": "Mehendi & High Tea",
        "startTime": "2026-10-24T15:00:00Z",
        "endTime": "2026-10-24T19:00:00Z",
        "venueName": "Poolside Lawns"
      }
    ],
    "checkInConfig": {
      "allowMultipleEntries": true,
      "requirePassVerification": true,
      "activeGates": ["Gate 1", "Gate 2"]
    }
  }
  ```

### `PATCH /api/v1/events/:id`
- **Permissions**: `events:edit`
- **Request Body**: Partial `Event` payload.

### `GET /api/v1/sessions`
- **Query Params**: `eventId`
- **Response `data`**: Array of `EventSession` objects (`id`, `eventId`, `name`, `startTime`, `endTime`, `venueName`, `dressCode`, `capacity`).

### `POST /api/v1/sessions`
- **Permissions**: `events:edit`
- **Request Body**:
  ```json
  {
    "eventId": "evt_sharma_wedding_2026",
    "name": "Sangeet Extravaganza",
    "startTime": "2026-10-24T20:00:00Z",
    "endTime": "2026-10-25T01:00:00Z",
    "venueName": "Grand Ballroom"
  }
  ```

### `PATCH /api/v1/sessions/:id`
- **Permissions**: `events:edit`
- **Request Body**: Partial `EventSession` payload.

---

## 5. Guests & Guest Groups (`/api/v1/guests`, `/api/v1/guest-groups`)

### `GET /api/v1/guests`
- **Query Params**: `eventId`, `page`, `limit`, `search`, `category`, `isVip`, `rsvpStatus`, `checkInStatus`
- **Response `data`**: Array of `Guest` objects.

### `POST /api/v1/guests`
- **Permissions**: `guests:manage`
- **Request Body**:
  ```json
  {
    "eventId": "evt_sharma_wedding_2026",
    "name": "Vikramaditya Roy",
    "mobile": "+919811099887",
    "email": "v.roy@royholdings.com",
    "category": "VIP",
    "isVip": true,
    "allowedCompanions": 1,
    "city": "Kolkata",
    "notes": "Arriving Oct 24 flight"
  }
  ```

### `PATCH /api/v1/guests/:id`
- **Permissions**: `guests:manage`
- **Request Body**: Partial `Guest` payload.

### `GET /api/v1/guest-groups`
- **Query Params**: `eventId`
- **Response `data`**: Array of `GuestGroup` objects (`id`, `name`, `primaryContactGuestId`, `notes`).

### `POST /api/v1/guest-groups`
- **Permissions**: `guests:manage`
- **Request Body**: `{ "eventId": "evt_123", "name": "Singhania Family", "notes": "VVIP group" }`

---

## 6. CSV Import Wizard (`/api/v1/imports`)

### `POST /api/v1/imports/guests/preview`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (CSV file)
- **Response `data`**:
  ```json
  {
    "importId": "imp_8812918",
    "totalRows": 25,
    "validRows": 22,
    "errorRows": 1,
    "duplicateCount": 2,
    "columnMappings": [
      { "csvHeader": "Full Name", "targetField": "name" },
      { "csvHeader": "Mobile Number", "targetField": "mobile" }
    ],
    "previewRows": [...],
    "validationIssues": [
      { "rowNumber": 14, "field": "mobile", "message": "9 digits instead of 10", "severity": "error" }
    ],
    "duplicates": [
      { "rowNumber": 4, "mobile": "+919820112233", "name": "Sunil", "existingGuestName": "Sunil Singhania", "action": "skip" }
    ]
  }
  ```

### `POST /api/v1/imports/guests`
- **Request Body**:
  ```json
  {
    "importId": "imp_8812918",
    "eventId": "evt_sharma_wedding_2026",
    "columnMappings": [...],
    "duplicateResolutions": { "row_4": "skip", "row_22": "overwrite" }
  }
  ```
- **Response `data`**: `{ "importedCount": 22, "updatedCount": 2 }`

### `GET /api/v1/imports/:id`
- **Response `data`**: Import job status (`pending`, `processing`, `completed`, `failed`).

---

## 7. WhatsApp Templates & Campaigns (`/api/v1/templates`, `/api/v1/campaigns`)

### `GET /api/v1/templates`
- **Response `data`**: Array of `WhatsAppTemplate` objects with `approvalStatus` (`APPROVED` | `PENDING` | `REJECTED`).
- **Strict Rule**: The frontend strictly prevents dispatching templates where `approvalStatus !== 'APPROVED'`.

### `GET /api/v1/campaigns`
- **Query Params**: `eventId`, `status`
- **Response `data`**: Array of `Campaign` objects with real-time `metrics` (`sent`, `delivered`, `read`, `failed`, `suppressed`).

### `POST /api/v1/campaigns`
- **Permissions**: `campaigns:create`
- **Request Body**:
  ```json
  {
    "eventId": "evt_sharma_wedding_2026",
    "name": "VIP Wave 1 Invitations",
    "templateId": "tmpl_wedding_invite_official",
    "scheduledFor": "2026-10-01T10:00:00Z",
    "targetSegment": { "category": "VVIP", "onlyVip": true }
  }
  ```

### `POST /api/v1/campaigns/:id/test`
- **Request Body**: `{ "mobile": "+919820012345" }`
- **Response `data`**: `{ "success": true, "message": "Test WhatsApp message sent" }`

### `POST /api/v1/campaigns/:id/pause` & `POST /api/v1/campaigns/:id/resume`
- **Permissions**: `campaigns:send`

### `GET /api/v1/campaigns/:id/recipients`
- **Query Params**: `status`, `page`, `limit`
- **Response `data`**: Array of `CampaignRecipient` objects (`guestName`, `mobile`, `status`: `pending` | `sent` | `delivered` | `read` | `failed` | `suppressed`).

---

## 8. RSVP Management (`/api/v1/rsvps`)

### `GET /api/v1/rsvps`
- **Query Params**: `eventId`, `status`, `search`
- **Response `data`**: Array of `RSVPRecord` objects.

### `GET /api/v1/rsvps/summary`
- **Query Params**: `eventId`
- **Response `data`**:
  ```json
  {
    "totalInvited": 350,
    "attending": 268,
    "declined": 32,
    "maybe": 18,
    "noResponse": 32,
    "expectedFootfall": 520,
    "totalCompanions": 252,
    "dietaryCounts": { "vegetarian": 180, "non_vegetarian": 68, "jain": 42, "vegan": 12 },
    "accommodationRequestedCount": 94,
    "transportRequestedCount": 78
  }
  ```

### `PATCH /api/v1/rsvps/:guestId`
- **Permissions**: `rsvp:update`
- **Request Body**:
  ```json
  {
    "status": "attending",
    "count": 3,
    "requirements": {
      "dietaryPreference": "jain",
      "dietaryNotes": "Strict Jain food without root vegetables",
      "needsAccommodation": true,
      "accommodationNotes": "Room 104",
      "needsTransport": true
    }
  }
  ```
- **Backend Responsibility**: Upon updating status to `attending` or `declined`, backend must cancel/suppress any queued reminder jobs for this guest in BullMQ/Redis (`reminderStatus = 'suppressed'`).

---

## 9. Reminder Automation (`/api/v1/reminder-rules`)

### `GET /api/v1/reminder-rules`
- **Query Params**: `eventId`
- **Response `data`**: Array of `ReminderRule` objects.

### `POST /api/v1/reminder-rules`
- **Permissions**: `reminders:configure`
- **Request Body**:
  ```json
  {
    "eventId": "evt_sharma_wedding_2026",
    "name": "RSVP Deadline 48H Push",
    "reminderType": "rsvp_deadline",
    "triggerType": "relative_to_deadline",
    "relativeTo": "rsvp_deadline",
    "offsetMinutes": -2880,
    "channel": "whatsapp",
    "templateId": "tmpl_rsvp_gentle_reminder",
    "maximumAttempts": 3,
    "quietHours": { "enabled": true, "start": "21:00", "end": "09:00" },
    "requiresApproval": true,
    "fallbackChannel": "sms"
  }
  ```
- **Rule**: Default maximum unanswered RSVP reminder attempts is 3.

---

## 10. WhatsApp Conversations Thread View (`/api/v1/conversations`)

### `GET /api/v1/conversations`
- **Query Params**: `guestId`, `eventId`, `page`, `limit`
- **Response `data`**: Array of conversation thread summaries with last message snippet, timestamp, and unread count.

### `GET /api/v1/conversations/:id/messages`
- **Response `data`**: Chronological message history between the organizer's WABA number and the guest's WhatsApp number.

---

## 11. Digital Entry Passes (`/api/v1/passes`)

### `GET /api/v1/passes`
- **Query Params**: `eventId`, `status`, `search`
- **Response `data`**: Array of `DigitalPass` objects.
- **Rule**: `signedToken` is an HMAC-SHA256 signature generated server-side. The frontend never mints trusted tokens.

### `POST /api/v1/passes/:id/resend`
- **Response `data`**: `{ "success": true, "message": "Pass resent via WhatsApp" }`

### `POST /api/v1/passes/:id/revoke`
- **Response `data`**: Updated pass object with status `revoked`.

---

## 12. Gate Check-In (`/api/v1/check-ins`)

### `POST /api/v1/check-ins/scan`
- **Request Body**:
  ```json
  {
    "qrData": "BIZ-2026-X79K",
    "gateId": "gate_1",
    "paxCount": 2
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "isDuplicate": false,
    "message": "Admitted 2 guests.",
    "guest": { "name": "Vikramaditya Roy", "allowedPax": 2 },
    "record": { "id": "chk_991", "scannedAt": "2026-10-24T18:30:00Z" }
  }
  ```
- **Response (Duplicate Warning)**:
  ```json
  {
    "success": false,
    "isDuplicate": true,
    "message": "Duplicate check-in: Guest was already admitted at 10:15 AM at Gate 1.",
    "guest": { "name": "Sunil Singhania", "previousCheckInAt": "2026-10-24T10:15:00Z" }
  }
  ```

### `POST /api/v1/check-ins/manual`
- **Request Body**: `{ "guestId": "gst_001", "gateId": "gate_1", "paxCount": 2 }`

### `GET /api/v1/check-ins/summary`
- **Response `data`**: Real-time counter of `checkedInPax`, `pendingPax`, `totalExpectedPax`, and recent scans.

---

## 13. Reports & Exports (`/api/v1/reports`)

- `GET /api/v1/reports/invitation-funnel?eventId=:id`
  - Returns stages: `Sent` $\rightarrow$ `Delivered` $\rightarrow$ `Read`.
- `GET /api/v1/reports/rsvp?eventId=:id`
- `GET /api/v1/reports/attendance?eventId=:id`
- `GET /api/v1/reports/reminders?eventId=:id`
- `GET /api/v1/reports/failures?eventId=:id`
- `GET /api/v1/reports/event-summary?eventId=:id`
- `GET /api/v1/reports/:type/export?eventId=:id`
  - Streams binary `.csv` or `.xlsx` attachment with header `Content-Disposition: attachment; filename="report.csv"`.

---

## 14. Billing & Messaging Usage (`/api/v1/billing`)

### `GET /api/v1/billing/usage`
- **Permissions**: `settings:manage`
- **Response `data`**:
  ```json
  {
    "plan": "enterprise",
    "tier": "TIER_100K",
    "conversationsUsedThisMonth": 2480,
    "conversationsQuota": 100000,
    "estimatedSpendInr": 7440
  }
  ```

### `GET /api/v1/billing/subscription`
- **Response `data`**: Subscription renewal date and status.

---

## 15. WhatsApp Inbound Webhooks (`/api/v1/webhooks/whatsapp`)
- **Handled exclusively on the backend**.
- Receives inbound Meta webhook payloads for message status updates (`sent`, `delivered`, `read`, `failed`), Quick Reply RSVP button clicks (`ACTION_RSVP_YES`, `ACTION_RSVP_NO`), and opt-out replies (`STOP`).
- Backend mutates database records and triggers BullMQ worker jobs; the frontend displays updated figures via queries.
