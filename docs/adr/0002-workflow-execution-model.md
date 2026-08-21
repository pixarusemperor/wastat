# 0002 — Workflow execution model (queue, scheduler, rate limiter)

Date: 2026-08-21 · Issue: #7 · Status: accepted

## Context

PRD §22–26 demand independent workflow executions, a persistent DB-backed queue, a session-scoped outbound rate limiter (≥5s per session), and retry classification. §14 demands an injectable clock; §52–53 demand idempotency for webhooks and outbound sends. ADR 0001 already merged `outbound_queue` + `scheduled_jobs` into one `jobs` table.

## Decisions

1. **Single global worker in the server process** — better-sqlite3 is synchronous and V1 is single-process, so one poller owns job execution. Per-session workers would add concurrency machinery for zero benefit; the rate limiter provides the only serialization the PRD requires.
2. **Poll-and-execute with chained ticks** — 1s poll interval via the injectable clock. Ticks are *chained, never dropped*: a wake arriving mid-tick queues the next pass instead of being discarded by a boolean guard (a dropped wake silently strands jobs). `enqueue` fires a wake immediately, so due-now work starts without waiting for the next poll.
3. **Due-job query** — `SELECT … FROM jobs JOIN workflow_executions … WHERE status='pending' AND run_at <= :now ORDER BY run_at LIMIT 50`, served by `idx_jobs_poll`. The join supplies `session_id` for the limiter without denormalizing it onto `jobs`. The clock abstraction (`Clock` interface, `FakeClock.advance`) is how tests skip 90-second delays (§14).
4. **Rate limiter = dispatcher-side slot map** — in-memory `Map<sessionId, nextFreeAt>`. When a `send_message` job's session slot is in the future, the job is deferred by writing `run_at = slot` and the loop moves on — other sessions' jobs keep flowing (§25), and executions never block each other (§22). `resume` jobs bypass the limiter entirely. Ceiling: the map resets on restart, so at most one send per session may go early after a crash; acceptable for a safety policy.
5. **Retries** — errors classified as `retryable` (429, 5xx, network codes), `non-retryable` (4xx), or `unknown`; unknown retries cautiously because dropping a maybe-sent message is worse than a capped resend. Max 3 attempts, backoff 30s·2^(n−1) written into `run_at`. Dead letter **is** `jobs.status='failed'` (+ `last_error`, execution marked failed, `job.failed` event) — no separate table, consistent with ADR 0001 minimalism.
6. **Schema representation** — settled by ADR 0001: independent `workflow_executions` rows; one `jobs` table (`send_message` | `resume`) referencing them. Nothing new.
7. **Outbound idempotency** — Wasender documents no idempotency-key header (verified against the docs snapshot), so the deterministic key is internal: `job:{id}`. Every attempt is visible via `attempts`/`last_error`; terminal failures are audited in `events`. Residual ceiling: a crash between provider-accept and mark-done can duplicate one message on restart — PRD §26 says "minimize", this meets it; revisit if Wasender adds idempotency keys.
8. **Webhook dedup** — Wasender payloads carry no event-id field (verified); the deterministic key is the message identity itself: `messages.provider_message_id UNIQUE`. Insert-conflict ⇒ event already processed ⇒ skip entirely, which also guarantees no second workflow execution (§53).

Implementation: `packages/server/src/scheduler.ts` (core verified by `scheduler.test.ts`: independence, ≥5s same-session spacing, cross-session concurrency, retry classes/backoff/dead-letter, fake-clock delays, webhook dedup).

## Consequences

- The server process must run exactly one scheduler instance; multi-process deployment needs row claiming before it happens (not a V1 concern).
- Node-graph stepping (trigger → keyword → send → delay → end) plugs in as the `JobExecutor` implementation; delay nodes enqueue `resume` jobs at `now + delay`.
- If Wasender later exposes idempotency keys or event ids, decisions 7–8 upgrade to provider-enforced dedup without schema changes.
