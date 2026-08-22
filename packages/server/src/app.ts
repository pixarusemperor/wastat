import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import type BetterSqlite3 from "better-sqlite3";
import { WASTAT_VERSION } from "@wastat/shared";
import { createEngine } from "./engine.js";
import { registerApiRoutes } from "./api.js";
import { realClock, type Clock } from "./scheduler.js";

export interface AppDeps {
  clock?: Clock;
  sendMessage: (input: {
    sessionId: number;
    toPhone: string;
    kind: "text" | "media";
    text?: string;
    mediaId?: number;
  }) => Promise<{ providerMessageId: string }>;
  /** When set, enables /api/sessions management (Wasender account-level). */
  wasenderPat?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export async function buildApp(db: BetterSqlite3.Database, deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const engine = createEngine(db, { clock: deps.clock ?? realClock, sendMessage: deps.sendMessage });

  await app.register(cors, { origin: true });
  registerApiRoutes(app, db, { wasenderPat: deps.wasenderPat, fetchImpl: deps.fetchImpl });

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

  const getSession = db.prepare(
    "SELECT id, webhook_secret FROM sessions WHERE provider_session_id = ?",
  );
  const upsertContact = db.prepare(`
    INSERT INTO contacts (phone) VALUES (?)
    ON CONFLICT(phone) DO NOTHING
  `);
  const getContact = db.prepare("SELECT id FROM contacts WHERE phone = ?");
  const insertMessage = db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, timestamp)
    VALUES (?, ?, 'in', 'text', ?, ?, ?)
  `);

  interface WasenderWebhook {
    event: string;
    timestamp: number;
    data?: {
      messages?: {
        key?: { id?: string; remoteJid?: string };
        messageBody?: string;
      };
    };
  }

  app.post<{ Params: { providerSessionId: string } }>(
    "/webhooks/wasender/:providerSessionId",
    async (request, reply) => {
      const session = getSession.get(request.params.providerSessionId) as
        | { id: number; webhook_secret: string | null }
        | undefined;
      const signature = request.headers["x-webhook-signature"];
      if (!session || !session.webhook_secret || signature !== session.webhook_secret) {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      const body = request.body as WasenderWebhook;
      if (body.event !== "messages.received") return { ignored: body.event };

      const key = body.data?.messages?.key;
      if (!key?.id || !key.remoteJid) return { ignored: "malformed" };

      // PRD §52: duplicate deliveries are dropped here — the UNIQUE constraint
      // on provider_message_id is the dedup key.
      try {
        const phone = key.remoteJid.split("@")[0];
        upsertContact.run(phone);
        const contact = getContact.get(phone) as { id: number };
        insertMessage.run(
          session.id,
          contact.id,
          body.data?.messages?.messageBody ?? null,
          key.id,
          new Date(body.timestamp * 1000).toISOString(),
        );
      } catch {
        return { duplicate: true };
      }

      const msg = db
        .prepare("SELECT id, contact_id FROM messages WHERE provider_message_id = ?")
        .get(key.id) as { id: number; contact_id: number };
      const executionId = engine.handleIncomingMessage(session.id, msg.contact_id, msg.id);
      return { ok: true, executionId };
    },
  );

  return app;
}
