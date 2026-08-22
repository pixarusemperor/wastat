#!/usr/bin/env node
/**
 * End-to-end test: boots the real server with a mock WhatsApp transport and
 * drives the full PRD §54-style loop over HTTP:
 *   create workflow → activate → webhook trigger → engine executes →
 *   outbound logged → customer reply → attribution → reply visible in thread.
 *
 * Usage: node scripts/e2e.mjs [--base http://localhost:4597]
 * Exits non-zero on any assertion failure.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const externalBase = baseIdx >= 0 ? args[baseIdx + 1] : undefined;
import net from "node:net";
function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
let BASE = externalBase ?? "";
const SESSION = "112691";
const SECRET = "e2e-test-secret";

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function hook(key, text) {
  return post(
    `/webhooks/wasender/${SESSION}`,
    {
      event: "messages.received",
      timestamp: Math.floor(Date.now() / 1000),
      data: { messages: { key: { id: key, remoteJid: "15551234567@s.whatsapp.net" }, messageBody: text } },
    },
    { "x-webhook-signature": SECRET },
  );
}

let server;
let dbDir;
if (!externalBase) {
  var PORT = await freePort();
  BASE = `http://localhost:${PORT}`;
  dbDir = mkdtempSync(join(tmpdir(), "wastat-e2e-"));
  server = spawn("npx", ["tsx", "src/index.ts"], {
    detached: true,
    cwd: join(process.cwd(), "packages/server"),
    env: {
      ...process.env,
      MOCK_SEND: "1",
      WASENDER_PAT: "e2e-unused-pat",
      PORT: String(PORT),
      DB_PATH: join(dbDir, "e2e.db"),
      STATIC_DIR: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
}

try {
  // wait for boot
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try {
      up = (await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      await sleep(500);
    }
  }
  if (!up) throw new Error("server did not start");

  const dbPath = dbDir ? join(dbDir, "e2e.db") : process.env.E2E_DB_PATH;
  const sql = dbPath ? new Database(dbPath) : null;

  // 1. create + activate a keyword workflow
  const created = await post("/api/workflows", {
    name: "E2E price follow-up",
    active: true,
    nodes: [
      { nodeKey: "t", type: "trigger", config: {} },
      { nodeKey: "k", type: "keyword", config: { phrase: "I want to know the price", algorithm: "dice", threshold: 75 } },
      { nodeKey: "s", type: "send_text", config: { text: "Our prices start at $10/mo" } },
      { nodeKey: "e", type: "end", config: {} },
    ],
    edges: [
      { sourceKey: "t", targetKey: "k" },
      { sourceKey: "k", targetKey: "s" },
      { sourceKey: "s", targetKey: "e" },
    ],
  });
  check("workflow created", created.status === 201);

  // 2. seed a session row directly (webhook secret known)
  if (sql) {
    sql.prepare("INSERT INTO sessions (name, provider_session_id, status, api_key_encrypted, webhook_secret) VALUES ('E2E', ?, 'connected', x'6b6579', ?)")
      .run(SESSION, SECRET);
  }

  // 3. trigger arrives
  const triggerKey = `e2e-${Date.now()}`;
  const t1 = await hook(triggerKey, "hello I want to know the price");
  check("trigger accepted", t1.status === 200 && t1.body.executionId !== null);
  const executionId = t1.body.executionId;

  // 4. engine executed the send (mock transport marks it done)
  await sleep(300);
  const jobs = sql ? sql.prepare("SELECT status FROM jobs WHERE execution_id = ?").all(executionId) : [];
  check("outbound job done", jobs.length > 0 && jobs.every((j) => j.status === "done"));

  // 5. duplicate delivery does not re-trigger (PRD §53)
  const dup = await hook(triggerKey, "hello I want to know the price");
  check("duplicate ignored", dup.status === 200 && dup.body.duplicate === true);

  // 6. customer reply is attributed (PRD §32)
  const r1 = await hook(`e2e-r-${Date.now()}`, "ok thanks!");
  check("reply accepted", r1.status === 200);
  if (sql) {
    const attr = sql.prepare("SELECT COUNT(*) n FROM events WHERE event_type = 'reply.attributed'").get();
    const linked = sql
      .prepare("SELECT COUNT(*) n FROM messages WHERE direction='in' AND in_reply_to_id IS NOT NULL")
      .get();
    check("reply attributed", attr.n === 1 && linked.n === 1);
  }

  // 7. thread API shows both directions
  const contactId = sql?.prepare("SELECT contact_id FROM messages WHERE direction='in' LIMIT 1").get().contact_id;
  const thread = await (await fetch(`${BASE}/api/messages?contactId=${contactId}`)).json();
  check(
    "thread has in+out",
    thread.some((m) => m.direction === "in") && thread.some((m) => m.direction === "out"),
  );

  console.log(failures === 0 ? "\nE2E: ALL PASS" : `\nE2E: ${failures} FAILURE(S)`);
  failures === 0 ? (process.exitCode = 0) : (process.exitCode = 1);
} catch (err) {
  console.error("E2E ERROR:", err.message);
  process.exitCode = 1;
} finally {
  // kill the whole npx→tsx→node tree, or the grandchild outlives us
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGKILL"); } catch { server.kill("SIGKILL"); }
  }
  if (dbDir) rmSync(dbDir, { recursive: true, force: true });
}
