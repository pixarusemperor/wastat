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

export interface DbClient {
  provider: DbProviderType;
  sqlite?: BetterSqlite3.Database;
  sql?: postgres.Sql;
  supabase?: SupabaseClient;
  exec: (sqlText: string) => Promise<void> | void;
  close: () => Promise<void> | void;
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
