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

export interface AppDeps {
  clock?: Clock;
  sendMessage: (input: {
    sessionId: number;
    toPhone: string;
    kind: "text" | "media";
    text?: string;
    mediaId?: number;
  }) => Promise<{ providerMessageId: string }>;
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

  const getSession = async (providerSessionId: string) =>
    queryGet(dbClient, "SELECT id, webhook_secret FROM sessions WHERE provider_session_id = ?", [
      providerSessionId,
    ]);
  const upsertContact = async (phone: string, name: string | null) =>
    execRun(
      dbClient,
      `INSERT INTO contacts (phone, name) VALUES (?, ?)
    ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, contacts.name)`,
      [phone, name],
    );
  const getContact = async (phone: string) =>
    queryGet(dbClient, "SELECT id FROM contacts WHERE phone = ?", [phone]);
  const insertMessage = async (sessionId: number, contactId: number, text: string, providerMessageId: string, ts: string) =>
    queryRun(
      dbClient,
      `INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, timestamp)
    VALUES (?, ?, 'in', 'text', ?, ?, ?)`,
      [sessionId, contactId, text, providerMessageId, ts],
    );

  interface WasenderWebhook {
    event: string;
    timestamp: number;
    data?: {
      messages?: {
        key?: {
          id?: string;
          remoteJid?: string;
          fromMe?: boolean;
          cleanedSenderPn?: string;
          cleanedParticipantPn?: string;
        };
        messageBody?: string;
        pushName?: string;
      };
      pushName?: string;
    };
  }

  app.post<{ Params: { providerSessionId: string } }>(
    "/webhooks/wasender/:providerSessionId",
    async (request, reply) => {
      const session = (await getSession(request.params.providerSessionId)) as
        | { id: number; webhook_secret: string | null }
        | undefined;
      const signature = request.headers["x-webhook-signature"];
      if (session?.webhook_secret && signature && signature !== session.webhook_secret) {
        return reply.code(401).send({ error: "Invalid signature" });
      }
      if (!session) {
        return reply.code(404).send({ error: "Session not found" });
      }

      const body = request.body as Record<string, any>;
      const eventName = body.event || "";

      // 1. Session Status Updates
      if (eventName === "session.status" || eventName === "connection.update") {
        const newStatus = body.data?.status || body.data?.state || "unknown";
        await queryRun(dbClient, "UPDATE sessions SET status = ? WHERE id = ?", [newStatus, session.id]);
        return { ok: true, handled: "session.status", status: newStatus };
      }

      // 2. Message Status Updates (Delivered, Read / Blue Ticks)
      if (eventName === "messages.update" || eventName === "message_ack" || eventName === "message.update") {
        const updates = Array.isArray(body.data) ? body.data : [body.data || {}];
        for (const item of updates) {
          const msgId = item.key?.id || item.id;
          const statusRaw = item.update?.status || item.status;
          let statusStr: string | null = null;
          if (statusRaw === 3 || statusRaw === "delivered") statusStr = "delivered";
          else if (statusRaw === 4 || statusRaw === "read") statusStr = "read";
          else if (statusRaw === 2 || statusRaw === "sent") statusStr = "sent";

          if (msgId && statusStr) {
            await queryRun(dbClient, "UPDATE messages SET status = ? WHERE provider_message_id = ?", [
              statusStr,
              msgId,
            ]);
            await execRun(
              dbClient,
              `INSERT INTO events (event_type, session_id, message_id, data)
              SELECT 'message.status_updated', ?, id, ? FROM messages WHERE provider_message_id = ?`,
              [session.id, jsonToDb(dbClient, { status: statusStr }), msgId],
            );
          }
        }
        return { ok: true, handled: "messages.update" };
      }

      // 3. Inbound Messages
      const isMessageEvent =
        eventName === "messages.received" ||
        eventName === "messages-group.received" ||
        eventName === "messages.upsert" ||
        eventName === "message.received";

      if (!isMessageEvent) return { ignored: eventName };

      const key = body.data?.messages?.key || body.data?.key;
      if (!key?.id || !key.remoteJid) return { ignored: "malformed" };

      // Determine sender phone safely (preventing @lid corruption)
      const isGroup = Boolean(key.remoteJid.endsWith("@g.us") || eventName === "messages-group.received");
      const phone =
        key.cleanedSenderPn ||
        key.cleanedParticipantPn ||
        (!isGroup && key.remoteJid.includes("@") ? key.remoteJid.split("@")[0] : key.remoteJid);
      const pushName = body.data?.messages?.pushName || body.data?.pushName || null;

      // Handle Human Takeover: If fromMe is true, only activate takeover if message was NOT sent by WaStat bot
      if (key.fromMe) {
        await upsertContact(phone, pushName);
        const contact = (await getContact(phone)) as { id: number } | undefined;

        // Dedup / Echo check: If this provider_message_id is already in messages or events, it is our own automated dispatch!
        const isBotEcho = key.id
          ? Boolean(
              (await queryGet(dbClient, "SELECT id FROM messages WHERE provider_message_id = ?", [key.id])) ||
              (await queryGet(
                dbClient,
                `SELECT id FROM events WHERE event_type IN ('api.outbound_dispatch', 'api.outbound_response', 'message.sent') AND ${dbClient.sql ? "data::text" : "data"} LIKE ?`,
                [`%${key.id}%`],
              ))
            )
          : false;

        if (isBotEcho) {
          return { ignored: "fromMe_bot_echo" };
        }

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
            [session.id, contact.id, jsonToDb(dbClient, { paused_until: pausedUntil, provider_message_id: key.id })],
          );
        }
        return { ignored: "fromMe_takeover_activated" };
      }

      // PRD §52: duplicate deliveries are dropped here — the UNIQUE constraint
      // on provider_message_id is the dedup key.
      const m = Array.isArray(body.data?.messages) ? body.data?.messages[0] : (body.data?.messages || body.data?.message || body.data);
      const messageBody =
        m?.messageBody ??
        m?.conversation ??
        m?.extendedTextMessage?.text ??
        m?.imageMessage?.caption ??
        m?.videoMessage?.caption ??
        m?.documentMessage?.caption ??
        m?.buttonsResponseMessage?.selectedDisplayText ??
        m?.listResponseMessage?.title ??
        body.data?.messageBody ??
        body.data?.text ??
        body.data?.body ??
        null;

      const ts = body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString();

      try {
        await upsertContact(phone, pushName);
        const contact = (await getContact(phone)) as { id: number };
        await insertMessage(session.id, contact.id, messageBody, key.id, ts);
      } catch {
        return { duplicate: true };
      }

      const msg = (await queryGet(dbClient, "SELECT id, contact_id FROM messages WHERE provider_message_id = ?", [
        key.id,
      ])) as { id: number; contact_id: number };
      await engine.attributeReply(msg.id); // PRD §32 — even when nothing matches
      const executionId = await engine.handleIncomingMessage(session.id, msg.contact_id, msg.id, isGroup);
      return { ok: true, executionId };
    },
  );

  return app;
}
