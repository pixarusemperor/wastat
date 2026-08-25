#!/usr/bin/env node
/**
 * Migrate production data (read via the wassflow.orizongroup.online API) into the
 * Supabase project configured in .env. Idempotent: re-running inserts nothing new.
 *
 * Source of truth for credentials: .env (never printed). Uses the project's own
 * `postgres` client with the pooler DATABASE_URL + direct SQL (bypasses RLS, like
 * the service role key does via PostgREST).
 *
 * Usage: node scripts/migrate-prod-to-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PROD_BASE = "https://wassflow.orizongroup.online";

function envVar(key) {
  const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = raw.split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

const databaseUrl = envVar("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL missing in .env");

let postgres;
try {
  postgres = require("postgres");
} catch {
  postgres = require("../packages/server/node_modules/postgres");
}
const sql = postgres(databaseUrl, {
  max: 5,
  idle_timeout: 10,
  connect_timeout: 10,
  ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

const get = async (path) => {
  const res = await fetch(`${PROD_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
};

try {
  // 1. Schema sync: workflows.session_id is expected by the app but was missing.
  const hasCol = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'session_id'
  `;
  if (hasCol.length === 0) {
    await sql.unsafe(
      "ALTER TABLE workflows ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES sessions(id) ON DELETE SET NULL",
    );
  }

  // 2. Source data from production
  const sessions = await get("/api/sessions"); // [{id,name,providerSessionId,status}]
  const wf = await get("/api/workflows/1"); // {id,...,sessionId,nodes,edges}
  if (!wf || wf.error) throw new Error("workflow id 1 not found in production");

  console.log(`source: ${sessions.length} sessions, 1 workflow, ${wf.nodes?.length ?? 0} nodes, ${wf.edges?.length ?? 0} edges`);

  // 3. Truncate-and-load the tables this migration owns (idempotent; the source
  //    API is authoritative). workflow_nodes/edges cascade from workflows.
  await sql`DELETE FROM workflows WHERE id = ${wf.id}`;
  if (sessions.length > 0) {
    const ids = sessions.map((s) => s.id);
    await sql`DELETE FROM sessions WHERE id = ANY(${ids})`;
  }

  // 4. Insert sessions (preserve ids)
  for (const s of sessions) {
    await sql`
      INSERT INTO sessions (id, name, provider_session_id, status)
      VALUES (${s.id}, ${s.name}, ${s.providerSessionId}, ${s.status ?? "connected"})
    `;
  }

  // 5. Insert workflow (preserve id + session_id)
  await sql`
    INSERT INTO workflows (id, name, description, session_id, active, ai_enabled)
    VALUES (${wf.id}, ${wf.name}, ${wf.description ?? null}, ${wf.sessionId ?? null},
            ${Boolean(wf.active)}, ${true})
  `;

  // 6. Nodes + edges
  for (const n of wf.nodes ?? []) {
    await sql`
      INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y)
      VALUES (${wf.id}, ${n.nodeKey}, ${n.type}, ${JSON.stringify(n.config ?? {})},
              ${n.positionX ?? 0}, ${n.positionY ?? 0})
    `;
  }
  for (const e of wf.edges ?? []) {
    await sql`
      INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle)
      VALUES (${wf.id}, ${e.sourceKey}, ${e.targetKey}, ${e.handle ?? null})
    `;
  }

  // 7. Fix serial sequences so future inserts don't collide with migrated ids
  for (const t of ["sessions", "workflows", "workflow_nodes", "workflow_edges"]) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1))`,
    );
  }

  // 8. Verify — exact counts vs source
  const [ns, nw, nn, ne] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM sessions`,
    sql`SELECT count(*)::int AS n FROM workflows`,
    sql`SELECT count(*)::int AS n FROM workflow_nodes`,
    sql`SELECT count(*)::int AS n FROM workflow_edges`,
  ]);
  const wfRow = await sql`SELECT id, name, session_id FROM workflows WHERE id = 1`;
  console.log(`supabase now: sessions=${ns[0].n} workflows=${nw[0].n} nodes=${nn[0].n} edges=${ne[0].n}`);
  console.log(`workflow 1: name=${wfRow[0]?.name} session_id=${wfRow[0]?.session_id}`);

  const ok =
    ns[0].n === sessions.length &&
    nw[0].n === 1 &&
    nn[0].n === (wf.nodes?.length ?? 0) &&
    ne[0].n === (wf.edges?.length ?? 0);
  console.log(ok ? "MIGRATION OK" : "MIGRATION CHECK FAILED — inspect above");
  process.exitCode = ok ? 0 : 1;
} finally {
  await sql.end({ timeout: 5 });
}
