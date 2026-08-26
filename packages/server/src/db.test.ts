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
