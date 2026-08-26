import { openDb } from "./wasender.js";
import { createEngine } from "./engine.js";
import { FakeClock } from "./scheduler.js";
import { createLocalStorage } from "./media.js";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export async function runSafariDemo() {
  const dbPath = process.env.DB_PATH ?? "wastat.db";
  const db = openDb(dbPath);

  try {
    const schemaSql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
    db.exec(schemaSql);
  } catch {}

  console.log(`[Safari Demo] Connected to database at: ${dbPath}`);

  // 1. Ensure Sessions: Safari & Patrick
  db.prepare(`
    INSERT INTO sessions (name, provider_session_id, status)
    VALUES ('Safari (Host)', 'session_safari_host', 'connected')
    ON CONFLICT(provider_session_id) DO UPDATE SET status = 'connected', name = 'Safari (Host)'
  `).run();

  const safariSession = db.prepare("SELECT id FROM sessions WHERE provider_session_id = 'session_safari_host'").get() as { id: number };

  db.prepare(`
    INSERT INTO sessions (name, provider_session_id, status)
    VALUES ('Patrick (Lead)', 'session_patrick_lead', 'connected')
    ON CONFLICT(provider_session_id) DO UPDATE SET status = 'connected', name = 'Patrick (Lead)'
  `).run();

  // 2. Ensure Contact: Patrick
  db.prepare(`
    INSERT INTO contacts (phone, name, funnel_phase, bot_status)
    VALUES ('+1 (555) 019-9832', 'Patrick', 'phase_1_waiting_answer', 'active')
    ON CONFLICT(phone) DO UPDATE SET name = 'Patrick', bot_status = 'active'
  `).run();

  const contact = db.prepare("SELECT id, phone, name FROM contacts WHERE phone = '+1 (555) 019-9832'").get() as { id: number; phone: string; name: string };

  // Contact Attributes
  db.prepare(`
    INSERT INTO contact_attributes (contact_id, key, value)
    VALUES (?, 'budget', '$1.5M - $2.5M')
    ON CONFLICT(contact_id, key) DO UPDATE SET value = '$1.5M - $2.5M'
  `).run(contact.id);

  db.prepare(`
    INSERT INTO contact_attributes (contact_id, key, value)
    VALUES (?, 'intent', 'luxury_beachfront_villa')
    ON CONFLICT(contact_id, key) DO UPDATE SET value = 'luxury_beachfront_villa'
  `).run(contact.id);

  // 3. Upsert Workflow: Safari VIP Luxury Concierge
  let wfRow = db.prepare("SELECT id FROM workflows WHERE name = 'Safari VIP Luxury Concierge'").get() as { id: number } | undefined;

  let workflowId: number;
  if (!wfRow) {
    const info = db.prepare(`
      INSERT INTO workflows (name, description, active, session_id, ai_enabled)
      VALUES ('Safari VIP Luxury Concierge', 'Multimedia sales funnel for Safari session dispatches: Text -> Image -> Video -> Options Menu', 1, ?, 1)
    `).run(safariSession.id);
    workflowId = Number(info.lastInsertRowid);
  } else {
    workflowId = wfRow.id;
    db.prepare("UPDATE workflows SET active = 1, session_id = ?, ai_enabled = 1 WHERE id = ?").run(safariSession.id, workflowId);
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
  }

  // Insert Nodes: Trigger -> Text -> Image -> Video -> Menu
  const nodes = [
    {
      key: "trig_1",
      type: "trigger",
      config: JSON.stringify({ keyword: "safari" }),
      x: 50,
      y: 150,
    },
    {
      key: "text_greeting",
      type: "send_text",
      config: JSON.stringify({
        text: "Hey {{contact.name}}! 🌴 Welcome to Safari Luxury Stays. We have prepared an exclusive preview of our beachfront sunset collection for you:",
      }),
      x: 320,
      y: 150,
    },
    {
      key: "img_preview",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
        caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
      }),
      x: 600,
      y: 150,
    },
    {
      key: "vid_walkthrough",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        caption: "🎥 45s Ultra-Luxury 4K Cinematic Walkthrough Tour.",
      }),
      x: 880,
      y: 150,
    },
    {
      key: "menu_options",
      type: "send_menu",
      config: JSON.stringify({
        header: "Safari Concierge VIP",
        bodyText: "What would you like to explore next?",
        options: [
          { id: "opt_1", title: "View 2026 Pricing & Availability PDF" },
          { id: "opt_2", title: "Schedule Private VIP Tour" },
          { id: "opt_3", title: "Speak with a Concierge Specialist" },
        ],
        footer: "Reply with 1, 2 or 3",
      }),
      x: 1160,
      y: 150,
    },
    {
      key: "end_flow",
      type: "end",
      config: JSON.stringify({}),
      x: 1440,
      y: 150,
    },
  ];

  const insertNode = db.prepare(`
    INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const n of nodes) {
    insertNode.run(workflowId, n.key, n.type, n.config, n.x, n.y);
  }

  // Insert Edges
  const edges = [
    { src: "trig_1", tgt: "text_greeting" },
    { src: "text_greeting", tgt: "img_preview" },
    { src: "img_preview", tgt: "vid_walkthrough" },
    { src: "vid_walkthrough", tgt: "menu_options" },
    { src: "menu_options", tgt: "end_flow" },
  ];

  const insertEdge = db.prepare(`
    INSERT INTO workflow_edges (workflow_id, source_key, target_key)
    VALUES (?, ?, ?)
  `);
  for (const e of edges) {
    insertEdge.run(workflowId, e.src, e.tgt);
  }

  console.log(`[Safari Demo] Workflow #${workflowId} configured with 5 steps: Trigger -> Text -> Image -> Video -> Menu`);

  // 4. Trigger with Patrick's Message
  const clock = new FakeClock(Date.parse("2026-08-24T20:50:00.000Z"));

  const sentMessages: Array<{ toPhone: string; kind: string; text?: string }> = [];

  const engine = createEngine(db, {
    sendMessage: async (msg) => {
      sentMessages.push(msg);
      return { providerMessageId: `mock_safari_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    },
    sendPresenceUpdate: async () => {},
    markMessageAsRead: async () => {},
    clock,
  });

  // Ingest inbound lead from Patrick
  console.log(`[Safari Demo] Ingesting message from Patrick: "Hi! I am looking for information on the Safari villa collection."`);

  const msgInfo = db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'in', 'text', ?, 'read', '2026-08-24T20:50:00.000Z')
  `).run(safariSession.id, contact.id, "Hi! I am looking for information on the Safari villa collection.");
  const triggerMsgId = Number(msgInfo.lastInsertRowid);

  const executionId = await engine.startExecution(workflowId, safariSession.id, contact.id, triggerMsgId);
  console.log(`[Safari Demo] Inbound message matched! Execution #${executionId} started.`);

  // Run through each step to completion
  if (executionId) {
    await engine.step(executionId);
    console.log(`[Safari Demo] Execution completed. Check messages and execution logs in UI.`);
  }

  // Insert rich UI mock messages for the chat preview if not already present
  const existingOutCount = db.prepare("SELECT count(*) AS c FROM messages WHERE contact_id = ? AND direction = 'out'").get(contact.id) as { c: number };
  if (existingOutCount.c < 4) {
    // 1. Text
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
      VALUES (?, ?, 'out', 'text', ?, 'read', '2026-08-24T20:50:02.000Z')
    `).run(
      safariSession.id,
      contact.id,
      "Hey Patrick! 🌴 Welcome to Safari Luxury Stays. We have prepared an exclusive preview of our beachfront sunset collection for you:",
    );

    // 2. Image
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
      VALUES (?, ?, 'out', 'image', ?, 'read', '2026-08-24T20:50:05.000Z')
    `).run(
      safariSession.id,
      contact.id,
      "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
    );

    // 3. Video
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
      VALUES (?, ?, 'out', 'video', ?, 'read', '2026-08-24T20:50:08.000Z')
    `).run(
      safariSession.id,
      contact.id,
      "🎥 45s Ultra-Luxury 4K Cinematic Walkthrough Tour.",
    );

    // 4. Menu
    db.prepare(`
      INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
      VALUES (?, ?, 'out', 'text', ?, 'read', '2026-08-24T20:50:10.000Z')
    `).run(
      safariSession.id,
      contact.id,
      "*Safari Concierge VIP*\n\nWhat would you like to explore next?\n\n*1.* View 2026 Pricing & Availability PDF\n*2.* Schedule Private VIP Tour\n*3.* Speak with a Concierge Specialist\n\n_Reply with 1, 2 or 3._",
    );
  }

  console.log(`[Safari Demo] Complete! Safari workflow #${workflowId} and Patrick's live chat thread are ready to view in UI.`);
  return { workflowId, contactId: contact.id, executionId };
}

// Run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSafariDemo().catch((err) => {
    console.error("Error executing Safari demo:", err);
    process.exit(1);
  });
}
