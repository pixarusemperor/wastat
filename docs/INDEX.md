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

> S3-compatible object storage — buckets, presigned URLs, uploads/downloads, security.

- **Source:** https://developers.cloudflare.com/r2/llms.txt
- **Snapshot date:** 2026-08-21
- **Pages captured:** 78 (+ `llms.txt` index)
- **Per-file hashes:** `docs/cloudflare-r2/manifest.json`

Key pages for this project:

| Topic | Path |
|---|---|
| Overview / pricing | `docs/cloudflare-r2/overview.md`, `pricing.md` |
| Get started (S3 SDKs) | `docs/cloudflare-r2/get-started/s3.md` |
| S3 API + extensions | `docs/cloudflare-r2/api/s3/api.md`, `extensions.md` |
| **Presigned URLs** (browser upload/download) | `docs/cloudflare-r2/api/s3/presigned-urls.md` |
| Temporary credentials | `docs/cloudflare-r2/api/s3/temporary-credentials.md` |
| CORS configuration | `docs/cloudflare-r2/buckets/cors.md` |
| Data security / tokens | `docs/cloudflare-r2/reference/data-security.md`, `docs/cloudflare-r2/api/tokens.md` |
| Object lifecycles | `docs/cloudflare-r2/buckets/object-lifecycles.md` |

## React Flow

> Node-based UI library — workflow canvas, custom nodes/edges, viewport control.

- **Source:** https://reactflow.dev/llms-full.txt
- **Snapshot date:** 2026-08-21
- **Raw corpus:** `docs/react-flow/llms-full.txt` (~896 KB, full text of all doc pages)
- **Page index:** `docs/react-flow/llms.txt`
- **Per-file hashes:** `docs/react-flow/manifest.json`

Grep `llms-full.txt` first; section headings (`## Learn`, `## API Reference`) delimit pages. Key sections: Building a Flow, Custom Nodes, Custom Edges, The Viewport, Adding Interactivity, Performance.

## Docker

> Images, containers, volumes, compose — deployment target for Coolify.

- **Source:** https://docs.docker.com/llms-full.txt
- **Snapshot date:** 2026-08-21
- **Raw corpus:** `docs/docker/llms-full.txt` (~324 KB)
- **Page index:** `docs/docker/llms.txt`
- **Per-file hashes:** `docs/docker/manifest.json`

Grep `llms-full.txt` first. Key sections: Docker concepts (containers/images/volumes), Compose, networking.

## Deployment

*(not yet specified — see wayfinder map fog)*