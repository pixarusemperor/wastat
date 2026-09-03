import Database from "better-sqlite3";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { FakeClock } from "../scheduler.js";
import { encryptSecret } from "../crypto.js";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

function signPeriskope(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function setupE2E() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(schema);

  const sentMessages: Array<{
    sessionId: number;
    toPhone: string;
    text?: string;
    priority?: number;
    kind: "text" | "media";
  }> = [];

  const clock = new FakeClock();

  const app = await buildApp(db, {
    clock,
    sendMessage: async (input) => {
      sentMessages.push({
        sessionId: input.sessionId,
        toPhone: input.toPhone,
        text: input.text,
        priority: (input as any).priority ?? 1,
        kind: input.kind,
      });
      return {
        providerMessageId: `msg_${Date.now()}_${sentMessages.length}`,
        queueId: `queue_${Date.now()}_${sentMessages.length}`,
        status: "sent",
      };
    },
  });

  // Setup sample workflow: Keyword "pricing" -> Reply "Villas start at $1.5M"
  const wf = db.prepare("INSERT INTO workflows (name, active) VALUES ('Luxury Villa Concierge', 1)").run();
  const workflowId = Number(wf.lastInsertRowid);
  const n = db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, ?, ?, ?)");
  n.run(workflowId, "trigger_node", "trigger", "{}");
  n.run(workflowId, "keyword_node", "keyword", JSON.stringify({ phrase: "pricing", algorithm: "exact", threshold: 100 }));
  n.run(workflowId, "reply_node", "send_text", JSON.stringify({ text: "Villas start at $1.5M. Would you like a brochure?" }));
  n.run(workflowId, "end_node", "end", "{}");

  const e = db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, ?, ?)");
  e.run(workflowId, "trigger_node", "keyword_node");
  e.run(workflowId, "keyword_node", "reply_node");
  e.run(workflowId, "reply_node", "end_node");

  return { db, app, clock, sentMessages, workflowId };
}

