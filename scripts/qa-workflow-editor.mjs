#!/usr/bin/env node
/**
 * Browser QA for the workflow editor against a live instance (default: production).
 * Verifies:
 *   1. The app boots without console/page errors (filtering analytics noise)
 *   2. No failed (4xx/5xx) network requests
 *   3. The workflow list shows the Supabase-backed workflow
 *   4. Opening the editor renders nodes + edges (read from Supabase)
 *   5. Screenshots the list + editor at desktop and mobile viewports
 *
 * Usage: node scripts/qa-workflow-editor.mjs [baseURL]
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://wassflow.orizongroup.online";
const OUT = "artifacts/qa-workflow-editor";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/home/stevenjossu/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function openPage(page, url, label) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    const u = req.url();
    // ignore third-party/analytics noise
    if (/google|gtag|analytics|facebook|hotjar|segment/i.test(u)) return;
    failedRequests.push(`${req.method()} ${u} :: ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    const s = res.status();
    if (s >= 400 && !/favicon|manifest/.test(res.url())) badResponses.push(`${s} ${res.url()}`);
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => pageErrors.push(`goto: ${e}`));
  await sleep(1200);

  // Core Web Vitals: LCP via PerformanceObserver (headless chromium reports it).
  let lcp = -1;
  try {
    lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const t = performance.getEntriesByType("paint")[0]?.startTime ?? -1;
          const obs = new PerformanceObserver((list) => {
            const e = list.getEntries().at(-1);
            if (e) resolve(e.startTime);
          });
          obs.observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(t), 3000);
        }),
    );
  } catch {}
  if (lcp >= 0) console.log(`  LCP: ${(lcp / 1000).toFixed(2)}s ${lcp < 2500 ? "✓" : "⚠"} (threshold 2.5s)`);

  console.log(`\n=== ${label} (${url}) ===`);
  check(`${label}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check(`${label}: no page errors`, pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
  check(`${label}: no failed requests`, failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
  check(`${label}: no 4xx/5xx responses`, badResponses.length === 0, badResponses.slice(0, 3).join(" | "));

  return { consoleErrors, pageErrors, failedRequests, badResponses };
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  📸 ${OUT}/${name}.png`);
}

// ---------- Desktop: workflow list ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const list = await openPage(page, `${BASE}/#/`, "list");

// Extract workflow rows
const listText = await page.locator("body").innerText();
const workflowsVisible = await page
  .getByText("Safari VIP Luxury Concierge", { exact: false })
  .count();
check("list: Supabase-backed workflow visible", workflowsVisible > 0, "Safari VIP Luxury Concierge");
check("list: no blank-state spinner", !/loading/i.test(listText.slice(0, 2000)), "");
await shot(page, "1-list-desktop");

// ---------- Desktop: open the editor for workflow 1 ----------
await page.goto(`${BASE}/#/workflows/1`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await sleep(1800);

const editorConsoleErrors = [];
page.on("console", (m) => m.type() === "error" && editorConsoleErrors.push(m.text()));
const editorPageErrors = [];
page.on("pageerror", (e) => editorPageErrors.push(String(e)));

await page.reload({ waitUntil: "networkidle" }).catch(() => {});
await sleep(1800);

// The name lives in an <input value> (editor-name), not plain text — read it.
const nameValue = await page
  .locator("input.editor-name, input[aria-label='Workflow name']")
  .inputValue()
  .catch(() => "");
check("editor: workflow name loaded in name input", nameValue.includes("Safari VIP Luxury Concierge"), `got: "${nameValue}"`);
check("editor: no console errors", editorConsoleErrors.length === 0, editorConsoleErrors.slice(0, 3).join(" | "));
check("editor: no page errors", editorPageErrors.length === 0, editorPageErrors.slice(0, 2).join(" | "));

// React Flow renders node cards; look for node-ish text (send_text, trigger, end, etc.)
const nodeCount = await page.locator(".react-flow__node, [class*='react-flow__node']").count();
check("editor: React Flow nodes rendered", nodeCount > 0, `${nodeCount} nodes`);

const edgeCount = await page.locator(".react-flow__edge").count();
check("editor: React Flow edges rendered", edgeCount > 0, `${edgeCount} edges`);

// Read-only interaction: select a node and verify its config panel opens.
// The editor has a fixed right-side config panel; selecting a node populates
// it with that node's fields (e.g. a trigger shows a Keywords input).
const firstNode = page.locator(".react-flow__node").first();
if ((await firstNode.count()) > 0) {
  // Click the node at its rendered center (React Flow is canvas-like; its own
  // pointer handling needs a real event at the node's coordinates).
  const box = await firstNode.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(700);
  }
  const body = await page.locator("body").innerText();
  const hasNodeConfig = /keywords|config|node type|send text|trigger/i.test(body);
  check("editor: selecting a node shows its config", hasNodeConfig, "config text present after click");
  await shot(page, "2b-editor-node-selected");
} else {
  check("editor: selecting a node shows its config", false, "no nodes to click");
}

await shot(page, "2-editor-desktop");

// ---------- Mobile viewport ----------
await page.setViewportSize({ width: 375, height: 720 });
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
await sleep(1500);
const mobileName = await page
  .locator("input.editor-name, input[aria-label='Workflow name']")
  .inputValue()
  .catch(() => "");
check("editor (mobile): workflow name loaded in name input", mobileName.includes("Safari VIP Luxury Concierge"), `got: "${mobileName}"`);
await shot(page, "3-editor-mobile");

await browser.close();

console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
