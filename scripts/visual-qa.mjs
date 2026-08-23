#!/usr/bin/env node
/**
 * Automated visual QA: renders every page of a running instance in headless
 * Chromium at desktop + mobile viewports, captures screenshots into
 * artifacts/visual-qa/, and fails on any page error.
 *
 * Usage: node scripts/visual-qa.mjs [baseURL]
 *   baseURL defaults to http://localhost:4597 (a MOCK_SEND dev server).
 */
import { chromium } from "playwright-core";
import { readdirSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const OUT = "artifacts/visual-qa";
mkdirSync(OUT, { recursive: true });

const pages = [
  { name: "workflows", hash: "#/" },
  { name: "experiments", hash: "#/experiments" },
  { name: "inbox", hash: "#/inbox" },
  { name: "sessions", hash: "#/sessions" },
];
const viewports = [
  { tag: "desktop", width: 1280, height: 800 },
  { tag: "mobile", width: 375, height: 720 },
];

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let BASE = process.argv[2] ?? process.env.VISUAL_QA_BASE;
let server;
let dbDir;

if (!BASE) {
  const isUp = await fetch("http://localhost:4597/health").then((r) => r.ok).catch(() => false);
  if (isUp) {
    BASE = "http://localhost:4597";
  } else {
    const PORT = await freePort();
    BASE = `http://localhost:${PORT}`;
    dbDir = mkdtempSync(join(tmpdir(), "wastat-visual-"));
    server = spawn("npx", ["tsx", "src/index.ts"], {
      detached: true,
      cwd: join(process.cwd(), "packages/server"),
      env: {
        ...process.env,
        MOCK_SEND: "1",
        WASENDER_PAT: "visual-unused-pat",
        PORT: String(PORT),
        DB_PATH: join(dbDir, "visual.db"),
        STATIC_DIR: join(process.cwd(), "packages/web/dist"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

    // wait for boot
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try {
        up = (await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) })).ok;
      } catch {
        await sleep(400);
      }
    }
    if (!up) throw new Error("Server failed to boot for visual QA");
  }
}

let failures = 0;
const summary = [];

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const dir = readdirSync(root).find((d) => d.startsWith("chromium_headless_shell-"));
    return `${root}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`;
  } catch {
    return undefined; // let playwright resolve its own browsers
  }
}

try {
  const browser = await chromium.launch({ executablePath: findChromium() });
  for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  for (const p of pages) {
    await page.goto(`${BASE}/${p.hash}`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(800);
    const file = `${OUT}/${p.name}-${vp.tag}.png`;
    await page.screenshot({ path: file });
    const bodyText = (await page.textContent("body"))?.trim() ?? "";
    const blank = bodyText.length < 10;
    if (errors.length > 0 || blank) failures++;
    summary.push({ page: p.name, viewport: vp.tag, blank, errors });
  }
  await context.close();
}
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, failures, summary }, null, 2));
  console.table(summary.map(({ page, viewport, blank, errors }) => ({ page, viewport, blank, errors: errors.length })));
  if (failures > 0) {
    console.error(`Visual QA: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("Visual QA: all pages render without errors");
} finally {
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
  if (dbDir) {
    try {
      rmSync(dbDir, { recursive: true, force: true });
    } catch {}
  }
}