describe("Multi-Provider E2E HTTP Integration Tests via app.inject()", () => {
  it("creates Wasender and Periskope sessions with encrypted credentials and masked reads", async () => {
    const { app } = await setupE2E();

    // 1. Create Wasender session
    const wasenderRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        name: "Wasender Sales Phone",
        provider: "wasender",
        apiKey: "pat_test_secret_key_12345",
      },
    });
    expect(wasenderRes.statusCode).toBe(201);
    const wasenderBody = JSON.parse(wasenderRes.body);
    expect(wasenderBody.provider).toBe("wasender");
    expect(wasenderBody.apiKeyMasked).toMatch(/pat_••••.*2345/);
    expect(wasenderBody.webhookUrl).toContain(`/webhooks/wasender/${wasenderBody.providerSessionId}`);

    // 2. Create Periskope session
    const periskopeRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        name: "Periskope Concierge Desk",
        provider: "periskope",
        phone: "+971501234567",
        apiKey: "prsk_live_secret_key_9999",
        webhookSecret: "whsec_super_secret_webhook_key_7777",
      },
    });
    expect(periskopeRes.statusCode).toBe(201);
    const periskopeBody = JSON.parse(periskopeRes.body);
    expect(periskopeBody.provider).toBe("periskope");
    expect(periskopeBody.providerSessionId).toBe("971501234567");
    expect(periskopeBody.apiKeyMasked).toMatch(/prsk_••••.*9999/);
    expect(periskopeBody.webhookSecretMasked).toMatch(/whsec_••••.*7777/);
    expect(periskopeBody.webhookUrl).toContain("/webhooks/periskope");

    // 3. List sessions and verify both are returned with masked credentials
    const listRes = await app.inject({
      method: "GET",
      url: "/api/sessions",
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.length).toBe(2);
    expect(listBody.some((s: any) => s.provider === "wasender")).toBe(true);
    expect(listBody.some((s: any) => s.provider === "periskope")).toBe(true);
  });

  it("triggers automated workflow and dispatches reply via Wasender webhook", async () => {
    const { db, app, sentMessages } = await setupE2E();

    // Create session in DB
    const wasenderSecret = "whsec_wasender_secret";
    db.prepare(`
      INSERT INTO sessions (name, provider, provider_session_id, webhook_secret, status)
      VALUES ('Wasender Session', 'wasender', 'wasender_sess_1', ?, 'connected')
    `).run(encryptSecret(wasenderSecret));

    // Send incoming webhook
    const wasenderPayload = {
      event: "messages.received",
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        messages: {
          key: { id: "WASENDER_MSG_001", remoteJid: "971551112233@s.whatsapp.net" },
          pushName: "Sheikh Al-Maktoum",
          messageBody: "pricing",
        },
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/wasender/wasender_sess_1",
      headers: { "x-webhook-signature": wasenderSecret },
      payload: wasenderPayload,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);

    // Verify contact upserted with pushName
    const contact = db.prepare("SELECT * FROM contacts WHERE phone = '971551112233'").get() as any;
    expect(contact).toBeDefined();
    expect(contact.name).toBe("Sheikh Al-Maktoum");

    // Verify automated outbound message was dispatched
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].toPhone).toBe("971551112233");
    expect(sentMessages[0].text).toContain("Villas start at $1.5M");
  });

  it("triggers automated workflow and dispatches reply via Periskope webhook", async () => {
    const { db, app, sentMessages } = await setupE2E();

    const periskopeSecret = "whsec_periskope_secret_key";
    db.prepare(`
      INSERT INTO sessions (name, provider, provider_session_id, webhook_secret, provider_config, status)
      VALUES ('Periskope Session', 'periskope', '971509998888', ?, '{"orgPhone":"971509998888"}', 'connected')
    `).run(encryptSecret(periskopeSecret));

    const payloadObj = {
      event: "message.created",
      data: {
        id: { id: "PRSK_INBOUND_001", from_me: false },
        chat_id: "971505554444@c.us",
        sender_phone: "971505554444",
        org_phone: "971509998888",
        body: "pricing",
        sender_name: "Fatima VIP",
        created_at: new Date().toISOString(),
      },
    };

    const rawBody = JSON.stringify(payloadObj);
    const signature = signPeriskope(rawBody, periskopeSecret);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": signature,
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);

    // Verify contact upserted
    const contact = db.prepare("SELECT * FROM contacts WHERE phone = '971505554444'").get() as any;
    expect(contact).toBeDefined();
    expect(contact.name).toBe("Fatima VIP");

    // Verify automated outbound message was dispatched
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].toPhone).toBe("971505554444");
    expect(sentMessages[0].text).toContain("Villas start at $1.5M");
  });

  it("suppresses bot-echo via queue_id matching and does NOT trigger human takeover freeze", async () => {
    const { db, app } = await setupE2E();

    const periskopeSecret = "whsec_periskope_echo_test";
    const sessionRes = db.prepare(`
      INSERT INTO sessions (name, provider, provider_session_id, webhook_secret, provider_config, status)
      VALUES ('Periskope Echo Desk', 'periskope', '971508887777', ?, '{"orgPhone":"971508887777"}', 'connected')
    `).run(encryptSecret(periskopeSecret));
    const sessionId = Number(sessionRes.lastInsertRowid);

    const contactRes = db.prepare(`
      INSERT INTO contacts (phone, name, bot_status) VALUES ('971501110000', 'Lead Contact', 'active')
    `).run();
    const contactId = Number(contactRes.lastInsertRowid);

    // Simulate outbound message record stored with queue_id
    const trackedQueueId = "queue_uuid_abc_123";
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, queue_id, status, timestamp)
      VALUES (?, ?, 'out', 'text', 'Automated Greeting', 'pending_msg_id', ?, 'sent', ?)
    `).run(sessionId, contactId, trackedQueueId, new Date().toISOString());

    // Periskope webhook echoes this bot-sent message with from_me: true and queue_id
    const echoPayload = {
      event: "message.created",
      data: {
        id: { id: "3EB0_REAL_WHATSAPP_ID_999", from_me: true },
        chat_id: "971501110000@c.us",
        sender_phone: "971508887777",
        org_phone: "971508887777",
        queue_id: trackedQueueId,
        body: "Automated Greeting",
      },
    };

    const echoRaw = JSON.stringify(echoPayload);
    const echoSig = signPeriskope(echoRaw, periskopeSecret);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": echoSig,
      },
      payload: echoRaw,
    });

    expect(res.statusCode).toBe(200);

    // Verify contact bot_status is STILL active (echo did NOT freeze automation)
    const contactAfter = db.prepare("SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?").get(contactId) as any;
    expect(contactAfter.bot_status).toBe("active");
    expect(contactAfter.bot_paused_until).toBeNull();
  });

  it("triggers 24h human takeover guard when an untracked manual message is sent from phone", async () => {
    const { db, app } = await setupE2E();

    const periskopeSecret = "whsec_takeover_test";
    db.prepare(`
      INSERT INTO sessions (name, provider, provider_session_id, webhook_secret, provider_config, status)
      VALUES ('Periskope Takeover Desk', 'periskope', '971503332222', ?, '{"orgPhone":"971503332222"}', 'connected')
    `).run(encryptSecret(periskopeSecret));

    const contactRes = db.prepare(`
      INSERT INTO contacts (phone, name, bot_status) VALUES ('971502221111', 'Human Lead', 'active')
    `).run();
    const contactId = Number(contactRes.lastInsertRowid);

    // Operator physically picks up phone and sends a message (from_me: true, no matching queue_id or message_id in DB)
    const humanPayload = {
      event: "message.created",
      data: {
        id: { id: "3EB0_UNTRACKED_MANUAL_SEND" },
        from_me: true,
        chat_id: "971502221111@c.us",
        sender_phone: "971503332222",
        org_phone: "971503332222",
        body: "Hello, I am taking over this conversation manually.",
      },
    };

    const humanRaw = JSON.stringify(humanPayload);
    const humanSig = signPeriskope(humanRaw, periskopeSecret);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: {
        "content-type": "application/json",
        "x-periskope-signature": humanSig,
      },
      payload: humanRaw,
    });

    expect(res.statusCode).toBe(200);

    // Verify contact bot_status flipped to 'paused_human' with a 24h freeze
    const contactAfter = db.prepare("SELECT bot_status, bot_paused_until FROM contacts WHERE id = ?").get(contactId) as any;
    expect(contactAfter.bot_status).toBe("paused_human");
    expect(contactAfter.bot_paused_until).not.toBeNull();
  });

  it("updates delivery ACKs monotonically without regressions", async () => {
    const { db, app } = await setupE2E();

    const periskopeSecret = "whsec_ack_test";
    const sessionRes = db.prepare(`
      INSERT INTO sessions (name, provider, provider_session_id, webhook_secret, provider_config, status)
      VALUES ('Periskope Ack Session', 'periskope', '971504443333', ?, '{"orgPhone":"971504443333"}', 'connected')
    `).run(encryptSecret(periskopeSecret));
    const sessionId = Number(sessionRes.lastInsertRowid);

    const contactRes = db.prepare(`
      INSERT INTO contacts (phone) VALUES ('971506667777')
    `).run();
    const contactId = Number(contactRes.lastInsertRowid);

    // Initial message at 'sent'
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, provider_message_id, status, timestamp)
      VALUES (?, ?, 'out', 'text', 'Important Notification', 'MSG_MONOTONIC_TEST', 'sent', ?)
    `).run(sessionId, contactId, new Date().toISOString());

    // 1. Delivery ACK (ack = 2 -> 'delivered')
    const delivBody = JSON.stringify({
      event: "message.ack",
      data: { id: { id: "MSG_MONOTONIC_TEST" }, ack: 2, org_phone: "971504443333" },
    });
    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: { "content-type": "application/json", "x-periskope-signature": signPeriskope(delivBody, periskopeSecret) },
      payload: delivBody,
    });

    let msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_MONOTONIC_TEST'").get() as any;
    expect(msg.status).toBe("delivered");

    // 2. Read ACK (ack = 4 -> 'read')
    const readBody = JSON.stringify({
      event: "message.ack",
      data: { id: { id: "MSG_MONOTONIC_TEST" }, ack: 4, org_phone: "971504443333" },
    });
    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: { "content-type": "application/json", "x-periskope-signature": signPeriskope(readBody, periskopeSecret) },
      payload: readBody,
    });

    msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_MONOTONIC_TEST'").get() as any;
    expect(msg.status).toBe("read");

    // 3. Delayed stale ACK (ack = 1 -> 'sent') must NOT regress 'read'
    const staleBody = JSON.stringify({
      event: "message.ack",
      data: { id: { id: "MSG_MONOTONIC_TEST" }, ack: 1, org_phone: "971504443333" },
    });
    await app.inject({
      method: "POST",
      url: "/webhooks/periskope",
      headers: { "content-type": "application/json", "x-periskope-signature": signPeriskope(staleBody, periskopeSecret) },
      payload: staleBody,
    });

    msg = db.prepare("SELECT status FROM messages WHERE provider_message_id = 'MSG_MONOTONIC_TEST'").get() as any;
    expect(msg.status).toBe("read");
  });

  it("rotates credentials via PATCH /api/sessions/:id and registers webhook URL", async () => {
    const { app } = await setupE2E();

    // Create session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        name: "Initial Periskope Session",
        provider: "periskope",
        phone: "+971501112233",
        apiKey: "prsk_initial_key_1111",
      },
    });
    const created = JSON.parse(createRes.body);

    // Update credentials via PATCH
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/sessions/${created.id}`,
      payload: {
        name: "Renamed Periskope Session",
        apiKey: "prsk_updated_key_2222",
        webhookSecret: "whsec_updated_secret_3333",
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = JSON.parse(patchRes.body);
    expect(patched.name).toBe("Renamed Periskope Session");
    expect(patched.apiKeyMasked).toMatch(/prsk_••••.*2222/);
    expect(patched.webhookSecretMasked).toMatch(/whsec_••••.*3333/);

    // Sync webhook URL
    const syncRes = await app.inject({
      method: "POST",
      url: `/api/sessions/${created.id}/sync-webhook`,
    });
    expect(syncRes.statusCode).toBe(200);
    expect(JSON.parse(syncRes.body).ok).toBe(true);
  });
});
