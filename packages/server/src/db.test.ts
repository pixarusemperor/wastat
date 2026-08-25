import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { applySqliteSchema, createDatabaseClient } from "./db/client.js";
import { autoSeedProductionWorkflows } from "./seed-defaults.js";

const ENV_KEYS = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "DB_PATH"];

describe("provider-aware boot (regression: no such table: workflows on Supabase mode)", () => {
  const saved = new Map<string, string | undefined>();

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved.has(k)) {
        const v = saved.get(k);
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
    saved.clear();
  });

  const saveEnv = () => {
    for (const k of ENV_KEYS) saved.set(k, process.env[k]);
  };

  it("createDatabaseClient selects supabase_postgres when DATABASE_URL is set and exposes no sqlite handle", async () => {
    saveEnv();
    process.env.DATABASE_URL = "postgres://postgres.probe:pw@127.0.0.1:1/postgres";
    process.env.SUPABASE_URL = "https://probe.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "probe-key";
    const dbClient = await createDatabaseClient();
    try {
      expect(dbClient.provider).toBe("supabase_postgres");
      expect(dbClient.sqlite).toBeUndefined();
      expect(dbClient.sql).toBeDefined();
    } finally {
      await dbClient.close();
    }
  });

  it("applies schema to the fallback SQLite runtime db so boot seeding does not crash", () => {
    // index.ts fallback for the Supabase provider: dbClient.sqlite is undefined, so the
    // runtime db (openDb of DB_PATH) must be schema-applied before autoSeed runs.
    const db = new Database(":memory:");
    applySqliteSchema(db);
    expect(() => autoSeedProductionWorkflows(db)).not.toThrow();
    const row = db.prepare("SELECT COUNT(*) AS n FROM workflows").get() as { n: number };
    expect(row.n).toBe(1);
    db.close();
  });
});
