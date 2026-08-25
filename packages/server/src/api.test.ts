import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";
import type { DbClient } from "./db/client.js";

/**
 * Wraps a real sqlite db in a DbClient whose `sql` side is a mock postgres.js
 * client: captures every SQL text sent and answers from `unsafeImpl`. Routes
 * ported to the seam must route their queries through `dbClient.sql` — if they
 * fall back to `dbClient.sqlite`, the mock's `calls` stay empty and the test
 * goes red.
 */
function pgMockDbClient(
  db: Database.Database,
  unsafeImpl: (text: string, params: unknown[]) => unknown[],
) {
  const calls: string[] = [];
  type MockSql = {
    unsafe: (text: string, params?: unknown[]) => Promise<unknown[]>;
    begin: (fn: (tx: { unsafe: MockSql["unsafe"] }) => Promise<void>) => Promise<void>;
  };
  const mockSql: MockSql = {
    unsafe: async (text: string, params: unknown[] = []) => {
      calls.push(text);
      return unsafeImpl(text, params);
    },
    // postgres.js transactions: begin(fn) calls fn with a tx-scoped client.
    begin: async (fn: (tx: { unsafe: MockSql["unsafe"] }) => Promise<void>) => {
      await fn({ unsafe: mockSql.unsafe });
    },
  };
  const dbClient = {
    provider: "supabase_postgres",
    sql: mockSql,
    sqlite: db,
    exec: async () => {},
    close: async () => db.close(),
  } as unknown as DbClient;
  return { dbClient, calls };
}

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

async function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  const app = await buildApp(db, {
    clock: new FakeClock(),
    sendMessage: async () => ({ providerMessageId: "p" }),
  });
  return { db, app };
}

const validGraph = {
  name: "Price responder",
  description: "Replies to price questions",
  nodes: [
    { nodeKey: "t", type: "trigger", config: {} },
    { nodeKey: "k", type: "keyword", config: { phrase: "price", algorithm: "exact", threshold: 100 } },
    { nodeKey: "s", type: "send_text", config: { text: "$10" } },
    { nodeKey: "e", type: "end", config: {} },
  ],
  edges: [
    { sourceKey: "t", targetKey: "k" },
    { sourceKey: "k", targetKey: "s" },
    { sourceKey: "s", targetKey: "e" },
  ],
};

