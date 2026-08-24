# ADR 0005: Supabase PostgreSQL & Cloudflare R2 Cloud Architecture

## Context
WaStat is scaling from single-node local prototypes into a high-concurrency WhatsApp Sales Intelligence, A/B Testing, and Automation engine. 

While SQLite in WAL mode was previously chosen for local single-file simplicity (ADR 0001), real-world production demands:
1. Multi-operator live chat inbox synchronization without polling race conditions.
2. Direct PostgreSQL compatibility with Supabase Realtime pub/sub channels (`postgres_changes` on `messages` and `contacts`).
3. Seamless integration with external MCP tooling (such as Block Buzz and Antigravity CLI) querying live states over network without locking local SQLite files.
4. Fast global media distribution and infinite asset scalability via Cloudflare R2 (S3-compatible, zero egress fees).

## Decisions

### 1. Primary Database: Supabase PostgreSQL
- All production data (Sessions, Contacts, Attributes, Tags, Workflows, Executions, Messages, Conversions, Playbooks) is hosted on Supabase PostgreSQL.
- Primary schema defined in `supabase/migrations/20260824000000_wastat_v2_schema.sql` and `packages/server/src/db/supabase-schema.sql`.
- PostgreSQL JSONB columns (`vars`, `config`, `payload`, `data`) provide strict relational integrity combined with dynamic flow state flexibility.

### 2. Live Operator Synchronization: Supabase Realtime
- Live WhatsApp messages and team notes broadcast through Supabase Realtime publications (`ALTER PUBLICATION supabase_realtime ADD TABLE messages, contacts, private_notes;`).
- Inbox clients receive sub-millisecond push updates when companion sessions receive inbound messages.

### 3. Media Storage: Cloudflare R2
- All WhatsApp media (product images, audio notes, product video demos, PDF catalogs) are uploaded directly to Cloudflare R2 using AWS S3 SDK compatibility.
- Stored assets record their SHA-256 hash, MIME type, byte size, and public CDN URL in `media_assets`.

### 4. Configuration Contract
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

## Consequences
- Single unified cloud database accessible by both the Fastify server, background workers, and external MCP tool runners (Buzz / Antigravity).
- No database file lock contention during multi-agent concurrent tasks.
- Zero egress costs on WhatsApp audio and video media delivery through Cloudflare R2.
