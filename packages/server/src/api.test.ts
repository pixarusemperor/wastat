import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";

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
});
