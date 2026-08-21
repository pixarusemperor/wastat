import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEngine } from "./engine.js";
import { FakeClock } from "./scheduler.js";

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  const clock = new FakeClock();
  const sent: Array<{ toPhone: string; text?: string; kind: string }> = [];
  const engine = createEngine(db, {
    clock,
    sendMessage: async (input) => {
      sent.push(input);
      return { providerMessageId: `prov-${sent.length}` };
    },
  });
  return { db, clock, engine, sent };
}

/** Workflow: trigger → node chain. Returns ids for seeding executions. */
function seedWorkflow(
  db: Database.Database,
  nodes: Array<{ key: string; type: string; config?: unknown }>,
  edges: Array<[string, string]>,
) {
  const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('wf', 1)").run();
  const workflowId = Number(wf.lastInsertRowid);
  const insNode = db.prepare(
    "INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)",
  );
  for (const n of nodes) insNode.run(workflowId, n.key, n.type, JSON.stringify(n.config ?? {}));
  const insEdge = db.prepare(
    "INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)",
  );
  for (const [s, t] of edges) insEdge.run(workflowId, s, t);
  return workflowId;
}

function seedContactSession(db: Database.Database) {
  const s = db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('A','pa')").run();
  const c = db.prepare("INSERT INTO contacts (phone) VALUES ('+15550001')").run();
  return { sessionId: Number(s.lastInsertRowid), contactId: Number(c.lastInsertRowid) };
}

describe("engine", () => {
  it("starting an execution on trigger→send_text→end queues the text for sending", async () => {
    const { db, engine, sent } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "s", type: "send_text", config: { text: "hello!" } },
        { key: "e", type: "end" },
      ],
      [["t", "s"], ["s", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);

    const execId = engine.startExecution(workflowId, sessionId, contactId);

    expect(execId).not.toBeNull();
    expect(sent).toEqual([]); // nothing sent synchronously — goes through the queue
    const job = db
      .prepare("SELECT type, payload FROM jobs WHERE execution_id = ?")
      .get(execId) as { type: string; payload: string };
    expect(job.type).toBe("send_message");
    expect(JSON.parse(job.payload)).toMatchObject({ kind: "text", text: "hello!" });
  });

  it("executing the send job sends, logs the outgoing message, and completes at end", async () => {
    const { db, engine, sent } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "s", type: "send_text", config: { text: "hello!" } },
        { key: "e", type: "end" },
      ],
      [["t", "s"], ["s", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;

    await engine.scheduler.tick();

    expect(sent).toEqual([{ sessionId, toPhone: "+15550001", kind: "text", text: "hello!" }]);
    const msg = db
      .prepare(
        "SELECT direction, provider_message_id, workflow_execution_id, node_key FROM messages WHERE workflow_execution_id = ?",
      )
      .get(execId) as any;
    expect(msg).toMatchObject({
      direction: "out",
      provider_message_id: "prov-1",
      workflow_execution_id: execId,
      node_key: "s",
    });
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(execId)).toEqual({
      status: "completed",
    });
  });

  it("delay node schedules a resume job and persists the chosen duration", async () => {
    const { db, clock, engine } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "d", type: "delay", config: { mode: "fixed", seconds: 90 } },
        { key: "e", type: "end" },
      ],
      [["t", "d"], ["d", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;

    const job = db
      .prepare("SELECT type, run_at FROM jobs WHERE execution_id = ?")
      .get(execId) as { type: string; run_at: string };
    expect(job.type).toBe("resume");
    expect(new Date(job.run_at).getTime()).toBe(90_000);

    const evt = db
      .prepare("SELECT data FROM events WHERE execution_id = ? AND event_type = 'delay.scheduled'")
      .get(execId) as { data: string };
    expect(JSON.parse(evt.data)).toEqual({ seconds: 90 });

    // still waiting until time passes
    await engine.scheduler.tick();
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(execId)).toEqual({
      status: "waiting",
    });

    clock.advance(90_000);
    await engine.scheduler.tick();
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(execId)).toEqual({
      status: "completed",
    });
  });

  it("random delay picks within [min,max] using the injected rng", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const engine = createEngine(db, {
      clock: new FakeClock(),
      rng: () => 0.5, // deterministic: 30 + floor(0.5 * (90-30+1)) = 60
      sendMessage: async () => ({ providerMessageId: "p" }),
    });
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "d", type: "delay", config: { mode: "random", minSeconds: 30, maxSeconds: 90 } },
        { key: "e", type: "end" },
      ],
      [["t", "d"], ["d", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;

    const evt = db
      .prepare("SELECT data FROM events WHERE execution_id = ? AND event_type = 'delay.scheduled'")
      .get(execId) as { data: string };
    expect(JSON.parse(evt.data)).toEqual({ seconds: 60 });
    const job = db.prepare("SELECT run_at FROM jobs WHERE execution_id = ?").get(execId) as {
      run_at: string;
    };
    expect(new Date(job.run_at).getTime()).toBe(60_000);
  });

  it("keyword node proceeds on match and dead-ends without sending on no-match", async () => {
    const { db, engine, sent } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "k", type: "keyword", config: { phrase: "I want to know the price", algorithm: "dice", threshold: 75 } },
        { key: "s", type: "send_text", config: { text: "it costs $10" } },
        { key: "e", type: "end" },
      ],
      [["t", "k"], ["k", "s"], ["s", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);

    // incoming message stored by the webhook layer before the engine runs
    const msg = db
      .prepare(
        "INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', ?, '2026-01-01T00:00:00Z')",
      )
      .run(sessionId, contactId, "hello I want to know your PRICE");
    const triggerId = Number(msg.lastInsertRowid);

    const matched = engine.startExecution(workflowId, sessionId, contactId, triggerId)!;
    await engine.scheduler.tick();
    expect(sent.length).toBe(1);
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(matched)).toEqual({
      status: "completed",
    });

    const noMatchMsg = db
      .prepare(
        "INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', ?, '2026-01-01T00:01:00Z')",
      )
      .run(sessionId, contactId, "completely unrelated greeting");
    const unmatched = engine.startExecution(
      workflowId,
      sessionId,
      contactId,
      Number(noMatchMsg.lastInsertRowid),
    )!;
    await engine.scheduler.tick();
    expect(sent.length).toBe(1); // no second send
    expect(db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(unmatched)).toEqual({
      status: "completed",
    });
  });

  it("the same trigger message never starts a second execution (PRD §53)", () => {
    const { db, engine } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "e", type: "end" },
      ],
      [["t", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const msg = db
      .prepare(
        "INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'hi', '2026-01-01T00:00:00Z')",
      )
      .run(sessionId, contactId);

    const first = engine.startExecution(workflowId, sessionId, contactId, Number(msg.lastInsertRowid));
    const second = engine.startExecution(workflowId, sessionId, contactId, Number(msg.lastInsertRowid));

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_executions").get()).toEqual({ n: 1 });
  });

  it("send_media nodes queue a media send", async () => {
    const { db, engine, sent } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "m", type: "send_media", config: { mediaId: 7 } },
        { key: "e", type: "end" },
      ],
      [["t", "m"], ["m", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;

    await engine.scheduler.tick();
    expect(sent).toEqual([{ sessionId, toPhone: "+15550001", kind: "media", mediaId: 7 }]);
    expect(db.prepare("SELECT message_type FROM messages WHERE workflow_execution_id = ?").get(execId)).toEqual({
      message_type: "media",
    });
  });
});
