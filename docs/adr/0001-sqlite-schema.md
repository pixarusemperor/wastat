# 0001 — SQLite schema

Date: 2026-08-21 · Issue: #5 · Status: accepted

## Context

PRD §41 suggests 15 tables and asks for the smallest normalized schema that satisfies the requirements. Inputs: §27 (incoming message fields), §28 (outgoing attribution), §29 (experiments = workflows), §34 (media_assets), §42 (event model).

## Decisions

1. **`conversations` dropped** — derived from `messages (session_id, contact_id, timestamp)`. No conversation-level attribute exists in V1; add a table only when one appears.
2. **One `messages` table** for both directions, discriminated by `direction`. Outgoing rows carry nullable attribution (`workflow_execution_id`, `node_key`, `in_reply_to_id`) — this is what makes reply attribution possible (§28). Two tables would duplicate every shared column for zero gain.
3. **`outbound_queue` + `scheduled_jobs` merged into one `jobs` table** (`type`: `send_message` | `resume`). Both are "do something at run_at", so both are served by a single poller.
4. **`experiment_variants` dropped** — per PRD §29 a variant *is* a workflow; `workflows.experiment_id` expresses it. Equal distribution needs no weight column yet.
5. **Node configs as JSON** in `workflow_nodes.config` — configs are heterogeneous per node type (trigger/keyword/send_text/send_media/delay/end); normalizing them would explode into per-type columns or tables. Nodes/edges stay normalized tables because graph structure needs FK integrity.
6. **Single `events` table** replaces `workflow_execution_events` — PRD §42 events span message-level *and* workflow-level occurrences; one append-only table with nullable subject refs covers the whole audit trail.

Schema: `packages/server/src/db/schema.sql`. 11 tables vs the suggested 15.

## Consequences

- Enable `PRAGMA foreign_keys = ON` on every better-sqlite3 connection (SQLite defaults OFF).
- `PRAGMA journal_mode = WAL` at open time.
- If per-variant weights land later, add `weight` to `workflows`; if non-equal distribution gets complex, revisit dropping the variants abstraction.
