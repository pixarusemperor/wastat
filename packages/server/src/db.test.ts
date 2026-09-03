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

  it("applies schema to the fallback SQLite runtime db so boot seeding does not crash", async () => {
    // index.ts fallback for the Supabase provider: dbClient.sqlite is undefined, so the
    // runtime db (openDb of DB_PATH) must be schema-applied before autoSeed runs.
    const db = new Database(":memory:");
    applySqliteSchema(db);
    await expect(autoSeedProductionWorkflows(db)).resolves.not.toThrow();
    const row = db.prepare("SELECT COUNT(*) AS n FROM workflows").get() as { n: number };
    expect(row.n).toBe(1);
    db.close();
  });
});

describe("A/B Option C schema (experiment owns trigger + experiment_variants)", () => {
  it("exposes experiment trigger columns + experiment_variants table after schema apply", () => {
    const db = new Database(":memory:");
    applySqliteSchema(db);

    const expCols = db.prepare("PRAGMA table_info(experiments)").all() as Array<{ name: string }>;
    const names = expCols.map((c) => c.name);
    for (const col of [
      "trigger_keywords",
      "trigger_algorithm",
      "trigger_threshold",
      "session_id",
      "distribution_mode",
    ]) {
      expect(names).toContain(col);
    }

    const variantsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='experiment_variants'")
      .get();
    expect(variantsTable).toBeTruthy();
    const variantCols = db.prepare("PRAGMA table_info(experiment_variants)").all() as Array<{ name: string }>;
    expect(variantCols.map((c) => c.name).sort()).toEqual(
      ["experiment_id", "workflow_id", "weight", "active"].sort(),
    );
    db.close();
  });

  it("backfills experiment_variants from existing workflows.experiment_id idempotently", async () => {
    const db = new Database(":memory:");
    applySqliteSchema(db);
    const { backfillExperimentVariants } = await import("./db/ab-migration.js");

    db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('S', 'ps')").run();
    const expInfo = db.prepare("INSERT INTO experiments (name, active) VALUES ('exp', 1)").run();
    const wfInfo = db
      .prepare("INSERT INTO workflows (name, active, session_id, experiment_id) VALUES ('v1', 1, 1, ?)")
      .run(expInfo.lastInsertRowid);

    await backfillExperimentVariants(db);
    let rows = db
      .prepare("SELECT experiment_id, workflow_id, weight, active FROM experiment_variants")
      .all() as Array<{ experiment_id: number; workflow_id: number; weight: number; active: number }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weight: 100, active: 1 });

    // Idempotent: running again must not duplicate rows.
    await backfillExperimentVariants(db);
    rows = db.prepare("SELECT experiment_id, workflow_id FROM experiment_variants").all() as any[];
    expect(rows).toHaveLength(1);
    db.close();
  });
});

describe("Multi-Provider WhatsApp Translation Layer schema (Wasender & Periskope)", () => {
  it("exposes provider, provider_config, queue_id and webhook_idempotency table", () => {
    const db = new Database(":memory:");
    applySqliteSchema(db);

    const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string; dflt_value: string }>;
    const sessionColNames = sessionCols.map((c) => c.name);
    expect(sessionColNames).toContain("provider");
    expect(sessionColNames).toContain("provider_config");

    const messageCols = db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
    const messageColNames = messageCols.map((c) => c.name);
    expect(messageColNames).toContain("queue_id");

    const idempotencyCols = db.prepare("PRAGMA table_info(webhook_idempotency)").all() as Array<{ name: string }>;
    expect(idempotencyCols.map((c) => c.name)).toEqual(["id", "provider", "event_id", "created_at"]);

    // Test default values on session insertion
    const info = db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('Default Session', 'sess_123')").run();
    const sessionRow = db.prepare("SELECT provider, provider_config FROM sessions WHERE id = ?").get(info.lastInsertRowid) as {
      provider: string;
      provider_config: string;
    };
    expect(sessionRow.provider).toBe("wasender");
    expect(sessionRow.provider_config).toBe("{}");

    // Test composite provider scoping: same provider_session_id on different providers allowed
    expect(() => {
      db.prepare("INSERT INTO sessions (name, provider, provider_session_id) VALUES ('Periskope Session', 'periskope', 'sess_123')").run();
    }).not.toThrow();

    // Duplicate provider_session_id on SAME provider is rejected
    expect(() => {
      db.prepare("INSERT INTO sessions (name, provider, provider_session_id) VALUES ('Duplicate Wasender', 'wasender', 'sess_123')").run();
    }).toThrow();

    // Test webhook_idempotency uniqueness constraint
    db.prepare("INSERT INTO webhook_idempotency (provider, event_id) VALUES ('periskope', 'evt_1')").run();
    expect(() => {
      db.prepare("INSERT INTO webhook_idempotency (provider, event_id) VALUES ('periskope', 'evt_1')").run();
    }).toThrow();
    // Different provider with same event_id is allowed
    expect(() => {
      db.prepare("INSERT INTO webhook_idempotency (provider, event_id) VALUES ('wasender', 'evt_1')").run();
    }).not.toThrow();

    db.close();
  });
});

