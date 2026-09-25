# WhatsApp integration

BizInvite uses **only the official WhatsApp Business Cloud API** (Meta Graph API). There is no unofficial automation.

## Configuration

| Variable | Use |
|----------|-----|
| `WHATSAPP_API_VERSION` | Graph API version, e.g. `v21.0` |
| `WHATSAPP_ACCESS_TOKEN` | System-user token with `whatsapp_business_messaging` and `whatsapp_business_management` |
| `WHATSAPP_PHONE_NUMBER_ID` | Default sending number (an organization can override it with `whatsApp.phoneNumberId`) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Default WABA for template sync (overridable per organization with `whatsApp.wabaId`) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Echo token for Meta's GET verification |
| `WHATSAPP_APP_SECRET` | Verifies `X-Hub-Signature-256` on webhook POSTs |

A missing access token enables the **dry-run sender**: messages are recorded with a `dryrun.*` id and logged, not
sent, so the pipeline can be tested. Dry-run messages are not counted as usage.

In production, the process refuses to start when `WHATSAPP_ACCESS_TOKEN` is set (live) but any of the other four
values is missing: without the verify token Meta cannot subscribe to webhooks, and without the app secret every
webhook is rejected, so delivery/read statuses and RSVP replies would never arrive. Production without an access token
runs in dry-run; set `REQUIRE_WHATSAPP=true` to forbid that. `GET /organizations/:id/whatsapp-status` reports the mode,
sender, webhook readiness and template count, and the dashboard shows it.

**Sender per organization.** Only a platform admin can set an organization's `whatsApp.wabaId`. Organization users can
then choose `whatsApp.phoneNumberId`, which is accepted only if `GET /{wabaId}/phone_numbers` lists it; one number
belongs to one organization. Without an own number the platform default `WHATSAPP_PHONE_NUMBER_ID` is used.

## Templates

- `POST /templates/sync` pulls templates with their Meta status. `APPROVED` is sendable; `PENDING`, `IN_APPEAL`
  and `LIMIT_EXCEEDED` map to `PENDING`; anything else (`REJECTED`, `PAUSED`, `DISABLED`, deleted) maps to `REJECTED`.
- **Variable mapping.** Each body placeholder (`{{1}}`, or named `{{guest_name}}`) is bound to a business field:
  `guest_name`, `event_name`, `event_date`, `event_time`, `venue`, `venue_address`, `venue_city`, `rsvp_deadline`,
  `dress_code`, `host_names`, `companions_allowed`, `session_names`, `organization_name`, `pass_code`, `pass_url`.
  Positional placeholders arrive from sync as `var_N`; bind them with `PATCH /templates/:id { variables: [...] }`.
- **Header and button placeholders.** A TEXT header placeholder is bound with `headerVariable`; a URL button whose
  link ends in `{{1}}` (`dynamicUrl`) is bound with `buttonUrlVariables` (index-aligned with the buttons). Named
  templates keep Meta's placeholder names in `parameterNames` and send them as `parameter_name`, so a Meta name such as
  `{{first_name}}` can be bound to `guest_name`. Re-syncing keeps bindings while the placeholders are unchanged.
  `GET /templates` returns `mappingProblems` (empty when the template can be sent); the dashboard's **Map Fields**
  button edits the mapping.
- **Media headers.** A template approved with an IMAGE or VIDEO header needs a campaign attachment or a default
  `headerMediaUrl` (public https); a DOCUMENT header needs `headerMediaUrl`. Otherwise sending is refused with 422,
  because Meta would reject every message.
- **Gate.** Before any send (campaign, reminder, pass, test), the template must be `APPROVED`, fully mapped and, when
  live, a real Meta template (local test templates exist only in dry-run), otherwise `400 TEMPLATE_NOT_APPROVED` or
  `422 VALIDATION_ERROR`. The background jobs re-check this at send time.
- **Quick replies.** Each quick-reply button is assigned an action (inferred from its label, overridable with
  `buttonPayloads`): `ACTION_RSVP_YES`, `ACTION_RSVP_NO`, `ACTION_RSVP_MAYBE`, `ACTION_OPT_OUT`. At send time the
  payload becomes `<ACTION>:<invitationId>`, so a reply maps to exactly one invitation.

