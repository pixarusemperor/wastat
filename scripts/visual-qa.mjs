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
import { readdirSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? process.env.VISUAL_QA_BASE ?? "http://localhost:4597";
const OUT = "artifacts/visual-qa";
mkdirSync(OUT, { recursive: true });

const pages = [
  { name: "workflows", hash: "#/" },
  { name: "inbox", hash: "#/inbox" },
  { name: "sessions", hash: "#/sessions" },
];
const viewports = [
  { tag: "desktop", width: 1280, height: 800 },
  { tag: "mobile", width: 375, height: 720 },
];

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
await browser.close();

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, failures, summary }, null, 2));
console.table(summary.map(({ page, viewport, blank, errors }) => ({ page, viewport, blank, errors: errors.length })));
if (failures > 0) {
  console.error(`Visual QA: ${failures} failure(s)`);
  process.exit(1);
}
console.log("Visual QA: all pages render without errors");
