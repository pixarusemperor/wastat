import type BetterSqlite3 from "better-sqlite3";
import {
  evaluateMatch,
  normalize,
  parseSpintax,
  type KeywordMatchConfig,
  type ConditionNodeConfig,
  type SendMenuNodeConfig,
  type CollectInputNodeConfig,
  type MilestoneNodeConfig,
} from "@wastat/shared";
import { realClock, createScheduler, type Clock, type JobRow } from "./scheduler.js";
import { buildTextMenu } from "./wasender.js";
import { createStorageFromEnv } from "./media.js";
import {
  queryAll,
  queryGet,
  queryRun,
  execRun,
  toDbClient,
  jsonFromDb,
  jsonToDb,
  tsNowSql,
  trueSql,
  falseSql,
  type DbClient,
} from "./db/client.js";

export interface SendMessageInput {
  sessionId: number;
  toPhone: string;
  kind: "text" | "media";
  text?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  mediaId?: number;
  mediaUrl?: string;
  mimeType?: string;
  filename?: string;
}

export interface EngineDeps {
  clock?: Clock;
  /** PRD §13: random delays need a deterministic source in tests. */
  rng?: () => number;
  sendMessage: (input: SendMessageInput) => Promise<{
    providerMessageId: string;
    queueId?: string;
    status?: number | string;
    rawPayload?: unknown;
    rawResponse?: unknown;
  }>;
  markMessageAsRead?: (input: {
    sessionId: number;
    toPhone: string;
    key: { id: string; remoteJid: string; fromMe?: boolean };
  }) => Promise<void>;
  sendPresenceUpdate?: (input: {
    sessionId: number;
    toPhone: string;
    type: "composing" | "recording" | "available" | "unavailable";
  }) => Promise<void>;
}

/**
 * Interpolates Spintax {A|B} and {{vars.key}}, {{contact.phone}}, {{contact.name}}, {{contact.pushName}},
 * {{session.name}}, {{message.text}}, {{contact.attribute}} templates.
 */
