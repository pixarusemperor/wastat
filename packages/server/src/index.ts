import { buildApp } from "./app.js";
import { makeWasenderTransport, markMessageAsRead, sendPresenceUpdate, openDb } from "./wasender.js";
import { createDatabaseClient } from "./db/client.js";

const dbClient = await createDatabaseClient();
console.log(`[DB] Database initialized successfully using provider: ${dbClient.provider}`);

const db = dbClient.sqlite ?? openDb(process.env.DB_PATH ?? "wastat.db");

import { autoSeedProductionWorkflows } from "./seed-defaults.js";
autoSeedProductionWorkflows(db);

// ponytail: session API keys are read as plaintext until the encryption
// decision lands; the column is already BLOB so it upgrades in place.
const getApiKey = db.prepare("SELECT api_key_encrypted FROM sessions WHERE id = ?");

process.env.STATIC_DIR ||= "/app/public";

import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";

const app = await buildApp(db, {
  wasenderPat: process.env.WASENDER_PAT,
  sendMessage: process.env.MOCK_SEND
    ? async () => ({ providerMessageId: `mock-${Date.now()}` })
    : async (input) => {
        const row = getApiKey.get(input.sessionId) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) throw { status: 500, code: "NO_SESSION_KEY" };
        return makeWasenderTransport(db)({ ...input, apiKey });
      },
  markMessageAsRead: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const row = getApiKey.get(input.sessionId) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) return;
        await markMessageAsRead(apiKey, input.key);
      },
  sendPresenceUpdate: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const row = getApiKey.get(input.sessionId) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) return;
        await sendPresenceUpdate(apiKey, input.toPhone, input.type);
      },
});

if (process.env.WASENDER_PAT) {
  const admin = makeWasenderAdmin(process.env.WASENDER_PAT);
  admin
    .listSessions()
    .then((sessions) => {
      for (const s of sessions) upsertSession(db, s);
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