describe("workflow CRUD API", () => {
  it("creates a workflow with its graph and returns it", async () => {
    const { db, app } = await setup();

    const res = await app.inject({ method: "POST", url: "/api/workflows", payload: validGraph });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.id).toBeGreaterThan(0);

    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_nodes WHERE workflow_id = ?").get(created.id)).toEqual({ n: 4 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_edges WHERE workflow_id = ?").get(created.id)).toEqual({ n: 3 });
  });

  it("rejects graphs whose edges reference unknown nodes", async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        ...validGraph,
        edges: [{ sourceKey: "t", targetKey: "ghost" }],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unknown node types", async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        ...validGraph,
        nodes: [{ nodeKey: "x", type: "ai_agent", config: {} }],
        edges: [],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("round-trips a graph: get returns parsed nodes and edges", async () => {
    const { app } = await setup();
    const created = (await app.inject({ method: "POST", url: "/api/workflows", payload: validGraph })).json();

    const res = await app.inject({ method: "GET", url: `/api/workflows/${created.id}` });
    expect(res.statusCode).toBe(200);
    const wf = res.json();
    expect(wf.name).toBe("Price responder");
    expect(wf.nodes).toEqual(validGraph.nodes);
    expect(wf.edges).toEqual(validGraph.edges);
  });

  it("PUT replaces the whole graph", async () => {
    const { db, app } = await setup();
    const created = (await app.inject({ method: "POST", url: "/api/workflows", payload: validGraph })).json();

    const res = await app.inject({
      method: "PUT",
      url: `/api/workflows/${created.id}`,
      payload: {
        name: "Renamed",
        active: true,
        nodes: [
          { nodeKey: "t", type: "trigger", config: {} },
          { nodeKey: "e", type: "end", config: {} },
        ],
        edges: [{ sourceKey: "t", targetKey: "e" }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_nodes WHERE workflow_id = ?").get(created.id)).toEqual({ n: 2 });
    const wf = (await app.inject({ method: "GET", url: `/api/workflows/${created.id}` })).json();
    expect(wf.name).toBe("Renamed");
    expect(wf.active).toBe(1);
  });

  it("DELETE removes the workflow and cascades its graph", async () => {
    const { db, app } = await setup();
    const created = (await app.inject({ method: "POST", url: "/api/workflows", payload: validGraph })).json();

    const res = await app.inject({ method: "DELETE", url: `/api/workflows/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflows").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_nodes").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_edges").get()).toEqual({ n: 0 });
  });

  it("creates, reads, updates, stats, and deletes experiments", async () => {
    const { db, app } = await setup();

    const created = await app.inject({
      method: "POST",
      url: "/api/experiments",
      payload: { name: "Greeting A/B", description: "hi vs hello" },
    });
    expect(created.statusCode).toBe(201);
    const expId = created.json().id;

    // Attach a workflow to this experiment
    const wfRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        ...validGraph,
        name: "Variant A",
        experimentId: expId,
      },
    });
    expect(wfRes.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/api/experiments" });
    expect(list.json()).toEqual([
      { id: expId, name: "Greeting A/B", description: "hi vs hello", active: 1, variantCount: 1, totalAssigned: 0 },
    ]);

    const getRes = await app.inject({ method: "GET", url: `/api/experiments/${expId}` });
    expect(getRes.statusCode).toBe(200);
    const expDetails = getRes.json();
    expect(expDetails.name).toBe("Greeting A/B");
    expect(expDetails.workflows).toHaveLength(1);
    expect(expDetails.workflows[0].name).toBe("Variant A");

    // Check stats (should show Variant A even with 0 assignments)
    const statsRes = await app.inject({ method: "GET", url: `/api/experiments/${expId}/stats` });
    expect(statsRes.statusCode).toBe(200);
    const stats = statsRes.json();
    expect(stats.experiment.id).toBe(expId);
    expect(stats.variants).toHaveLength(1);
    expect(stats.variants[0].name).toBe("Variant A");
    expect(stats.totals.assigned).toBe(0);

    // Update experiment
    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/experiments/${expId}`,
      payload: { name: "Greeting A/B Updated", description: "new desc", active: false },
    });
    expect(updateRes.statusCode).toBe(200);

    // Delete experiment unlinks workflow
    const delRes = await app.inject({ method: "DELETE", url: `/api/experiments/${expId}` });
    expect(delRes.statusCode).toBe(200);

    const checkWf = db.prepare("SELECT experiment_id FROM workflows WHERE id = ?").get(wfRes.json().id) as { experiment_id: number | null };
    expect(checkWf.experiment_id).toBeNull();
  });
});

describe("experiment funnel API", () => {
  it("returns 404 for a missing experiment", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/experiments/999/funnel" });
    expect(res.statusCode).toBe(404);
  });

  it("derives per-variant per-stage counts from executions, messages, and conversions", async () => {
    const { db, app } = await setup();
    db.exec("INSERT INTO sessions (id, name, provider_session_id) VALUES (1, 's', 'ps')");
    for (const phone of ["+100", "+200"]) {
      db.prepare("INSERT INTO contacts (phone) VALUES (?)").run(phone);
    }
    const expId = (await app.inject({ method: "POST", url: "/api/experiments", payload: { name: "Funnel A/B" } })).json().id as number;
    const wfId = (
      await app.inject({ method: "POST", url: "/api/workflows", payload: { ...validGraph, name: "V1", experimentId: expId } })
    ).json().id as number;
    db.prepare(
      "INSERT INTO workflow_executions (workflow_id, session_id, contact_id) VALUES (?, 1, 1)",
    ).run(wfId);
    // Hook delivered + read; second outbound = presentation; reply within 2h.
    db.prepare(
      "INSERT INTO messages (session_id, contact_id, direction, message_type, status, timestamp, workflow_execution_id) VALUES (1, 1, 'out', 'text', 'read', '2026-08-24T10:00:00Z', ?)",
    ).run(wfId);
    db.prepare(
      "INSERT INTO messages (session_id, contact_id, direction, message_type, status, timestamp, workflow_execution_id) VALUES (1, 1, 'out', 'text', 'delivered', '2026-08-24T10:01:00Z', ?)",
    ).run(wfId);
    db.prepare(
      "INSERT INTO messages (session_id, contact_id, direction, message_type, status, timestamp, in_reply_to_id) VALUES (1, 1, 'in', 'text', 'received', '2026-08-24T11:30:00Z', 1)",
    ).run();
    db.prepare("INSERT INTO funnel_conversions (execution_id, workflow_id, contact_id, milestone_key) VALUES (1, ?, 1, 'lead_qualified')").run(wfId);
    // Contact 2 reached phase 2 without executing this variant's flow.
    db.prepare("UPDATE contacts SET funnel_phase = 'phase_2_active' WHERE id = 2").run();
    db.prepare("INSERT INTO experiment_assignments (experiment_id, contact_id, workflow_id) VALUES (?, 2, ?)").run(expId, wfId);

    const res = await app.inject({ method: "GET", url: `/api/experiments/${expId}/funnel` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.experimentId).toBe(expId);
    expect(body.stages).toEqual(["hook_delivered", "presentation_sent", "replied_2h", "qualified", "phase_2_closed"]);
    expect(body.variants).toHaveLength(1);

    const stages = body.variants[0].stages;
    expect(stages.hook_delivered).toEqual({ reached: 1, converted: 1 });
    expect(stages.presentation_sent).toEqual({ reached: 1, converted: 1 });
    expect(stages.replied_2h).toEqual({ reached: 1, converted: 1 });
    expect(stages.qualified).toEqual({ reached: 1, converted: 1 });
    expect(stages.phase_2_closed.reached).toBe(1);
    // Contact 2 is assigned but never entered this variant's flow.
    expect(stages.phase_2_closed.converted).toBe(0);
  });

  it("keeps the funnel empty for an untouched experiment", async () => {
    const { app } = await setup();
    const expId = (await app.inject({ method: "POST", url: "/api/experiments", payload: { name: "Empty" } })).json().id as number;
    await app.inject({ method: "POST", url: "/api/workflows", payload: { ...validGraph, name: "V1", experimentId: expId } });

    const res = await app.inject({ method: "GET", url: `/api/experiments/${expId}/funnel` });
    expect(res.statusCode).toBe(200);
    const stages = res.json().variants[0].stages;
    for (const key of Object.keys(stages)) {
      expect(stages[key]).toEqual({ reached: 0, converted: 0 });
    }
  });

  it("duplicates a workflow, preserves nodes/edges, and creates copy", async () => {
    const { db, app } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        ...validGraph,
        name: "Welcome Flow",
      },
    });
    const origId = created.json().id;

    const dupRes = await app.inject({
      method: "POST",
      url: `/api/workflows/${origId}/duplicate`,
    });
    expect(dupRes.statusCode).toBe(201);
    const dupBody = dupRes.json();
    expect(dupBody.name).toBe("Welcome Flow (Copy)");
    expect(dupBody.id).toBeDefined();

    const fetchDup = await app.inject({
      method: "GET",
      url: `/api/workflows/${dupBody.id}`,
    });
    expect(fetchDup.statusCode).toBe(200);
    expect(fetchDup.json().nodes).toHaveLength(4);
    expect(fetchDup.json().edges).toHaveLength(3);
    expect(fetchDup.json().active).toBe(0);
  });

  it("lists executions, fetches execution details with events, and returns summary stats", async () => {
    const { db, app } = await setup();
    const sInfo = db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('Default Session', 'sess_exec_test')").run();
    const sessionId = Number(sInfo.lastInsertRowid);
    const cInfo = db.prepare("INSERT INTO contacts (phone, name) VALUES ('+15550001', 'Alice')").run();
    const contactId = Number(cInfo.lastInsertRowid);

    const wfRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: { ...validGraph, name: "Lead Qualification", sessionId },
    });
    const wfId = wfRes.json().id;

    // Seed execution and events
    const execInfo = db.prepare(`
      INSERT INTO workflow_executions (workflow_id, session_id, contact_id, status, current_node_key, started_at)
      VALUES (?, ?, ?, 'running', 's', '2026-08-24T12:00:00Z')
    `).run(wfId, sessionId, contactId);
    const execId = Number(execInfo.lastInsertRowid);

    db.prepare(`
      INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
      VALUES ('trigger.matched', ?, ?, ?, '{"score": 100}')
    `).run(sessionId, contactId, execId);
    db.prepare(`
      INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
      VALUES ('message.sent', ?, ?, ?, '{"kind": "text"}')
    `).run(sessionId, contactId, execId);

    // Test executions list
    const listRes = await app.inject({ method: "GET", url: "/api/executions" });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.total).toBe(1);
    expect(listBody.executions).toHaveLength(1);
    expect(listBody.executions[0].workflowName).toBe("Lead Qualification");
    expect(listBody.executions[0].stepCount).toBe(2);

    // Test execution detail
    const detailRes = await app.inject({ method: "GET", url: `/api/executions/${execId}` });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.id).toBe(execId);
    expect(detail.events).toHaveLength(2);
    expect(detail.events[0].eventType).toBe("trigger.matched");

    // Test summary stats
    const summaryRes = await app.inject({ method: "GET", url: "/api/executions/summary" });
    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.json().running).toBe(1);

    // Test retry execution
    const retryRes = await app.inject({ method: "POST", url: `/api/executions/${execId}/retry` });
    expect(retryRes.statusCode).toBe(200);
    expect(retryRes.json().ok).toBe(true);
  });

  it("serves test lab scenarios and executes test runner", async () => {
    const { app } = await setup();
    const listRes = await app.inject({ method: "GET", url: "/api/test-lab/scenarios" });
    expect(listRes.statusCode).toBe(200);
    const scenarios = listRes.json().scenarios;
    expect(scenarios).toHaveLength(10);

    const runRes = await app.inject({
      method: "POST",
      url: "/api/test-lab/run",
      payload: { scenarioId: "text_spintax_vars", mode: "virtual" },
    });
    const runAllRes = await app.inject({ method: "POST", url: "/api/test-lab/run-all" });
    expect(runAllRes.statusCode).toBe(200);
    const runAllBody = runAllRes.json();
    expect(runAllBody.total).toBe(9);
    expect(runAllBody.passed).toBe(9);
    expect(runAllBody.failed).toBe(0);
  });

  it("validates workflows dry-run via POST /api/workflows/validate", async () => {
    const { app } = await setup();

    // Valid graph
    const validRes = await app.inject({
      method: "POST",
      url: "/api/workflows/validate",
      payload: validGraph,
    });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.json().ok).toBe(true);

    // Invalid graph (empty text in send_text)
    const invalidRes = await app.inject({
      method: "POST",
      url: "/api/workflows/validate",
      payload: {
        ...validGraph,
        nodes: [
          { nodeKey: "t", type: "trigger", config: {} },
          { nodeKey: "s", type: "send_text", config: { text: "" } },
        ],
        edges: [{ sourceKey: "t", targetKey: "s" }],
      },
    });
    expect(invalidRes.statusCode).toBe(400);
    expect(invalidRes.json().ok).toBe(false);
  });

  it("creates and triggers workflows programmatically via REST API", async () => {
    const { db, app } = await setup();

    // 1. Create session and contact
    db.prepare("INSERT INTO sessions (name, provider_session_id, status) VALUES ('Test Sess', 'sess_test', 'connected')").run();
    const session = db.prepare("SELECT id FROM sessions WHERE provider_session_id = 'sess_test'").get() as { id: number };

    db.prepare("INSERT INTO contacts (phone, name) VALUES ('+15551234567', 'API Lead')").run();
    const contact = db.prepare("SELECT id FROM contacts WHERE phone = '+15551234567'").get() as { id: number };

    // 2. Programmatically create workflow
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows/programmatic",
      payload: {
        name: "Programmatic VIP Onboarding",
        description: "Created via REST API without code change",
        active: 1,
        sessionId: session.id,
        nodes: [
          { nodeKey: "trig", type: "trigger", config: { keywords: ["start"] } },
          { nodeKey: "greet", type: "send_text", config: { text: "Hello from API!" } },
          { nodeKey: "end", type: "end", config: {} },
        ],
        edges: [
          { sourceKey: "trig", targetKey: "greet" },
          { sourceKey: "greet", targetKey: "end" },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.ok).toBe(true);
    expect(created.id).toBeGreaterThan(0);

    // 3. Programmatically trigger workflow
    const trigRes = await app.inject({
      method: "POST",
      url: `/api/workflows/${created.id}/trigger`,
      payload: {
        contactId: contact.id,
        initialVars: { promoCode: "SUMMER2026" },
      },
    });

    expect(trigRes.statusCode).toBe(200);
    const trigBody = trigRes.json();
    expect(trigBody.ok).toBe(true);
    expect(trigBody.executionId).toBeGreaterThan(0);
  });
});

