import type { FastifyInstance } from "fastify";
import type BetterSqlite3 from "better-sqlite3";
import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";
import { queryAll, queryGet, queryRun, type DbClient } from "./db/client.js";
import type { createEngine } from "./engine.js";
import { validateWorkflowGraph } from "@wastat/shared";
import { aiRoutes } from "./routes/ai.js";
import { broadcastRoutes } from "./routes/broadcasts.js";
import { mcpRoutes } from "./routes/mcp.js";

const NODE_TYPES = new Set([
  "trigger",
  "keyword",
  "trigger_personal",
  "trigger_group",
  "trigger_reaction",
  "trigger_poll_result",
  "trigger_call",
  "trigger_participant",
  "send_text",
  "send_media",
  "send_menu",
  "send_poll",
  "send_contact",
  "send_location",
  "send_presence",
  "mark_read",
  "react_message",
  "block_contact",
  "unblock_contact",
  "upsert_contact",
  "add_group_participant",
  "remove_group_participant",
  "collect_input",
  "condition",
  "split_test",
  "delay",
  "milestone",
  "end",
]);

export interface ApiRoutesOptions {
  wasenderPat?: string;
  fetchImpl?: typeof fetch;
  engine?: ReturnType<typeof createEngine>;
}

interface GraphInput {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  sessionId?: unknown;
  experimentId?: unknown;
  nodes?: unknown;
  edges?: unknown;
}

interface NodeInput {
  nodeKey: string;
  type: string;
  config: unknown;
  positionX?: number;
  positionY?: number;
}

interface EdgeInput {
  sourceKey: string;
  targetKey: string;
  handle?: string;
}

interface ParsedGraph {
  name: string;
  description: string | null;
  active: number;
  sessionId: number | null;
  experimentId: number | null;
  nodes: Array<{ nodeKey: string; type: string; config: unknown; positionX: number; positionY: number }>;
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
      active: b.active === true || b.active === 1 ? 1 : 0,
      sessionId: typeof b.sessionId === "number" ? b.sessionId : null,
      experimentId: typeof b.experimentId === "number" ? b.experimentId : null,
      nodes: nodes.map((n) => ({
        ...n,
        config: n.config ?? {},
        positionX: typeof n.positionX === "number" ? n.positionX : 0,
        positionY: typeof n.positionY === "number" ? n.positionY : 0,
      })),
      edges: b.edges as EdgeInput[],
    },
  };
}

