import type BetterSqlite3 from "better-sqlite3";
import {
  evaluateMatch,
  normalize,
  parseSpintax,
  type KeywordMatchConfig,
  type ConditionNodeConfig,
  type SendMenuNodeConfig,
  type CollectInputNodeConfig,
  type SplitTestNodeConfig,
  type MilestoneNodeConfig,
} from "@wastat/shared";
import { realClock, createScheduler, type Clock, type JobRow } from "./scheduler.js";
import { buildTextMenu } from "./wasender.js";

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

/**
 * Interpolates Spintax {A|B} and {{vars.key}}, {{contact.phone}}, {{contact.name}}, {{contact.attribute}} templates.
 */
export function interpolateVariables(
  template: string,
  vars: Record<string, unknown> = {},
  contact?: { phone?: string; name?: string; attributes?: Record<string, string> },
  rng: () => number = Math.random,
): string {
  if (!template) return "";
  // 1. Interpolate {{variables}} first
  const interpolated = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    if (key.startsWith("vars.")) {
      const varName = key.slice(5);
      return vars[varName] != null ? String(vars[varName]) : "";
    }
    if (key.startsWith("contact.")) {
      const contactKey = key.slice(8);
      if (contactKey === "phone") return contact?.phone ?? "";
      if (contactKey === "name") return contact?.name ?? "";
      if (contact?.attributes && contact.attributes[contactKey] != null) {
        return contact.attributes[contactKey];
      }
    }
    if (contact?.attributes && contact.attributes[key] != null) {
      return contact.attributes[key];
    }
    return vars[key] != null ? String(vars[key]) : "";
  });

  // 2. Resolve Spintax {A|B} variations
  return parseSpintax(interpolated, rng);
}

/**
 * Evaluates branching condition predicates.
 */
export function evaluateCondition(
  config: ConditionNodeConfig,
  vars: Record<string, unknown> = {},
  triggerText = "",
  contact?: { phone?: string; name?: string },
): boolean {
  let targetVal = "";
  if (config.subject === "var" && config.subjectKey) {
    targetVal = vars[config.subjectKey] != null ? String(vars[config.subjectKey]) : "";
  } else if (config.subject === "message_text") {
    targetVal = triggerText;
  } else if (config.subject === "contact_field" && config.subjectKey) {
    if (config.subjectKey === "phone") targetVal = contact?.phone ?? "";
    if (config.subjectKey === "name") targetVal = contact?.name ?? "";
  }

  const expected = config.value ?? "";
  const normTarget = targetVal.trim().toLowerCase();
  const normExpected = expected.trim().toLowerCase();

  switch (config.operator) {
    case "equals":
      return normTarget === normExpected;
    case "contains":
      return normTarget.includes(normExpected);
    case "starts_with":
      return normTarget.startsWith(normExpected);
    case "present":
      return normTarget.length > 0;
    case "absent":
      return normTarget.length === 0;
    case "greater_than": {
      const numT = parseFloat(targetVal);
      const numE = parseFloat(expected);
      return !isNaN(numT) && !isNaN(numE) && numT > numE;
    }
    case "less_than": {
      const numT = parseFloat(targetVal);
      const numE = parseFloat(expected);
      return !isNaN(numT) && !isNaN(numE) && numT < numE;
    }
    default:
      return false;
  }
}