## Webhook

`GET /api/v1/webhooks/whatsapp`: the verification handshake (constant-time token compare).

`POST /api/v1/webhooks/whatsapp`:
1. Verifies `X-Hub-Signature-256` = HMAC-SHA256(app secret, raw body), compared in constant time. Invalid → `401`.
2. Validates the payload shape with zod and stores each message or status item in `webhookEvents` under a unique
   key (`msg:<wamid>` or `status:<wamid>:<status>`). A redelivered item hits the unique index and is skipped.
3. Enqueues `whatsapp.process-webhook` per new item and returns `200` immediately.

Processing (`whatsapp.process-webhook` scheduled job; each item is claimed atomically, up to 5 attempts):

| Item | Action |
|------|--------|
| status `sent` / `delivered` / `read` | Advance the message, the campaign recipient and the pass delivery status. Updates never move backwards. |
| status `failed` | Mark failed with the error code. Codes 131026 and 131021 mark the number invalid, which stops reminders. A failed reminder message fails its scheduled job. |
| button / interactive reply `ACTION_RSVP_*` | Update the RSVP through the same service staff use (history, reminder stop). The invitation must belong to the **sender's** contact; mismatches are ignored. |
| `ACTION_OPT_OUT`, or text `STOP` / `UNSUBSCRIBE` | Opt out: consent record, cancel reminders, suppress pending campaign sends |
| text `START` / `SUBSCRIBE` | Opt back in |
| any other inbound message | Stored in the conversation; unread count incremented |

**Delivery details.** Webhook requests are exempt from the per-IP API rate limit (a campaign produces several status
events per guest) and are authenticated by signature. A status that arrives before the send call has stored its
message id is retried with backoff for up to 10 minutes instead of being dropped.

**Webhook subscription.** Meta only delivers a WABA's webhooks to apps subscribed to it (`/{waba-id}/subscribed_apps`),
even when the app's callback URL is set. `GET /organizations/:id/whatsapp-status` checks this and verifies the sender
number with Meta (`/{phone-number-id}`, which also proves the access token works); `POST
/organizations/:id/whatsapp/subscribe-webhooks` subscribes the app.

**Organization routing.** The sender's organization is resolved from the replied-to message (`context.id`), then
from the receiving `phone_number_id` when exactly one organization owns it, then from the last outbound message to
that number.

## Error handling for sends

Permanent Cloud API errors (invalid parameters, template problems, undeliverable numbers) fail the recipient or
reminder immediately. Everything else (rate limits, 5xx, network) is retried by the job scheduler with backoff. Requests time
out after 15 s.

What a permanent error means for the guest (same handling for sends and for `failed` status webhooks):

| Code | Meaning | Effect |
|------|---------|--------|
| 131026, 131021 | Number cannot receive WhatsApp | Message failed; number marked invalid; reminders stop |
| 131050 | Guest stopped messages from this business | Message failed; **guest opted out** (consent record, reminders cancelled, pending campaign sends suppressed) |
| 131049 | Meta withheld the message (per-user marketing limit) | Message failed; not retried; consent unchanged |
| 190, 10, 200, 3, 368, 131031, 131042, 133010 | Problem with the sending account (token, permission, blocked, payment, number not registered) | Campaign **paused** with the reason; unsent guests stay pending and **Resume** continues after the fix. Reminders retry with backoff. |

## Sending to selected guests

The Guests page can select guests and open the campaign form in *Selected guests* mode, which sends
`targetSegment.eventGuestIds`. The ids narrow the segment; they never bypass it. Recipients are built by the same
`campaign.dispatch` job, so opted-out, suppressed, invalid and cancelled guests are still excluded or suppressed.

## Passes over WhatsApp

`POST /passes/:id/resend` sends the event's `communication.passTemplateId` template. When `PUBLIC_BASE_URL` is set,
an IMAGE header receives the public QR URL `/api/v1/passes/qr/<signed-token>.png`; the image renders only for a
correctly signed, current pass.
