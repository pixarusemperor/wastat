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
