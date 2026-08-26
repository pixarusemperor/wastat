import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyError, createScheduler, FakeClock, type JobRow } from "./scheduler.js";

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}

function seedExecution(db: Database.Database, sessionName: string) {
  const s = db
    .prepare("INSERT INTO sessions (name, provider_session_id) VALUES (?, ?)")
    .run(sessionName, `prov-${sessionName}`);
  const c = db.prepare("INSERT INTO contacts (phone) VALUES (?)").run(`+100${sessionName}`);
  const w = db.prepare("INSERT INTO workflows (name) VALUES (?)").run(`wf-${sessionName}`);
  const e = db
    .prepare("INSERT INTO workflow_executions (workflow_id, session_id, contact_id) VALUES (?, ?, ?)")
    .run(w.lastInsertRowid, s.lastInsertRowid, c.lastInsertRowid);
  return { sessionId: Number(s.lastInsertRowid), executionId: Number(e.lastInsertRowid) };
}

function sentLog() {
  const sent: number[] = [];
  const executeJob = async (job: JobRow) => {
    sent.push(job.id);
  };
  return { sent, executeJob };
}

describe("scheduler", () => {
  it("a waiting execution does not block another (PRD §22)", async () => {
    const db = setup();
    const clock = new FakeClock();
    const { sent, executeJob } = sentLog();
    const sched = createScheduler(db, executeJob, clock);
    const a = seedExecution(db, "A");
    const b = seedExecution(db, "B");

    await sched.enqueue({ type: "resume", executionId: a.executionId, runAt: new Date(90_000) });
    await sched.enqueue({ type: "send_message", executionId: b.executionId });

    await sched.tick();
    expect(sent).toEqual([2]); // B's send ran; A's resume untouched
    expect(
      db.prepare("SELECT status FROM jobs WHERE id = 1").get(),
    ).toEqual({ status: "pending" });
  });

  it("serializes same-session sends with ≥5s spacing (PRD §24–25)", async () => {
    const db = setup();
    const clock = new FakeClock();
    const { sent, executeJob } = sentLog();
    const sched = createScheduler(db, executeJob, clock);
    const { executionId } = seedExecution(db, "A");

    for (let i = 0; i < 3; i++) {
      await sched.enqueue({ type: "send_message", executionId });
    }

    await sched.tick();
    expect(sent.length).toBe(1);

    clock.advance(5_000);
    await sched.tick();
    expect(sent.length).toBe(2);

    clock.advance(5_000);
    await sched.tick();
    expect(sent.length).toBe(3);
  });

  it("different sessions send concurrently in one tick (PRD §54)", async () => {
    const db = setup();
    const clock = new FakeClock();
    const { sent, executeJob } = sentLog();
    const sched = createScheduler(db, executeJob, clock);
    const a = seedExecution(db, "A");
    const b = seedExecution(db, "B");

    await sched.enqueue({ type: "send_message", executionId: a.executionId });
    await sched.enqueue({ type: "send_message", executionId: b.executionId });

    await sched.tick();
    expect(sent.length).toBe(2);
  });

  it("non-retryable errors fail immediately and fail the execution (PRD §26)", async () => {
    const db = setup();
    const clock = new FakeClock();
    const sched = createScheduler(db, async () => {
      throw { status: 400 };
    }, clock);
    const { executionId } = seedExecution(db, "A");
    const jobId = await sched.enqueue({ type: "send_message", executionId });

    await sched.tick();
    expect(db.prepare("SELECT status FROM jobs WHERE id = ?").get(jobId)).toEqual({ status: "failed" });
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(executionId)).toEqual({
      status: "failed",
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 1 });
  });

  it("retryable errors back off exponentially and dead-letter after max attempts", async () => {
    const db = setup();
    const clock = new FakeClock();
    let calls = 0;
    const sched = createScheduler(db, async () => {
      calls++;
      throw { status: 500 };
    }, clock);
    const { executionId } = seedExecution(db, "A");
    const jobId = await sched.enqueue({ type: "send_message", executionId });

    await sched.tick();
    let job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow;
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(new Date(job.run_at).getTime()).toBe(30_000); // 30s backoff

    clock.advance(30_000);
    await sched.tick();
    job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow;
    expect(job.attempts).toBe(2);
    expect(new Date(job.run_at).getTime()).toBe(90_000); // +60s backoff

    clock.advance(60_000);
    await sched.tick();
    job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow;
    expect(job.status).toBe("failed"); // dead letter = jobs.status 'failed'
    expect(calls).toBe(3);
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(executionId)).toEqual({
      status: "failed",
    });
  });

  it("unknown error classes retry cautiously (PRD §26)", () => {
    expect(classifyError({ status: 429 })).toBe("retryable");
    expect(classifyError({ status: 503 })).toBe("retryable");
    expect(classifyError({ code: "ETIMEDOUT" })).toBe("retryable");
    expect(classifyError({ status: 404 })).toBe("non-retryable");
    expect(classifyError({ status: 401 })).toBe("non-retryable");
    expect(classifyError(new Error("weird"))).toBe("unknown");
  });

  it("duplicate webhook messages are stored once (PRD §52–53)", () => {
    const db = setup();
    const { sessionId, executionId } = seedExecution(db, "A");
    void executionId;
    const insert = db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, provider_message_id, timestamp)
      VALUES (?, 1, 'in', 'text', '3EB0X123456789', '2026-01-01T00:00:00Z')
    `);
    insert.run(sessionId);
    expect(() => insert.run(sessionId)).toThrow(); // UNIQUE(provider_message_id)
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 1 });
  });

  it("fake clock advances past delays without sleeping (PRD §14)", async () => {
    const db = setup();
    const clock = new FakeClock();
    const { sent, executeJob } = sentLog();
    const sched = createScheduler(db, executeJob, clock);
    const { executionId } = seedExecution(db, "A");

    await sched.enqueue({ type: "resume", executionId, runAt: new Date(90_000) });

    await sched.tick();
    expect(sent.length).toBe(0);

    clock.advance(90_000);
    await sched.tick();
    expect(sent.length).toBe(1);
  });
});
