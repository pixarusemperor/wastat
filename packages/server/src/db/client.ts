import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DatabaseConfig {
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  sqlitePath?: string;
}

export type DbProviderType = "supabase_postgres" | "sqlite";

/**
 * Applies the SQLite schema to a database handle. Idempotent (schema.sql uses
 * CREATE TABLE IF NOT EXISTS), so it is safe to run against an existing DB —
 * e.g. the Supabase-mode runtime fallback in index.ts, where a fresh volume
 * would otherwise have no tables and boot seeding would crash.
 */
export function applySqliteSchema(db: BetterSqlite3.Database): void {
  try {
    const schemaSql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
    db.exec(schemaSql);
  } catch (err) {
    console.warn("[DB] SQLite schema notice:", (err as Error)?.message || err);
  }

  // Idempotent column upgrades for existing database files
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'wasender'");
  } catch {}
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN provider_config TEXT DEFAULT '{}'");
  } catch {}
  try {
    db.exec("ALTER TABLE messages ADD COLUMN queue_id TEXT");
  } catch {}
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_messages_queue_id ON messages (queue_id)");
  } catch {}
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_provider_scoping ON sessions(provider, provider_session_id)");
  } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS webhook_idempotency (
      id         INTEGER PRIMARY KEY,
      provider   TEXT NOT NULL,
      event_id   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(provider, event_id)
    )`);
  } catch {}
}

// ---------------------------------------------------------------------------
// Provider-agnostic query helpers (used by ported modules)
//
// SQLite uses `?` placeholders and a synchronous API; postgres.js uses `$1..$n`
// and is async. These helpers bridge the two so a module can run the same SQL
// text against whichever provider is active: `db.sql` (Postgres) when present,
// otherwise the `db.sqlite` fallback. Do not use `?` inside string literals in
// queries passed here.
// ---------------------------------------------------------------------------

function toPgPlaceholders(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

export async function queryAll(
  db: DbClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  if (db.sql) {
    // postgres.js parameter typing is narrower than our generic unknown[] — bridge it.
    return (await db.sql.unsafe(toPgPlaceholders(sqlText), params as any[])) as Record<string, unknown>[];
  }
  if (!db.sqlite) throw new Error("queryAll: no database provider available");
  return db.sqlite.prepare(sqlText).all(...params) as Record<string, unknown>[];
}

export async function queryGet(
  db: DbClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<Record<string, unknown> | undefined> {
  if (db.sql) {
    const rows = await db.sql.unsafe(toPgPlaceholders(sqlText), params as any[]);
    return rows[0] as Record<string, unknown> | undefined;
  }
  if (!db.sqlite) throw new Error("queryGet: no database provider available");
  return db.sqlite.prepare(sqlText).get(...params) as Record<string, unknown> | undefined;
}

export async function queryRun(
  db: DbClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<{ lastInsertRowid?: number }> {
  if (db.sql) {
    const rows = await db.sql.unsafe(`${toPgPlaceholders(sqlText)} RETURNING id`, params as any[]);
    return { lastInsertRowid: rows.length ? Number(rows[0].id) : undefined };
  }
  if (!db.sqlite) throw new Error("queryRun: no database provider available");
  const info = db.sqlite.prepare(sqlText).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid) };
}

/**
 * Like queryRun but never appends RETURNING — for statements whose target has
 * no `id` column (e.g. composite-PK tables like experiment_assignments).
 */
export async function execRun(
  db: DbClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<void> {
  if (db.sql) {
    await db.sql.unsafe(toPgPlaceholders(sqlText), params as any[]);
    return;
  }
  if (!db.sqlite) throw new Error("execRun: no database provider available");
  db.sqlite.prepare(sqlText).run(...params);
}

export interface DbClient {
  provider: DbProviderType;
  sqlite?: BetterSqlite3.Database;
  sql?: postgres.Sql;
  supabase?: SupabaseClient;
  exec: (sqlText: string) => Promise<void> | void;
  close: () => Promise<void> | void;
}

/**
 * Normalizes either a raw sqlite handle (tests / legacy callers) or a DbClient
 * into a DbClient. Unported-but-seam-aware modules (engine, scheduler, webhook)
 * call this so they can run against whichever provider is active.
 */
export function toDbClient(db: DbClient | BetterSqlite3.Database): DbClient {
  if (typeof (db as Partial<DbClient>).provider === "string") return db as DbClient;
  return {
    provider: "sqlite",
    sqlite: db as BetterSqlite3.Database,
    exec: (q: string) => {
      (db as BetterSqlite3.Database).exec(q);
    },
    close: () => {
      (db as BetterSqlite3.Database).close();
    },
  } as DbClient;
}

/** Provider-aware `now()` timestamp expression (strftime is SQLite-only). */
export function tsNowSql(db: DbClient): string {
  return db.sql ? "now()" : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
}

/** Provider-aware FALSE literal (pg BOOLEAN vs sqlite 0/1 INTEGER). */
export function falseSql(db: DbClient): string {
  return db.sql ? "false" : "0";
}

/** Provider-aware TRUE literal (pg BOOLEAN vs sqlite 0/1 INTEGER). */
export function trueSql(db: DbClient): string {
  return db.sql ? "true" : "1";
}

/**
 * Config/vars/data columns are JSONB on pg (returned pre-parsed) and TEXT on
 * sqlite (JSON strings). Normalize reads to a plain object.
 */
export function jsonFromDb(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) ?? {};
    } catch {
      return {};
    }
  }
  return (value ?? {}) as Record<string, unknown>;
}

/**
 * Serialize a JS value for a JSON-ish column: on pg pass the object through
 * (postgres.js JSON-stringifies it for JSONB); on sqlite stringify explicitly.
 */
export function jsonToDb(db: DbClient, value: unknown): unknown {
  return db.sql ? (value ?? {}) : JSON.stringify(value ?? {});
}

/**
 * Initializes Database connection.
 * Prioritizes Supabase PostgreSQL if DATABASE_URL or SUPABASE_URL is provided;
 * otherwise falls back to SQLite (local file or :memory:).
 */
export async function createDatabaseClient(config?: DatabaseConfig): Promise<DbClient> {
  const databaseUrl = config?.databaseUrl ?? process.env.DATABASE_URL;
  const supabaseUrl = config?.supabaseUrl ?? process.env.SUPABASE_URL;
  const supabaseKey = config?.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const sqlitePath = config?.sqlitePath ?? process.env.DB_PATH ?? "wastat.db";

  // 1. Supabase PostgreSQL Mode
  if (databaseUrl || (supabaseUrl && supabaseKey)) {
    let sqlInstance: postgres.Sql | undefined;
    let supabaseInstance: SupabaseClient | undefined;

    if (databaseUrl) {
      sqlInstance = postgres(databaseUrl, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
      });
    }

    if (supabaseUrl && supabaseKey) {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    // Auto-run Supabase PostgreSQL migrations if sqlInstance is connected
    if (sqlInstance) {
      try {
        const migrationSql = readFileSync(new URL("./supabase-schema.sql", import.meta.url), "utf8");
        await sqlInstance.unsafe(migrationSql);
      } catch (err) {
        console.warn("[DB] Supabase migration notice:", (err as Error)?.message || err);
      }
    }

    return {
      provider: "supabase_postgres",
      sql: sqlInstance,
      supabase: supabaseInstance,
      exec: async (query: string) => {
        if (sqlInstance) await sqlInstance.unsafe(query);
      },
      close: async () => {
        if (sqlInstance) await sqlInstance.end();
      },
    };
  }

  // 2. SQLite Fallback (Local / CI / Unit tests)
  if (sqlitePath !== ":memory:") {
    try {
      mkdirSync(dirname(sqlitePath), { recursive: true });
    } catch {}
  }

  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySqliteSchema(db);

  return {
    provider: "sqlite",
    sqlite: db,
    exec: (query: string) => {
      db.exec(query);
    },
    close: () => {
      db.close();
    },
  };
}
