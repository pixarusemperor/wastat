import type BetterSqlite3 from "better-sqlite3";
import {
  queryAll,
  queryGet,
  queryRun,
  toDbClient,
  jsonToDb,
  type DbClient,
} from "./db/client.js";

// PRD §14: time must be injectable so tests never sleep through delays.
export interface Clock {
  now(): number; // epoch ms
}

export const realClock: Clock = { now: () => Date.now() };

export class FakeClock implements Clock {
  private t: number;
  constructor(start = 0) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

const MIN_SEND_INTERVAL_MS = 5_000; // PRD §24: ≥5s between sends per session
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 30_000;

export type ErrorClass = "retryable" | "non-retryable" | "unknown";

// PRD §26: distinguish retryable / non-retryable / unknown.
export function classifyError(err: unknown): ErrorClass {
  const e = err as { status?: number; code?: string } | null;
  if (typeof e?.status === "number") {
    if (e.status === 429 || e.status >= 500) return "retryable";
    if (e.status >= 400 && e.status < 500) return "non-retryable";
  }
  if (e?.code && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(e.code)) {
    return "retryable";
  }
  return "unknown";
}

export interface JobRow {
  id: number;
  type: "send_message" | "mark_read" | "send_presence" | "resume";
  execution_id: number;
  node_key: string | null;
  payload: string;
  run_at: string;
  status: "pending" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  session_id: number;
}

export type JobExecutor = (job: JobRow) => Promise<void>;

export interface EnqueueInput {
  type: "send_message" | "mark_read" | "send_presence" | "resume";
  executionId: number;
  nodeKey?: string;
  payload?: unknown;
  runAt?: Date;
}

export interface Scheduler {
  /** Process all due jobs once. Safe to call concurrently; calls coalesce. */
  tick(): Promise<void>;
  /** Insert a job and wake the scheduler immediately. Returns the job id. */
  enqueue(input: EnqueueInput): Promise<number>;
}

/**
 * Single global worker over the unified `jobs` table (ADR 0001).
 * Workflow executions stay independent (PRD §22); only outbound sends are
 * serialized per session by the rate limiter (PRD §24–25).
 *
 * Provider-aware: runs against whichever DbClient is active (Postgres on
 * Supabase, SQLite in tests/dev).
 */
export function createScheduler(
  db: DbClient | BetterSqlite3.Database,
  executeJob: JobExecutor,
  clock: Clock = realClock,
): Scheduler {
  const dbClient = toDbClient(db);
  const isPg = Boolean(dbClient.sql);

  // ponytail: in-memory limiter resets on restart — worst case one early send
  // per session right after a restart; acceptable for a safety policy, not an SLA.
  const nextSendAt = new Map<number, number>();
  // Ticks are chained, never dropped: a wake arriving mid-tick runs as the
  // next pass instead of being lost to a boolean guard.
  let tail: Promise<void> = Promise.resolve();

  const iso = (ms: number) => new Date(ms).toISOString();

  const SELECT_DUE = `
    SELECT j.*, we.session_id
    FROM jobs j JOIN workflow_executions we ON we.id = j.execution_id
    WHERE j.status = 'pending' AND j.run_at <= ?
    ORDER BY j.run_at
    LIMIT 50
  `;

  async function dispatch(job: JobRow): Promise<void> {
    await queryRun(dbClient, "UPDATE jobs SET attempts = attempts + 1 WHERE id = ?", [job.id]);
    try {
      await executeJob(job);
      await queryRun(dbClient, "UPDATE jobs SET status = 'done' WHERE id = ?", [job.id]);
    } catch (err) {
      const cls = classifyError(err);
      // BIGINT columns come back as strings from postgres.js — coerce before math.
      const attempts = Number(job.attempts) + 1;
      if (cls === "non-retryable" || attempts >= MAX_ATTEMPTS) {
        await queryRun(dbClient, "UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?", [
          String(err),
          job.id,
        ]);
        await queryRun(
          dbClient,
          "UPDATE workflow_executions SET status = 'failed', finished_at = ? WHERE id = ?",
          [iso(clock.now()), job.execution_id],
        );
        await queryRun(
          dbClient,
          "INSERT INTO events (event_type, execution_id, data) VALUES ('job.failed', ?, ?)",
          [job.execution_id, jsonToDb(dbClient, { job_id: job.id, error: String(err), class: cls })],
        );
      } else {
        // retryable and unknown both retry — unknown capped by MAX_ATTEMPTS
        const backoff = BASE_BACKOFF_MS * 2 ** (attempts - 1); // 30s, 60s
        await queryRun(dbClient, "UPDATE jobs SET run_at = ?, last_error = ? WHERE id = ?", [
          iso(clock.now() + backoff),
          String(err),
          job.id,
        ]);
      }
    }
  }

  async function runPass(): Promise<void> {
    const due = (await queryAll(dbClient, SELECT_DUE, [iso(clock.now())])) as unknown as JobRow[];
    for (const job of due) {
      if (job.type === "send_message") {
        // Reserve the session's next free slot; later same-session jobs in this
        // batch see the moved slot and defer behind it (keeps strict ≥5s spacing).
        const slot = Math.max(clock.now(), nextSendAt.get(job.session_id) ?? 0);
        if (clock.now() < slot) {
          await queryRun(dbClient, "UPDATE jobs SET run_at = ? WHERE id = ?", [iso(slot), job.id]);
          continue;
        }
        nextSendAt.set(job.session_id, slot + MIN_SEND_INTERVAL_MS);
      }
      await dispatch(job);
    }
  }

  function tick(): Promise<void> {
    const pass = tail.then(runPass, runPass);
    tail = pass.then(
      () => undefined,
      () => undefined,
    );
    return pass;
  }

  async function enqueue(input: EnqueueInput): Promise<number> {
    const info = await queryRun(
      dbClient,
      "INSERT INTO jobs (type, execution_id, node_key, payload, run_at) VALUES (?, ?, ?, ?, ?)",
      [
        input.type,
        input.executionId,
        input.nodeKey ?? null,
        jsonToDb(dbClient, input.payload ?? {}),
        iso(input.runAt?.getTime() ?? clock.now()),
      ],
    );
    void tick(); // due-now work starts immediately; the poller covers the rest
    return info.lastInsertRowid ?? 0;
  }

  return { tick, enqueue };
}
