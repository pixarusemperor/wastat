import { buildApp } from "./app.js";
import { makeWasenderTransport, markMessageAsRead, sendPresenceUpdate } from "./wasender.js";
import { createDatabaseClient, queryGet } from "./db/client.js";

const dbClient = await createDatabaseClient();
console.log(`[DB] Database initialized successfully using provider: ${dbClient.provider}`);

import { autoSeedProductionWorkflows } from "./seed-defaults.js";
await autoSeedProductionWorkflows(dbClient);

import { backfillExperimentVariants } from "./db/ab-migration.js";
const backfilled = await backfillExperimentVariants(dbClient);
if (backfilled > 0) {
  console.log(`[A/B] Backfilled ${backfilled} experiment_variants row(s) from existing workflows`);
}

// ponytail: session API keys are read as plaintext until the encryption
// decision lands; the column is already BLOB so it upgrades in place.
const getApiKey = async (sessionId: number) =>
  queryGet(dbClient, "SELECT api_key_encrypted FROM sessions WHERE id = ?", [sessionId]);

process.env.STATIC_DIR ||= "/app/public";

import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";

import { getProviderAdapter, type WhatsAppProviderType } from "./providers/index.js";
import { decryptSecret } from "./crypto.js";
import { jsonFromDb } from "./db/client.js";

const app = await buildApp(dbClient, {
  wasenderPat: process.env.WASENDER_PAT,
  sendMessage: process.env.MOCK_SEND
    ? async () => ({ providerMessageId: `mock-${Date.now()}`, status: "sent" })
    : async (input) => {
        const session = (await queryGet(
          dbClient,
          "SELECT id, provider, provider_session_id, api_key_encrypted, provider_config FROM sessions WHERE id = ?",
          [input.sessionId],
        )) as {
          id: number;
          provider: string;
          provider_session_id: string;
          api_key_encrypted: Buffer | string | null;
          provider_config: unknown;
        } | undefined;

        const provider = (session?.provider || "wasender") as WhatsAppProviderType;
        const adapter = getProviderAdapter(provider);
        const decryptedKey = session?.api_key_encrypted ? decryptSecret(session.api_key_encrypted) : undefined;
        const apiKey = decryptedKey || (provider === "wasender" ? process.env.WASENDER_PAT : process.env.PERISKOPE_API_KEY);
        if (!apiKey) throw { status: 500, code: "NO_SESSION_KEY" };

        const sessionContext = {
          id: input.sessionId,
          sessionId: input.sessionId,
          provider,
          providerSessionId: session?.provider_session_id || "",
          apiKey,
          providerConfig: jsonFromDb(session?.provider_config),
        };

        const inputAny = input as any;
        return adapter.sendMessage(sessionContext, {
          to: input.toPhone,
          text: input.text,
          mediaUrl: inputAny.mediaUrl,
          fileName: inputAny.filename,
          mimetype: inputAny.mimeType,
        });
      },
  markMessageAsRead: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const session = (await queryGet(
          dbClient,
          "SELECT id, provider, provider_session_id, api_key_encrypted, provider_config FROM sessions WHERE id = ?",
          [input.sessionId],
        )) as any;
        if (!session) return;
        const provider = (session.provider || "wasender") as WhatsAppProviderType;
        const adapter = getProviderAdapter(provider);
        const apiKey = (session.api_key_encrypted ? decryptSecret(session.api_key_encrypted) : undefined) ||
          (provider === "wasender" ? process.env.WASENDER_PAT : process.env.PERISKOPE_API_KEY);
        if (!apiKey) return;
        await adapter.markAsRead({
          id: input.sessionId,
          sessionId: input.sessionId,
          provider,
          providerSessionId: session.provider_session_id,
          apiKey,
          providerConfig: jsonFromDb(session.provider_config),
        }, input.key.id, input.toPhone);
      },
  sendPresenceUpdate: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const session = (await queryGet(
          dbClient,
          "SELECT id, provider, provider_session_id, api_key_encrypted, provider_config FROM sessions WHERE id = ?",
          [input.sessionId],
        )) as any;
        if (!session) return;
        const provider = (session.provider || "wasender") as WhatsAppProviderType;
        const adapter = getProviderAdapter(provider);
        const apiKey = (session.api_key_encrypted ? decryptSecret(session.api_key_encrypted) : undefined) ||
          (provider === "wasender" ? process.env.WASENDER_PAT : process.env.PERISKOPE_API_KEY);
        if (!apiKey) return;
        await adapter.sendPresenceUpdate({
          id: input.sessionId,
          sessionId: input.sessionId,
          provider,
          providerSessionId: session.provider_session_id,
          apiKey,
          providerConfig: jsonFromDb(session.provider_config),
        }, input.toPhone, input.type);
      },
});

if (process.env.WASENDER_PAT) {
  const admin = makeWasenderAdmin(process.env.WASENDER_PAT);
  admin
    .listSessions()
    .then(async (sessions) => {
      for (const s of sessions) await upsertSession(dbClient, s);
      app.log.info({ count: sessions.length }, "Synced Wasender sessions to local DB");
    })
    .catch((err) => {
      app.log.warn({ err }, "Could not auto-sync Wasender sessions on boot");
    });
}

const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