export function interpolateVariables(
  template: string,
  vars: Record<string, unknown> = {},
  contact?: { id?: number; phone?: string; name?: string; attributes?: Record<string, string> },
  session?: { id?: number; name?: string },
  message?: { id?: number | string; text?: string; timestamp?: string },
  rng: () => number = Math.random,
): string {
  if (!template) return "";
  // 1. Interpolate {{variables}} first
  const interpolated = template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, rawKey) => {
    const key = rawKey.trim();
    if (key.startsWith("vars.")) {
      const varName = key.slice(5);
      return vars[varName] != null ? String(vars[varName]) : "";
    }
    if (key.startsWith("contact.")) {
      const contactKey = key.slice(8);
      if (contactKey === "phone" || contactKey === "number") return contact?.phone ?? "";
      if (
        contactKey === "name" ||
        contactKey === "pushName" ||
        contactKey === "push_name" ||
        contactKey === "whatsappName"
      ) {
        return contact?.name ?? "";
      }
      if (contactKey === "id") return contact?.id != null ? String(contact.id) : "";
      if (contact?.attributes && contact.attributes[contactKey] != null) {
        return contact.attributes[contactKey];
      }
    }
    if (key.startsWith("session.")) {
      const sessionKey = key.slice(8);
      if (sessionKey === "name") return session?.name ?? "";
      if (sessionKey === "id") return session?.id != null ? String(session.id) : "";
    }
    if (key.startsWith("message.")) {
      const msgKey = key.slice(8);
      if (msgKey === "text" || msgKey === "body") return message?.text ?? "";
      if (msgKey === "id") return message?.id != null ? String(message.id) : "";
      if (msgKey === "timestamp") return message?.timestamp ?? "";
    }
    if (contact?.attributes && contact.attributes[key] != null) {
      return contact.attributes[key];
    }
    if (key === "phone" || key === "number") return contact?.phone ?? "";
    if (key === "name" || key === "pushName") return contact?.name ?? "";
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

export function createEngine(db: DbClient | BetterSqlite3.Database, deps: EngineDeps) {
  const dbClient = toDbClient(db);
  const isPg = Boolean(dbClient.sql);
  const clock = deps.clock ?? realClock;
  const rng = deps.rng ?? Math.random;

  const iso = (ms: number) => new Date(ms).toISOString();

  const getWorkflow = async (workflowId: number | string) =>
    queryGet(dbClient, "SELECT * FROM workflows WHERE id = ?", [workflowId]);
  const getNode = async (workflowId: number | string, nodeKey: string) =>
    queryGet(dbClient, "SELECT * FROM workflow_nodes WHERE workflow_id = ? AND node_key = ?", [
      workflowId,
      nodeKey,
    ]);
  const getNextKey = async (workflowId: number | string, nodeKey: string) =>
    queryGet(
      dbClient,
      "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND (handle IS NULL OR handle = '') LIMIT 1",
      [workflowId, nodeKey],
    );
  const getEdgeByHandle = async (workflowId: number | string, nodeKey: string, handle: string) =>
    queryGet(
      dbClient,
      "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND handle = ? LIMIT 1",
      [workflowId, nodeKey, handle],
    );
  const getTriggerNode = async (workflowId: number | string) =>
    queryGet(dbClient, "SELECT node_key FROM workflow_nodes WHERE workflow_id = ? AND type = 'trigger'", [
      workflowId,
    ]);
  // Presentation (trigger-less) entry: the node with no incoming edges —
  // i.e. the first node the graph executes, which for Option C variants is
  // the first send node. Lowest id wins if the graph has several entries.
  const getEntryNode = async (workflowId: number | string) =>
    queryGet(
      dbClient,
      `SELECT node_key FROM workflow_nodes wn
       WHERE wn.workflow_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM workflow_edges we
           WHERE we.workflow_id = wn.workflow_id AND we.target_key = wn.node_key
         )
       ORDER BY wn.id ASC
       LIMIT 1`,
      [workflowId],
    );
  const getTriggerText = async (executionId: number) =>
    queryGet(
      dbClient,
      `SELECT m.text FROM workflow_executions we JOIN messages m ON m.id = we.trigger_message_id
    WHERE we.id = ?`,
      [executionId],
    );
  const findExecutionByTrigger = async (triggerMessageId: number | string) =>
    queryGet(dbClient, "SELECT id FROM workflow_executions WHERE trigger_message_id = ?", [
      triggerMessageId,
    ]);
  const getExecution = async (executionId: number) =>
    queryGet(dbClient, "SELECT * FROM workflow_executions WHERE id = ?", [executionId]);

  async function complete(executionId: number, currentKey: string | null) {
    await queryRun(
      dbClient,
      "UPDATE workflow_executions SET status = ?, current_node_key = ?, finished_at = ? WHERE id = ?",
      ["completed", currentKey, iso(clock.now()), executionId],
    );
    const exec = (await getExecution(executionId)) as
      | { session_id: number; contact_id: number }
      | undefined;
    if (exec) {
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('execution.completed', ?, ?, ?, ?)`,
        [exec.session_id, exec.contact_id, executionId, jsonToDb(dbClient, {})],
      );
    }
  }

  async function setWaiting(executionId: number, currentKey: string) {
    await queryRun(
      dbClient,
      "UPDATE workflow_executions SET status = ?, current_node_key = ? WHERE id = ?",
      ["waiting", currentKey, executionId],
    );
  }

  async function setWaitingInput(executionId: number, currentKey: string) {
    const silenceIso = new Date(clock.now() + 2 * 3600 * 1000).toISOString();
    await queryRun(
      dbClient,
      `UPDATE workflow_executions
      SET status = 'waiting_input',
          current_node_key = ?,
          silence_followup_at = ?,
          reply_window_expires_at = ?,
          silence_sweep_executed = ${falseSql(dbClient)},
          finished_at = NULL
      WHERE id = ?`,
      [currentKey, silenceIso, silenceIso, executionId],
    );
  }

  async function getContactWithAttributes(contactId: number | string) {
    const contact = (await queryGet(
      dbClient,
      "SELECT id, phone, name, funnel_phase, bot_status, bot_paused_until FROM contacts WHERE id = ?",
      [contactId],
    )) as
      | { id?: number; phone?: string; name?: string; funnel_phase?: string; bot_status?: string; bot_paused_until?: string | null }
      | undefined;
    if (!contact) return undefined;
    const rows = (await queryAll(
      dbClient,
      "SELECT key, value FROM contact_attributes WHERE contact_id = ?",
      [contactId],
    )) as Array<{ key: string; value: string }>;
    const attributes: Record<string, string> = {};
    for (const r of rows) attributes[r.key] = r.value;
    return { ...contact, attributes };
  }

  async function step(executionId: number): Promise<void> {
    const exec = (await getExecution(executionId)) as
      | {
          id: number;
          workflow_id: number;
          session_id: number;
          contact_id: number;
          status: string;
          current_node_key: string | null;
          vars: unknown;
        }
      | undefined;
    if (!exec || exec.status !== "running") return;

    const contact = await getContactWithAttributes(exec.contact_id);
    if (contact && (contact.bot_status === "paused_human" || contact.bot_status === "opted_out")) {
      if (contact.bot_paused_until && new Date(contact.bot_paused_until).getTime() > clock.now()) {
        await queryRun(
          dbClient,
          "UPDATE workflow_executions SET status = 'paused_human' WHERE id = ?",
          [executionId],
        );
        await queryRun(
          dbClient,
          "INSERT INTO events (event_type, session_id, contact_id, execution_id, data) VALUES ('execution.suppressed.human_takeover', ?, ?, ?, ?)",
          [exec.session_id, exec.contact_id, executionId, jsonToDb(dbClient, {})],
        );
        return;
      } else if (contact.bot_status === "paused_human") {
        await queryRun(
          dbClient,
          "UPDATE contacts SET bot_status = 'active', bot_paused_until = NULL WHERE id = ?",
          [exec.contact_id],
        );
      } else {
        await queryRun(dbClient, "UPDATE workflow_executions SET status = 'cancelled' WHERE id = ?", [
          executionId,
        ]);
        return;
      }
    }

    const session = (await queryGet(dbClient, "SELECT id, name FROM sessions WHERE id = ?", [
      exec.session_id,
    ])) as { id: number; name: string } | undefined;
    const triggerMsg = (await getTriggerText(executionId)) as
      | { id: number; text: string; timestamp: string }
      | undefined;

    let vars: Record<string, unknown> = {};
    try {
      vars = jsonFromDb(exec.vars) as Record<string, unknown>;
    } catch {}

    try {
      while (true) {
        if (!exec.current_node_key) {
          await complete(executionId, null);
          return;
        }
        const node = (await getNode(exec.workflow_id, exec.current_node_key)) as
          | { type: string; config: unknown }
          | undefined;
        if (!node) {
          await complete(executionId, exec.current_node_key);
          return;
        }

        await queryRun(
          dbClient,
          `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
          VALUES ('node.entered', ?, ?, ?, ?)`,
          [
            exec.session_id,
            exec.contact_id,
            executionId,
            jsonToDb(dbClient, { node_key: exec.current_node_key, type: node.type }),
          ],
        );

        switch (node.type) {
          case "send_text": {
            const config = jsonFromDb(node.config) as { text?: string };
            const interpolated = interpolateVariables(config.text ?? "", vars, contact, session, triggerMsg, rng);
            await enqueueSend(executionId, exec.current_node_key, {
              kind: "text",
              text: interpolated,
            });
            await setWaiting(executionId, exec.current_node_key);
            return;
          }
          case "send_media": {
            const config = jsonFromDb(node.config) as {
              text?: string;
              caption?: string;
              mediaType?: "image" | "audio" | "video" | "document";
              mediaId?: number;
              mediaUrl?: string;
              url?: string;
              mimeType?: string;
              filename?: string;
              fileName?: string;
            };
            const rawCaption = config.caption ?? config.text;
            const caption = rawCaption ? interpolateVariables(rawCaption, vars, contact, session, triggerMsg, rng) : undefined;

            let resolvedMediaUrl = config.mediaUrl ?? config.url;
            let resolvedMimeType = config.mimeType;
            let resolvedFilename = config.filename ?? config.fileName;
            let resolvedMediaType = config.mediaType;

            if (!resolvedMediaUrl && config.mediaId) {
              const asset = (await queryGet(
                dbClient,
                "SELECT r2_key, mime_type, filename FROM media_assets WHERE id = ?",
                [config.mediaId],
              )) as { r2_key: string; mime_type?: string; filename?: string } | undefined;
              if (asset?.r2_key) {
                try {
                  resolvedMediaUrl = createStorageFromEnv().getPublicUrl(asset.r2_key);
                } catch {}
                resolvedMimeType ||= asset.mime_type;
                resolvedFilename ||= asset.filename;
                if (!resolvedMediaType && asset.mime_type) {
                  if (asset.mime_type.startsWith("image/")) resolvedMediaType = "image";
                  else if (asset.mime_type.startsWith("audio/")) resolvedMediaType = "audio";
                  else if (asset.mime_type.startsWith("video/")) resolvedMediaType = "video";
                  else resolvedMediaType = "document";
                }
              }
            }

            await enqueueSend(executionId, exec.current_node_key, {
              kind: "media",
              text: caption,
              mediaType: resolvedMediaType,
              mediaId: config.mediaId,
              mediaUrl: resolvedMediaUrl,
              mimeType: resolvedMimeType,
              filename: resolvedFilename,
            });
            await setWaiting(executionId, exec.current_node_key);
            return;
          }
          case "send_menu": {
            const config = jsonFromDb(node.config) as unknown as SendMenuNodeConfig;
            const bodyText = interpolateVariables(config.bodyText ?? "", vars, contact, session, triggerMsg, rng);
            const menuText = buildTextMenu(config.header, bodyText, config.options ?? [], config.footer);
            await enqueueSend(executionId, exec.current_node_key, {
              kind: "text",
              text: menuText,
            });
            await setWaitingInput(executionId, exec.current_node_key);
            return;
          }
          case "collect_input": {
            const config = jsonFromDb(node.config) as unknown as CollectInputNodeConfig;
            const prompt = interpolateVariables(config.promptText ?? "", vars, contact, session, triggerMsg, rng);
            if (prompt.trim()) {
              await enqueueSend(executionId, exec.current_node_key, {
                kind: "text",
                text: prompt,
              });
            }
            await setWaitingInput(executionId, exec.current_node_key);
            return;
          }
          case "condition": {
            const config = jsonFromDb(node.config) as unknown as ConditionNodeConfig;
            const triggerText =
              ((await getTriggerText(executionId)) as { text: string | null } | undefined)?.text ?? "";
            const isTrue = evaluateCondition(config, vars, triggerText, contact);

            await queryRun(
              dbClient,
              `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
              VALUES ('condition.evaluated', ?, ?, ?, ?)`,
              [
                exec.session_id,
                exec.contact_id,
                executionId,
                jsonToDb(dbClient, { node_key: exec.current_node_key, result: isTrue }),
              ],
            );

            const branchHandle = isTrue ? "true" : "false";
            const edge = (await getEdgeByHandle(exec.workflow_id, exec.current_node_key, branchHandle)) as
              | { target_key: string }
              | undefined;

            if (edge) {
              exec.current_node_key = edge.target_key;
              await queryRun(
                dbClient,
                "UPDATE workflow_executions SET current_node_key = ? WHERE id = ?",
                [edge.target_key, executionId],
              );
              break;
            } else {
              const defEdge = (await getNextKey(exec.workflow_id, exec.current_node_key)) as
                | { target_key: string }
                | undefined;
              if (defEdge) {
                exec.current_node_key = defEdge.target_key;
                break;
              }
              await complete(executionId, exec.current_node_key);
              return;
            }
          }
          case "milestone": {
            const config = (jsonFromDb(node.config) ?? {}) as unknown as MilestoneNodeConfig;
            if (config.milestoneKey) {
              await queryRun(
                dbClient,
                `INSERT INTO funnel_conversions (execution_id, workflow_id, contact_id, milestone_key, value)
                VALUES (?, ?, ?, ?, ?)`,
                [executionId, exec.workflow_id, exec.contact_id, config.milestoneKey, config.value ?? 1],
              );
              await queryRun(
                dbClient,
                `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
                VALUES ('milestone.reached', ?, ?, ?, ?)`,
                [
                  exec.session_id,
                  exec.contact_id,
                  executionId,
                  jsonToDb(dbClient, { milestone_key: config.milestoneKey, value: config.value ?? 1 }),
                ],
              );
            }
            const next = (await getNextKey(exec.workflow_id, exec.current_node_key)) as
              | { target_key: string }
              | undefined;
            if (!next) {
              await complete(executionId, exec.current_node_key);
              return;
            }
            exec.current_node_key = next.target_key;
            break;
          }
          case "delay": {
            const config = (jsonFromDb(node.config) ?? {}) as {
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

            await queryRun(
              dbClient,
              "INSERT INTO events (event_type, execution_id, data) VALUES ('delay.scheduled', ?, ?)",
              [executionId, jsonToDb(dbClient, { seconds })],
            );
            await scheduler.enqueue({
              type: "resume",
              executionId,
              nodeKey: exec.current_node_key,
              runAt: new Date(clock.now() + seconds * 1000),
              payload: { seconds },
            });
            await setWaiting(executionId, exec.current_node_key);
            return;
          }
          case "keyword": {
            const config = jsonFromDb(node.config) as unknown as KeywordMatchConfig;
            const triggerText = (await getTriggerText(executionId)) as { text: string | null } | undefined;
            const { matched } = evaluateMatch(config, triggerText?.text ?? "");
            if (!matched) {
              await complete(executionId, exec.current_node_key);
              return;
            }
            const next = (await getNextKey(exec.workflow_id, exec.current_node_key)) as
              | { target_key: string }
              | undefined;
            if (!next) {
              await complete(executionId, exec.current_node_key);
              return;
            }
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
            const next = (await getNextKey(exec.workflow_id, exec.current_node_key)) as
              | { target_key: string }
              | undefined;
            if (!next) {
              await complete(executionId, exec.current_node_key);
              return;
            }
            exec.current_node_key = next.target_key;
            break;
          }
          case "end":
            await complete(executionId, exec.current_node_key);
            return;
          default:
            await complete(executionId, exec.current_node_key);
            return;
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err));
      const errStack = err?.stack || "";
      await queryRun(
        dbClient,
        "UPDATE workflow_executions SET status = 'failed', finished_at = ? WHERE id = ?",
        [iso(clock.now()), executionId],
      );
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('execution.failed', ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          executionId,
          jsonToDb(dbClient, {
            node_key: exec.current_node_key,
            error: errMsg,
            stack: errStack,
          }),
        ],
      );
    }
  }

  async function advanceFrom(executionId: number, nodeKey: string, handle?: string): Promise<void> {
    const exec = (await getExecution(executionId)) as { workflow_id: number } | undefined;
    if (!exec) return;

    let targetKey: string | null = null;
    if (handle) {
      const edge = (await getEdgeByHandle(exec.workflow_id, nodeKey, handle)) as
        | { target_key: string }
        | undefined;
      if (edge) targetKey = edge.target_key;
    }
    if (!targetKey) {
      const next = (await getNextKey(exec.workflow_id, nodeKey)) as { target_key: string } | undefined;
      if (next) targetKey = next.target_key;
    }

    if (!targetKey) {
      await complete(executionId, null);
      return;
    }
    await queryRun(
      dbClient,
      "UPDATE workflow_executions SET status = 'running', current_node_key = ?, finished_at = NULL WHERE id = ?",
      [targetKey, executionId],
    );
    await step(executionId);
  }

  async function enqueueSend(
    executionId: number,
    nodeKey: string,
    partial: {
      kind: "text" | "media";
      text?: string;
      mediaType?: "image" | "audio" | "video" | "document";
      mediaId?: number;
      mediaUrl?: string;
      mimeType?: string;
      filename?: string;
    },
  ) {
    await scheduler.enqueue({
      type: "send_message",
      executionId,
      nodeKey,
      payload: partial,
    });
  }

  async function handleIncomingMessage(
    sessionId: number,
    contactId: number,
    messageId: number,
    isGroup = false,
  ): Promise<number | null> {
    const msg = (await queryGet(dbClient, "SELECT text, provider_message_id FROM messages WHERE id = ?", [
      messageId,
    ])) as { text: string | null; provider_message_id: string | null } | undefined;
    if (!msg || !msg.text) return null;

    const rawInbound = msg.text.trim();

    // Check contact bot status: suppress auto-reply if human takeover is active
    const contact = await getContactWithAttributes(contactId);
    if (contact && (contact.bot_status === "paused_human" || contact.bot_status === "opted_out")) {
      if (contact.bot_paused_until && new Date(contact.bot_paused_until).getTime() > clock.now()) {
        await queryRun(
          dbClient,
          `INSERT INTO events (event_type, session_id, contact_id, message_id, data)
          VALUES ('execution.suppressed.human_takeover', ?, ?, ?, ?)`,
          [sessionId, contactId, messageId, jsonToDb(dbClient, {})],
        );
        return null;
      }
      if (contact.bot_status === "paused_human") {
        await queryRun(
          dbClient,
          "UPDATE contacts SET bot_status = 'active', bot_paused_until = NULL WHERE id = ?",
          [contactId],
        );
      } else {
        return null;
      }
    }

    const suspended = (await queryGet(
      dbClient,
      `SELECT * FROM workflow_executions
      WHERE session_id = ? AND contact_id = ? AND status = 'waiting_input'
      ORDER BY id DESC LIMIT 1`,
      [sessionId, contactId],
    )) as
      | {
          id: number;
          workflow_id: number;
          current_node_key: string;
          vars: unknown;
        }
      | undefined;

    if (suspended && suspended.current_node_key) {
      const node = (await getNode(suspended.workflow_id, suspended.current_node_key)) as
        | { type: string; config: unknown }
        | undefined;

      if (node) {
        let vars: Record<string, unknown> = {};
        try {
          vars = jsonFromDb(suspended.vars) as Record<string, unknown>;
        } catch {}

        // Cancel pending silence followup upon organic reply
        await queryRun(
          dbClient,
          `UPDATE workflow_executions
          SET silence_followup_at = NULL,
              silence_sweep_executed = ${falseSql(dbClient)}
          WHERE id = ?`,
          [suspended.id],
        );

        if (node.type === "collect_input") {
          const config = jsonFromDb(node.config) as unknown as CollectInputNodeConfig;
          if (config.varKey) {
            vars[config.varKey] = rawInbound;
            await queryRun(
              dbClient,
              "UPDATE workflow_executions SET vars = ? WHERE id = ?",
              [jsonToDb(dbClient, vars), suspended.id],
            );
            await queryRun(
              dbClient,
              `INSERT INTO contact_attributes (contact_id, key, value)
              VALUES (?, ?, ?)
              ON CONFLICT(contact_id, key) DO UPDATE SET value = excluded.value, updated_at = ${tsNowSql(dbClient)}`,
              [contactId, config.varKey, rawInbound],
            );
          }

          // Blue ticks + typing simulation before advancing reply
          const readDelayMs = 1500 + Math.floor(rng() * 2000);
          await scheduler.enqueue({
            type: "mark_read",
            executionId: suspended.id,
            runAt: new Date(clock.now() + readDelayMs),
          });
          await advanceFrom(suspended.id, suspended.current_node_key, "on_reply");
          return Number(suspended.id);
        }

        if (node.type === "send_menu") {
          const config = jsonFromDb(node.config) as unknown as SendMenuNodeConfig;
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
            await queryRun(
              dbClient,
              "UPDATE workflow_executions SET vars = ? WHERE id = ?",
              [jsonToDb(dbClient, vars), suspended.id],
            );

            const readDelayMs = 1500 + Math.floor(rng() * 2000);
            await scheduler.enqueue({
              type: "mark_read",
              executionId: suspended.id,
              runAt: new Date(clock.now() + readDelayMs),
            });
            await advanceFrom(suspended.id, suspended.current_node_key, matchedOption.id);
            return Number(suspended.id);
          }
        }
      }
    }

    // ---- Option C: experiment-owned shared trigger. If an active experiment
    // has trigger_keywords set, route through IT (variants are presentation
    // workflows picked from experiment_variants). Experiments without
    // trigger_keywords fall through to the legacy per-workflow matching below.
    const keywordList = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw.filter((k): k is string => typeof k === "string" && !!k.trim());
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string" && !!k.trim());
        } catch {}
      }
      return [];
    };

    const activeExperiments = (await queryAll(
      dbClient,
      `SELECT id, trigger_keywords, trigger_algorithm, trigger_threshold
       FROM experiments
       WHERE active = ${trueSql(dbClient)}
         AND trigger_keywords IS NOT NULL
         AND (session_id IS NULL OR session_id = ?)`,
      [sessionId],
    )) as Array<{
      id: number;
      trigger_keywords: unknown;
      trigger_algorithm: string;
      trigger_threshold: number;
    }>;

    let bestExperiment: { id: number; score: number; keyword: string } | null = null;
    for (const exp of activeExperiments) {
      const phrases = keywordList(exp.trigger_keywords);
      if (phrases.length === 0) continue;
      const algorithm =
        exp.trigger_algorithm === "exact"
          ? "exact"
          : exp.trigger_algorithm === "levenshtein"
            ? "levenshtein"
            : "dice";
      const threshold =
        typeof exp.trigger_threshold === "number"
          ? exp.trigger_threshold <= 1
            ? exp.trigger_threshold * 100
            : exp.trigger_threshold
          : 75;
      let expScore = 0;
      let expKeyword = "";
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
          const effScore = isWord ? Math.max(score, 0.95) : score;
          if (effScore > expScore) {
            expScore = effScore;
            expKeyword = p;
          }
        }
      }
      if (expScore > 0 && (!bestExperiment || expScore > bestExperiment.score)) {
        bestExperiment = { id: Number(exp.id), score: expScore, keyword: expKeyword };
      }
    }

    if (bestExperiment) {
      const expId = bestExperiment.id;
      // Sticky first: an already-assigned contact keeps their variant.
      const sticky = (await queryGet(
        dbClient,
        "SELECT workflow_id FROM experiment_assignments WHERE experiment_id = ? AND contact_id = ?",
        [expId, contactId],
      )) as { workflow_id: number } | undefined;

      let targetWorkflowId: number;
      if (sticky) {
        targetWorkflowId = Number(sticky.workflow_id);
      } else {
        const expRow = (await queryGet(dbClient, "SELECT distribution_mode FROM experiments WHERE id = ?", [
          expId,
        ])) as { distribution_mode: string } | undefined;
        const distributionMode = expRow?.distribution_mode ?? "balanced";
        const activeVariants = (await queryAll(
          dbClient,
          `SELECT workflow_id AS id, weight FROM experiment_variants
           WHERE experiment_id = ? AND active = ${trueSql(dbClient)}
           ORDER BY workflow_id ASC`,
          [expId],
        )) as Array<{ id: number; weight: number }>;
        if (activeVariants.length === 0) return null;

        if (distributionMode === "weighted") {
          // Weighted random: weight w means w% of new assignments.
          const totalWeight = activeVariants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0);
          if (totalWeight <= 0) return null;
          let roll = rng() * totalWeight;
          let picked: number | undefined;
          for (const v of activeVariants) {
            roll -= Number(v.weight) || 0;
            if (roll < 0) {
              picked = Number(v.id);
              break;
            }
          }
          if (picked === undefined) picked = Number(activeVariants[activeVariants.length - 1].id);
          targetWorkflowId = picked;
        } else {
          // Balanced default: least-assigned active variant (ties -> lowest id).
          const pick = (await queryGet(
            dbClient,
            `SELECT ev.workflow_id AS id FROM experiment_variants ev
             LEFT JOIN experiment_assignments ea
               ON ea.experiment_id = ev.experiment_id AND ea.workflow_id = ev.workflow_id
             WHERE ev.experiment_id = ? AND ev.active = ${trueSql(dbClient)}
             GROUP BY ev.workflow_id
             ORDER BY COUNT(ea.contact_id) ASC, ev.workflow_id ASC
             LIMIT 1`,
            [expId],
          )) as { id: number } | undefined;
          if (!pick) return null;
          targetWorkflowId = Number(pick.id);
        }
        // composite-PK table: no id column, so use execRun (no RETURNING)
        await execRun(
          dbClient,
          "INSERT INTO experiment_assignments (experiment_id, contact_id, workflow_id) VALUES (?, ?, ?)",
          [expId, contactId, targetWorkflowId],
        );
      }
      // Option C: variants are trigger-less presentation workflows — start at
      // their first node, the experiment owns the trigger.
      return startExecution(targetWorkflowId, sessionId, contactId, messageId, {}, { skipTrigger: true });
    }

    // Filter active workflows strictly by session: workflow.session_id IS NULL OR workflow.session_id = sessionId
    const activeWorkflows = (await queryAll(
      dbClient,
      `SELECT id, session_id, experiment_id FROM workflows 
      WHERE active = ${trueSql(dbClient)} AND (session_id IS NULL OR session_id = ?)`,
      [sessionId],
    )) as Array<{ id: number; session_id: number | null; experiment_id: number | null }>;

    if (activeWorkflows.length === 0) {
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, message_id, data)
        VALUES ('trigger.unmatched', ?, ?, ?, ?)`,
        [sessionId, contactId, messageId, jsonToDb(dbClient, { reason: "no_active_workflows_for_session" })],
      );
      return null;
    }

    const activeWorkflowIds = new Set(activeWorkflows.map((w) => Number(w.id)));
    const getKeywordNodes = await queryAll(
      dbClient,
      `SELECT workflow_id, type, config FROM workflow_nodes 
      WHERE type IN ('keyword', 'trigger', 'trigger_personal', 'trigger_group')`,
    );

    let best: { workflowId: number; score: number; priority: number; keyword?: string } | null = null;
    for (const row of getKeywordNodes as Array<{ workflow_id: number; type: string; config: unknown }>) {
      if (!activeWorkflowIds.has(Number(row.workflow_id))) continue;

      // Group vs Personal isolation
      if (isGroup && row.type === "trigger_personal") continue;
      if (!isGroup && row.type === "trigger_group") continue;

      let rawConfig: Record<string, unknown> = {};
      try {
        rawConfig = jsonFromDb(row.config);
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
      let matchedPhrase = "";

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
          if (effScore > highestScore) {
            highestScore = effScore;
            matchedPhrase = p;
          }
        }
      }

      if (!matchedAny) continue;

      if (
        !best ||
        highestScore > best.score ||
        (highestScore === best.score && priority > best.priority) ||
        (highestScore === best.score && priority === best.priority && Number(row.workflow_id) < best.workflowId)
      ) {
        best = { workflowId: Number(row.workflow_id), score: highestScore, priority, keyword: matchedPhrase };
      }
    }

    // Condition FALSE: No trigger matched -> DO NOT mark read, return null
    if (!best) {
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, message_id, data)
        VALUES ('trigger.unmatched', ?, ?, ?, ?)`,
        [sessionId, contactId, messageId, jsonToDb(dbClient, { text: msg.text })],
      );
      return null;
    }

    let targetWorkflowId = best.workflowId;
    const wfRow = (await queryGet(dbClient, "SELECT experiment_id FROM workflows WHERE id = ?", [
      best.workflowId,
    ])) as { experiment_id: number | null };
    const expId = wfRow?.experiment_id ?? null;
    if (expId != null) {
      const sticky = (await queryGet(
        dbClient,
        "SELECT workflow_id FROM experiment_assignments WHERE experiment_id = ? AND contact_id = ?",
        [expId, contactId],
      )) as { workflow_id: number } | undefined;
      if (sticky) {
        targetWorkflowId = Number(sticky.workflow_id);
      } else {
        const pick = (await queryGet(
          dbClient,
          `SELECT w.id FROM workflows w
          LEFT JOIN experiment_assignments ea
            ON ea.workflow_id = w.id AND ea.experiment_id = w.experiment_id
          WHERE w.experiment_id = ? AND w.active = ${trueSql(dbClient)}
          GROUP BY w.id
          ORDER BY COUNT(ea.contact_id) ASC, w.id ASC
          LIMIT 1`,
          [expId],
        )) as { id: number } | undefined;
        if (!pick) return null;
        targetWorkflowId = Number(pick.id);
        // composite-PK table: no id column, so use execRun (no RETURNING)
        await execRun(
          dbClient,
          "INSERT INTO experiment_assignments (experiment_id, contact_id, workflow_id) VALUES (?, ?, ?)",
          [expId, contactId, targetWorkflowId],
        );
      }
    }

    return startExecution(targetWorkflowId, sessionId, contactId, messageId);
  }

  async function attributeReply(messageId: number): Promise<void> {
    const msg = (await queryGet(
      dbClient,
      "SELECT session_id, contact_id FROM messages WHERE id = ? AND direction = 'in'",
      [messageId],
    )) as { session_id: number; contact_id: number } | undefined;
    if (!msg) return;
    const lastOut = (await queryGet(
      dbClient,
      `SELECT m.id, m.workflow_execution_id FROM messages m
      WHERE m.session_id = ? AND m.contact_id = ? AND m.direction = 'out'
        AND m.workflow_execution_id IS NOT NULL
      ORDER BY m.id DESC LIMIT 1`,
      [msg.session_id, msg.contact_id],
    )) as
      | { id: number; workflow_execution_id: number }
      | undefined;
    if (!lastOut) return;
    await queryRun(dbClient, "UPDATE messages SET in_reply_to_id = ? WHERE id = ?", [
      lastOut.id,
      messageId,
    ]);
    await queryRun(
      dbClient,
      "INSERT INTO events (event_type, execution_id, message_id, data) VALUES ('reply.attributed', ?, ?, ?)",
      [lastOut.workflow_execution_id, messageId, jsonToDb(dbClient, {})],
    );
  }

  async function executeJob(job: JobRow) {
    const exec = (await getExecution(Number(job.execution_id))) as
      | {
          session_id: number;
          contact_id: number;
          workflow_id: number;
          trigger_message_id: number | null;
        }
      | undefined;
    if (!exec) return;
    const contact = await getContactWithAttributes(exec.contact_id);
    if (!contact || !contact.phone) return;

    try {
      if (job.type === "mark_read") {
        const triggerMsg = exec.trigger_message_id
          ? ((await queryGet(dbClient, "SELECT id, provider_message_id FROM messages WHERE id = ?", [
              exec.trigger_message_id,
            ])) as { id: number; provider_message_id: string } | undefined)
          : undefined;
        if (triggerMsg?.id) {
          await queryRun(dbClient, "UPDATE messages SET status = 'read' WHERE id = ?", [triggerMsg.id]);
        }
        if (deps.markMessageAsRead) {
          await deps
            .markMessageAsRead({
              sessionId: exec.session_id,
              toPhone: contact.phone,
              key: { id: triggerMsg?.provider_message_id ?? `msg-${Date.now()}`, remoteJid: contact.phone },
            })
            .catch(() => {});
        }
        await queryRun(
          dbClient,
          `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
          VALUES ('read_receipt.sent', ?, ?, ?, ?)`,
          [exec.session_id, exec.contact_id, job.execution_id, jsonToDb(dbClient, {})],
        );
        return;
      }

      if (job.type === "send_presence") {
        const payload = jsonFromDb(job.payload) as { presence?: "composing" | "recording"; durationMs?: number };
        if (deps.sendPresenceUpdate) {
          await deps
            .sendPresenceUpdate({
              sessionId: exec.session_id,
              toPhone: contact.phone,
              type: payload.presence ?? "composing",
            })
            .catch(() => {});
        }
        await queryRun(
          dbClient,
          `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
          VALUES ('presence.sent', ?, ?, ?, ?)`,
          [
            exec.session_id,
            exec.contact_id,
            job.execution_id,
            jsonToDb(dbClient, { presence: payload.presence ?? "composing" }),
          ],
        );
        return;
      }

      if (job.type === "resume") {
        await queryRun(dbClient, "UPDATE workflow_executions SET status = 'running' WHERE id = ?", [
          job.execution_id,
        ]);
        await queryRun(
          dbClient,
          `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
          VALUES ('workflow.step', ?, ?, ?, ?)`,
          [
            exec.session_id,
            exec.contact_id,
            job.execution_id,
            jsonToDb(dbClient, { node_key: job.node_key }),
          ],
        );
        if (job.node_key) await advanceFrom(job.execution_id, job.node_key);
        else await step(job.execution_id);
        return;
      }

      // job.type === "send_message"
      // Ensure trigger message status is marked read when reply is dispatched
      if (exec.trigger_message_id) {
        await queryRun(
          dbClient,
          "UPDATE messages SET status = 'read' WHERE id = ? AND status != 'read'",
          [exec.trigger_message_id],
        );
      }

      const payload = jsonFromDb(job.payload) as {
        kind: "text" | "media";
        text?: string;
        mediaType?: "image" | "audio" | "video" | "document";
        mediaId?: number;
        mediaUrl?: string;
        mimeType?: string;
        filename?: string;
      };

      let resolvedMediaUrl = payload.mediaUrl;
      let resolvedMimeType = payload.mimeType;
      let resolvedFilename = payload.filename;
      let resolvedMediaType = payload.mediaType;

      if (!resolvedMediaUrl && payload.mediaId) {
        const asset = (await queryGet(
          dbClient,
          "SELECT r2_key, mime_type, filename FROM media_assets WHERE id = ?",
          [payload.mediaId],
        )) as { r2_key: string; mime_type?: string; filename?: string } | undefined;
        if (asset?.r2_key) {
          try {
            resolvedMediaUrl = createStorageFromEnv().getPublicUrl(asset.r2_key);
          } catch {}
          resolvedMimeType ||= asset.mime_type;
          resolvedFilename ||= asset.filename;
          if (!resolvedMediaType && asset.mime_type) {
            if (asset.mime_type.startsWith("image/")) resolvedMediaType = "image";
            else if (asset.mime_type.startsWith("audio/")) resolvedMediaType = "audio";
            else if (asset.mime_type.startsWith("video/")) resolvedMediaType = "video";
            else resolvedMediaType = "document";
          }
        }
      }

      const startTime = clock.now();
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('api.outbound_dispatch', ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          job.execution_id,
          jsonToDb(dbClient, {
            node_key: job.node_key,
            kind: payload.kind,
            to: contact.phone,
            text: payload.text,
            mediaType: resolvedMediaType,
            mediaUrl: resolvedMediaUrl,
            mimeType: resolvedMimeType,
            filename: resolvedFilename,
          }),
        ],
      );

      const result = await deps.sendMessage({
        sessionId: exec.session_id,
        toPhone: contact.phone,
        kind: payload.kind,
        text: payload.text,
        mediaType: resolvedMediaType,
        mediaId: payload.mediaId,
        mediaUrl: resolvedMediaUrl,
        mimeType: resolvedMimeType,
        filename: resolvedFilename,
      });

      const durationMs = clock.now() - startTime;
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('api.outbound_response', ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          job.execution_id,
          jsonToDb(dbClient, {
            node_key: job.node_key,
            status: result.status ?? 200,
            provider_message_id: result.providerMessageId,
            duration_ms: durationMs,
            raw_response: result.rawResponse ?? null,
          }),
        ],
      );

      await queryRun(
        dbClient,
        `INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, queue_id, workflow_execution_id, node_key, status, timestamp)
        VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          payload.kind === "media" ? "media" : "text",
          payload.text ?? null,
          result.providerMessageId,
          result.queueId ?? null,
          job.execution_id,
          job.node_key,
          typeof result.status === "string" ? result.status : "sent",
          iso(clock.now()),
        ],
      );

      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('message.sent', ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          job.execution_id,
          jsonToDb(dbClient, {
            kind: payload.kind,
            provider_message_id: result.providerMessageId,
            node_key: job.node_key,
          }),
        ],
      );

      const currentExec = (await getExecution(job.execution_id)) as { status: string } | undefined;
      if (currentExec && currentExec.status === "waiting_input") {
        return;
      }

      await queryRun(dbClient, "UPDATE workflow_executions SET status = 'running' WHERE id = ?", [
        job.execution_id,
      ]);
      if (job.node_key) await advanceFrom(job.execution_id, job.node_key);
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err));
      const errStack = err?.stack || "";
      await queryRun(
        dbClient,
        "UPDATE workflow_executions SET status = 'failed', finished_at = ? WHERE id = ?",
        [iso(clock.now()), job.execution_id],
      );
      await queryRun(
        dbClient,
        `INSERT INTO events (event_type, session_id, contact_id, execution_id, data)
        VALUES ('job.failed', ?, ?, ?, ?)`,
        [
          exec.session_id,
          exec.contact_id,
          job.execution_id,
          jsonToDb(dbClient, {
            job_type: job.type,
            node_key: job.node_key,
            error: errMsg,
            details: err?.body ?? err?.response ?? err,
            status: err?.status ?? 500,
            stack: errStack,
          }),
        ],
      );
      throw err;
    }
  }

  async function startExecution(
    workflowId: number,
    sessionId: number,
    contactId: number,
    triggerMessageId?: number,
    initialVars: Record<string, unknown> = {},
    opts?: { skipTrigger?: boolean },
  ): Promise<number | null> {
    const wf = (await getWorkflow(workflowId)) as { active: number } | undefined;
    if (!wf?.active) return null;
    let first: { node_key?: string; target_key?: string } | undefined;
    if (opts?.skipTrigger) {
      // Presentation path (Option C): the variant workflow has no trigger
      // node — start at its first executable node (entry with no in-edges).
      first = (await getEntryNode(workflowId)) as { node_key: string } | undefined;
    } else {
      const trigger = (await getTriggerNode(workflowId)) as { node_key: string } | undefined;
      if (!trigger) return null;
      first = (await getNextKey(workflowId, trigger.node_key)) as { target_key: string } | undefined;
    }
    const firstKey = first?.node_key ?? first?.target_key;
    if (!firstKey) return null;
    if (triggerMessageId != null && (await findExecutionByTrigger(triggerMessageId))) return null;

    const info = await queryRun(
      dbClient,
      "INSERT INTO workflow_executions (workflow_id, session_id, contact_id, trigger_message_id, status, current_node_key, vars) VALUES (?, ?, ?, ?, 'running', ?, ?)",
      [workflowId, sessionId, contactId, triggerMessageId ?? null, firstKey, jsonToDb(dbClient, initialVars)],
    );
    const executionId = Number(info.lastInsertRowid);

    await queryRun(
      dbClient,
      `INSERT INTO events (event_type, session_id, contact_id, execution_id, message_id, data)
      VALUES ('execution.started', ?, ?, ?, ?, ?)`,
      [sessionId, contactId, executionId, triggerMessageId ?? null, jsonToDb(dbClient, { workflow_id: workflowId })],
    );

    await step(executionId);

    return executionId;
  }

  async function runSilenceSweep(targetClock: Clock = clock) {
    return runSilenceSweepInternal(dbClient, { advanceFrom }, targetClock);
  }

  const engine = {
    attributeReply,
    executeJob,
    startExecution,
    advanceFrom,
    runSilenceSweep,
  };

  const scheduler = createScheduler(dbClient, engine.executeJob, clock);

  return { ...engine, handleIncomingMessage, scheduler, step };
}

