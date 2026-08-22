import type { FastifyInstance } from "fastify";
import type BetterSqlite3 from "better-sqlite3";
import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";

const NODE_TYPES = new Set(["trigger", "keyword", "send_text", "send_media", "delay", "end"]);

interface GraphInput {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  experimentId?: unknown;
  nodes?: unknown;
  edges?: unknown;
}

interface NodeInput {
  nodeKey: string;
  type: string;
  config: unknown;
}

interface EdgeInput {
  sourceKey: string;
  targetKey: string;
}

interface ParsedGraph {
  name: string;
  description: string | null;
  active: number;
  experimentId: number | null;
  nodes: Array<{ nodeKey: string; type: string; config: unknown }>;
  edges: EdgeInput[];
}

/** Trust boundary: validate the submitted graph before it touches the DB. */
function parseGraph(body: unknown): { error: string } | { graph: ParsedGraph } {
  const b = (body ?? {}) as GraphInput;
  if (typeof b.name !== "string" || !b.name.trim()) return { error: "name is required" };
  if (!Array.isArray(b.nodes)) return { error: "nodes must be an array" };
  const nodes = b.nodes as NodeInput[];
  for (const n of nodes) {
    if (typeof n?.nodeKey !== "string" || !n.nodeKey) return { error: "nodeKey is required" };
    if (!NODE_TYPES.has(n.type)) return { error: `unknown node type: ${n.type}` };
  }
  const keys = new Set(nodes.map((n) => n.nodeKey));
  if (keys.size !== nodes.length) return { error: "duplicate nodeKey" };
  if (!Array.isArray(b.edges)) return { error: "edges must be an array" };
  for (const e of b.edges as EdgeInput[]) {
    if (!keys.has(e?.sourceKey) || !keys.has(e?.targetKey)) {
      return { error: `edge references unknown node` };
    }
  }
  return {
    graph: {
      name: b.name,
      description: typeof b.description === "string" ? b.description : null,
      active: b.active === true ? 1 : 0,
      experimentId: typeof b.experimentId === "number" ? b.experimentId : null,
      nodes: nodes.map((n) => ({ ...n, config: n.config ?? {} })),
      edges: b.edges as EdgeInput[],
    },
  };
}

export function registerApiRoutes(
  app: FastifyInstance,
  db: BetterSqlite3.Database,
  opts?: { wasenderPat?: string; fetchImpl?: typeof fetch },
): void {
  const insertWorkflow = db.prepare(
    "INSERT INTO workflows (name, description, active, experiment_id) VALUES (?, ?, ?, ?)",
  );
  const insertNode = db.prepare(
    "INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)",
  );
  const insertEdge = db.prepare(
    "INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)",
  );

  const saveGraph = db.transaction((workflowId: number, graph: ParsedGraph) => {
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
    for (const n of graph.nodes) insertNode.run(workflowId, n.nodeKey, n.type, JSON.stringify(n.config));
    for (const e of graph.edges) insertEdge.run(workflowId, e.sourceKey, e.targetKey);
  });

  app.post("/api/workflows", async (request, reply) => {
    const parsed = parseGraph(request.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    const g = parsed.graph;
    const info = insertWorkflow.run(g.name, g.description, g.active, g.experimentId);
    const workflowId = Number(info.lastInsertRowid);
    saveGraph(workflowId, g);
    return reply.code(201).send({ id: workflowId });
  });

  app.get("/api/workflows", async () => {
    return db.prepare("SELECT id, name, description, active, experiment_id AS experimentId FROM workflows ORDER BY id").all();
  });

  app.get<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const wf = db
      .prepare("SELECT id, name, description, active, experiment_id AS experimentId FROM workflows WHERE id = ?")
      .get(request.params.id) as Record<string, unknown> | undefined;
    if (!wf) return reply.code(404).send({ error: "not found" });
    const nodes = (
      db.prepare("SELECT node_key, type, config FROM workflow_nodes WHERE workflow_id = ? ORDER BY id").all(request.params.id) as any[]
    ).map((n) => ({ nodeKey: n.node_key, type: n.type, config: JSON.parse(n.config) }));
    const edges = (
      db.prepare("SELECT source_key, target_key FROM workflow_edges WHERE workflow_id = ? ORDER BY id").all(request.params.id) as any[]
    ).map((e) => ({ sourceKey: e.source_key, targetKey: e.target_key }));
    return { ...wf, nodes, edges };
  });

  app.put<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const exists = db.prepare("SELECT id FROM workflows WHERE id = ?").get(id);
    if (!exists) return reply.code(404).send({ error: "not found" });
    const parsed = parseGraph(request.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    const g = parsed.graph;
    db.prepare("UPDATE workflows SET name = ?, description = ?, active = ?, experiment_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
      g.name,
      g.description,
      g.active,
      g.experimentId,
      id,
    );
    saveGraph(id, g);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const info = db.prepare("DELETE FROM workflows WHERE id = ?").run(request.params.id);
    if (info.changes === 0) return reply.code(404).send({ error: "not found" });
    return { ok: true };
  });

  app.post("/api/experiments", async (request, reply) => {
    const b = (request.body ?? {}) as { name?: unknown; description?: unknown };
    if (typeof b.name !== "string" || !b.name.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }
    const info = db
      .prepare("INSERT INTO experiments (name, description) VALUES (?, ?)")
      .run(b.name, typeof b.description === "string" ? b.description : null);
    return reply.code(201).send({ id: Number(info.lastInsertRowid) });
  });

  app.get("/api/experiments", async () => {
    return db.prepare("SELECT id, name, description, active FROM experiments ORDER BY id").all();
  });

  // ---- Sessions management (Wasender account-level) ----
  if (opts?.wasenderPat) {
    const admin = makeWasenderAdmin(opts.wasenderPat, opts.fetchImpl);
    const getLocal = db.prepare("SELECT id FROM sessions WHERE provider_session_id = ?");

    /** List remote sessions and mirror them locally — the local table is the
     * webhook-facing source of truth for api keys and secrets. */
    async function syncSessions() {
      for (const s of await admin.listSessions()) upsertSession(db, s);
      return db
        .prepare(
          "SELECT id, name, provider_session_id AS providerSessionId, status FROM sessions ORDER BY id",
        )
        .all();
    }

    app.get("/api/sessions", async () => syncSessions());

    app.post<{ Body: { name?: unknown } }>("/api/sessions", async (request, reply) => {
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (!name) return reply.code(400).send({ error: "name is required" });
      try {
        const created = await admin.createSession(name);
        upsertSession(db, created);
        const local = getLocal.get(String(created.id)) as { id: number } | undefined;
        return reply.code(201).send({
          id: local?.id ?? 0,
          providerSessionId: String(created.id),
          name: created.name,
          status: created.status,
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender create failed" });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      await admin.deleteSession(Number(row.provider_session_id));
      db.prepare("DELETE FROM sessions WHERE id = ?").run(localId);
      return { ok: true };
    });
  }
}
