import { openDb } from "./wasender.js";
import { readFileSync } from "node:fs";

export async function setupRealSafariAndPatrick() {
  const dbPath = process.env.DB_PATH ?? "wastat.db";
  const db = openDb(dbPath);

  try {
    const schemaSql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
    db.exec(schemaSql);
  } catch {}

  console.log(`[Real Setup] Connected to database at: ${dbPath}`);

  // 1. Ensure Real Wasender Sessions: Safari (105947) & Patrick Simo (112691)
  db.prepare(`
    INSERT INTO sessions (name, provider, provider_session_id, status)
    VALUES ('Safari', 'wasender', '105947', 'connected')
    ON CONFLICT(provider, provider_session_id) DO UPDATE SET name = 'Safari', status = 'connected'
  `).run();

  const safariSession = db.prepare("SELECT id, name, provider_session_id FROM sessions WHERE provider_session_id = '105947'").get() as {
    id: number;
    name: string;
    provider_session_id: string;
  };

  db.prepare(`
    INSERT INTO sessions (name, provider, provider_session_id, status)
    VALUES ('Patrick Simo', 'wasender', '112691', 'connected')
    ON CONFLICT(provider, provider_session_id) DO UPDATE SET name = 'Patrick Simo', status = 'connected'
  `).run();

  const patrickSession = db.prepare("SELECT id, name, provider_session_id FROM sessions WHERE provider_session_id = '112691'").get() as {
    id: number;
    name: string;
    provider_session_id: string;
  };

  console.log(`[Real Setup] Sessions synchronized: Safari (DB ID: ${safariSession.id}, Wasender ID: ${safariSession.provider_session_id}), Patrick Simo (DB ID: ${patrickSession.id}, Wasender ID: ${patrickSession.provider_session_id})`);

  // 2. Ensure Contact: Patrick Simo
  db.prepare(`
    INSERT INTO contacts (phone, name, funnel_phase, bot_status)
    VALUES ('+1 (555) 019-9832', 'Patrick Simo', 'phase_1_waiting_answer', 'active')
    ON CONFLICT(phone) DO UPDATE SET name = 'Patrick Simo', bot_status = 'active'
  `).run();

  const contact = db.prepare("SELECT id, phone, name FROM contacts WHERE phone = '+1 (555) 019-9832'").get() as {
    id: number;
    phone: string;
    name: string;
  };

  // 3. Upsert Multimedia Workflow for Safari (105947)
  let wfRow = db.prepare("SELECT id FROM workflows WHERE name = 'Safari VIP Luxury Concierge'").get() as { id: number } | undefined;

  let workflowId: number;
  if (!wfRow) {
    const info = db.prepare(`
      INSERT INTO workflows (name, description, active, session_id, ai_enabled)
      VALUES ('Safari VIP Luxury Concierge', 'Live multimedia automation for Safari (105947): Text -> Image -> Video -> Numbered Menu', 1, ?, 1)
    `).run(safariSession.id);
    workflowId = Number(info.lastInsertRowid);
  } else {
    workflowId = wfRow.id;
    db.prepare("UPDATE workflows SET active = 1, session_id = ?, ai_enabled = 1 WHERE id = ?").run(safariSession.id, workflowId);
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
  }

  // Nodes: Trigger -> Text -> Image -> Video -> Menu
  const nodes = [
    {
      key: "trig_safari",
      type: "trigger",
      config: JSON.stringify({ keyword: "safari" }),
      x: 60,
      y: 160,
    },
    {
      key: "text_greeting",
      type: "send_text",
      config: JSON.stringify({
        text: "Hello {{contact.name}}! 🌴 Welcome to Safari Luxury Villas. Here is our handpicked beachfront collection:",
      }),
      x: 340,
      y: 160,
    },
    {
      key: "img_villa_photo",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
        caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
        mimeType: "image/jpeg",
      }),
      x: 620,
      y: 160,
    },
    {
      key: "vid_cinematic_tour",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        caption: "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
        mimeType: "video/mp4",
      }),
      x: 900,
      y: 160,
    },
    {
      key: "menu_options",
      type: "send_menu",
      config: JSON.stringify({
        header: "Safari VIP Concierge",
        bodyText: "What would you like to explore next?",
        options: [
          { id: "opt_1", title: "View 2026 Pricing & Availability PDF" },
          { id: "opt_2", title: "Schedule Private VIP Viewing" },
          { id: "opt_3", title: "Speak with a Concierge Specialist" },
        ],
        footer: "Reply with 1, 2 or 3.",
      }),
      x: 1180,
      y: 160,
    },
    {
      key: "end_flow",
      type: "end",
      config: JSON.stringify({}),
      x: 1460,
      y: 160,
    },
  ];

  const insertNode = db.prepare(`
    INSERT INTO workflow_nodes (workflow_id, node_key, type, config, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const n of nodes) {
    insertNode.run(workflowId, n.key, n.type, n.config, n.x, n.y);
  }

  const edges = [
    { src: "trig_safari", tgt: "text_greeting" },
    { src: "text_greeting", tgt: "img_villa_photo" },
    { src: "img_villa_photo", tgt: "vid_cinematic_tour" },
    { src: "vid_cinematic_tour", tgt: "menu_options" },
    { src: "menu_options", tgt: "end_flow" },
  ];

  const insertEdge = db.prepare(`
    INSERT INTO workflow_edges (workflow_id, source_key, target_key)
    VALUES (?, ?, ?)
  `);
  for (const e of edges) {
    insertEdge.run(workflowId, e.src, e.tgt);
  }

  console.log(`[Real Setup] Workflow #${workflowId} ('Safari VIP Luxury Concierge') bound to Safari session (105947) with 5 live nodes.`);

  // 4. Populate Live Chat Thread for UI Display
  db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'in', 'text', ?, 'read', datetime('now', '-2 minutes'))
  `).run(safariSession.id, contact.id, "Hi Safari! I am interested in your luxury villa collection.");

  db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'out', 'text', ?, 'read', datetime('now', '-90 seconds'))
  `).run(
    safariSession.id,
    contact.id,
    "Hello Patrick Simo! 🌴 Welcome to Safari Luxury Villas. Here is our handpicked beachfront collection:",
  );

  db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'out', 'image', ?, 'read', datetime('now', '-60 seconds'))
  `).run(
    safariSession.id,
    contact.id,
    "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
  );

  db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'out', 'video', ?, 'read', datetime('now', '-30 seconds'))
  `).run(
    safariSession.id,
    contact.id,
    "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
  );

  db.prepare(`
    INSERT INTO messages (session_id, contact_id, direction, message_type, text, status, timestamp)
    VALUES (?, ?, 'out', 'text', ?, 'read', datetime('now'))
  `).run(
    safariSession.id,
    contact.id,
    "*Safari VIP Concierge*\n\nWhat would you like to explore next?\n\n*1.* View 2026 Pricing & Availability PDF\n*2.* Schedule Private VIP Tour\n*3.* Speak with a Concierge Specialist\n\n_Reply with 1, 2 or 3._",
  );

  console.log(`[Real Setup] Live messages and workflow configuration complete!`);
  return { workflowId, safariSessionId: safariSession.id, patrickSessionId: patrickSession.id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupRealSafariAndPatrick().catch((err) => {
    console.error("Error setting up real Safari and Patrick sessions:", err);
    process.exit(1);
  });
}
