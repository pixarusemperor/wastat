#!/usr/bin/env node
/**
 * Pushes R2 + Supabase env vars from the local .env onto the Coolify wastat app
 * so production uses Cloudflare R2 + Supabase PostgreSQL instead of local disk.
 *
 * Values are read straight from .env and NEVER printed. Only key names + HTTP
 * statuses are reported. Idempotent: re-running re-POSTs the same values.
 *
 * Usage: node scripts/coolify-set-envs.mjs            # set envs only
 *        node scripts/coolify-set-envs.mjs --deploy   # also trigger a deploy
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const envPath = join(ROOT, ".env");
const raw = readFileSync(envPath, "utf8");

function envVar(key) {
  const line = raw.split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) return "";
  return line.slice(key.length + 1).trim();
}

const BASE = envVar("COOLIFY_BASE_URL");
const TOKEN = envVar("COOLIFY_API_TOKEN");
const APP = envVar("COOLIFY_APP_UUID") || "kscggalxinzezf0f9u8b5wbn";

if (!TOKEN) throw new Error("COOLIFY_API_TOKEN missing in .env");
if (!BASE) throw new Error("COOLIFY_BASE_URL missing in .env");

const KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "DATABASE_URL",
];

let failures = 0;
for (const key of KEYS) {
  const value = envVar(key);
  if (!value) {
    console.error(`SKIP  ${key} (empty in .env)`);
    continue;
  }
  const res = await fetch(`${BASE}/api/v1/applications/${APP}/envs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const txt = await res.text().catch(() => "");
  console.log(`${res.ok ? "OK  " : "FAIL"}  ${key} (HTTP ${res.status})`);
  if (!res.ok) {
    failures++;
    console.error(`     -> ${txt.slice(0, 300)}`);
  }
}

if (failures > 0) {
  console.error(`\nDone with ${failures} failure(s). NOT triggering deploy.`);
  process.exitCode = 1;
  process.exit(1);
}

console.log("\nAll env vars set successfully.");

if (process.argv.includes("--deploy")) {
  const trigger = await fetch(`${BASE}/api/v1/applications/${APP}/deploy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await trigger.text().catch(() => "");
  console.log(`Deploy trigger HTTP ${trigger.status}`);
  console.log(body.slice(0, 400));
}