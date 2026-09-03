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

  it("handles webhook dispatches for Safari (105947) and Patrick Simo (112691)", async () => {
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

    // Seed Safari (105947) and Patrick Simo (112691) sessions
    db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('Safari', '105947')").run();
    db.prepare("INSERT INTO sessions (name, provider_session_id) VALUES ('Patrick Simo', '112691')").run();

    // 1. Dispatch webhook to Safari session (105947) from Patrick Simo phone
    const safariRes = await app.inject({
      method: "POST",
      url: "/webhooks/wasender/105947",
      payload: {
        event: "messages.received",
        timestamp: 1787659200,
        data: {
          messages: {
            key: { id: "SAFARI_MSG_001", remoteJid: "15550199832@s.whatsapp.net", cleanedSenderPn: "+15550199832" },
            pushName: "Patrick Simo",
            messageBody: "Hello Safari VIP Concierge",
          },
        },
      },
    });

    expect(safariRes.statusCode).toBe(200);
    const safariMsg = db.prepare("SELECT * FROM messages WHERE provider_message_id = 'SAFARI_MSG_001'").get() as any;
    expect(safariMsg).toMatchObject({
      text: "Hello Safari VIP Concierge",
      provider_message_id: "SAFARI_MSG_001",
      direction: "in",
    });
    const patrickContact = db.prepare("SELECT * FROM contacts WHERE phone = '+15550199832'").get() as any;
    expect(patrickContact).toMatchObject({
      phone: "+15550199832",
      name: "Patrick Simo",
    });

    // 2. Dispatch webhook to Patrick Simo session (112691) from Safari phone
    const patrickRes = await app.inject({
      method: "POST",
      url: "/webhooks/wasender/112691",
      payload: {
        event: "messages.received",
        timestamp: 1787659205,
        data: {
          messages: {
            key: { id: "PATRICK_MSG_001", remoteJid: "15550199833@s.whatsapp.net", cleanedSenderPn: "+15550199833" },
            pushName: "Safari Host",
            messageBody: "Welcome to your luxury experience",
          },
        },
      },
    });

    expect(patrickRes.statusCode).toBe(200);
    const patrickMsg = db.prepare("SELECT * FROM messages WHERE provider_message_id = 'PATRICK_MSG_001'").get() as any;
    expect(patrickMsg).toMatchObject({
      text: "Welcome to your luxury experience",
      provider_message_id: "PATRICK_MSG_001",
      direction: "in",
    });
  });
});