export function createEngine(db: BetterSqlite3.Database, deps: EngineDeps) {
  const clock = deps.clock ?? realClock;
  const rng = deps.rng ?? Math.random;

  const iso = (ms: number) => new Date(ms).toISOString();

  const getWorkflow = db.prepare("SELECT * FROM workflows WHERE id = ?");
  const getNode = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ? AND node_key = ?");
  const getNextKey = db.prepare(
    "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND (handle IS NULL OR handle = '') LIMIT 1",
  );
  const getEdgeByHandle = db.prepare(
    "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND handle = ? LIMIT 1",
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
    "INSERT INTO workflow_executions (workflow_id, session_id, contact_id, trigger_message_id, status, current_node_key, vars) VALUES (?, ?, ?, ?, 'running', ?, ?)",
  );
  const updateExecution = db.prepare(
    "UPDATE workflow_executions SET status = ?, current_node_key = ?, finished_at = ? WHERE id = ?",
  );
  const updateExecutionVars = db.prepare(
    "UPDATE workflow_executions SET vars = ? WHERE id = ?",
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

  function setWaitingInput(executionId: number, currentKey: string) {
    const silenceIso = new Date(clock.now() + 2 * 3600 * 1000).toISOString();
    db.prepare(`
      UPDATE workflow_executions
      SET status = 'waiting_input',
          current_node_key = ?,
          silence_followup_at = ?,
          reply_window_expires_at = ?,
          silence_sweep_executed = 0,
          finished_at = NULL
      WHERE id = ?
    `).run(currentKey, silenceIso, silenceIso, executionId);
  }

  function getContactWithAttributes(contactId: number) {
    const contact = db.prepare("SELECT phone, name, funnel_phase, bot_status, bot_paused_until FROM contacts WHERE id = ?").get(contactId) as { phone?: string; name?: string; funnel_phase?: string; bot_status?: string; bot_paused_until?: string | null } | undefined;
    if (!contact) return undefined;
    const rows = db.prepare("SELECT key, value FROM contact_attributes WHERE contact_id = ?").all(contactId) as Array<{ key: string; value: string }>;
    const attributes: Record<string, string> = {};
    for (const r of rows) attributes[r.key] = r.value;
    return { ...contact, attributes };
  }

  const insertMessage = db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, workflow_execution_id, node_key, status, timestamp)
    VALUES (?, ?, 'out', ?, ?, ?, ?, ?, 'sent', ?)
  `);

  const getExecution = db.prepare("SELECT * FROM workflow_executions WHERE id = ?");

  async function step(executionId: number): Promise<void> {
    const exec = getExecution.get(executionId) as
      | {
          id: number;
          workflow_id: number;
          session_id: number;
          contact_id: number;
          status: string;
          current_node_key: string | null;
          vars: string;
        }
      | undefined;
    if (!exec || exec.status !== "running") return;

    const contact = getContactWithAttributes(exec.contact_id);
    if (contact && contact.bot_status === "paused_human") {
      if (contact.bot_paused_until && new Date(contact.bot_paused_until).getTime() > clock.now()) {
        db.prepare("UPDATE workflow_executions SET status = 'paused_human' WHERE id = ?").run(executionId);
        return;
      } else {
        db.prepare("UPDATE contacts SET bot_status = 'active', bot_paused_until = NULL WHERE id = ?").run(exec.contact_id);
      }
    }

    let vars: Record<string, unknown> = {};
    try {
      vars = JSON.parse(exec.vars || "{}");
    } catch {}

    while (true) {
      if (!exec.current_node_key) return complete(executionId, null);
      const node = getNode.get(exec.workflow_id, exec.current_node_key) as
        | { type: string; config: string }
        | undefined;
      if (!node) return complete(executionId, exec.current_node_key);

      switch (node.type) {
        case "send_text": {
          const config = JSON.parse(node.config || "{}") as { text?: string };
          const interpolated = interpolateVariables(config.text ?? "", vars, contact);
          enqueueSend(executionId, exec.current_node_key, {
            kind: "text",
            text: interpolated,
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "send_media": {
          const config = JSON.parse(node.config || "{}") as { text?: string; caption?: string; mediaId?: number };
          const rawCaption = config.caption ?? config.text;
          const caption = rawCaption ? interpolateVariables(rawCaption, vars, contact) : undefined;
          enqueueSend(executionId, exec.current_node_key, {
            kind: "media",
            text: caption,
            mediaId: config.mediaId,
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "send_menu": {
          const config = JSON.parse(node.config || "{}") as SendMenuNodeConfig;
          const bodyText = interpolateVariables(config.bodyText ?? "", vars, contact);
          const menuText = buildTextMenu(config.header, bodyText, config.options ?? [], config.footer);
          enqueueSend(executionId, exec.current_node_key, {
            kind: "text",
            text: menuText,
          });
          setWaitingInput(executionId, exec.current_node_key);
          return;
        }
        case "collect_input": {
          const config = JSON.parse(node.config || "{}") as CollectInputNodeConfig;
          const prompt = interpolateVariables(config.promptText ?? "", vars, contact);
          if (prompt.trim()) {
            enqueueSend(executionId, exec.current_node_key, {
              kind: "text",
              text: prompt,
            });
          }
          setWaitingInput(executionId, exec.current_node_key);
          return;
        }
        case "condition": {
          const config = JSON.parse(node.config || "{}") as ConditionNodeConfig;
          const triggerText = (getTriggerText.get(executionId) as { text: string | null } | undefined)?.text ?? "";
          const isTrue = evaluateCondition(config, vars, triggerText, contact);

          const branchHandle = isTrue ? "true" : "false";
          const edge = getEdgeByHandle.get(exec.workflow_id, exec.current_node_key, branchHandle) as
            | { target_key: string }
            | undefined;

          if (edge) {
            exec.current_node_key = edge.target_key;
            db.prepare("UPDATE workflow_executions SET current_node_key = ? WHERE id = ?").run(
              edge.target_key,
              executionId,
            );
            break;
          } else {
            const defEdge = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
            if (defEdge) {
              exec.current_node_key = defEdge.target_key;
              break;
            }
            return complete(executionId, exec.current_node_key);
          }
        }
        case "split_test": {
          const config = JSON.parse(node.config || "{}") as SplitTestNodeConfig;
          const variants = config.variants ?? [];
          if (variants.length === 0) {
            const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
            if (!next) return complete(executionId, exec.current_node_key);
            exec.current_node_key = next.target_key;
            break;
          }

          const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0);
          let random = rng() * totalWeight;
          let selected = variants[0];
          for (const v of variants) {
            random -= v.weight || 1;
            if (random <= 0) {
              selected = v;
              break;
            }
          }

          vars.split_variant = selected.id;
          updateExecutionVars.run(JSON.stringify(vars), executionId);

          const edge = getEdgeByHandle.get(exec.workflow_id, exec.current_node_key, selected.id) as
            | { target_key: string }
            | undefined;

          if (edge) {
            exec.current_node_key = edge.target_key;
            break;
          }
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "send_poll": {
          const config = JSON.parse(node.config || "{}") as { question?: string; options?: string[]; multiSelect?: boolean };
          const question = interpolateVariables(config.question ?? "Please vote:", vars, contact);
          const pollText = `📊 *${question}*\n\n` + (config.options ?? []).map((o, i) => `${i + 1}. ${o}`).join("\n");
          enqueueSend(executionId, exec.current_node_key, {
            kind: "text",
            text: pollText,
          });
          setWaitingInput(executionId, exec.current_node_key);
          return;
        }
        case "send_contact": {
          const config = JSON.parse(node.config || "{}") as { name?: string; phone?: string };
          const name = interpolateVariables(config.name ?? "Support Contact", vars, contact);
          const phone = interpolateVariables(config.phone ?? "", vars, contact);
          const text = `📇 *Contact Card*\n*Name:* ${name}\n*Phone:* ${phone}`;
          enqueueSend(executionId, exec.current_node_key, {
            kind: "text",
            text,
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "send_location": {
          const config = JSON.parse(node.config || "{}") as { latitude?: number; longitude?: number; name?: string; address?: string };
          const name = config.name ? interpolateVariables(config.name, vars, contact) : "Location";
          const addr = config.address ? interpolateVariables(config.address, vars, contact) : "";
          const lat = config.latitude ?? 0;
          const lng = config.longitude ?? 0;
          const text = `📍 *${name}*\n${addr ? `${addr}\n` : ""}https://maps.google.com/?q=${lat},${lng}`;
          enqueueSend(executionId, exec.current_node_key, {
            kind: "text",
            text,
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "send_presence": {
          const config = JSON.parse(node.config || "{}") as { presenceType?: string; durationSeconds?: number };
          const sec = config.durationSeconds ?? 2;
          scheduler.enqueue({
            type: "resume",
            executionId,
            nodeKey: exec.current_node_key,
            runAt: new Date(clock.now() + sec * 1000),
            payload: { presence: config.presenceType ?? "composing" },
          });
          setWaiting(executionId, exec.current_node_key);
          return;
        }
        case "mark_read":
        case "react_message":
        case "block_contact":
        case "unblock_contact":
        case "add_group_participant":
        case "remove_group_participant": {
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "upsert_contact": {
          const config = (JSON.parse(node.config || "{}") ?? {}) as { name?: string; phone?: string; attributes?: Record<string, string>; tags?: string[] };
          if (config.name) {
            db.prepare("UPDATE contacts SET name = ? WHERE id = ?").run(config.name, exec.contact_id);
          }
          if (config.attributes) {
            for (const [k, v] of Object.entries(config.attributes)) {
              db.prepare(`
                INSERT INTO contact_attributes (contact_id, key, value) VALUES (?, ?, ?)
                ON CONFLICT(contact_id, key) DO UPDATE SET value = excluded.value, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
              `).run(exec.contact_id, k, v);
            }
          }
          if (config.tags && Array.isArray(config.tags)) {
            for (const t of config.tags) {
              db.prepare("INSERT OR IGNORE INTO contact_tags (contact_id, tag) VALUES (?, ?)").run(exec.contact_id, t);
            }
          }
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "milestone": {
          const config = (JSON.parse(node.config || "{}") ?? {}) as MilestoneNodeConfig;
          if (config.milestoneKey) {
            db.prepare(`
              INSERT INTO funnel_conversions (execution_id, workflow_id, contact_id, milestone_key, value)
              VALUES (?, ?, ?, ?, ?)
            `).run(executionId, exec.workflow_id, exec.contact_id, config.milestoneKey, config.value ?? 1);
          }
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "delay": {
          const config = (JSON.parse(node.config || "{}") ?? {}) as {
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
          const config = JSON.parse(node.config || "{}") as KeywordMatchConfig;
          const triggerText = getTriggerText.get(executionId) as { text: string | null } | undefined;
          const { matched } = evaluateMatch(config, triggerText?.text ?? "");
          if (!matched) return complete(executionId, exec.current_node_key);
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "trigger":
        case "trigger_personal":
        case "trigger_group":
        case "trigger_reaction":
        case "trigger_poll_result":
        case "trigger_call":
        case "trigger_participant": {
          const next = getNextKey.get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;
          if (!next) return complete(executionId, exec.current_node_key);
          exec.current_node_key = next.target_key;
          break;
        }
        case "end":
          return complete(executionId, exec.current_node_key);
        default:
          return complete(executionId, exec.current_node_key);
      }

    }
  }

  function advanceFrom(executionId: number, nodeKey: string, handle?: string): void {
    const exec = getExecution.get(executionId) as { workflow_id: number } | undefined;
    if (!exec) return;

    let targetKey: string | null = null;
    if (handle) {
      const edge = getEdgeByHandle.get(exec.workflow_id, nodeKey, handle) as { target_key: string } | undefined;
      if (edge) targetKey = edge.target_key;
    }
    if (!targetKey) {
      const next = getNextKey.get(exec.workflow_id, nodeKey) as { target_key: string } | undefined;
      if (next) targetKey = next.target_key;
    }

    if (!targetKey) return complete(executionId, null);
    db.prepare("UPDATE workflow_executions SET status = 'running', current_node_key = ?, finished_at = NULL WHERE id = ?").run(
      targetKey,
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

  const getWaitingExecution = db.prepare(`
    SELECT * FROM workflow_executions
    WHERE session_id = ? AND contact_id = ? AND status = 'waiting_input'
    ORDER BY id DESC LIMIT 1
  `);

  function handleIncomingMessage(
    sessionId: number,
    contactId: number,
    messageId: number,
  ): number | null {
    const msg = db
      .prepare("SELECT text FROM messages WHERE id = ?")
      .get(messageId) as { text: string | null } | undefined;
    if (!msg || !msg.text) return null;

    const rawInbound = msg.text.trim();

    const suspended = getWaitingExecution.get(sessionId, contactId) as
      | {
          id: number;
          workflow_id: number;
          current_node_key: string;
          vars: string;
        }
      | undefined;

    if (suspended && suspended.current_node_key) {
      const node = getNode.get(suspended.workflow_id, suspended.current_node_key) as
        | { type: string; config: string }
        | undefined;

      if (node) {
        let vars: Record<string, unknown> = {};
        try {
          vars = JSON.parse(suspended.vars || "{}");
        } catch {}

        // Cancel pending silence followup upon organic reply
        db.prepare(`
          UPDATE workflow_executions
          SET silence_followup_at = NULL,
              silence_sweep_executed = 0
          WHERE id = ?
        `).run(suspended.id);

        if (node.type === "collect_input") {
          const config = JSON.parse(node.config || "{}") as CollectInputNodeConfig;
          if (config.varKey) {
            vars[config.varKey] = rawInbound;
            updateExecutionVars.run(JSON.stringify(vars), suspended.id);
            db.prepare(`
              INSERT INTO contact_attributes (contact_id, key, value)
              VALUES (?, ?, ?)
              ON CONFLICT(contact_id, key) DO UPDATE SET value = excluded.value, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            `).run(contactId, config.varKey, rawInbound);
          }
          advanceFrom(suspended.id, suspended.current_node_key, "on_reply");
          return suspended.id;
        }

        if (node.type === "send_menu") {
          const config = JSON.parse(node.config || "{}") as SendMenuNodeConfig;
          const options = config.options ?? [];

          let matchedOption: { id: string; title: string } | null = null;
          const num = parseInt(rawInbound, 10);
          if (!isNaN(num) && num >= 1 && num <= options.length) {
            matchedOption = options[num - 1];
          } else {
            const normIn = rawInbound.toLowerCase();
            matchedOption =
              options.find(
                (opt) =>
                  opt.id.toLowerCase() === normIn ||
                  opt.title.toLowerCase() === normIn ||
                  opt.title.toLowerCase().includes(normIn),
              ) ?? null;
          }

          if (matchedOption) {
            vars.selected_option = matchedOption.id;
            vars.selected_option_title = matchedOption.title;
            updateExecutionVars.run(JSON.stringify(vars), suspended.id);
            advanceFrom(suspended.id, suspended.current_node_key, matchedOption.id);
            return suspended.id;
          }
        }
      }
    }

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

      const algorithm =
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

        const normP = normalize(p);
        const cleanMsg = (msg.text ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .trim();
        const words = cleanMsg.split(/\s+/);
        const isWord = normP.length > 0 && (words.includes(normP) || cleanMsg.includes(normP));

        if (matched || isWord) {
          matchedAny = true;
          const effScore = isWord ? Math.max(score, 0.95) : score;
          if (effScore > highestScore) highestScore = effScore;
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
        ).run(expId, contactId, targetWorkflowId);
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
        db.prepare("UPDATE workflow_executions SET status = 'running' WHERE id = ?").run(job.execution_id);
        if (job.node_key) advanceFrom(job.execution_id, job.node_key);
        return;
      }

      const payload = JSON.parse(job.payload) as { kind: "text" | "media"; text?: string; mediaId?: number };
      const exec = getExecution.get(job.execution_id) as { session_id: number; contact_id: number } | undefined;
      if (!exec) return;
      const contact = getContactWithAttributes(exec.contact_id);
      if (!contact || !contact.phone) return;

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

      const currentExec = getExecution.get(job.execution_id) as { status: string } | undefined;
      if (currentExec && currentExec.status === "waiting_input") {
        return;
      }

      db.prepare("UPDATE workflow_executions SET status = 'running' WHERE id = ?").run(job.execution_id);
      if (job.node_key) advanceFrom(job.execution_id, job.node_key);
    },
    startExecution(
      workflowId: number,
      sessionId: number,
      contactId: number,
      triggerMessageId?: number,
      initialVars: Record<string, unknown> = {},
    ): number | null {
      const wf = getWorkflow.get(workflowId) as { active: number } | undefined;
      if (!wf?.active) return null;
      const trigger = getTriggerNode.get(workflowId) as { node_key: string } | undefined;
      if (!trigger) return null;
      const first = getNextKey.get(workflowId, trigger.node_key) as { target_key: string } | undefined;
      if (!first) return null;
      if (triggerMessageId != null && findExecutionByTrigger.get(triggerMessageId)) return null;
      const info = insertExecution.run(
        workflowId,
        sessionId,
        contactId,
        triggerMessageId ?? null,
        first.target_key,
        JSON.stringify(initialVars),
      );
      const executionId = Number(info.lastInsertRowid);
      void step(executionId);
      return executionId;
    },
    advanceFrom,
    runSilenceSweep(targetClock: Clock = clock) {
      return runSilenceSweepInternal(db, { advanceFrom }, targetClock);
    },
  };

  const scheduler = createScheduler(db, engine.executeJob, clock);

  return { ...engine, handleIncomingMessage, scheduler, step };
}

export async function runSilenceSweepInternal(
  db: BetterSqlite3.Database,
  engine: { advanceFrom: (executionId: number, nodeKey: string, handle?: string) => void },
  clock: Clock = realClock,
): Promise<{ scanned: number; nudged: number }> {
  const nowIso = new Date(clock.now()).toISOString();
  const dueExecutions = db.prepare(`
    SELECT we.id, we.workflow_id, we.current_node_key, we.contact_id
    FROM workflow_executions we
    WHERE we.status = 'waiting_input'
      AND we.silence_followup_at IS NOT NULL
      AND we.silence_followup_at <= ?
      AND we.silence_sweep_executed = 0
  `).all(nowIso) as Array<{ id: number; workflow_id: number; current_node_key: string; contact_id: number }>;

  let nudged = 0;
  for (const exec of dueExecutions) {
    const contact = db.prepare("SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?").get(exec.contact_id) as { bot_status: string; bot_paused_until: string | null } | undefined;
    if (contact && contact.bot_status === "paused_human") continue;

    const edge = db.prepare("SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND handle = 'on_silence_2h'").get(exec.workflow_id, exec.current_node_key) as { target_key: string } | undefined;

    if (edge) {
      db.prepare(`
        UPDATE workflow_executions
        SET status = 'running',
            current_node_key = ?,
            silence_sweep_executed = 1,
            silence_followup_at = NULL
        WHERE id = ?
      `).run(edge.target_key, exec.id);

      db.prepare("INSERT INTO events (event_type, execution_id, data) VALUES ('silence_sweep.triggered', ?, ?)").run(
        exec.id,
        JSON.stringify({ from_node: exec.current_node_key, target_node: edge.target_key }),
      );

      engine.advanceFrom(exec.id, exec.current_node_key, "on_silence_2h");
      nudged++;
    } else {
      db.prepare("UPDATE workflow_executions SET silence_sweep_executed = 1 WHERE id = ?").run(exec.id);
    }
  }

  return { scanned: dueExecutions.length, nudged };
}