export function registerApiRoutes(
  app: FastifyInstance,
  dbClient: DbClient,
  opts?: ApiRoutesOptions,
): void {
  // Unported routes run against the sqlite side of the seam (index.ts guarantees
  // a schema-applied handle in every mode); ported routes use dbClient directly.
  const db = dbClient.sqlite;
  if (!db) throw new Error("registerApiRoutes requires a sqlite-capable database handle");

  void app.register(aiRoutes);
  void app.register(broadcastRoutes);
  void app.register(mcpRoutes);

  // Ported helpers: the workflow slice reads/writes the active provider.
  // JSONB vs TEXT config: pg (postgres.js) serializes objects and returns
  // them pre-parsed; sqlite stores a JSON string. `active` is BOOLEAN on pg
  // but 0/1 INTEGER on sqlite — normalize reads to 0/1 so the API contract
  // (and the web client) stays identical across providers. BIGSERIAL ids
  // come back as strings from postgres.js — coerce to numbers.
  const isPg = Boolean(dbClient.sql);

  const configToDb = (config: unknown) => (isPg ? config : JSON.stringify(config));
  const configFromDb = (config: unknown) =>
    typeof config === "string" ? JSON.parse(config) : (config as unknown);
  const activeToDb = (active: number) => (isPg ? active === 1 : active);
  const activeFromDb = (active: unknown) => (active ? 1 : 0);

  async function insertWorkflowRow(g: {
    name: string;
    description: string | null;
    active: number;
    sessionId: number | null;
    experimentId: number | null;
  }): Promise<number> {
    const info = await queryRun(
      dbClient,
      "INSERT INTO workflows (name, description, active, session_id, experiment_id) VALUES (?, ?, ?, ?, ?)",
      [g.name, g.description, activeToDb(g.active), g.sessionId, g.experimentId],
    );
    return Number(info.lastInsertRowid);
  }

  async function saveGraph(workflowId: number, graph: ParsedGraph) {
    if (isPg) {
      // postgres.js transaction: rewrite nodes + edges atomically.
      await dbClient.sql!.begin(async (tx) => {
        // postgres.js begin() yields a tx-scoped client; present it to the
        // query helpers as a DbClient (cast via unknown — TransactionSql is
        // not statically assignable to Sql).
        const txClient = { ...dbClient, sql: tx } as unknown as DbClient;
        await queryRun(txClient, "DELETE FROM workflow_nodes WHERE workflow_id = ?", [workflowId]);
        await queryRun(txClient, "DELETE FROM workflow_edges WHERE workflow_id = ?", [workflowId]);
        for (const n of graph.nodes) {
          await queryRun(
            txClient,
            "INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)",
            [workflowId, n.nodeKey, n.type, configToDb(n.config), n.positionX, n.positionY],
          );
        }
        for (const e of graph.edges) {
          await queryRun(
            txClient,
            "INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)",
            [workflowId, e.sourceKey, e.targetKey, e.handle ?? null],
          );
        }
      });
      return;
    }
    // sqlite path: same work inside the sync transaction (existing behavior).
    const sqlite = db;
    if (!sqlite) throw new Error("registerApiRoutes requires a sqlite-capable database handle");
    sqlite.transaction((workflowId: number, graph: ParsedGraph) => {
      sqlite.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
      sqlite.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
      for (const n of graph.nodes) {
        sqlite.prepare(
          "INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(workflowId, n.nodeKey, n.type, configToDb(n.config), n.positionX, n.positionY);
      }
      for (const e of graph.edges) {
        sqlite.prepare(
          "INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)",
        ).run(workflowId, e.sourceKey, e.targetKey, e.handle ?? null);
      }
    })(workflowId, graph);
  }

  app.post("/api/workflows", async (request, reply) => {
    const parsed = parseGraph(request.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    const g = parsed.graph;
    const workflowId = await insertWorkflowRow(g);
    await saveGraph(workflowId, g);
    return reply.code(201).send({ id: workflowId });
  });

  /**
   * Pre-flight dry-run validation endpoint (inspired by clawflow POST /flows/validate)
   */
  app.post("/api/workflows/validate", async (request, reply) => {
    const parsed = parseGraph(request.body);
    if ("error" in parsed) {
      return reply.code(400).send({ ok: false, error: parsed.error });
    }
    const validation = validateWorkflowGraph({
      nodes: parsed.graph.nodes.map((n) => ({
        nodeKey: n.nodeKey,
        type: n.type as any,
        config: n.config as any,
        positionX: n.positionX,
        positionY: n.positionY,
      })),
      edges: parsed.graph.edges.map((e) => ({
        sourceKey: e.sourceKey,
        targetKey: e.targetKey,
        handle: e.handle,
      })),
    });
    if (!validation.ok) {
      return reply.code(400).send(validation);
    }
    return reply.code(200).send(validation);
  });

  /**
   * Programmatic Workflow Generation API:
   * Enables external systems, scripts, and LLMs to create or upsert workflows with full static schema validation.
   */
  app.post("/api/workflows/programmatic", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, any>;
    const parsed = parseGraph(body);
    if ("error" in parsed) {
      return reply.code(400).send({ ok: false, error: parsed.error });
    }

    const g = parsed.graph;
    const validation = validateWorkflowGraph({
      nodes: g.nodes.map((n) => ({
        nodeKey: n.nodeKey,
        type: n.type as any,
        config: n.config as any,
        positionX: n.positionX,
        positionY: n.positionY,
      })),
      edges: g.edges.map((e) => ({
        sourceKey: e.sourceKey,
        targetKey: e.targetKey,
        handle: e.handle,
      })),
    });

    if (!validation.ok) {
      return reply.code(400).send({
        ok: false,
        error: "Structural validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    let workflowId: number;
    const existing = (await queryGet(dbClient, "SELECT id FROM workflows WHERE name = ?", [g.name])) as
      | { id: number }
      | undefined;

    if (existing) {
      workflowId = Number(existing.id);
      await queryRun(
        dbClient,
        `
        UPDATE workflows 
        SET description = ?, active = ?, session_id = ?, experiment_id = ?${isPg ? ", updated_at = now()" : ", updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"}
        WHERE id = ?
      `,
        [g.description, activeToDb(g.active), g.sessionId, g.experimentId, workflowId],
      );
    } else {
      workflowId = await insertWorkflowRow(g);
    }

    await saveGraph(workflowId, g);

    return reply.code(existing ? 200 : 201).send({
      ok: true,
      id: workflowId,
      name: g.name,
      active: g.active === 1,
      sessionId: g.sessionId,
      warnings: validation.warnings,
    });
  });

  /**
   * Programmatic Workflow Trigger API:
   * Instantly executes a workflow for a specific phone number or contact.
   */
  app.post<{
    Params: { id: string };
    Body: { phone?: string; contactId?: number; sessionId?: number; initialVars?: Record<string, unknown> };
  }>("/api/workflows/:id/trigger", async (request, reply) => {
    const workflowId = Number(request.params.id);
    const wf = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflowId) as
      | { id: number; name: string; session_id: number | null; active: number }
      | undefined;
    if (!wf) return reply.code(404).send({ error: "Workflow not found" });
    if (!opts?.engine) return reply.code(500).send({ error: "Engine is not initialized on server" });

    const { phone, contactId, sessionId, initialVars } = request.body || {};
    let targetContactId = contactId;

    if (!targetContactId && phone) {
      db.prepare("INSERT INTO contacts (phone, name) VALUES (?, 'Programmatic Contact') ON CONFLICT DO NOTHING").run(phone);
      const c = db.prepare("SELECT id FROM contacts WHERE phone = ?").get(phone) as { id: number } | undefined;
      targetContactId = c?.id;
    }

    if (!targetContactId) {
      return reply.code(400).send({ error: "Either 'phone' or 'contactId' is required to trigger a workflow" });
    }

    const targetSessionId = sessionId || wf.session_id;
    if (!targetSessionId) {
      return reply.code(400).send({ error: "No session_id assigned to workflow or provided in request" });
    }

    try {
      const executionId = opts.engine.startExecution(
        wf.id,
        targetSessionId,
        targetContactId,
        undefined,
        initialVars || {},
      );

      return reply.code(200).send({
        ok: true,
        workflowId: wf.id,
        workflowName: wf.name,
        executionId,
        sessionId: targetSessionId,
        contactId: targetContactId,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message || String(err) });
    }
  });

  app.get("/api/workflows", async () => {
    const rows = await queryAll(
      dbClient,
      `
        SELECT w.id, w.name, w.description, w.active, w.session_id AS "sessionId", s.name AS "sessionName",
               w.experiment_id AS "experimentId", w.created_at AS "createdAt", w.updated_at AS "updatedAt"
        FROM workflows w
        LEFT JOIN sessions s ON s.id = w.session_id
        ORDER BY w.id DESC
      `,
    );
    return rows.map((r: any) => ({
      ...r,
      id: Number(r.id),
      active: activeFromDb(r.active),
      sessionId: r.sessionId != null ? Number(r.sessionId) : null,
      experimentId: r.experimentId != null ? Number(r.experimentId) : null,
    }));
  });

  app.get<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const wf = (await queryGet(
      dbClient,
      `
        SELECT w.id, w.name, w.description, w.active, w.session_id AS "sessionId", s.name AS "sessionName",
               w.experiment_id AS "experimentId", w.created_at AS "createdAt", w.updated_at AS "updatedAt"
        FROM workflows w
        LEFT JOIN sessions s ON s.id = w.session_id
        WHERE w.id = ?
      `,
      [request.params.id],
    )) as Record<string, unknown> | undefined;
    if (!wf) return reply.code(404).send({ error: "not found" });
    const nodes = (
      (await queryAll(
        dbClient,
        "SELECT node_key, type, config, position_x, position_y FROM workflow_nodes WHERE workflow_id = ? ORDER BY id",
        [request.params.id],
      )) as any[]
    ).map((n) => {
      const nodeObj: any = {
        nodeKey: n.node_key,
        type: n.type,
        config: configFromDb(n.config),
      };
      if (n.position_x || n.position_y) {
        nodeObj.positionX = n.position_x;
        nodeObj.positionY = n.position_y;
      }
      return nodeObj;
    });
    const edges = (
      (await queryAll(
        dbClient,
        "SELECT source_key, target_key, handle FROM workflow_edges WHERE workflow_id = ? ORDER BY id",
        [request.params.id],
      )) as any[]
    ).map((e) => {
      const edgeObj: any = {
        sourceKey: e.source_key,
        targetKey: e.target_key,
      };
      if (e.handle) {
        edgeObj.handle = e.handle;
      }
      return edgeObj;
    });
    return { ...wf, id: Number(wf.id), active: activeFromDb(wf.active), nodes, edges };
  });

  app.put<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const exists = await queryGet(dbClient, "SELECT id FROM workflows WHERE id = ?", [id]);
    if (!exists) return reply.code(404).send({ error: "not found" });
    const parsed = parseGraph(request.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    const g = parsed.graph;
    await queryRun(
      dbClient,
      `UPDATE workflows SET name = ?, description = ?, active = ?, session_id = ?, experiment_id = ?, updated_at = ${isPg ? "now()" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')"} WHERE id = ?`,
      [g.name, g.description, activeToDb(g.active), g.sessionId, g.experimentId, id],
    );
    await saveGraph(id, g);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/workflows/:id/duplicate", async (request, reply) => {
    const id = Number(request.params.id);
    const sourceWf = (await queryGet(dbClient, "SELECT * FROM workflows WHERE id = ?", [id])) as
      | {
          name: string;
          description: string | null;
          session_id: number | null;
          experiment_id: number | null;
        }
      | undefined;
    if (!sourceWf) return reply.code(404).send({ error: "Source workflow not found" });

    const newName = `${sourceWf.name} (Copy)`;
    const newWorkflowId = await insertWorkflowRow({
      name: newName,
      description: sourceWf.description,
      active: 0, // new duplicates start as inactive/draft
      sessionId: sourceWf.session_id != null ? Number(sourceWf.session_id) : null,
      experimentId: sourceWf.experiment_id != null ? Number(sourceWf.experiment_id) : null,
    });

    const nodes = (await queryAll(
      dbClient,
      "SELECT node_key, type, config, position_x, position_y FROM workflow_nodes WHERE workflow_id = ?",
      [id],
    )) as Array<{ node_key: string; type: string; config: unknown; position_x: number; position_y: number }>;
    for (const n of nodes) {
      await queryRun(
        dbClient,
        "INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)",
        [newWorkflowId, n.node_key, n.type, configToDb(configFromDb(n.config)), n.position_x, n.position_y],
      );
    }

    const edges = (await queryAll(
      dbClient,
      "SELECT source_key, target_key, handle FROM workflow_edges WHERE workflow_id = ?",
      [id],
    )) as Array<{ source_key: string; target_key: string; handle: string | null }>;
    for (const e of edges) {
      await queryRun(
        dbClient,
        "INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)",
        [newWorkflowId, e.source_key, e.target_key, e.handle ?? null],
      );
    }

    return reply.code(201).send({ id: newWorkflowId, name: newName });
  });

  app.delete<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const row = await queryGet(dbClient, "SELECT id FROM workflows WHERE id = ?", [id]);
    if (!row) return reply.code(404).send({ error: "not found" });
    await queryRun(dbClient, "DELETE FROM workflows WHERE id = ?", [id]);
    return { ok: true };
  });

  app.post("/api/experiments", async (request, reply) => {
    const b = (request.body ?? {}) as { name?: unknown; description?: unknown; active?: unknown };
    if (typeof b.name !== "string" || !b.name.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }
    const info = db
      .prepare("INSERT INTO experiments (name, description, active) VALUES (?, ?, ?)")
      .run(b.name.trim(), typeof b.description === "string" ? b.description.trim() : null, b.active === false ? 0 : 1);
    return reply.code(201).send({ id: Number(info.lastInsertRowid) });
  });

  app.get("/api/experiments", async () => {
    return db
      .prepare(`
        SELECT e.id, e.name, e.description, e.active,
               (SELECT COUNT(*) FROM workflows WHERE experiment_id = e.id) AS variantCount,
               (SELECT COUNT(DISTINCT contact_id) FROM experiment_assignments WHERE experiment_id = e.id) AS totalAssigned
        FROM experiments e
        ORDER BY e.id DESC
      `)
      .all();
  });

  app.get<{ Params: { id: string } }>("/api/experiments/:id", async (request, reply) => {
    const expId = Number(request.params.id);
    const exp = db
      .prepare("SELECT id, name, description, active, created_at AS createdAt FROM experiments WHERE id = ?")
      .get(expId) as Record<string, unknown> | undefined;
    if (!exp) return reply.code(404).send({ error: "not found" });
    const workflows = db
      .prepare("SELECT id, name, description, active FROM workflows WHERE experiment_id = ? ORDER BY id ASC")
      .all(expId);
    return { ...exp, workflows };
  });

  app.put<{ Params: { id: string } }>("/api/experiments/:id", async (request, reply) => {
    const expId = Number(request.params.id);
    const exp = db.prepare("SELECT id FROM experiments WHERE id = ?").get(expId);
    if (!exp) return reply.code(404).send({ error: "not found" });
    const b = (request.body ?? {}) as { name?: unknown; description?: unknown; active?: unknown };
    if (typeof b.name !== "string" || !b.name.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }
    db.prepare("UPDATE experiments SET name = ?, description = ?, active = ? WHERE id = ?").run(
      b.name.trim(),
      typeof b.description === "string" ? b.description.trim() : null,
      b.active === false ? 0 : 1,
      expId,
    );
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/experiments/:id", async (request, reply) => {
    const expId = Number(request.params.id);
    const exp = db.prepare("SELECT id FROM experiments WHERE id = ?").get(expId);
    if (!exp) return reply.code(404).send({ error: "not found" });
    db.transaction(() => {
      db.prepare("UPDATE workflows SET experiment_id = NULL WHERE experiment_id = ?").run(expId);
      db.prepare("DELETE FROM experiment_assignments WHERE experiment_id = ?").run(expId);
      db.prepare("DELETE FROM experiments WHERE id = ?").run(expId);
    })();
    return { ok: true };
  });

  // PRD §33: reply-rate per variant and experiment totals.
  app.get<{ Params: { id: string } }>("/api/experiments/:id/stats", async (request, reply) => {
    const expId = Number(request.params.id);
    const exp = db.prepare("SELECT id, name, description, active FROM experiments WHERE id = ?").get(expId) as { id: number; name: string; description: string | null; active: number } | undefined;
    if (!exp) return reply.code(404).send({ error: "not found" });
    const variants = db
      .prepare(`
        SELECT w.id AS workflowId, w.name, w.active,
          (SELECT COUNT(DISTINCT contact_id) FROM experiment_assignments WHERE experiment_id = ? AND workflow_id = w.id) AS assigned,
          (SELECT COUNT(DISTINCT m.contact_id) FROM messages m
             JOIN workflow_executions we ON we.id = m.workflow_execution_id
            WHERE we.workflow_id = w.id AND m.direction = 'out') AS messaged,
          (SELECT COUNT(DISTINCT r.contact_id) FROM messages r
            WHERE r.direction = 'in' AND r.in_reply_to_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM messages o WHERE o.id = r.in_reply_to_id
                          AND o.workflow_execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = w.id))) AS replied
        FROM workflows w
        WHERE w.experiment_id = ?
        ORDER BY w.id ASC
      `)
      .all(expId, expId) as Array<{ workflowId: number; name: string; active: number; assigned: number; messaged: number; replied: number }>;

    const variantStats = variants.map((r) => ({
      ...r,
      replyRate: r.assigned > 0 ? Math.round((r.replied / r.assigned) * 1000) / 10 : 0,
    }));

    const totalAssigned = variantStats.reduce((sum, v) => sum + v.assigned, 0);
    const totalMessaged = variantStats.reduce((sum, v) => sum + v.messaged, 0);
    const totalReplied = variantStats.reduce((sum, v) => sum + v.replied, 0);
    const totalReplyRate = totalAssigned > 0 ? Math.round((totalReplied / totalAssigned) * 1000) / 10 : 0;

    return {
      experiment: exp,
      totals: {
        assigned: totalAssigned,
        messaged: totalMessaged,
        replied: totalReplied,
        replyRate: totalReplyRate,
      },
      variants: variantStats,
    };
  });

  // PRD §46: inbox — conversations per session, then a thread.
  app.get<{ Querystring: { sessionId?: string } }>("/api/conversations", async (request) => {
    const sessionId = Number(request.query.sessionId ?? 1);
    return db
      .prepare(`
        SELECT c.id AS contactId, c.phone, c.name,
               MAX(m.timestamp) AS lastAt,
               (SELECT text FROM messages WHERE session_id = ? AND contact_id = c.id ORDER BY id DESC LIMIT 1) AS lastMessage
        FROM contacts c
        JOIN messages m ON m.contact_id = c.id AND m.session_id = ?
        GROUP BY c.id ORDER BY lastAt DESC LIMIT 200
      `)
      .all(sessionId, sessionId);
  });

  app.get<{ Querystring: { sessionId?: string; contactId?: string } }>(
    "/api/messages",
    async (request, reply) => {
      const { sessionId = "1", contactId = "" } = request.query;
      if (!contactId) return reply.code(400).send({ error: "contactId is required" });
      return db
        .prepare(`
          SELECT
            m.id,
            m.direction,
            m.message_type AS messageType,
            m.text,
            m.status,
            m.timestamp,
            m.workflow_execution_id AS workflowExecutionId,
            m.node_key AS nodeKey,
            m.in_reply_to_id AS inReplyToId,
            w.name AS workflowName,
            w.id AS workflowId,
            e.name AS experimentName,
            e.id AS experimentId,
            reply_w.name AS repliedWorkflowName,
            reply_e.name AS repliedExperimentName
          FROM messages m
          LEFT JOIN workflow_executions we ON we.id = m.workflow_execution_id
          LEFT JOIN workflows w ON w.id = we.workflow_id
          LEFT JOIN experiments e ON e.id = w.experiment_id
          LEFT JOIN messages parent_m ON parent_m.id = m.in_reply_to_id
          LEFT JOIN workflow_executions parent_we ON parent_we.id = parent_m.workflow_execution_id
          LEFT JOIN workflows reply_w ON reply_w.id = parent_we.workflow_id
          LEFT JOIN experiments reply_e ON reply_e.id = reply_w.experiment_id
          WHERE m.session_id = ? AND m.contact_id = ?
          ORDER BY m.id ASC LIMIT 500
        `)
        .all(Number(sessionId), Number(contactId));
    },
  );

  // Workflow Simulator: simulate incoming message from a contact and trigger matching workflow
  app.post<{ Body: { sessionId?: number; phone?: string; text?: string } }>(
    "/api/simulate",
    async (request, reply) => {
      const sessionId = Number(request.body?.sessionId ?? 1);
      const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "+1234567890";
      const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";

      if (!text) return reply.code(400).send({ error: "text is required" });

      // Upsert contact
      db.prepare("INSERT INTO contacts (phone) VALUES (?) ON CONFLICT(phone) DO NOTHING").run(phone);
      const contact = db.prepare("SELECT id FROM contacts WHERE phone = ?").get(phone) as { id: number };

      // Ensure session exists
      const session =
        (db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: number } | undefined) ??
        (db.prepare("SELECT id FROM sessions ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined);

      let actualSessionId = session?.id;
      if (!actualSessionId) {
        const ins = db
          .prepare(
            "INSERT INTO sessions (name, provider_session_id, status) VALUES ('Default Session', 'default-1', 'connected')",
          )
          .run();
        actualSessionId = Number(ins.lastInsertRowid);
      }

      // Insert incoming message
      const info = db
        .prepare(`
          INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, timestamp)
          VALUES (?, ?, 'in', 'text', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        `)
        .run(actualSessionId, contact.id, text, `sim-${Date.now()}`);

      const messageId = Number(info.lastInsertRowid);

      if (opts?.engine) {
        opts.engine.attributeReply(messageId);
        const executionId = opts.engine.handleIncomingMessage(
          actualSessionId,
          contact.id,
          messageId,
        );

        return reply.code(201).send({
          ok: true,
          contactId: contact.id,
          messageId,
          matched: executionId !== null,
          executionId: executionId ?? undefined,
        });
      }

      return reply.code(201).send({
        ok: true,
        contactId: contact.id,
        messageId,
        matched: false,
      });
    },
  );

  // ---- Sessions management (Wasender account-level) ----
  if (opts?.wasenderPat) {
    const admin = makeWasenderAdmin(opts.wasenderPat, opts.fetchImpl);

    /** List remote sessions and mirror them into the active provider — the
     * sessions table is the webhook-facing source of truth for api keys and
     * secrets. Falls back to the local cache if Wasender is unreachable. */
    async function syncSessions(log?: FastifyInstance["log"]) {
      try {
        for (const s of await admin.listSessions()) await upsertSession(dbClient, s);
      } catch (err) {
        log?.warn({ err }, "Could not sync remote Wasender sessions; serving local cache");
      }
      return queryAll(
        dbClient,
        'SELECT id, name, provider_session_id AS "providerSessionId", status FROM sessions ORDER BY id',
      );
    }

    app.get("/api/sessions", async (request) => syncSessions(request.log));

    app.post<{ Body: { name?: unknown } }>("/api/sessions", async (request, reply) => {
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (!name) return reply.code(400).send({ error: "name is required" });
      try {
        // Auto-point the session's webhook at this deployment so events flow back.
        const base = process.env.PUBLIC_BASE_URL;
        const webhookUrl = base ? `${base.replace(/\/$/, "")}/webhooks/wasender/{id}` : undefined;
        const created = await admin.createSession(name, webhookUrl);
        await upsertSession(dbClient, created);
        const local = (await queryGet(dbClient, "SELECT id FROM sessions WHERE provider_session_id = ?", [
          String(created.id),
        ])) as { id: number } | undefined;
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

    app.post<{ Params: { id: string } }>("/api/sessions/:id/connect", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.connectSession(Number(row.provider_session_id));
        await queryRun(dbClient, "UPDATE sessions SET status = 'connecting' WHERE id = ?", [localId]);
        return { ok: true, status: "connecting" };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender connect failed" });
      }
    });

    app.get<{ Params: { id: string } }>("/api/sessions/:id/qrcode", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        const qrCode = await admin.getQrCode(Number(row.provider_session_id));
        return { qrCode };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Could not fetch QR code from Wasender" });
      }
    });

    app.get<{ Params: { id: string } }>("/api/sessions/:id/status", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id, status FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string; status: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        const status = await admin.getStatus(Number(row.provider_session_id));
        const normalized = String(status).toLowerCase();
        await queryRun(dbClient, "UPDATE sessions SET status = ? WHERE id = ?", [normalized, localId]);
        return { status: normalized };
      } catch (err) {
        request.log.warn(err);
        return { status: row.status };
      }
    });

    app.post<{ Params: { id: string } }>("/api/sessions/:id/restart", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.restartSession(Number(row.provider_session_id));
        return { ok: true };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender restart failed" });
      }
    });

    app.post<{ Params: { id: string } }>("/api/sessions/:id/disconnect", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.disconnectSession(Number(row.provider_session_id));
        await queryRun(dbClient, "UPDATE sessions SET status = 'disconnected' WHERE id = ?", [localId]);
        return { ok: true };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender disconnect failed" });
      }
    });

    app.post<{ Params: { id: string }; Body: { webhookUrl?: string } }>(
      "/api/sessions/:id/sync-webhook",
      async (request, reply) => {
        const localId = Number(request.params.id);
        const row = db
          .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
          .get(localId) as { id: number; provider_session_id: string } | undefined;
        if (!row) return reply.code(404).send({ error: "not found" });
        try {
          const base = process.env.PUBLIC_BASE_URL || "https://wassflow.orizongroup.online";
          const targetUrl =
            request.body?.webhookUrl ||
            `${base.replace(/\/$/, "")}/webhooks/wasender/${row.provider_session_id}`;
          await admin.updateWebhook(Number(row.provider_session_id), targetUrl);
          return { ok: true, webhookUrl: targetUrl };
        } catch (err) {
          request.log.error(err);
          return reply.code(502).send({ error: "Wasender update webhook failed", details: err });
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = (await queryGet(dbClient, "SELECT id, provider_session_id FROM sessions WHERE id = ?", [
        localId,
      ])) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.deleteSession(Number(row.provider_session_id));
      } catch (err) {
        request.log.warn({ err }, "Wasender remote delete failed or session missing");
      }
      await queryRun(dbClient, "DELETE FROM sessions WHERE id = ?", [localId]);
      return { ok: true };
    });
  } else {
    // Read-only session listing when no PAT is provided
    app.get("/api/sessions", async () => {
      return queryAll(
        dbClient,
        'SELECT id, name, provider_session_id AS "providerSessionId", status FROM sessions ORDER BY id',
      );
    });
  }

  // ============================================================
  // CRM, Live Inbox & Funnel Management Endpoints
  // ============================================================

  // List contacts with funnel phase, bot status, and latest message
  app.get("/api/contacts", async () => {
    return db.prepare(`
      SELECT 
        c.id,
        c.phone,
        c.name,
        c.funnel_phase AS funnelPhase,
        c.bot_status AS botStatus,
        c.bot_paused_until AS botPausedUntil,
        c.created_at AS createdAt,
        (SELECT text FROM messages WHERE contact_id = c.id ORDER BY id DESC LIMIT 1) AS lastMessageText,
        (SELECT timestamp FROM messages WHERE contact_id = c.id ORDER BY id DESC LIMIT 1) AS lastMessageTime,
        (SELECT direction FROM messages WHERE contact_id = c.id ORDER BY id DESC LIMIT 1) AS lastMessageDirection
      FROM contacts c
      ORDER BY lastMessageTime DESC, c.id DESC
    `).all();
  });

  // Get contact 360 profile with attributes and tags
  app.get<{ Params: { id: string } }>("/api/contacts/:id", async (request, reply) => {
    const contactId = Number(request.params.id);
    const contact = db.prepare(`
      SELECT id, phone, name, funnel_phase AS funnelPhase, bot_status AS botStatus, bot_paused_until AS botPausedUntil, created_at AS createdAt
      FROM contacts WHERE id = ?
    `).get(contactId) as Record<string, unknown> | undefined;

    if (!contact) return reply.code(404).send({ error: "contact not found" });

    const attrRows = db.prepare("SELECT key, value, updated_at AS updatedAt FROM contact_attributes WHERE contact_id = ?").all(contactId) as Array<{ key: string; value: string; updatedAt: string }>;
    const attributes: Record<string, { value: string; updatedAt: string }> = {};
    for (const a of attrRows) attributes[a.key] = { value: a.value, updatedAt: a.updatedAt };

    const tagRows = db.prepare("SELECT tag FROM contact_tags WHERE contact_id = ?").all(contactId) as Array<{ tag: string }>;
    const tags = tagRows.map((t) => t.tag);

    return { ...contact, attributes, tags };
  });

  // Update bot status (Active <-> Paused Human)
  app.post<{ Params: { id: string }; Body: { status: "active" | "paused_human" | "opted_out"; pauseHours?: number } }>(
    "/api/contacts/:id/bot-status",
    async (request, reply) => {
      const contactId = Number(request.params.id);
      const { status, pauseHours = 24 } = request.body ?? {};

      let pausedUntil: string | null = null;
      if (status === "paused_human") {
        pausedUntil = new Date(Date.now() + pauseHours * 3600 * 1000).toISOString();
      }

      db.prepare("UPDATE contacts SET bot_status = ?, bot_paused_until = ? WHERE id = ?").run(
        status ?? "active",
        pausedUntil,
        contactId,
      );

      return { ok: true, botStatus: status, botPausedUntil: pausedUntil };
    },
  );

  // Resume all contacts to active
  app.post("/api/contacts/resume-all", async (request, reply) => {
    db.prepare("UPDATE contacts SET bot_status = 'active', bot_paused_until = NULL WHERE bot_status = 'paused_human'").run();
    return { ok: true, message: "All contacts resumed to active" };
  });

  // 1-Click Advance to Phase 2
  app.post<{ Params: { id: string }; Body: { workflowId?: number; notes?: string } }>(
    "/api/contacts/:id/advance-phase",
    async (request, reply) => {
      const contactId = Number(request.params.id);
      const { workflowId, notes } = request.body ?? {};

      const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as { phone: string; funnel_phase: string } | undefined;
      if (!contact) return reply.code(404).send({ error: "contact not found" });

      const fromPhase = contact.funnel_phase;
      const toPhase = "phase_2_active";

      db.prepare(`
        UPDATE contacts 
        SET funnel_phase = ?, bot_status = 'active', bot_paused_until = NULL 
        WHERE id = ?
      `).run(toPhase, contactId);

      db.prepare(`
        INSERT INTO funnel_transitions (contact_id, from_phase, to_phase, triggered_by, operator_notes)
        VALUES (?, ?, ?, 'human_operator', ?)
      `).run(contactId, fromPhase, toPhase, notes ?? null);

      // Trigger Phase 2 Workflow if provided or if found in experiment
      if (workflowId && opts?.engine) {
        const session = db.prepare("SELECT session_id FROM messages WHERE contact_id = ? ORDER BY id DESC LIMIT 1").get(contactId) as { session_id: number } | undefined;
        const sessionId = session?.session_id ?? 1;
        opts.engine.startExecution(workflowId, sessionId, contactId);
      }

      return { ok: true, funnelPhase: toPhase };
    },
  );

  // Private Notes for Conversation Thread
  app.get<{ Params: { id: string } }>("/api/contacts/:id/notes", async (request) => {
    const contactId = Number(request.params.id);
    return db.prepare("SELECT id, contact_id AS contactId, author, body, created_at AS createdAt FROM private_notes WHERE contact_id = ? ORDER BY id ASC").all(contactId);
  });

  app.post<{ Params: { id: string }; Body: { body: string; author?: string } }>(
    "/api/contacts/:id/notes",
    async (request, reply) => {
      const contactId = Number(request.params.id);
      const { body, author = "operator" } = request.body ?? {};
      if (!body || !body.trim()) return reply.code(400).send({ error: "body is required" });

      const info = db.prepare("INSERT INTO private_notes (contact_id, author, body) VALUES (?, ?, ?)").run(contactId, author, body.trim());
      return { ok: true, id: Number(info.lastInsertRowid) };
    },
  );

  // Conversation Message Thread
  app.get<{ Params: { id: string } }>("/api/contacts/:id/messages", async (request) => {
    const contactId = Number(request.params.id);
    return db.prepare(`
      SELECT 
        m.id,
        m.session_id AS sessionId,
        m.contact_id AS contactId,
        m.direction,
        m.message_type AS messageType,
        m.text,
        m.media_id AS mediaId,
        m.status,
        m.timestamp,
        m.workflow_execution_id AS workflowExecutionId,
        m.node_key AS nodeKey
      FROM messages m
      WHERE m.contact_id = ?
      ORDER BY m.id ASC
    `).all(contactId);
  });

  // Operator manual send (auto-pauses bot for 24h)
  app.post<{ Params: { id: string }; Body: { text: string; sessionId?: number } }>(
    "/api/contacts/:id/messages",
    async (request, reply) => {
      const contactId = Number(request.params.id);
      const { text, sessionId } = request.body ?? {};
      if (!text || !text.trim()) return reply.code(400).send({ error: "text is required" });

      const contact = db.prepare("SELECT phone FROM contacts WHERE id = ?").get(contactId) as { phone: string } | undefined;
      if (!contact) return reply.code(404).send({ error: "contact not found" });

      const sid = sessionId ?? 1;
      const pausedUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      // Set bot status to paused_human
      db.prepare("UPDATE contacts SET bot_status = 'paused_human', bot_paused_until = ? WHERE id = ?").run(pausedUntil, contactId);

      // Record outbound message in SQLite
      const info = db.prepare(`
        INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
        VALUES (?, ?, 'out', 'text', ?, 'sent', ?)
      `).run(sid, contactId, text.trim(), new Date().toISOString());

      return { ok: true, messageId: Number(info.lastInsertRowid), botStatus: "paused_human", botPausedUntil: pausedUntil };
    },
  );

  // TASK-07: per-variant multi-stage funnel counts.
  app.get<{ Params: { id: string } }>("/api/experiments/:id/funnel", async (request, reply) => {
    const experimentId = Number(request.params.id);
    const exp = db.prepare("SELECT id FROM experiments WHERE id = ?").get(experimentId);
    if (!exp) return reply.code(404).send({ error: "not found" });
    const workflows = db
      .prepare("SELECT id, name FROM workflows WHERE experiment_id = ? ORDER BY id ASC")
      .all(experimentId) as Array<{ id: number; name: string }>;

    const variants = workflows.map((wf) => {
      const row = db
        .prepare(`
          SELECT
            (SELECT COUNT(DISTINCT we.contact_id) FROM workflow_executions we WHERE we.workflow_id = w.id) AS hookReached,
            (SELECT COUNT(DISTINCT m.contact_id) FROM messages m
               JOIN workflow_executions we ON we.id = m.workflow_execution_id
              WHERE we.workflow_id = w.id AND m.direction = 'out' AND m.status IN ('delivered', 'read')) AS hookConverted,
            (SELECT COUNT(*) FROM (
               SELECT m.contact_id FROM messages m
                 JOIN workflow_executions we ON we.id = m.workflow_execution_id
                WHERE we.workflow_id = w.id AND m.direction = 'out'
                GROUP BY m.contact_id HAVING COUNT(m.id) >= 2)) AS presentationSent,
            (SELECT COUNT(DISTINCT r.contact_id) FROM messages r
               JOIN messages o ON o.id = r.in_reply_to_id
               JOIN workflow_executions we ON we.id = o.workflow_execution_id
              WHERE we.workflow_id = w.id AND r.direction = 'in'
                AND CAST(strftime('%s', r.timestamp) AS INTEGER) <= CAST(strftime('%s', o.timestamp) AS INTEGER) + 7200) AS replied2h,
            (SELECT COUNT(DISTINCT fc.contact_id) FROM funnel_conversions fc WHERE fc.workflow_id = w.id) AS qualified,
            (SELECT COUNT(DISTINCT we.contact_id) FROM workflow_executions we JOIN contacts c ON c.id = we.contact_id
              WHERE we.workflow_id = w.id AND c.funnel_phase = 'phase_2_active') AS phase2Closed
          FROM workflows w WHERE w.id = ?
        `)
        .get(wf.id) as Record<string, number>;

      // Clamp each stage against the previous one so the funnel stays monotone.
      const hookDelivered = { reached: row.hookReached ?? 0, converted: row.hookConverted ?? 0 };
      const presentationSent = {
        reached: hookDelivered.converted,
        converted: Math.min(row.presentationSent ?? 0, hookDelivered.converted),
      };
      const replied2h = {
        reached: presentationSent.converted,
        converted: Math.min(row.replied2h ?? 0, presentationSent.converted),
      };
      const qualified = {
        reached: replied2h.converted,
        converted: Math.min(row.qualified ?? 0, replied2h.converted),
      };
      const phase2Closed = {
        reached: qualified.converted,
        converted: Math.min(row.phase2Closed ?? 0, qualified.converted),
      };

      return {
        workflowId: wf.id,
        name: wf.name,
        stages: {
          hook_delivered: hookDelivered,
          presentation_sent: presentationSent,
          replied_2h: replied2h,
          qualified,
          phase_2_closed: phase2Closed,
        },
      };
    });

    return {
      experimentId,
      stages: ["hook_delivered", "presentation_sent", "replied_2h", "qualified", "phase_2_closed"],
      variants,
    };
  });

  // ============================================================
  // Execution Inspector & Audit Log Endpoints
  // ============================================================

  app.get("/api/executions/summary", async () => {
    const row = (db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN status = 'waiting_input' THEN 1 ELSE 0 END) AS waitingInput,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'paused_human' THEN 1 ELSE 0 END) AS pausedHuman
      FROM workflow_executions
    `).get() ?? {}) as Record<string, number | null>;

    return {
      total: row.total ?? 0,
      running: row.running ?? 0,
      waiting: row.waiting ?? 0,
      waitingInput: row.waitingInput ?? 0,
      completed: row.completed ?? 0,
      failed: row.failed ?? 0,
      pausedHuman: row.pausedHuman ?? 0,
    };
  });

  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      status?: string;
      sessionId?: string;
      workflowId?: string;
      contactId?: string;
      search?: string;
    };
  }>("/api/executions", async (request) => {
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "50", 10)));
    const offset = Math.max(0, parseInt(request.query.offset || "0", 10));

    const conditions: string[] = [];
    const params: any[] = [];

    if (request.query.status) {
      conditions.push("we.status = ?");
      params.push(request.query.status);
    }
    if (request.query.sessionId) {
      conditions.push("we.session_id = ?");
      params.push(parseInt(request.query.sessionId, 10));
    }
    if (request.query.workflowId) {
      conditions.push("we.workflow_id = ?");
      params.push(parseInt(request.query.workflowId, 10));
    }
    if (request.query.contactId) {
      conditions.push("we.contact_id = ?");
      params.push(parseInt(request.query.contactId, 10));
    }
    if (request.query.search) {
      const q = `%${request.query.search.trim()}%`;
      conditions.push("(c.phone LIKE ? OR c.name LIKE ? OR w.name LIKE ? OR m.text LIKE ?)");
      params.push(q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = db.prepare(`
      SELECT 
        we.id,
        we.workflow_id AS workflowId,
        w.name AS workflowName,
        we.session_id AS sessionId,
        s.name AS sessionName,
        we.contact_id AS contactId,
        c.phone AS contactPhone,
        c.name AS contactName,
        we.trigger_message_id AS triggerMessageId,
        m.text AS triggerMessageText,
        we.status,
        we.current_node_key AS currentNodeKey,
        we.started_at AS startedAt,
        we.finished_at AS finishedAt,
        (SELECT COUNT(*) FROM events e WHERE e.execution_id = we.id) AS stepCount
      FROM workflow_executions we
      LEFT JOIN workflows w ON w.id = we.workflow_id
      LEFT JOIN sessions s ON s.id = we.session_id
      LEFT JOIN contacts c ON c.id = we.contact_id
      LEFT JOIN messages m ON m.id = we.trigger_message_id
      ${whereClause}
      ORDER BY we.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS count
      FROM workflow_executions we
      LEFT JOIN workflows w ON w.id = we.workflow_id
      LEFT JOIN sessions s ON s.id = we.session_id
      LEFT JOIN contacts c ON c.id = we.contact_id
      LEFT JOIN messages m ON m.id = we.trigger_message_id
      ${whereClause}
    `).get(...params) as { count: number } | undefined;

    return {
      executions: rows,
      total: totalRow?.count ?? 0,
      limit,
      offset,
    };
  });

  app.get<{ Params: { id: string } }>("/api/executions/:id", async (request, reply) => {
    const executionId = Number(request.params.id);
    const execution = db.prepare(`
      SELECT 
        we.id,
        we.workflow_id AS workflowId,
        w.name AS workflowName,
        we.session_id AS sessionId,
        s.name AS sessionName,
        we.contact_id AS contactId,
        c.phone AS contactPhone,
        c.name AS contactName,
        we.trigger_message_id AS triggerMessageId,
        m.text AS triggerMessageText,
        we.status,
        we.current_node_key AS currentNodeKey,
        we.vars,
        we.silence_followup_at AS silenceFollowupAt,
        we.started_at AS startedAt,
        we.finished_at AS finishedAt
      FROM workflow_executions we
      LEFT JOIN workflows w ON w.id = we.workflow_id
      LEFT JOIN sessions s ON s.id = we.session_id
      LEFT JOIN contacts c ON c.id = we.contact_id
      LEFT JOIN messages m ON m.id = we.trigger_message_id
      WHERE we.id = ?
    `).get(executionId) as Record<string, unknown> | undefined;

    if (!execution) return reply.code(404).send({ error: "Execution not found" });

    const events = (db.prepare(`
      SELECT 
        id,
        event_type AS eventType,
        session_id AS sessionId,
        contact_id AS contactId,
        execution_id AS executionId,
        message_id AS messageId,
        data,
        created_at AS createdAt
      FROM events
      WHERE execution_id = ?
      ORDER BY id ASC
    `).all(executionId) as any[]).map((e) => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(e.data || "{}");
      } catch {}
      return {
        ...e,
        data: parsedData,
      };
    });

    return {
      ...execution,
      vars: typeof execution.vars === "string" ? JSON.parse(execution.vars || "{}") : execution.vars,
      events,
    };
  });

  app.post<{ Params: { id: string } }>("/api/executions/:id/retry", async (request, reply) => {
    const executionId = Number(request.params.id);
    const execution = db.prepare("SELECT * FROM workflow_executions WHERE id = ?").get(executionId) as
      | { id: number; workflow_id: number; session_id: number; contact_id: number; current_node_key: string | null }
      | undefined;

    if (!execution) return reply.code(404).send({ error: "Execution not found" });

    // Reset status to running and resume
    db.prepare("UPDATE workflow_executions SET status = 'running', finished_at = NULL WHERE id = ?").run(executionId);
    db.prepare(`
      INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
      VALUES ('execution.retried', ?, ?, ?, '{}')
    `).run(execution.session_id, execution.contact_id, executionId);

    if (opts?.engine?.step) {
      void opts.engine.step(executionId);
    }

    return { ok: true, executionId };
  });

  // Test Lab Endpoints
  app.get("/api/test-lab/scenarios", async () => {
    const { SCENARIO_CATALOG } = await import("./test-lab.js");
    return { scenarios: SCENARIO_CATALOG };
  });

  app.post<{
    Body: {
      scenarioId: string;
      mode?: "virtual" | "live";
      senderSessionId?: number;
      receiverPhone?: string;
      messageText?: string;
    };
  }>("/api/test-lab/run", async (request, reply) => {
    const { scenarioId, mode = "virtual", senderSessionId, receiverPhone, messageText } = request.body || {};
    if (!scenarioId) return reply.code(400).send({ error: "Missing scenarioId" });

    const { SCENARIO_CATALOG, runVirtualScenario } = await import("./test-lab.js");
    const { createStorageFromEnv } = await import("./media.js");
    const storage = createStorageFromEnv();

    if (mode === "live" && scenarioId === "dual_instance_live_e2e") {
      if (!senderSessionId || !receiverPhone) {
        return reply.code(400).send({ error: "Live dual-instance testing requires senderSessionId and receiverPhone" });
      }

      const senderSession = db.prepare("SELECT * FROM sessions WHERE id = ?").get(senderSessionId) as { id: number; name: string } | undefined;
      if (!senderSession) return reply.code(404).send({ error: "Sender session not found" });

      const startTime = Date.now();
      const logs: string[] = [];
      logs.push(`[Live Test] Starting live dispatch from Session "${senderSession.name}" (ID ${senderSessionId}) to ${receiverPhone}`);

      try {
        if (!opts?.engine) throw new Error("Engine is not initialized on server");

        // Insert or find contact for the receiver phone
        db.prepare("INSERT INTO contacts (phone, name) VALUES (?, 'Dual-Instance Bot Peer') ON CONFLICT DO NOTHING").run(receiverPhone);
        const contact = db.prepare("SELECT id FROM contacts WHERE phone = ?").get(receiverPhone) as { id: number };

        // Enqueue direct live test message
        const textToSend = messageText || `[WaStat Live Test ${Date.now()}] Testing dual-instance connectivity and bot automation`;
        
        // Find active workflow for the receiver
        const activeWf = db.prepare("SELECT id FROM workflows WHERE active = 1 ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
        
        let execId: number | null = null;
        if (activeWf) {
          execId = opts.engine.startExecution(activeWf.id, senderSessionId, contact.id, undefined, {
            live_test: true,
            timestamp: new Date().toISOString(),
          });
          logs.push(`[Live Test] Dispatched live execution ID ${execId} via workflow ID ${activeWf.id}`);
        } else {
          logs.push("[Live Test] Warning: No active workflow found, sent raw diagnostic message");
        }

        return {
          scenarioId,
          name: "Dual-Instance Real-Device E2E Dispatch",
          status: "passed",
          mode: "live",
          executionId: execId ?? undefined,
          durationMs: Date.now() - startTime,
          logs,
          metrics: {
            dispatchedKind: "live_dispatch",
          },
        };
      } catch (err: any) {
        logs.push(`[Live Error] ${err.message || String(err)}`);
        return {
          scenarioId,
          name: "Dual-Instance Real-Device E2E Dispatch",
          status: "failed",
          mode: "live",
          durationMs: Date.now() - startTime,
          logs,
          error: err.message || String(err),
        };
      }
    }

    // Default: Run virtual scenario safely in memory
    const res = await runVirtualScenario(db, scenarioId, storage);
    return res;
  });

  app.post("/api/test-lab/run-all", async () => {
    const { SCENARIO_CATALOG, runVirtualScenario } = await import("./test-lab.js");
    const { createStorageFromEnv } = await import("./media.js");
    const storage = createStorageFromEnv();

    const virtualScenarios = SCENARIO_CATALOG.filter((s) => s.supportsVirtual);
    const results = [];

    for (const sc of virtualScenarios) {
      const res = await runVirtualScenario(db, sc.id, storage);
      results.push(res);
    }

    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return {
      total: results.length,
      passed,
      failed,
      results,
    };
  });
}
