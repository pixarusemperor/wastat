# Documentation Index

Local, versioned snapshots of external service documentation used during implementation (PRD §38–40). Each snapshot is stored under `docs/<service>/` with metadata (source URL, download date, sha256). Refresh deliberately when upstream docs change.

Never fetch documentation from the web at runtime (PRD §40).

## Wasender

> WhatsApp API — sessions, messages, webhooks, contacts, groups.

- **Source:** https://www.wasenderapi.com/llms.txt
- **Snapshot date:** 2026-08-21
- **Pages captured:** 99
- **Raw snapshot:** `docs/wasender/llms.txt` (588,740 bytes)
- **Capability registry:** `docs/wasender/capabilities.json`

| Category | Pages | Path |
|---|---|---|
| Authentication | 2 | `docs/wasender/authentication/` |
| Contacts | 8 | `docs/wasender/contacts/` |
| Groups | 15 | `docs/wasender/groups/` |
| Messages | 18 | `docs/wasender/messages/` |
| Sessions | 21 | `docs/wasender/sessions/` |
| Webhooks | 24 | `docs/wasender/webhooks/` |
| Getting Started | 6 | `docs/wasender/getting-started/` |
| Developer SDKs | 1 | `docs/wasender/developer-sdks/` |
| Channels | 1 | `docs/wasender/channels-communities/` |
| Responses & Errors | 2 | `docs/wasender/responses-errors/` |
| Rate Limits | 1 | `docs/wasender/rate-limits/` |

### Webhook events (triggers)

15 events classified as **suitable-as-trigger**, 8 as **not-suitable**. See `docs/wasender/capabilities.json` → `.webhookEvents` for the full classification.

### Actions

21 message/contact/group actions documented in the capability registry, covering text, image, audio, video, document, sticker, contact, location, poll, quoted, view-once, mentions, channel, mark-read, edit, delete, get-info, resend, upload-media, and decrypt-media.

## Cloudflare R2

*(not yet downloaded — see wayfinder map #4)*

## React Flow

*(not yet downloaded — see wayfinder map #4)*

## Docker

*(not yet downloaded — see wayfinder map #4)*

## Deployment

*(not yet specified — see wayfinder map fog)*