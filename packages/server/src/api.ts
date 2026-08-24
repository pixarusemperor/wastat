import type { FastifyInstance } from "fastify";
import type BetterSqlite3 from "better-sqlite3";
import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";
import type { createEngine } from "./engine.js";
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
      active: b.active === true ? 1 : 0,
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
  db: BetterSqlite3.Database,
  opts?: ApiRoutesOptions,
): void {
  void app.register(aiRoutes);
  void app.register(broadcastRoutes);
  void app.register(mcpRoutes);

  const insertWorkflow = db.prepare(
    "INSERT INTO workflows (name, description, active, experiment_id) VALUES (?, ?, ?, ?)",
  );
  const insertNode = db.prepare(
    "INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertEdge = db.prepare(
    "INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, ?, ?, ?)",
  );

  const saveGraph = db.transaction((workflowId: number, graph: ParsedGraph) => {
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
    for (const n of graph.nodes) {
      insertNode.run(workflowId, n.nodeKey, n.type, JSON.stringify(n.config), n.positionX, n.positionY);
    }
    for (const e of graph.edges) {
      insertEdge.run(workflowId, e.sourceKey, e.targetKey, e.handle ?? null);
    }
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
      db.prepare("SELECT node_key, type, config, position_x, position_y FROM workflow_nodes WHERE workflow_id = ? ORDER BY id").all(request.params.id) as any[]
    ).map((n) => {
      const nodeObj: any = {
        nodeKey: n.node_key,
        type: n.type,
        config: JSON.parse(n.config),
      };
      if (n.position_x || n.position_y) {
        nodeObj.positionX = n.position_x;
        nodeObj.positionY = n.position_y;
      }
      return nodeObj;
    });
    const edges = (
      db.prepare("SELECT source_key, target_key, handle FROM workflow_edges WHERE workflow_id = ? ORDER BY id").all(request.params.id) as any[]
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
    const getLocal = db.prepare("SELECT id FROM sessions WHERE provider_session_id = ?");

    /** List remote sessions and mirror them locally — the local table is the
     * webhook-facing source of truth for api keys and secrets. Falls back to
     * local cache if Wasender is unreachable or credentials are mock/expired. */
    async function syncSessions(log?: FastifyInstance["log"]) {
      try {
        for (const s of await admin.listSessions()) upsertSession(db, s);
      } catch (err) {
        log?.warn({ err }, "Could not sync remote Wasender sessions; serving local cache");
      }
      return db
        .prepare(
          "SELECT id, name, provider_session_id AS providerSessionId, status FROM sessions ORDER BY id",
        )
        .all();
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

    app.post<{ Params: { id: string } }>("/api/sessions/:id/connect", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.connectSession(Number(row.provider_session_id));
        db.prepare("UPDATE sessions SET status = 'connecting' WHERE id = ?").run(localId);
        return { ok: true, status: "connecting" };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender connect failed" });
      }
    });

    app.get<{ Params: { id: string } }>("/api/sessions/:id/qrcode", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
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
      const row = db
        .prepare("SELECT id, provider_session_id, status FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string; status: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        const status = await admin.getStatus(Number(row.provider_session_id));
        const normalized = String(status).toLowerCase();
        db.prepare("UPDATE sessions SET status = ? WHERE id = ?").run(normalized, localId);
        return { status: normalized };
      } catch (err) {
        request.log.warn(err);
        return { status: row.status };
      }
    });

    app.post<{ Params: { id: string } }>("/api/sessions/:id/restart", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
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
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.disconnectSession(Number(row.provider_session_id));
        db.prepare("UPDATE sessions SET status = 'disconnected' WHERE id = ?").run(localId);
        return { ok: true };
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Wasender disconnect failed" });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
      const localId = Number(request.params.id);
      const row = db
        .prepare("SELECT id, provider_session_id FROM sessions WHERE id = ?")
        .get(localId) as { id: number; provider_session_id: string } | undefined;
      if (!row) return reply.code(404).send({ error: "not found" });
      try {
        await admin.deleteSession(Number(row.provider_session_id));
      } catch (err) {
        request.log.warn({ err }, "Wasender remote delete failed or session missing");
      }
      db.prepare("DELETE FROM sessions WHERE id = ?").run(localId);
      return { ok: true };
    });
  } else {
    // Read-only local session listing when no PAT is provided
    app.get("/api/sessions", async () => {
      return db
        .prepare(
          "SELECT id, name, provider_session_id AS providerSessionId, status FROM sessions ORDER BY id",
        )
        .all();
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

  // Multi-Stage Funnel & Variant Statistics Endpoint
  app.get<{ Params: { id: string } }>("/api/experiments/:id/funnel", async (request, reply) => {
    const experimentId = Number(request.params.id);
    const workflows = db.prepare("SELECT id, name FROM workflows WHERE experiment_id = ?").all(experimentId) as Array<{ id: number; name: string }>;

    const funnelStages = workflows.map((wf) => {
      const stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT we.id) AS totalExecutions,
          COUNT(DISTINCT CASE WHEN m.direction = 'out' THEN m.contact_id END) AS totalSent,
          COUNT(DISTINCT CASE WHEN m.direction = 'out' AND m.status IN ('delivered', 'read') THEN m.contact_id END) AS totalDelivered,
          COUNT(DISTINCT CASE WHEN m.direction = 'out' AND m.status = 'read' THEN m.contact_id END) AS totalRead,
          COUNT(DISTINCT CASE WHEN m_in.id IS NOT NULL AND m_in.timestamp <= we.reply_window_expires_at THEN m_in.contact_id END) AS organic2hReplies,
          COUNT(DISTINCT CASE WHEN we.silence_sweep_executed = 1 AND m_in.id IS NOT NULL AND m_in.timestamp > we.reply_window_expires_at THEN m_in.contact_id END) AS silenceReactivations,
          COUNT(DISTINCT fc.id) AS qualifiedConversions
        FROM workflows w
        LEFT JOIN workflow_executions we ON we.workflow_id = w.id
        LEFT JOIN messages m ON m.workflow_execution_id = we.id
        LEFT JOIN messages m_in ON m_in.in_reply_to_id = m.id
        LEFT JOIN funnel_conversions fc ON fc.workflow_id = w.id
        WHERE w.id = ?
      `).get(wf.id) as Record<string, number>;

      return {
        workflowId: wf.id,
        name: wf.name,
        totalExecutions: stats.totalExecutions ?? 0,
        totalSent: stats.totalSent ?? 0,
        totalDelivered: stats.totalDelivered ?? 0,
        totalRead: stats.totalRead ?? 0,
        organic2hReplies: stats.organic2hReplies ?? 0,
        silenceReactivations: stats.silenceReactivations ?? 0,
        qualifiedConversions: stats.qualifiedConversions ?? 0,
      };
    });

    return { experimentId, variants: funnelStages };
  });
}
