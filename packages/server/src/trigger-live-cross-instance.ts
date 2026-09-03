import { openDb } from "./wasender.js";
import { makeWasenderAdmin } from "./wasender-admin.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile() {
  const envPaths = [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")];
  for (const p of envPaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

export async function executeLiveCrossInstanceTrigger() {
  loadEnvFile();
  const pat = process.env.WASENDER_PAT;
  if (!pat) {
    throw new Error("WASENDER_PAT environment variable is not defined.");
  }

  const dbPath = process.env.DB_PATH ?? "wastat.db";
  const db = openDb(dbPath);

  try {
    const schemaSql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
    db.exec(schemaSql);
  } catch {}

  console.log(`[Live Trigger] Fetching connected sessions from Wasender API...`);
  const admin = makeWasenderAdmin(pat);
  const sessions = await admin.listSessions();

  console.log(`[Live Trigger] Found ${sessions.length} session(s) in Wasender account:`);
  for (const s of sessions) {
    console.log(` - [ID: ${s.id}] ${s.name} | Status: ${s.status} | Phone: ${s.phone_number ?? "N/A"}`);
  }

  // Find Safari (105947) and Patrick Simo (112691)
  const safari = sessions.find((s) => String(s.id) === "105947" || s.name.toLowerCase().includes("safari"));
  const patrick = sessions.find((s) => String(s.id) === "112691" || s.name.toLowerCase().includes("patrick"));

  if (!safari) {
    throw new Error("Could not find session 'Safari' (ID: 105947) in Wasender account.");
  }
  if (!patrick) {
    throw new Error("Could not find session 'Patrick Simo' (ID: 112691) in Wasender account.");
  }

  console.log(`\n[Live Trigger] Identified Target Sessions:`);
  console.log(`  Target Host (Safari): ID ${safari.id}, Phone: ${safari.phone_number || "configured in Wasender"}`);
  console.log(`  Sender Lead (Patrick Simo): ID ${patrick.id}, Phone: ${patrick.phone_number || "configured in Wasender"}`);

  // 1. Sync Sessions into local database
  db.prepare(`
    INSERT INTO sessions (name, provider, provider_session_id, status, api_key_encrypted)
    VALUES (?, 'wasender', ?, ?, ?)
    ON CONFLICT(provider, provider_session_id) DO UPDATE SET
      name = excluded.name, status = excluded.status, api_key_encrypted = excluded.api_key_encrypted
  `).run(safari.name, String(safari.id), safari.status, Buffer.from(safari.api_key, "utf8"));

  db.prepare(`
    INSERT INTO sessions (name, provider, provider_session_id, status, api_key_encrypted)
    VALUES (?, 'wasender', ?, ?, ?)
    ON CONFLICT(provider, provider_session_id) DO UPDATE SET
      name = excluded.name, status = excluded.status, api_key_encrypted = excluded.api_key_encrypted
  `).run(patrick.name, String(patrick.id), patrick.status, Buffer.from(patrick.api_key, "utf8"));

  const safariLocal = db.prepare("SELECT id FROM sessions WHERE provider_session_id = ?").get(String(safari.id)) as { id: number };

  // 2. Setup Keyword Workflow "Safari VIP Luxury Concierge" bound to Safari
  let wfRow = db.prepare("SELECT id FROM workflows WHERE name = 'Safari VIP Luxury Concierge'").get() as { id: number } | undefined;

  let workflowId: number;
  if (!wfRow) {
    const info = db.prepare(`
      INSERT INTO workflows (name, description, active, session_id, ai_enabled)
      VALUES ('Safari VIP Luxury Concierge', 'Live multimedia automation for Safari (105947): Trigger VIP2026 -> Text -> Image -> Video -> Menu', 1, ?, 1)
    `).run(safariLocal.id);
    workflowId = Number(info.lastInsertRowid);
  } else {
    workflowId = wfRow.id;
    db.prepare("UPDATE workflows SET active = 1, session_id = ?, ai_enabled = 1 WHERE id = ?").run(safariLocal.id, workflowId);
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
  }

  // Nodes: Trigger (keyword VIP2026) -> Text -> Image -> Video -> Menu
  const nodes = [
    {
      key: "trig_vip",
      type: "trigger",
      config: JSON.stringify({ keyword: "VIP2026" }),
      x: 60,
      y: 160,
    },
    {
      key: "text_greeting",
      type: "send_text",
      config: JSON.stringify({
        text: "Hello {{contact.name|there}}! 🌴 Welcome to Safari Luxury Villas. Here is our exclusive beachfront collection:",
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
          { id: "opt_2", title: "Schedule Private VIP Tour" },
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
    { src: "trig_vip", tgt: "text_greeting" },
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

  console.log(`[Live Trigger] Workflow #${workflowId} ('Safari VIP Luxury Concierge') configured with keyword 'VIP2026' on Safari session (105947).`);

  // Determine recipient phone number for Safari
  const safariPhone = safari.phone_number;
  if (!safariPhone) {
    console.log(`[Live Trigger] Note: Wasender session list did not return explicit phone_number in metadata.`);
    console.log(`[Live Trigger] Attempting dispatch via Patrick Simo session API key...`);
  }

  const targetRecipient = safariPhone || "+15550199832";
  console.log(`\n[Live Trigger] Dispatching REAL Wasender API Call from Patrick Simo (112691) to Safari (${targetRecipient}):`);
  console.log(`  Payload: { to: "${targetRecipient}", text: "VIP2026" }`);

  const wasenderBaseUrl = process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api";
  const res = await fetch(`${wasenderBaseUrl}/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${patrick.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: targetRecipient,
      text: "VIP2026",
    }),
  });

  const responseText = await res.text();
  console.log(`[Live Trigger] Wasender API HTTP Response Status: ${res.status}`);
  console.log(`[Live Trigger] Wasender API Response Body: ${responseText}`);

  if (res.ok) {
    console.log(`\n[Live Trigger] ✅ SUCCESS! Real WhatsApp message 'VIP2026' dispatched from Patrick Simo to Safari.`);
    console.log(`[Live Trigger] Safari's webhook at https://wassflow.orizongroup.online/webhooks/wasender/105947 will process the incoming keyword and reply with Text, Image, Video, and Menu.`);
  } else {
    console.warn(`[Live Trigger] Note: API returned status ${res.status}: ${responseText}`);
  }

  return {
    safariSessionId: safari.id,
    patrickSessionId: patrick.id,
    workflowId,
    apiStatus: res.status,
    responseBody: responseText,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executeLiveCrossInstanceTrigger().catch((err) => {
    console.error("Fatal error during live cross-instance trigger:", err);
    process.exit(1);
  });
}
