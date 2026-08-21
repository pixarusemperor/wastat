import type BetterSqlite3 from "better-sqlite3";

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
  type: "send_message" | "resume";
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
  type: "send_message" | "resume";
  executionId: number;
  nodeKey?: string;
  payload?: unknown;
  runAt?: Date;
}

export interface Scheduler {
  /** Process all due jobs once. Safe to call concurrently; calls coalesce. */
  tick(): Promise<void>;
  /** Insert a job and wake the scheduler immediately. Returns the job id. */
  enqueue(input: EnqueueInput): number;
}

/**
 * Single global worker over the unified `jobs` table (ADR 0001).
 * Workflow executions stay independent (PRD §22); only outbound sends are
 * serialized per session by the rate limiter (PRD §24–25).
 */
export function createScheduler(
  db: BetterSqlite3.Database,
  executeJob: JobExecutor,
  clock: Clock = realClock,
): Scheduler {
  // ponytail: in-memory limiter resets on restart — worst case one early send
  // per session right after a restart; acceptable for a safety policy, not an SLA.
  const nextSendAt = new Map<number, number>();
  // Ticks are chained, never dropped: a wake arriving mid-tick runs as the
  // next pass instead of being lost to a boolean guard.
  let tail: Promise<void> = Promise.resolve();

  const iso = (ms: number) => new Date(ms).toISOString();

  const selectDue = db.prepare(`
    SELECT j.*, we.session_id
    FROM jobs j JOIN workflow_executions we ON we.id = j.execution_id
    WHERE j.status = 'pending' AND j.run_at <= ?
    ORDER BY j.run_at
    LIMIT 50
  `);
  const bumpAttempts = db.prepare("UPDATE jobs SET attempts = attempts + 1 WHERE id = ?");
  const markDone = db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?");
  const deferTo = db.prepare("UPDATE jobs SET run_at = ? WHERE id = ?");
  const failJob = db.prepare("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?");
  const failExecution = db.prepare(
    "UPDATE workflow_executions SET status = 'failed', finished_at = ? WHERE id = ?",
  );
  const backoffJob = db.prepare("UPDATE jobs SET run_at = ?, last_error = ? WHERE id = ?");
  const logEvent = db.prepare(
    "INSERT INTO events (event_type, execution_id, data) VALUES ('job.failed', ?, ?)",
  );

  async function dispatch(job: JobRow): Promise<void> {
    bumpAttempts.run(job.id);
    try {
      await executeJob(job);
      markDone.run(job.id);
    } catch (err) {
      const cls = classifyError(err);
      const attempts = job.attempts + 1;
      if (cls === "non-retryable" || attempts >= MAX_ATTEMPTS) {
        failJob.run(String(err), job.id);
        failExecution.run(iso(clock.now()), job.execution_id);
        logEvent.run(job.execution_id, JSON.stringify({ job_id: job.id, error: String(err), class: cls }));
      } else {
        // retryable and unknown both retry — unknown capped by MAX_ATTEMPTS
        const backoff = BASE_BACKOFF_MS * 2 ** (attempts - 1); // 30s, 60s
        backoffJob.run(iso(clock.now() + backoff), String(err), job.id);
      }
    }
  }

  async function runPass(): Promise<void> {
    const due = selectDue.all(iso(clock.now())) as JobRow[];
    for (const job of due) {
      if (job.type === "send_message") {
        // Reserve the session's next free slot; later same-session jobs in this
        // batch see the moved slot and defer behind it (keeps strict ≥5s spacing).
        const slot = Math.max(clock.now(), nextSendAt.get(job.session_id) ?? 0);
        if (clock.now() < slot) {
          deferTo.run(iso(slot), job.id);
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

  function enqueue(input: EnqueueInput): number {
    const info = db
      .prepare("INSERT INTO jobs (type, execution_id, node_key, payload, run_at) VALUES (?, ?, ?, ?, ?)")
      .run(
        input.type,
        input.executionId,
        input.nodeKey ?? null,
        JSON.stringify(input.payload ?? {}),
        iso(input.runAt?.getTime() ?? clock.now()),
      );
    void tick(); // due-now work starts immediately; the poller covers the rest
    return Number(info.lastInsertRowid);
  }

  return { tick, enqueue };
}
