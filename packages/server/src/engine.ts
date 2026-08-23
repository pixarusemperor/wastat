import type BetterSqlite3 from "better-sqlite3";
import { evaluateMatch, type KeywordMatchConfig } from "@wastat/shared";
import { realClock, createScheduler, type Clock, type JobRow } from "./scheduler.js";

export interface SendMessageInput {
  sessionId: number;
  toPhone: string;
  kind: "text" | "media";
  text?: string;
  mediaId?: number;
}

export interface EngineDeps {
  clock?: Clock;
  /** PRD §13: random delays need a deterministic source in tests. */
  rng?: () => number;
  sendMessage: (input: SendMessageInput) => Promise<{ providerMessageId: string }>;
}

export function createEngine(db: BetterSqlite3.Database, deps: EngineDeps) {
  const clock = deps.clock ?? realClock;
  const rng = deps.rng ?? Math.random;

  const iso = (ms: number) => new Date(ms).toISOString();

  const getWorkflow = db.prepare("SELECT * FROM workflows WHERE id = ?");
  const getNode = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ? AND node_key = ?");
  const getNextKey = db.prepare(
    "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ?",
  );
  const getTriggerNode = db.prepare(
    "SELECT node_key FROM workflow_nodes WHERE workflow_id = ? AND type = 'trigger'",
  );
  const getTriggerText = db.prepare(`
    SELECT m.text FROM workflow_executions we JOIN messages m ON m.id = we.trigger_message_id
    WHERE we.id = ?
  `);
  const findExecutionByTrigger = db.prepare(
    "SELECT id FROM workflow_executions WHERE trigger_message_id = ?",
  );
  const insertExecution = db.prepare(
    "INSERT INTO workflow_executions (workflow_id, session_id, contact_id, trigger_message_id, status, current_node_key) VALUES (?, ?, ?, ?, 'running', ?)",
  );
  const updateExecution = db.prepare(
    "UPDATE workflow_executions SET status = ?, current_node_key = ?, finished_at = ? WHERE id = ?",
  );

  function complete(executionId: number, currentKey: string | null) {
    updateExecution.run("completed", currentKey, iso(clock.now()), executionId);
  }

  const logDelay = db.prepare(
    "INSERT INTO events (event_type, execution_id, data) VALUES ('delay.scheduled', ?, ?)",
  );

  function setWaiting(executionId: number, currentKey: string) {
    updateExecution.run("waiting", currentKey, null, executionId);
  }

  const getContactPhone = db.prepare("SELECT phone FROM contacts WHERE id = ?");
  const insertMessage = db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, workflow_execution_id, node_key, status, timestamp)
    VALUES (?, ?, 'out', ?, ?, ?, ?, ?, 'sent', ?)
  `);

  const getExecution = db.prepare("SELECT * FROM workflow_executions WHERE id = ?");

  /**
   * Walk the graph from the execution's current node until the path blocks on
   * a queued job (send/delay) or terminates (end / dead end / no-match).
   */
  async function step(executionId: number): Promise<void> {
    const exec = getExecution.get(executionId) as
      | { id: number; workflow_id: number; session_id: number; status: string; current_node_key: string | null }
      | undefined;
    if (!exec || exec.status !== "running") return;

    while (true) {
      if (!exec.current_node_key) return complete(executionId, null);
      const node = getNode.get(exec.workflow_id, exec.current_node_key) as
        | { type: string; config: string }
        | undefined;
      if (!node) return complete(executionId, exec.current_node_key);

      switch (node.type) {
        case "send_text":
        case "send_media": {
          const config = JSON.parse(node.config) as { text?: string; mediaId?: number };
          enqueueSend(executionId, exec.current_node_key, {
            kind: node.type === "send_media" ? "media" : "text",
            text: config.text,
            mediaId: config.mediaId,
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "delay": {
          const config = (JSON.parse(node.config) ?? {}) as {
            mode?: "fixed" | "random";
            seconds?: number;
            delayMs?: number;
            minSeconds?: number;
            maxSeconds?: number;
          };
          const isRandom =
            config.mode === "random" ||
            (config.minSeconds !== undefined && config.maxSeconds !== undefined);
          const seconds = isRandom
            ? (config.minSeconds ?? 3) +
              Math.floor(rng() * ((config.maxSeconds ?? 10) - (config.minSeconds ?? 3) + 1))
            : config.seconds ?? (config.delayMs ? Math.max(1, Math.round(config.delayMs / 1000)) : 5);

          logDelay.run(executionId, JSON.stringify({ seconds }));
          scheduler.enqueue({
            type: "resume",
            executionId,
            nodeKey: exec.current_node_key,
            runAt: new Date(clock.now() + seconds * 1000),
            payload: { seconds },
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "keyword": {
          const config = JSON.parse(node.config) as KeywordMatchConfig;
          const triggerText = getTriggerText.get(executionId) as { text: string | null } | undefined;
          const { matched } = evaluateMatch(config, triggerText?.text ?? "");
          if (!matched) return complete(executionId, exec.current_node_key);
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as
            | { target_key: string }
            | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break; // keep walking
        }
        case "end":
          return complete(executionId, exec.current_node_key);
        default:
          return complete(executionId, exec.current_node_key);
      }
    }
  }

  /** Advance past the node a completed job belonged to, then keep walking. */
  function advanceFrom(executionId: number, nodeKey: string): void {
    const exec = getExecution.get(executionId) as { workflow_id: number } | undefined;
    if (!exec) return;
    const next = getNextKey.get(exec.workflow_id, nodeKey) as { target_key: string } | undefined;
    if (!next) return complete(executionId, null);
    db.prepare("UPDATE workflow_executions SET status = 'running', current_node_key = ?, finished_at = NULL WHERE id = ?").run(
      next.target_key,
      executionId,
    );
    void step(executionId);
  }

  function enqueueSend(
    executionId: number,
    nodeKey: string,
    partial: { kind: "text" | "media"; text?: string; mediaId?: number },
  ) {
    scheduler.enqueue({
      type: "send_message",
      executionId,
      nodeKey,
      payload: partial,
    });
  }

  const getActiveWorkflows = db.prepare("SELECT id FROM workflows WHERE active = 1");
  const getKeywordNodes = db.prepare(
    "SELECT workflow_id, config FROM workflow_nodes WHERE type IN ('keyword', 'trigger')",
  );

  /**
   * PRD §17: route one incoming message across all active workflows.
   * Winner: highest similarity → highest configured priority → lowest workflow id.
   * Returns the new execution id, or null when nothing matches.
   */
  function handleIncomingMessage(
    sessionId: number,
    contactId: number,
    messageId: number,
  ): number | null {
    const msg = db
      .prepare("SELECT text FROM messages WHERE id = ?")
      .get(messageId) as { text: string | null } | undefined;
    if (!msg) return null;

    const active = new Set((getActiveWorkflows.all() as Array<{ id: number }>).map((w) => w.id));
    let best: { workflowId: number; score: number; priority: number } | null = null;
    for (const row of getKeywordNodes.all() as Array<{ workflow_id: number; config: string }>) {
      if (!active.has(row.workflow_id)) continue;
      let rawConfig: Record<string, unknown> = {};
      try {
        rawConfig = JSON.parse(row.config);
      } catch {
        continue;
      }

      const algorithm: MatchAlgorithm =
        rawConfig.algorithm === "exact" || rawConfig.mode === "exact"
          ? "exact"
          : rawConfig.algorithm === "levenshtein"
            ? "levenshtein"
            : "dice";

      const threshold: number =
        typeof rawConfig.threshold === "number"
          ? rawConfig.threshold <= 1
            ? rawConfig.threshold * 100
            : rawConfig.threshold
          : 75;

      const priority = typeof rawConfig.priority === "number" ? rawConfig.priority : 0;

      const phrases: string[] = [];
      if (typeof rawConfig.phrase === "string" && rawConfig.phrase.trim()) {
        phrases.push(rawConfig.phrase.trim());
      }
      if (Array.isArray(rawConfig.keywords)) {
        for (const kw of rawConfig.keywords) {
          if (typeof kw === "string" && kw.trim()) phrases.push(kw.trim());
        }
      }

      if (phrases.length === 0) continue;

      let highestScore = 0;
      let matchedAny = false;

      for (const p of phrases) {
        const { score, matched } = evaluateMatch(
          { phrase: p, algorithm, threshold },
          msg.text ?? "",
        );
        if (matched) {
          matchedAny = true;
          if (score > highestScore) highestScore = score;
        }
      }

      if (!matchedAny) continue;

      if (
        !best ||
        highestScore > best.score ||
        (highestScore === best.score && priority > best.priority) ||
        (highestScore === best.score && priority === best.priority && row.workflow_id < best.workflowId)
      ) {
        best = { workflowId: row.workflow_id, score: highestScore, priority };
      }
    }
    if (!best) return null;

    // PRD §30–31: within an experiment, contacts are distributed across
    // active variants (least-assigned first, ties by lowest id) and then
    // stick to that variant for every future message in the experiment.
    let targetWorkflowId = best.workflowId;
    const expId = (
      db.prepare("SELECT experiment_id FROM workflows WHERE id = ?").get(best.workflowId) as {
        experiment_id: number | null;
      }
    ).experiment_id;
    if (expId != null) {
      const sticky = db
        .prepare(
          "SELECT workflow_id FROM experiment_assignments WHERE experiment_id = ? AND contact_id = ?",
        )
        .get(expId, contactId) as { workflow_id: number } | undefined;
      if (sticky) {
        targetWorkflowId = sticky.workflow_id;
      } else {
        const pick = db
          .prepare(`
            SELECT w.id FROM workflows w
            LEFT JOIN experiment_assignments ea
              ON ea.workflow_id = w.id AND ea.experiment_id = w.experiment_id
            WHERE w.experiment_id = ? AND w.active = 1
            GROUP BY w.id
            ORDER BY COUNT(ea.contact_id) ASC, w.id ASC
            LIMIT 1
          `)
          .get(expId) as { id: number } | undefined;
        if (!pick) return null;
        targetWorkflowId = pick.id;
        db.prepare(
          "INSERT INTO experiment_assignments (experiment_id, contact_id, workflow_id) VALUES (?, ?, ?)",
        ).run(expId, contactId, pick.id);
      }
    }

    return engine.startExecution(targetWorkflowId, sessionId, contactId, messageId);
  }

  const engine = {
    /**
     * PRD §32: link an incoming message to the contact's most recent outbound
     * message (whose execution identifies workflow/experiment). No-op when the
     * contact has no prior outbound traffic.
     */
    attributeReply(messageId: number): void {
      const msg = db
        .prepare("SELECT session_id, contact_id FROM messages WHERE id = ? AND direction = 'in'")
        .get(messageId) as { session_id: number; contact_id: number } | undefined;
      if (!msg) return;
      const lastOut = db
        .prepare(`
          SELECT m.id, m.workflow_execution_id FROM messages m
          WHERE m.session_id = ? AND m.contact_id = ? AND m.direction = 'out'
            AND m.workflow_execution_id IS NOT NULL
          ORDER BY m.id DESC LIMIT 1
        `)
        .get(msg.session_id, msg.contact_id) as
        | { id: number; workflow_execution_id: number }
        | undefined;
      if (!lastOut) return;
      db.prepare("UPDATE messages SET in_reply_to_id = ? WHERE id = ?").run(lastOut.id, messageId);
      db.prepare(
        "INSERT INTO events (event_type, execution_id, message_id, data) VALUES ('reply.attributed', ?, ?, '{}')",
      ).run(lastOut.workflow_execution_id, messageId);
    },
    async executeJob(job: JobRow) {
      if (job.type === "resume") {
        if (job.node_key) advanceFrom(job.execution_id, job.node_key);
        return;
      }

      const payload = JSON.parse(job.payload) as { kind: "text" | "media"; text?: string; mediaId?: number };
      const exec = getExecution.get(job.execution_id) as { session_id: number; contact_id: number };
      const contact = getContactPhone.get(exec.contact_id) as { phone: string };

      const result = await deps.sendMessage({
        sessionId: exec.session_id,
        toPhone: contact.phone,
        kind: payload.kind,
        text: payload.text,
        mediaId: payload.mediaId,
      });
      insertMessage.run(
        exec.session_id,
        exec.contact_id,
        payload.kind === "media" ? "media" : "text",
        payload.text ?? null,
        result.providerMessageId,
        job.execution_id,
        job.node_key,
        iso(clock.now()),
      );
      if (job.node_key) advanceFrom(job.execution_id, job.node_key);
    },
    startExecution(workflowId: number, sessionId: number, contactId: number, triggerMessageId?: number): number | null {
      const wf = getWorkflow.get(workflowId) as { active: number } | undefined;
      if (!wf?.active) return null;
      const trigger = getTriggerNode.get(workflowId) as { node_key: string } | undefined;
      if (!trigger) return null;
      const first = getNextKey.get(workflowId, trigger.node_key) as { target_key: string } | undefined;
      if (!first) return null;
      // PRD §53: a duplicate webhook delivery must not re-trigger the workflow.
      if (triggerMessageId != null && findExecutionByTrigger.get(triggerMessageId)) return null;
      const info = insertExecution.run(workflowId, sessionId, contactId, triggerMessageId ?? null, first.target_key);
      const executionId = Number(info.lastInsertRowid);
      void step(executionId);
      return executionId;
    },
  };

  const scheduler = createScheduler(db, engine.executeJob, clock);

  return { ...engine, handleIncomingMessage, scheduler };
}
