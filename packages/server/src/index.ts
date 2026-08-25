import { buildApp } from "./app.js";
import { makeWasenderTransport, markMessageAsRead, sendPresenceUpdate, openDb } from "./wasender.js";
import { applySqliteSchema, createDatabaseClient, queryGet } from "./db/client.js";
import type BetterSqlite3 from "better-sqlite3";

const dbClient = await createDatabaseClient();
console.log(`[DB] Database initialized successfully using provider: ${dbClient.provider}`);

let db: BetterSqlite3.Database;
if (dbClient.sqlite) {
  db = dbClient.sqlite;
} else {
  // Supabase env is configured, but the app runtime (engine/api/media) is SQLite-native.
  // Open the local SQLite store WITH schema applied so boot and all routes keep working
  // until the app is fully ported to Postgres. Without this, a fresh volume has no schema
  // and autoSeedProductionWorkflows crashes with "no such table: workflows".
  db = openDb(process.env.DB_PATH ?? "wastat.db");
  applySqliteSchema(db);
  // Attach the schema-applied sqlite handle to the DbClient so buildApp's
  // unported modules (engine/api/webhooks) can reach it while ported modules
  // (media) use dbClient.sql (Postgres).
  dbClient.sqlite = db;
  console.warn(
    "[DB] Supabase provider configured, but the app runtime is SQLite-native — continuing on local SQLite.",
  );
}

import { autoSeedProductionWorkflows } from "./seed-defaults.js";
autoSeedProductionWorkflows(db);

// ponytail: session API keys are read as plaintext until the encryption
// decision lands; the column is already BLOB so it upgrades in place.
const getApiKey = async (sessionId: number) =>
  queryGet(dbClient, "SELECT api_key_encrypted FROM sessions WHERE id = ?", [sessionId]);

process.env.STATIC_DIR ||= "/app/public";

import { makeWasenderAdmin, upsertSession } from "./wasender-admin.js";

const app = await buildApp(dbClient, {
  wasenderPat: process.env.WASENDER_PAT,
  sendMessage: process.env.MOCK_SEND
    ? async () => ({ providerMessageId: `mock-${Date.now()}` })
    : async (input) => {
        const row = (await getApiKey(input.sessionId)) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) throw { status: 500, code: "NO_SESSION_KEY" };
        return makeWasenderTransport(db)({ ...input, apiKey });
      },
  markMessageAsRead: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const row = (await getApiKey(input.sessionId)) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) return;
        await markMessageAsRead(apiKey, input.key);
      },
  sendPresenceUpdate: process.env.MOCK_SEND
    ? async () => {}
    : async (input) => {
        const row = (await getApiKey(input.sessionId)) as { api_key_encrypted: Buffer | string | null } | undefined;
        const apiKey = row?.api_key_encrypted?.toString("utf8") || process.env.WASENDER_PAT;
        if (!apiKey) return;
        await sendPresenceUpdate(apiKey, input.toPhone, input.type);
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