describe("periskope webhook pipeline", () => {
  const secret = "prsk_signing_secret_test_123";

  const makePeriskopeApp = async () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    const sent: unknown[] = [];
    const app = await buildApp(db, {
      clock: new FakeClock(),
      sendMessage: async (input) => {
        sent.push(input);
        return { providerMessageId: `prov-${sent.length}`, queueId: `prsk_q_${sent.length}` };
      },
    });

    db.prepare(
      "INSERT INTO sessions (name, provider, provider_session_id, webhook_secret) VALUES ('Periskope Org', 'periskope', '919876543210', ?)"
    ).run(secret);

    return { db, app, sent };
  };

  const sign = async (body: string, key: string) => {
    const crypto = await import("node:crypto");
    return crypto.createHmac("sha256", key).update(body).digest("hex");
  };

  it("verifies HMAC-SHA256 signature and handles multiplexed org webhook via org_phone", async () => {
    const { db, app } = await makePeriskopeApp();

    const payloadObj = {
      event: "message.created",
      timestamp: new Date().toISOString(),
      data: {
        id: { id: "3EB0_PERISKOPE_IN_01", _serialized: "false_919876543210@c.us_3EB0_PERISKOPE_IN_01" },
        from_me: false,
        chat_id: "917778889999@c.us",
        sender_phone: "917778889999",
        org_phone: "919876543210",
        body: "Hello from Periskope lead",
        sender_name: "Anita Roy",
      },
    };
    const bodyStr = JSON.stringify(payloadObj);
    const validSignature = await sign(bodyStr, secret);

    // 1. Invalid signature is rejected with 401
    const badRes = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": "invalid_sig",
      },
      payload: bodyStr,
    });
    expect(badRes.statusCode).toBe(401);
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 0 });

    // 2. Valid signature succeeds and resolves session via org_phone
    const goodRes = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": validSignature,
      },
      payload: bodyStr,
    });
    expect(goodRes.statusCode).toBe(200);

    const storedMsg = db.prepare("SELECT * FROM messages WHERE provider_message_id = '3EB0_PERISKOPE_IN_01'").get() as any;
    expect(storedMsg).toMatchObject({
      text: "Hello from Periskope lead",
      provider_message_id: "3EB0_PERISKOPE_IN_01",
      direction: "in",
    });

    const contact = db.prepare("SELECT * FROM contacts WHERE phone = '917778889999'").get() as any;
    expect(contact).toMatchObject({
      name: "Anita Roy",
      phone: "917778889999",
    });
  });

  it("suppresses bot echo via dual-key (queue_id and provider_message_id) without triggering human takeover", async () => {
    const { db, app } = await makePeriskopeApp();

    const contactInfo = db.prepare("INSERT INTO contacts (phone, name, bot_status) VALUES ('917778889999', 'Customer', 'active')").run();
    const contactId = Number(contactInfo.lastInsertRowid);
    const session = db.prepare("SELECT id FROM sessions WHERE provider = 'periskope'").get() as { id: number };

    // Record an outbound dispatch that has queue_id
    db.prepare(
      `INSERT INTO messages (session_id, contact_id, direction, message_type, text, queue_id, status, timestamp)
       VALUES (?, ?, 'out', 'text', 'Bot Automated Offer', 'prsk_q_777', 'queued', ?)`
    ).run(session.id, contactId, new Date().toISOString());

    // Periskope sends message.created with from_me = true, matching queue_id
    const echoPayload = {
      event: "message.created",
      timestamp: new Date().toISOString(),
      data: {
        id: { id: "3EB0_STANZA_FROM_PERISKOPE" },
        from_me: true,
        chat_id: "917778889999@c.us",
        sender_phone: "917778889999",
        org_phone: "919876543210",
        queue_id: "prsk_q_777",
        body: "Bot Automated Offer",
      },
    };
    const echoBody = JSON.stringify(echoPayload);
    const echoSig = await sign(echoBody, secret);

    const echoRes = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": echoSig,
      },
      payload: echoBody,
    });

    expect(echoRes.statusCode).toBe(200);
    expect(echoRes.json()).toMatchObject({ ignored: "fromMe_bot_echo" });

    // Bot status must NOT be paused
    const contactAfter = db.prepare("SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?").get(contactId) as any;
    expect(contactAfter.bot_status).toBe("active");
    expect(contactAfter.bot_paused_until).toBeNull();
  });

  it("activates 24h Human Takeover when a genuine human sends from physical phone", async () => {
    const { db, app } = await makePeriskopeApp();

    const contactInfo = db.prepare("INSERT INTO contacts (phone, name, bot_status) VALUES ('917778889999', 'Customer', 'active')").run();
    const contactId = Number(contactInfo.lastInsertRowid);

    // Operator sends a manual message from physical WhatsApp app (not recorded in WaStat)
    const humanPayload = {
      event: "message.created",
      timestamp: new Date().toISOString(),
      data: {
        id: { id: "3EB0_MANUAL_REP_MSG" },
        from_me: true,
        chat_id: "917778889999@c.us",
        sender_phone: "917778889999",
        org_phone: "919876543210",
        body: "Hey, this is Steve taking over manually",
      },
    };
    const humanBody = JSON.stringify(humanPayload);
    const humanSig = await sign(humanBody, secret);

    const humanRes = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": humanSig,
      },
      payload: humanBody,
    });

    expect(humanRes.statusCode).toBe(200);
    expect(humanRes.json()).toMatchObject({ ignored: "fromMe_takeover_activated" });

    // Bot status MUST be paused for 24h
    const contactAfter = db.prepare("SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?").get(contactId) as any;
    expect(contactAfter.bot_status).toBe("paused_human");
    expect(contactAfter.bot_paused_until).not.toBeNull();
  });

  it("updates delivery ACKs monotonically", async () => {
    const { db, app } = await makePeriskopeApp();

    const contactInfo = db.prepare("INSERT INTO contacts (phone) VALUES ('917778889999')").run();
    const session = db.prepare("SELECT id FROM sessions WHERE provider = 'periskope'").get() as { id: number };

    db.prepare(
      `INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, status, timestamp)
       VALUES (?, ?, 'out', 'text', 'Tracked message', 'MSG_TRACK_101', 'sent', ?)`
    ).run(session.id, contactInfo.lastInsertRowid, new Date().toISOString());

    // Delivery ACK: ack = 2 -> 'delivered'
    const delivPayload = {
      event: "message.ack",
      data: {
        id: { id: "MSG_TRACK_101" },
        ack: 2,
        org_phone: "919876543210",
      },
    };
    const delivBody = JSON.stringify(delivPayload);
    const delivSig = await sign(delivBody, secret);

    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": delivSig,
      },
      payload: delivBody,
    });

    let msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_TRACK_101'").get() as any;
    expect(msg.status).toBe("delivered");

    // Read ACK: ack = 3 (delivered to all) -> ack = 4 -> 'read'
    const readPayload = {
      event: "message.ack",
      data: {
        id: { id: "MSG_TRACK_101" },
        ack: 4,
        org_phone: "919876543210",
      },
    };
    const readBody = JSON.stringify(readPayload);
    const readSig = await sign(readBody, secret);

    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": readSig,
      },
      payload: readBody,
    });

    msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_TRACK_101'").get() as any;
    expect(msg.status).toBe("read");

    // Out-of-order delayed ack = 1 (server received) must NOT regress read back to queued
    const delayedPayload = {
      event: "message.ack",
      data: {
        id: { id: "MSG_TRACK_101" },
        ack: 1,
        org_phone: "919876543210",
      },
    };
    const delayedBody = JSON.stringify(delayedPayload);
    const delayedSig = await sign(delayedBody, secret);

    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": delayedSig,
      },
      payload: delayedBody,
    });

    msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_TRACK_101'").get() as any;
    expect(msg.status).toBe("read");
  });
});

