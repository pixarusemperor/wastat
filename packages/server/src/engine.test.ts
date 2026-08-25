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

  it("attributes a customer reply to their latest execution (PRD §32)", async () => {
    const { db, clock, engine } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        { key: "s", type: "send_text", config: { text: "hi" } },
        { key: "e", type: "end" },
      ],
      [["t", "s"], ["s", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;
    await engine.scheduler.tick();

    // customer's reply arrives
    const reply = db
      .prepare(
        "INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'ok thanks', '2026-01-02T00:00:00Z')",
      )
      .run(sessionId, contactId);

    engine.attributeReply(Number(reply.lastInsertRowid));

    const linked = db
      .prepare("SELECT in_reply_to_id FROM messages WHERE id = ?")
      .get(Number(reply.lastInsertRowid)) as { in_reply_to_id: number | null };
    const outMsgId = (
      db.prepare("SELECT id FROM messages WHERE direction = 'out'").get() as { id: number }
    ).id;
    expect(linked.in_reply_to_id).toBe(outMsgId);
    const evt = db
      .prepare("SELECT execution_id FROM events WHERE event_type = 'reply.attributed'")
      .get() as { execution_id: number };
    expect(evt.execution_id).toBe(execId);
    void clock;
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

  it("send_media nodes forward mediaType, mediaUrl, mimeType, filename, and caption to deps.sendMessage", async () => {
    const { db, engine, sent } = setup();
    const workflowId = seedWorkflow(
      db,
      [
        { key: "t", type: "trigger" },
        {
          key: "m",
          type: "send_media",
          config: {
            caption: "VIP Presentation for {{contact.name}}",
            mediaType: "video",
            mediaUrl: "https://r2.domain.com/video.mp4?sig=xyz",
            mimeType: "video/mp4",
            filename: "presentation.mp4",
          },
        },
        { key: "e", type: "end" },
      ],
      [["t", "m"], ["m", "e"]],
    );
    const { sessionId, contactId } = seedContactSession(db);
    db.prepare("UPDATE contacts SET name = 'Alice' WHERE id = ?").run(contactId);
    const execId = engine.startExecution(workflowId, sessionId, contactId)!;

    await engine.scheduler.tick();
    expect(sent).toEqual([
      {
        sessionId,
        toPhone: "+15550001",
        kind: "media",
        text: "VIP Presentation for Alice",
        mediaType: "video",
        mediaId: undefined,
        mediaUrl: "https://r2.domain.com/video.mp4?sig=xyz",
        mimeType: "video/mp4",
        filename: "presentation.mp4",
      },
    ]);
    expect(db.prepare("SELECT message_type FROM messages WHERE workflow_execution_id = ?").get(execId)).toEqual({
      message_type: "media",
    });
  });

  describe("incoming-message routing (PRD §17)", () => {
    function keywordWorkflow(
      db: Database.Database,
      phrase: string,
      threshold = 75,
      priority = 0,
    ): number {
      const wf = db
        .prepare("INSERT INTO workflows (name, active) VALUES ('wf', 1)")
        .run();
      const workflowId = Number(wf.lastInsertRowid);
      const insNode = db.prepare(
        "INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)",
      );
      insNode.run(workflowId, "t", "trigger", "{}");
      insNode.run(
        workflowId,
        "k",
        "keyword",
        JSON.stringify({ phrase, algorithm: "dice", threshold, priority }),
      );
      insNode.run(workflowId, "e", "end", "{}");
      const insEdge = db.prepare(
        "INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)",
      );
      insEdge.run(workflowId, "t", "k");
      insEdge.run(workflowId, "k", "e");
      return workflowId;
    }

    function seedIncoming(db: Database.Database, text: string, sessionId?: number) {
      const sid = sessionId ?? Number(db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('S', 'ps-' || random())").run().lastInsertRowid);
      const c = db
        .prepare("INSERT INTO contacts (phone) VALUES ('+1555' || (abs(random()) % 900000 + 100000) || '-' || abs(random()))")
        .run();
      const m = db
        .prepare(
          "INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', ?, '2026-01-01T00:00:00Z')",
        )
        .run(sid, Number(c.lastInsertRowid), text);
      return {
        sessionId: sid,
        contactId: Number(c.lastInsertRowid),
        messageId: Number(m.lastInsertRowid),
      };
    }

    it("routes to the workflow whose keyword matches best", async () => {
      const { db, engine } = setup();
      // "price" workflow scores ~0.78 against the input; "delivery" scores much lower
      const priceWf = keywordWorkflow(db, "I want to know the price", 60);
      const deliveryWf = keywordWorkflow(db, "where is my delivery", 60);

      const { sessionId, contactId, messageId } = seedIncoming(db, "hello I want to know your PRICE");
      const execId = engine.handleIncomingMessage(sessionId, contactId, messageId)!;

      expect(execId).not.toBeNull();
      expect(
        db.prepare("SELECT workflow_id FROM workflow_executions WHERE id = ?").get(execId),
      ).toEqual({ workflow_id: priceWf });
      void deliveryWf;
    });

    it("breaks ties by priority, then lowest workflow id", async () => {
      const { db, engine } = setup();
      const lowPriority = keywordWorkflow(db, "refund please", 100, 1);
      const highPriority = keywordWorkflow(db, "refund please", 100, 9);
      const anotherHigh = keywordWorkflow(db, "refund please", 100, 9);

      const { sessionId, contactId, messageId } = seedIncoming(db, "refund please");
      const execId = engine.handleIncomingMessage(sessionId, contactId, messageId)!;

      // all three match at score 1.0 → priority 9 wins → lowest id among those wins
      expect(highPriority).toBeLessThan(anotherHigh);
      expect(
        db.prepare("SELECT workflow_id FROM workflow_executions WHERE id = ?").get(execId),
      ).toEqual({ workflow_id: highPriority });
      void lowPriority;
    });

    it("returns null when no workflow matches", async () => {
      const { db, engine } = setup();
      keywordWorkflow(db, "refund please", 100);
      const { sessionId, contactId, messageId } = seedIncoming(db, "good morning");
      expect(engine.handleIncomingMessage(sessionId, contactId, messageId)).toBeNull();
    });

    it("distributes experiment variants equally and sticks assignments", async () => {
      const { db, engine } = setup();
      // three variants of ONE experiment, identical keywords
      const mkVariant = () => {
        db.prepare("INSERT OR IGNORE INTO experiments (id, name) VALUES (1, 'exp')").run();
        const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('v',1)").run();
        const id = Number(wf.lastInsertRowid);
        db.prepare("UPDATE workflows SET experiment_id = 1 WHERE id = ?").run(id);
        const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
        insNode.run(id, "t", "trigger", "{}");
        insNode.run(id, "k", "keyword", JSON.stringify({ phrase: "price", algorithm: "exact", threshold: 100 }));
        insNode.run(id, "e", "end", "{}");
        const e2 = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
        e2.run(id, "t", "k"); e2.run(id, "k", "e");
        return id;
      };
      const v1 = mkVariant();
      const v2 = mkVariant();
      const v3 = mkVariant();

      const a = seedIncoming(db, "price");       // contact A
      const b = seedIncoming(db, "price");       // contact B
      const c = seedIncoming(db, "price");       // contact C

      const eA = engine.handleIncomingMessage(a.sessionId, a.contactId, a.messageId)!;
      const eB = engine.handleIncomingMessage(b.sessionId, b.contactId, b.messageId)!;
      const eC = engine.handleIncomingMessage(c.sessionId, c.contactId, c.messageId)!;
      void eB; void eC;

      const wfOf = (eid: number) =>
        (db.prepare("SELECT workflow_id FROM workflow_executions WHERE id = ?").get(eid) as any).workflow_id;

      // equal distribution: each variant got exactly one contact (ties -> lowest id)
      expect([wfOf(eA), wfOf(eB), wfOf(eC)].sort((x, y) => x - y)).toEqual([v1, v2, v3].sort((x, y) => x - y));

      // sticky: contact A messages again -> lands on their original variant
      const a2 = seedIncoming(db, "price");
      const eA2 = engine.handleIncomingMessage(a2.sessionId, a2.contactId, a2.messageId)!;
      expect(wfOf(eA2)).toBe(wfOf(eA));
    });
  });

  describe("Flow extensions: variables, menus, condition branching, and input collection", () => {
    it("interpolates {{vars.x}} and {{contact.phone}} into messages", async () => {
      const { db, engine, sent } = setup();
      const workflowId = seedWorkflow(
        db,
        [
          { key: "t", type: "trigger" },
          { key: "s", type: "send_text", config: { text: "Hello {{contact.phone}}, your plan is {{vars.plan}}!" } },
          { key: "e", type: "end" },
        ],
        [["t", "s"], ["s", "e"]],
      );
      const { sessionId, contactId } = seedContactSession(db);
      const execId = engine.startExecution(workflowId, sessionId, contactId, undefined, { plan: "Pro" })!;

      await engine.scheduler.tick();

      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Hello +15550001, your plan is Pro!",
      });
    });

    it("evaluates condition predicates (equals, contains, present) and branches to true/false edges", async () => {
      const { db, clock, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('cond_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", "{}");
      insNode.run(wfId, "c", "condition", JSON.stringify({
        subject: "var",
        subjectKey: "score",
        operator: "greater_than",
        value: "50",
      }));
      insNode.run(wfId, "high", "send_text", JSON.stringify({ text: "High score!" }));
      insNode.run(wfId, "low", "send_text", JSON.stringify({ text: "Low score!" }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)");
      insEdge.run(wfId, "t", "c", null);
      insEdge.run(wfId, "c", "high", "true");
      insEdge.run(wfId, "c", "low", "false");
      insEdge.run(wfId, "high", "e", null);
      insEdge.run(wfId, "low", "e", null);

      const { sessionId, contactId } = seedContactSession(db);

      // 1. Test True branch (score = 80 > 50)
      const execTrue = engine.startExecution(wfId, sessionId, contactId, undefined, { score: 80 })!;
      await engine.scheduler.tick();

      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "High score!",
      });

      // 2. Test False branch (score = 20 <= 50)
      clock.advance(5000);
      sent.length = 0;
      const execFalse = engine.startExecution(wfId, sessionId, contactId, undefined, { score: 20 })!;
      await engine.scheduler.tick();

      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Low score!",
      });
    });

    it("sends numbered text menu and routes down selected option branch on user reply", async () => {
      const { db, clock, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('menu_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", JSON.stringify({ keywords: ["menu"] }));
      insNode.run(wfId, "m", "send_menu", JSON.stringify({
        header: "Main Menu",
        bodyText: "How can we help you?",
        options: [
          { id: "opt_sales", title: "Talk to Sales", description: "Pricing & Plans" },
          { id: "opt_support", title: "Technical Support", description: "Bug reports" },
        ],
      }));
      insNode.run(wfId, "sales_resp", "send_text", JSON.stringify({ text: "Connecting to Sales..." }));
      insNode.run(wfId, "support_resp", "send_text", JSON.stringify({ text: "Connecting to Support..." }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)");
      insEdge.run(wfId, "t", "m", null);
      insEdge.run(wfId, "m", "sales_resp", "opt_sales");
      insEdge.run(wfId, "m", "support_resp", "opt_support");
      insEdge.run(wfId, "sales_resp", "e", null);
      insEdge.run(wfId, "support_resp", "e", null);

      const { sessionId, contactId } = seedContactSession(db);

      // Start workflow via incoming "menu"
      const insMsg = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'menu', '2026-08-24T00:00:00Z')").run(sessionId, contactId);
      const msgId = Number(insMsg.lastInsertRowid);

      const execId = engine.handleIncomingMessage(sessionId, contactId, msgId)!;
      expect(execId).not.toBeNull();

      // Process outbound menu send
      await engine.scheduler.tick();

      expect(sent[0].text).toContain("*Main Menu*");
      expect(sent[0].text).toContain("*1.* Talk to Sales - _Pricing & Plans_");
      expect(sent[0].text).toContain("*2.* Technical Support - _Bug reports_");
      expect(sent[0].text).toContain("_Reply with the number of your choice._");

      // Verify execution is suspended waiting for input
      const execRow = db.prepare("SELECT status, current_node_key FROM workflow_executions WHERE id = ?").get(execId) as any;
      expect(execRow.status).toBe("waiting_input");
      expect(execRow.current_node_key).toBe("m");

      // Advance clock past 5s rate limit and user replies with "1"
      clock.advance(5000);
      sent.length = 0;
      const insReply = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', '1', '2026-08-24T00:00:05Z')").run(sessionId, contactId);
      const replyMsgId = Number(insReply.lastInsertRowid);

      const advancedId = engine.handleIncomingMessage(sessionId, contactId, replyMsgId);
      expect(advancedId).toBe(execId);

      // Process outbound sales response
      await engine.scheduler.tick();

      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Connecting to Sales...",
      });
    });

    it("collect_input suspends, captures free text into vars, and advances", async () => {
      const { db, clock, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('input_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", JSON.stringify({ keywords: ["register"] }));
      insNode.run(wfId, "ask_name", "collect_input", JSON.stringify({
        promptText: "What is your full name?",
        varKey: "user_name",
      }));
      insNode.run(wfId, "confirm", "send_text", JSON.stringify({
        text: "Welcome, {{vars.user_name}}!",
      }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)");
      insEdge.run(wfId, "t", "ask_name", null);
      insEdge.run(wfId, "ask_name", "confirm", null);
      insEdge.run(wfId, "confirm", "e", null);

      const { sessionId, contactId } = seedContactSession(db);

      // 1. Inbound trigger "register"
      const insMsg = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'register', '2026-08-24T00:00:00Z')").run(sessionId, contactId);
      const execId = engine.handleIncomingMessage(sessionId, contactId, Number(insMsg.lastInsertRowid))!;

      // Send prompt
      await engine.scheduler.tick();
      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "What is your full name?",
      });

      // 2. Advance clock past 5s rate limit and user replies with their name "Steven Jossu"
      clock.advance(5000);
      sent.length = 0;
      const insReply = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'Steven Jossu', '2026-08-24T00:00:05Z')").run(sessionId, contactId);
      engine.handleIncomingMessage(sessionId, contactId, Number(insReply.lastInsertRowid));

      // Process confirmation
      await engine.scheduler.tick();
      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Welcome, Steven Jossu!",
      });

      // Check stored vars in DB
      const exec = db.prepare("SELECT vars FROM workflow_executions WHERE id = ?").get(execId) as any;
      expect(JSON.parse(exec.vars)).toEqual({ user_name: "Steven Jossu" });

      // Check persistent attribute in contact_attributes table (Customer 360)
      const attr = db.prepare("SELECT value FROM contact_attributes WHERE contact_id = ? AND key = 'user_name'").get(contactId) as any;
      expect(attr?.value).toBe("Steven Jossu");
    });

    it("evaluates Spintax anti-ban templates and custom attributes during send_text", async () => {
      const { db, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('spintax_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", "{}");
      insNode.run(wfId, "msg", "send_text", JSON.stringify({
        text: "{Hello|Hi} {{contact.name}}, your tier is {{contact.tier}}!",
      }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
      insEdge.run(wfId, "t", "msg");
      insEdge.run(wfId, "msg", "e");

      const { sessionId, contactId } = seedContactSession(db);
      db.prepare("UPDATE contacts SET name = 'Alice' WHERE id = ?").run(contactId);
      db.prepare("INSERT INTO contact_attributes (contact_id, key, value) VALUES (?, 'tier', 'VIP')").run(contactId);

      engine.startExecution(wfId, sessionId, contactId);
      await engine.scheduler.tick();

      expect(sent.length).toBe(1);
      expect(sent[0].text).toMatch(/^(Hello|Hi) Alice, your tier is VIP!$/);
    });

    it("triggers 2-hour silence follow-up sweep when user does not reply", async () => {
      const { db, clock, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('silence_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", JSON.stringify({ keywords: ["quote"] }));
      insNode.run(wfId, "q", "collect_input", JSON.stringify({ promptText: "Which product?", varKey: "prod" }));
      insNode.run(wfId, "reply_path", "send_text", JSON.stringify({ text: "Got your product choice!" }));
      insNode.run(wfId, "nudge_path", "send_text", JSON.stringify({ text: "Still there? We have limited stock." }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)");
      insEdge.run(wfId, "t", "q", null);
      insEdge.run(wfId, "q", "reply_path", "on_reply");
      insEdge.run(wfId, "q", "nudge_path", "on_silence_2h");
      insEdge.run(wfId, "reply_path", "e", null);
      insEdge.run(wfId, "nudge_path", "e", null);

      const { sessionId, contactId } = seedContactSession(db);

      // Inbound trigger "quote"
      const insMsg = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'quote', '2026-08-24T00:00:00Z')").run(sessionId, contactId);
      const execId = engine.handleIncomingMessage(sessionId, contactId, Number(insMsg.lastInsertRowid))!;

      await engine.scheduler.tick();
      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Which product?",
      });

      // User stays silent for 2 hours and 1 minute (7260 seconds)
      clock.advance(7260 * 1000);
      sent.length = 0;

      // Run silence sweep
      const sweepResult = await engine.runSilenceSweep(clock);
      expect(sweepResult.scanned).toBe(1);
      expect(sweepResult.nudged).toBe(1);

      // Process nudge message send
      await engine.scheduler.tick();
      expect(sent).toContainEqual({
        sessionId,
        toPhone: "+15550001",
        kind: "text",
        text: "Still there? We have limited stock.",
      });

      // Check DB execution updated
      const exec = db.prepare("SELECT silence_sweep_executed FROM workflow_executions WHERE id = ?").get(execId) as any;
      expect(exec.silence_sweep_executed).toBe(1);
    });

    it("records milestone conversion on milestone node", async () => {
      const { db, engine } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('milestone_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", "{}");
      insNode.run(wfId, "m", "milestone", JSON.stringify({ milestoneKey: "lead_qualified", milestoneName: "Lead Qualified", value: 50 }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
      insEdge.run(wfId, "t", "m");
      insEdge.run(wfId, "m", "e");

      const { sessionId, contactId } = seedContactSession(db);
      const execId = engine.startExecution(wfId, sessionId, contactId);

      await engine.scheduler.tick();

      const conv = db.prepare("SELECT * FROM funnel_conversions WHERE execution_id = ?").get(execId) as any;
      expect(conv).toBeDefined();
      expect(conv.milestone_key).toBe("lead_qualified");
      expect(conv.value).toBe(50);
    });

    it("pauses execution when contact bot_status is paused_human (Human Takeover)", async () => {
      const { db, engine, sent } = setup();
      const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('takeover_wf', 1)").run();
      const wfId = Number(wf.lastInsertRowid);

      const insNode = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
      insNode.run(wfId, "t", "trigger", "{}");
      insNode.run(wfId, "s", "send_text", JSON.stringify({ text: "Automated greeting" }));
      insNode.run(wfId, "e", "end", "{}");

      const insEdge = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
      insEdge.run(wfId, "t", "s");
      insEdge.run(wfId, "s", "e");

      const { sessionId, contactId } = seedContactSession(db);
      // Human operator takeover: pause bot for 24h
      const futureIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      db.prepare("UPDATE contacts SET bot_status = 'paused_human', bot_paused_until = ? WHERE id = ?").run(futureIso, contactId);

      const execId = engine.startExecution(wfId, sessionId, contactId);
      await engine.scheduler.tick();

      // No message should be sent
      expect(sent.length).toBe(0);

      // Execution status should be paused_human
      const exec = db.prepare("SELECT status FROM workflow_executions WHERE id = ?").get(execId) as any;
      expect(exec.status).toBe("paused_human");
    });
  });
});
