import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FakeClock } from "./scheduler.js";

const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");

async function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  const sent: unknown[] = [];
  const app = await buildApp(db, {
    clock: new FakeClock(),
    sendMessage: async (input) => {
      sent.push(input);
      return { providerMessageId: `prov-${sent.length}` };
    },
  });
  const s = db
    .prepare("INSERT INTO sessions (name, provider_session_id, webhook_secret) VALUES ('A', 'sess1', 'secret1')")
    .run();
  const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('wf', 1)").run();
  const workflowId = Number(wf.lastInsertRowid);
  const n = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
  n.run(workflowId, "t", "trigger", "{}");
  n.run(workflowId, "k", "keyword", JSON.stringify({ phrase: "price", algorithm: "exact", threshold: 100 }));
  n.run(workflowId, "s", "send_text", JSON.stringify({ text: "it costs $10" }));
  n.run(workflowId, "e", "end", "{}");
  const e = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
  e.run(workflowId, "t", "k");
  e.run(workflowId, "k", "s");
  e.run(workflowId, "s", "e");
  return { db, app, sessionId: Number(s.lastInsertRowid), sent };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    event: "messages.received",
    timestamp: 1633456789,
    data: {
      messages: {
        key: { id: "3EB0X123456789", remoteJid: "15550001@s.whatsapp.net" },
        messageBody: "price",
      },
    },
    ...overrides,
  };
}

describe("wasender webhook", () => {
  it("stores the incoming message and starts a matching workflow", async () => {
    const { db, app } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/wasender/sess1",
      headers: { "x-webhook-signature": "secret1" },
      payload: payload(),
    });

    expect(res.statusCode).toBe(200);
    const msg = db
      .prepare("SELECT direction, text, provider_message_id FROM messages")
      .get() as any;
    expect(msg).toMatchObject({ direction: "in", text: "price", provider_message_id: "3EB0X123456789" });
    // keyword matched → send job queued for the reply
    const jobs = db.prepare("SELECT type FROM jobs").all();
    expect(jobs).toEqual([{ type: "send_message" }]);
  });

  it("rejects bad signatures with 401 and stores nothing", async () => {
    const { db, app } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/wasender/sess1",
      headers: { "x-webhook-signature": "wrong" },
      payload: payload(),
    });

    expect(res.statusCode).toBe(401);
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM jobs").get()).toEqual({ n: 0 });
  });

  it("delivers duplicates exactly once (PRD §52–53)", async () => {
    const { db, app } = await setup();
    const hook = {
      method: "POST" as const,
      url: "/webhooks/wasender/sess1",
      headers: { "x-webhook-signature": "secret1" },
      payload: payload(),
    };

    await app.inject(hook);
    await app.inject(hook);

    expect(
      db.prepare("SELECT COUNT(*) AS n FROM messages WHERE direction = 'in'").get(),
    ).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM workflow_executions").get()).toEqual({ n: 1 });
  });
});
