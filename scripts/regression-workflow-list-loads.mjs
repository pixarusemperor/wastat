#!/usr/bin/env node
/**
 * Regression test for the "workflow list loads forever (infinite spinner)" bug.
 *
 * Root cause (2026-08): the WorkflowList component rendered its loading skeleton
 * but had no `useEffect` on mount that calls `refresh()`, so /api/workflows was
 * never fetched and the list never loaded.
 *
 * This test boots the real local server (mock WhatsApp transport), serves the
 * freshly-built frontend, and drives it in headless Chromium, asserting that the
 * workflow list actually renders a workflow row (spinner disappears).
 *
 * Usage: node scripts/regression-workflow-list-loads.mjs
 * Exits non-zero on failure.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, accessSync, constants, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import net from "node:net";

const require = createRequire(import.meta.url);
const { chromium } = await import("playwright-core");

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function findChromium() {
  const root = join(process.env.HOME || osHomedir(), ".cache/ms-playwright");
  const candidates = [];
  try {
    for (const d of require("fs").readdirSync(root)) {
      const dir = join(root, d);
      const chrome = join(dir, "chrome-linux64/chrome");
      const shell = join(dir, "chrome-headless-shell-linux64/chrome-headless-shell");
      if (fsExists(chrome)) candidates.push(chrome);
      if (fsExists(shell)) candidates.push(shell);
    }
  } catch {}
  if (candidates.length === 0) throw new Error("No Playwright chromium binary found; run: npx playwright install chromium");
  return candidates[0];
}
function fsExists(p) { try { accessSync(p, constants.F_OK); return true; } catch { return false; } }
function osHomedir() { return process.env.HOME || process.env.USERPROFILE; }

// Force the SQLite fallback provider for the server so the test has no external
// DB dependency: null out any Supabase/DATABASE connection vars inherited from the
// local/production env.
function stripSupabaseEnv() {
  const env = { ...process.env };
  for (const k of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]) delete env[k];
  return env;
}

const ROOT = process.cwd();
const DIST = join(ROOT, "packages/web/dist");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Ensure a fresh frontend build is available to serve.
  if (!fsExists(join(DIST, "index.html"))) {
    throw new Error(`Frontend dist not found at ${DIST}. Run 'npm run build --workspace @wastat/web' first.`);
  }

  const PORT = await freePort();
  const BASE = `http://localhost:${PORT}`;
  const dbDir = mkdtempSync(join(tmpdir(), "wastat-wflist-"));
  const dbPath = join(dbDir, "regression.db");

  const server = spawn("npx", ["tsx", "src/index.ts"], {
    detached: true,
    cwd: join(ROOT, "packages/server"),
    env: {
      ...stripSupabaseEnv(),
      MOCK_SEND: "1",
      WASENDER_PAT: "regression-unused-pat",
      PORT: String(PORT),
      DB_PATH: dbPath,
      STATIC_DIR: DIST,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  let browser;
  try {
    // Wait for server boot (schema is created during boot).
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try { up = (await fetch(`${BASE}/api/workflows`)).ok; } catch { await sleep(500); }
    }
    if (!up) throw new Error("server did not become ready");

    // The server AUTO-SEEDS at least one workflow on boot (seed-defaults.ts), so
    // the list has real data to render. Confirm the API returns at least one row.
    const apiWorkflows = await (await fetch(`${BASE}/api/workflows`)).json();
    check("API serves at least one workflow", Array.isArray(apiWorkflows) && apiWorkflows.length >= 1);
    const expectedName = Array.isArray(apiWorkflows) && apiWorkflows.length ? apiWorkflows[0].name : "";

    browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const apiFetches = [];
    page.on("requestfail", (r) => { if (r.url().includes("/api/")) apiFetches.push({ url: r.url(), fail: true }); });

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait long enough for the effect to run and render, or for an error banner.
    await page.waitForFunction(
      () => {
        const busy = document.querySelector('[aria-busy="true"]');
        return document.querySelectorAll(".wf-row").length > 0 || !!document.querySelector(".error-banner");
      },
      { timeout: 12000 },
    ).catch(() => {});

    const rows = await page.locator(".wf-row").count();
    const busy = await page.locator('[aria-busy="true"]').count();
    const banner = await page.locator(".error-banner").count();
    const rowText = rows ? await page.locator(".wf-row").first().innerText() : "";

    check("workflow list rendered rows", rows >= 1);
    check("loading skeleton disappeared", busy === 0);
    check("no error banner", banner === 0);
    check("rendered a seeded workflow name", expectedName !== "" && rowText.includes(expectedName));

    console.log(failures === 0 ? "\nREGRESSION: ALL PASS" : `\nREGRESSION: ${failures} FAILURE(S)`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server?.pid) {
      try { process.kill(-server.pid, "SIGKILL"); } catch { server.kill("SIGKILL"); }
    }
    if (dbDir) rmSync(dbDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("REGRESSION ERROR:", e.message);
  process.exitCode = 1;
});