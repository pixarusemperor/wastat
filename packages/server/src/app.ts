import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import type BetterSqlite3 from "better-sqlite3";
import { WASTAT_VERSION } from "@wastat/shared";
import { createEngine } from "./engine.js";
import { registerApiRoutes } from "./api.js";
import { registerMediaRoutes, type StorageProvider } from "./media.js";
import {
  queryAll,
  queryGet,
  queryRun,
  execRun,
  toDbClient,
  jsonToDb,
  type DbClient,
} from "./db/client.js";
import { realClock, type Clock } from "./scheduler.js";
import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";
import fastifyRawBody from "fastify-raw-body";
import { getProviderAdapter, hasProviderAdapter, type WhatsAppProviderType } from "./providers/index.js";
import { decryptSecret } from "./crypto.js";
import { normalizePhoneNumber } from "@wastat/shared";

export interface AppDeps {
  clock?: Clock;
  sendMessage: (input: {
    sessionId: number;
    toPhone: string;
    kind: "text" | "media";
    text?: string;
    mediaId?: number;
  }) => Promise<{ providerMessageId: string; queueId?: string }>;
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
  /** When set, enables /api/sessions management (Wasender account-level). */
  wasenderPat?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Media storage provider (Cloudflare R2 or local disk). */
  storage?: StorageProvider;
}

