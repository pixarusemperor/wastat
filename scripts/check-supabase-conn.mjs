// Read-only Supabase connectivity check.
// Reads DATABASE_URL from .env, connects with the project's own `postgres` client
// (same options as packages/server/src/db/client.ts), runs read-only queries.
// Never prints the password.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// --- read DATABASE_URL from .env (no dotenv dependency needed) ---
let raw = "";
try {
  raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch {
  raw = process.env.DATABASE_URL ?? "";
}
const line = raw.split("\n").find((l) => /^DATABASE_URL=/.test(l.trim()));
const databaseUrl = line ? line.slice(line.indexOf("=") + 1).trim() : (process.env.DATABASE_URL ?? "");
if (!databaseUrl) {
  console.error("DATABASE_URL is empty in .env");
  process.exit(1);
}
// Mask for display
const masked = databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
console.log("Using:", masked);

// --- load postgres client (hoisted in root node_modules) ---
let postgres;
try {
  postgres = require("postgres");
} catch {
  postgres = require("../packages/server/node_modules/postgres");
}

const sql = postgres(databaseUrl, {
  max: 2,
  idle_timeout: 10,
  connect_timeout: 10,
  ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

try {
  const [ping, wf, ss, dbname, ver] = await Promise.all([
    sql`select 1 as ok`,
    sql`select count(*)::int as n from workflows`,
    sql`select count(*)::int as n from sessions`,
    sql`select current_database() as db`,
    sql`select version() as v`,
  ]);
  console.log("CONNECT OK");
  console.log("db:", dbname[0].db);
  console.log("version:", ver[0].v.split(" on ")[0]);
  console.log("workflows rows:", wf[0].n);
  console.log("sessions rows:", ss[0].n);
} catch (err) {
  console.error("CONNECT FAILED:", err?.message || err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