describe("workflows via the DbClient seam (provider-aware port)", () => {
  it("POST /api/workflows writes the workflow and its graph into the active provider", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const writes: string[] = [];
    const { dbClient } = pgMockDbClient(db, (text) => {
      if (/INSERT INTO workflows/.test(text)) return [{ id: 42 }];
      if (/INSERT INTO workflow_nodes/.test(text)) {
        writes.push("nodes");
        return [{ id: 1 }];
      }
      if (/INSERT INTO workflow_edges/.test(text)) {
        writes.push("edges");
        return [{ id: 1 }];
      }
      if (/DELETE FROM workflow_nodes/.test(text) || /DELETE FROM workflow_edges/.test(text)) return [];
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
    });
    const res = await app.inject({ method: "POST", url: "/api/workflows", payload: validGraph });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(42);
    expect(writes).toContain("nodes");
    expect(writes).toContain("edges");
  });

  it("GET /api/workflows/:id reads workflow, nodes, and edges from the active provider (config pre-parsed)", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const { dbClient } = pgMockDbClient(db, (text) => {
      if (/WHERE w.id =/.test(text)) {
        return [
          {
            id: 7,
            name: "Provider Workflow",
            description: null,
            active: true,
            sessionId: null,
            sessionName: null,
            experimentId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      if (/FROM workflow_nodes WHERE workflow_id =/.test(text)) {
        return [
          { node_key: "t", type: "trigger", config: { phrase: "hi" }, position_x: 10, position_y: 20 },
          { node_key: "e", type: "end", config: {}, position_x: 0, position_y: 0 },
        ];
      }
      if (/FROM workflow_edges WHERE workflow_id =/.test(text)) {
        return [{ source_key: "t", target_key: "e", handle: null }];
      }
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
    });
    const res = await app.inject({ method: "GET", url: "/api/workflows/7" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(7);
    expect(body.name).toBe("Provider Workflow");
    expect(body.nodes).toHaveLength(2);
    expect(body.nodes[0]).toEqual({ nodeKey: "t", type: "trigger", config: { phrase: "hi" }, positionX: 10, positionY: 20 });
    expect(body.edges).toEqual([{ sourceKey: "t", targetKey: "e" }]);
  });

  it("POST /api/workflows/:id/duplicate reads source and writes copy through the active provider", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const writes: string[] = [];
    const { dbClient } = pgMockDbClient(db, (text) => {
      if (/SELECT \* FROM workflows WHERE id =/.test(text)) {
        return [{ id: 5, name: "Original", description: "d", session_id: null, experiment_id: null }];
      }
      if (/INSERT INTO workflows/.test(text)) {
        writes.push("workflow");
        return [{ id: 99 }];
      }
      if (/FROM workflow_nodes WHERE workflow_id =/.test(text)) {
        return [{ node_key: "t", type: "trigger", config: "{}", position_x: 0, position_y: 0 }];
      }
      if (/FROM workflow_edges WHERE workflow_id =/.test(text)) return [];
      if (/INSERT INTO workflow_nodes/.test(text)) {
        writes.push("nodes");
        return [{ id: 1 }];
      }
      if (/INSERT INTO workflow_edges/.test(text)) {
        writes.push("edges");
        return [{ id: 1 }];
      }
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
    });
    const res = await app.inject({ method: "POST", url: "/api/workflows/5/duplicate" });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(99);
    expect(writes).toEqual(["workflow", "nodes"]);
  });

  it("PUT /api/workflows/:id updates via the provider; DELETE /api/workflows/:id removes via the provider", async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const seen: string[] = [];
    const { dbClient } = pgMockDbClient(db, (text) => {
      seen.push(text);
      if (/SELECT id FROM workflows WHERE id =/.test(text)) return [{ id: 3 }];
      if (/UPDATE workflows SET/.test(text)) return [];
      if (/DELETE FROM workflow_nodes/.test(text) || /DELETE FROM workflow_edges/.test(text)) return [];
      if (/INSERT INTO workflow_nodes/.test(text)) return [{ id: 1 }];
      if (/INSERT INTO workflow_edges/.test(text)) return [{ id: 1 }];
      if (/DELETE FROM workflows WHERE id =/.test(text)) return [{ id: 3 }];
      return [];
    });
    const app = await buildApp(dbClient, {
      clock: new FakeClock(),
      sendMessage: async () => ({ providerMessageId: "mock" }),
    });

    const put = await app.inject({ method: "PUT", url: "/api/workflows/3", payload: validGraph });
    expect(put.statusCode).toBe(200);
    expect(seen.some((t) => /UPDATE workflows SET/.test(t))).toBe(true);

    const del = await app.inject({ method: "DELETE", url: "/api/workflows/3" });
    expect(del.statusCode).toBe(200);
    expect(seen.some((t) => /DELETE FROM workflows WHERE id =/.test(t))).toBe(true);
  });
});