export async function buildApp(db: DbClient | BetterSqlite3.Database, deps: AppDeps): Promise<FastifyInstance> {
  // Seam for the Postgres port: the runtime carries a DbClient (both providers);
  // ported modules use it directly, unported modules keep the guaranteed sqlite
  // handle (index.ts always provides one, schema applied). Raw sqlite dbs from
  // tests are wrapped.
  const dbClient = toDbClient(db);

  const app = Fastify({ logger: true });
  const engine = createEngine(dbClient, {
    clock: deps.clock ?? realClock,
    sendMessage: deps.sendMessage,
    markMessageAsRead: deps.markMessageAsRead,
    sendPresenceUpdate: deps.sendPresenceUpdate,
  });

  // Background worker poller for delayed jobs and silence sweeps (PRD §13, §24)
  const poller = setInterval(() => {
    void engine.scheduler.tick();
    void engine.runSilenceSweep();
  }, 1000);

  app.addHook("onClose", async () => {
    clearInterval(poller);
  });

  await app.register(cors, { origin: true });
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  registerApiRoutes(app, dbClient, { wasenderPat: deps.wasenderPat, fetchImpl: deps.fetchImpl, engine });
  await registerMediaRoutes(app, dbClient, deps.storage);

  app.get("/health", async () => ({
    status: "ok",
    version: WASTAT_VERSION,
    time: new Date().toISOString(),
  }));

  // Production serves the built web UI from the same origin (wassflow.orizongroup.online).
  const staticDir = process.env.STATIC_DIR;
  if (staticDir && existsSync(staticDir)) {
    await app.register(fastifyStatic, { root: staticDir });
    // SPA fallback: any non-API GET renders the app shell.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api") && !request.url.startsWith("/webhooks")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not found" });
    });
  }

  const upsertContact = async (phone: string, name: string | null) =>
    execRun(
      dbClient,
      `INSERT INTO contacts (phone, name) VALUES (?, ?)
    ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, contacts.name)`,
      [phone, name],
    );
  const getContact = async (phone: string) =>
    queryGet(dbClient, "SELECT id FROM contacts WHERE phone = ?", [phone]);

  const handleWebhook = async (
    provider: string,
    providerSessionId: string | undefined,
    request: any,
    reply: any,
  ) => {
    const providerType = (provider || "wasender") as WhatsAppProviderType;
    if (!hasProviderAdapter(providerType)) {
      return reply.code(404).send({ error: `Unsupported provider: ${provider}` });
    }

    const adapter = getProviderAdapter(providerType);
    const rawBody = request.rawBody || (typeof request.body === "string" ? request.body : JSON.stringify(request.body || {}));
    const parsedEvent = adapter.parseWebhook(request.body, request.headers);
    if (!parsedEvent) {
      return reply.code(200).send({ ignored: "unparseable" });
    }

    // Resolve session
    let session: any = null;
    if (providerSessionId) {
      session = await queryGet(
        dbClient,
        "SELECT id, provider, provider_session_id, webhook_secret, api_key_encrypted, provider_config FROM sessions WHERE provider = ? AND provider_session_id = ?",
        [providerType, providerSessionId],
      );
      if (!session && providerType === "wasender") {
        // Fallback for legacy Wasender sessions
        session = await queryGet(
          dbClient,
          "SELECT id, provider, provider_session_id, webhook_secret, api_key_encrypted, provider_config FROM sessions WHERE provider_session_id = ?",
          [providerSessionId],
        );
      }
    } else if (parsedEvent.sessionLookup?.orgPhone) {
      const cleanOrgPhone = normalizePhoneNumber(parsedEvent.sessionLookup.orgPhone);
      session = await queryGet(
        dbClient,
        `SELECT id, provider, provider_session_id, webhook_secret, api_key_encrypted, provider_config
         FROM sessions
         WHERE provider = ? AND (provider_session_id = ? OR ${dbClient.sql ? "provider_config::text" : "provider_config"} LIKE ?)`,
        [providerType, cleanOrgPhone, `%${cleanOrgPhone}%`],
      );
    } else if (parsedEvent.sessionLookup?.providerSessionId) {
      session = await queryGet(
        dbClient,
        "SELECT id, provider, provider_session_id, webhook_secret, api_key_encrypted, provider_config FROM sessions WHERE provider = ? AND provider_session_id = ?",
        [providerType, parsedEvent.sessionLookup.providerSessionId],
      );
    }

    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }

    // Verify webhook signature
    const secret = session.webhook_secret ? decryptSecret(session.webhook_secret) : undefined;
    const isValid = adapter.verifyWebhookSignature(rawBody, request.headers, secret);
    if (!isValid) {
      return reply.code(401).send({ error: "Invalid signature" });
    }

    // Freshness check: reject webhooks with > 5 min clock drift to prevent replay attacks
    if (parsedEvent.eventTimestamp) {
      const tsMs = new Date(parsedEvent.eventTimestamp).getTime();
      if (!isNaN(tsMs)) {
        const drift = Math.abs(Date.now() - tsMs);
        if (drift > 300_000) {
          return reply.code(400).send({ error: "Webhook timestamp expired or clock drift exceeded" });
        }
      }
    }

    // Webhook Idempotency Ledger: reject duplicate event occurrences
    let eventKey: string | undefined;
    if (parsedEvent.eventType === "message.created" && parsedEvent.message?.id) {
      eventKey = `msg:${parsedEvent.message.id}`;
    } else if (parsedEvent.eventType === "message.ack" && parsedEvent.ack?.messageId) {
      eventKey = `ack:${parsedEvent.ack.messageId}:${parsedEvent.ack.status}`;
    } else if (parsedEvent.eventType === "reaction.created" && parsedEvent.reaction?.messageId) {
      eventKey = `react:${parsedEvent.reaction.messageId}:${parsedEvent.reaction.emoji ?? parsedEvent.reaction.reactionText}`;
    }

    if (eventKey) {
      try {
        await execRun(dbClient, "INSERT INTO webhook_idempotency (provider, event_id) VALUES (?, ?)", [
          providerType,
          eventKey,
        ]);
      } catch {
        return reply.code(200).send({ ok: true, duplicate: true });
      }
    }

    // 1. Session Status Updates
    if (parsedEvent.eventType === "status.updated") {
      const newStatus = (parsedEvent.rawPayload as any)?.status || (parsedEvent.rawPayload as any)?.data?.status || "unknown";
      await queryRun(dbClient, "UPDATE sessions SET status = ? WHERE id = ?", [newStatus, session.id]);
      return { ok: true, handled: "session.status", status: newStatus };
    }

    // 2. Message Delivery Status / ACKs (Monotonic update)
    if (parsedEvent.eventType === "message.ack" && parsedEvent.ack) {
      const { messageId, status, queueId } = parsedEvent.ack;
      if (messageId || queueId) {
        const rankMap: Record<string, number> = { failed: -1, received: 0, queued: 1, sent: 2, delivered: 3, read: 4 };
        const currentMsg = (await queryGet(
          dbClient,
          "SELECT id, status FROM messages WHERE provider_message_id = ? OR (queue_id IS NOT NULL AND queue_id = ?)",
          [messageId, queueId || messageId],
        )) as { id: number; status: string } | undefined;

        if (currentMsg) {
          const currentRank = rankMap[currentMsg.status] ?? 0;
          const newRank = rankMap[status] ?? 0;
          if (newRank > currentRank || status === "failed") {
            await queryRun(dbClient, "UPDATE messages SET status = ? WHERE id = ?", [status, currentMsg.id]);
            await execRun(
              dbClient,
              `INSERT INTO events (event_type, session_id, message_id, data)
               VALUES ('message.status_updated', ?, ?, ?)`,
              [session.id, currentMsg.id, jsonToDb(dbClient, { status, messageId, queueId })],
            );
          }
        }
      }
      return { ok: true, handled: "message.ack" };
    }

    // 3. Message Created
    if (parsedEvent.eventType === "message.created" && parsedEvent.message) {
      const msg = parsedEvent.message;
      const phone = (msg.fromMe && !msg.isGroup && msg.chatId)
        ? msg.chatId.replace(/@(c|g)\.us$/, "").replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "")
        : msg.senderPhone;
      const pushName = msg.pushName || null;

      // Handle Human Takeover / Bot Echo Check
      if (msg.fromMe) {
        await upsertContact(phone, pushName);
        const contact = (await getContact(phone)) as { id: number } | undefined;

        // Dedup / Echo check against both provider_message_id and queue_id
        const isBotEcho = (msg.id || msg.queueId)
          ? Boolean(
              (await queryGet(
                dbClient,
                "SELECT id FROM messages WHERE provider_message_id = ? OR (queue_id IS NOT NULL AND queue_id = ?)",
                [msg.id, msg.queueId || msg.id],
              )) ||
              (await queryGet(
                dbClient,
                `SELECT id FROM events WHERE event_type IN ('api.outbound_dispatch', 'api.outbound_response', 'message.sent') AND ${dbClient.sql ? "data::text" : "data"} LIKE ?`,
                [`%${msg.id}%`],
              )) ||
              (msg.queueId
                ? await queryGet(
                    dbClient,
                    `SELECT id FROM events WHERE event_type IN ('api.outbound_dispatch', 'api.outbound_response', 'message.sent') AND ${dbClient.sql ? "data::text" : "data"} LIKE ?`,
                    [`%${msg.queueId}%`],
                  )
                : false),
            )
          : false;

        if (isBotEcho) {
          return { ignored: "fromMe_bot_echo" };
        }

        // Genuine manual intervention by human operator
        if (contact) {
          const pausedUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
          await queryRun(
            dbClient,
            `UPDATE contacts
             SET bot_status = 'paused_human',
                 bot_paused_until = ?
             WHERE id = ?`,
            [pausedUntil, contact.id],
          );

          await queryRun(
            dbClient,
            `INSERT INTO events (event_type, session_id, contact_id, data)
             VALUES ('human_takeover.activated', ?, ?, ?)`,
            [session.id, contact.id, jsonToDb(dbClient, { paused_until: pausedUntil, provider_message_id: msg.id })],
          );
        }
        return { ignored: "fromMe_takeover_activated" };
      }

      // Customer Inbound Message
      await upsertContact(phone, pushName);
      const contact = (await getContact(phone)) as { id: number };

      let insertedId: number | undefined;
      try {
        const res = await queryRun(
          dbClient,
          `INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, queue_id, timestamp)
           VALUES (?, ?, 'in', 'text', ?, ?, ?, ?)`,
          [session.id, contact.id, msg.body, msg.id, msg.queueId ?? null, msg.timestamp],
        );
        insertedId = res.lastInsertRowid;
      } catch {
        return { duplicate: true };
      }

      const insertedMsg = (await queryGet(
        dbClient,
        "SELECT id, contact_id FROM messages WHERE id = ? OR provider_message_id = ?",
        [insertedId || 0, msg.id],
      )) as { id: number; contact_id: number };

      if (insertedMsg) {
        await engine.attributeReply(insertedMsg.id);
        const executionId = await engine.handleIncomingMessage(session.id, insertedMsg.contact_id, insertedMsg.id, msg.isGroup);
        return { ok: true, executionId };
      }

      return { ok: true };
    }

    return { ok: true, ignored: parsedEvent.eventType };
  };

  const webhookOpts = { config: { rawBody: true } };

  // 1. Legacy Wasender Route
  app.post<{ Params: { providerSessionId: string } }>(
    "/webhooks/wasender/:providerSessionId",
    webhookOpts,
    async (request, reply) => handleWebhook("wasender", request.params.providerSessionId, request, reply),
  );

  // 2. Multi-Provider Parameterized Session Route (/webhooks/:provider/:providerSessionId)
  app.post<{ Params: { provider: string; providerSessionId: string } }>(
    "/webhooks/:provider/:providerSessionId",
    webhookOpts,
    async (request, reply) => handleWebhook(request.params.provider, request.params.providerSessionId, request, reply),
  );

  // 3. Multi-Provider Multiplexed Org Route (/webhooks/:provider)
  app.post<{ Params: { provider: string } }>(
    "/webhooks/:provider",
    webhookOpts,
    async (request, reply) => handleWebhook(request.params.provider, undefined, request, reply),
  );

  return app;
}