export async function runSilenceSweepInternal(
  db: DbClient | BetterSqlite3.Database,
  engine: { advanceFrom: (executionId: number, nodeKey: string, handle?: string) => Promise<void> },
  clock: Clock = realClock,
): Promise<{ scanned: number; nudged: number }> {
  const dbClient = toDbClient(db);
  const nowIso = new Date(clock.now()).toISOString();
  const dueExecutions = (await queryAll(
    dbClient,
    `SELECT we.id, we.workflow_id, we.current_node_key, we.contact_id
    FROM workflow_executions we
    WHERE we.status = 'waiting_input'
      AND we.silence_followup_at IS NOT NULL
      AND we.silence_followup_at <= ?
      AND we.silence_sweep_executed = ${falseSql(dbClient)}`,
    [nowIso],
  )) as Array<{ id: number; workflow_id: number; current_node_key: string; contact_id: number }>;

  let nudged = 0;
  for (const exec of dueExecutions) {
    const contact = (await queryGet(
      dbClient,
      "SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?",
      [exec.contact_id],
    )) as { bot_status: string; bot_paused_until: string | null } | undefined;
    if (contact && contact.bot_status === "paused_human") continue;

    const edge = (await queryGet(
      dbClient,
      "SELECT target_key FROM workflow_edges WHERE workflow_id = ? AND source_key = ? AND handle = 'on_silence_2h'",
      [exec.workflow_id, exec.current_node_key],
    )) as { target_key: string } | undefined;

    if (edge) {
      await queryRun(
        dbClient,
        `UPDATE workflow_executions
        SET silence_sweep_executed = ${trueSql(dbClient)},
            silence_followup_at = NULL
        WHERE id = ?`,
        [exec.id],
      );

      await queryRun(
        dbClient,
        "INSERT INTO events (event_type, execution_id, data) VALUES ('silence_sweep.triggered', ?, ?)",
        [exec.id, jsonToDb(dbClient, { from_node: exec.current_node_key, target_node: edge.target_key })],
      );

      await engine.advanceFrom(exec.id, exec.current_node_key, "on_silence_2h");
      nudged++;
    } else {
      await queryRun(
        dbClient,
        `UPDATE workflow_executions SET silence_sweep_executed = ${trueSql(dbClient)} WHERE id = ?`,
        [exec.id],
      );
    }
  }

  return { scanned: dueExecutions.length, nudged };
}
