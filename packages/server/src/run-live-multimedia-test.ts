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
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

export async function runLiveMultimediaTest() {
  loadEnvFile();
  const pat = process.env.WASENDER_PAT;
  if (!pat) throw new Error("WASENDER_PAT environment variable is not defined.");

  const dbPath = process.env.DB_PATH ?? "wastat.db";
  const db = openDb(dbPath);

  try {
    const schemaSql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
    db.exec(schemaSql);
  } catch {}

  console.log(`\n======================================================================`);
  console.log(`🚀 WASTAT LIVE MULTI-STEP MULTI-MEDIA TEST RUNNER (5-10s RANDOM DELAYS)`);
  console.log(`======================================================================\n`);

  const admin = makeWasenderAdmin(pat);
  const sessions = await admin.listSessions();

  const safari = sessions.find((s) => String(s.id) === "105947" || s.name.toLowerCase().includes("safari"));
  const patrick = sessions.find((s) => String(s.id) === "112691" || s.name.toLowerCase().includes("patrick"));

  if (!safari || !patrick) {
    throw new Error("Could not locate Safari (105947) or Patrick Simo (112691) in Wasender.");
  }

  const safariPhone = safari.phone_number || "+237652474378";
  const patrickPhone = patrick.phone_number || "+237676637853";

  console.log(`[Sessions Connected]`);
  console.log(`  🟢 Host Bot: Safari (ID: ${safari.id}, Phone: ${safariPhone})`);
  console.log(`  🟢 Lead Sender: Patrick Simo (ID: ${patrick.id}, Phone: ${patrickPhone})`);

  // Sync sessions in DB
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

  // 1. Programmatically Configure Multi-Media Workflow with 5-10s random delays
  let wfRow = db.prepare("SELECT id FROM workflows WHERE name = 'Safari VIP Luxury Concierge'").get() as { id: number } | undefined;
  let workflowId: number;

  if (!wfRow) {
    const info = db.prepare(`
      INSERT INTO workflows (name, description, active, session_id, ai_enabled)
      VALUES ('Safari VIP Luxury Concierge', 'Multi-step multi-media sales flow with 5-10s random delays', 1, ?, 1)
    `).run(safariLocal.id);
    workflowId = Number(info.lastInsertRowid);
  } else {
    workflowId = wfRow.id;
    db.prepare("UPDATE workflows SET active = 1, session_id = ?, ai_enabled = 1 WHERE id = ?").run(safariLocal.id, workflowId);
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(workflowId);
  }

  const nodes = [
    {
      key: "trig_vip",
      type: "trigger",
      config: JSON.stringify({ keywords: ["VIP2026", "safari", "villa"] }),
      x: 50,
      y: 150,
    },
    {
      key: "del_1",
      type: "delay",
      config: JSON.stringify({ mode: "random", minSeconds: 5, maxSeconds: 10 }),
      x: 250,
      y: 150,
    },
    {
      key: "step_text",
      type: "send_text",
      config: JSON.stringify({
        text: "Hello Patrick Simo! 🌴 Welcome to Safari Luxury Villas. Here is our exclusive beachfront collection:",
      }),
      x: 450,
      y: 150,
    },
    {
      key: "del_2",
      type: "delay",
      config: JSON.stringify({ mode: "random", minSeconds: 5, maxSeconds: 10 }),
      x: 650,
      y: 150,
    },
    {
      key: "step_image",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
        caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
        mimeType: "image/jpeg",
      }),
      x: 850,
      y: 150,
    },
    {
      key: "del_3",
      type: "delay",
      config: JSON.stringify({ mode: "random", minSeconds: 5, maxSeconds: 10 }),
      x: 1050,
      y: 150,
    },
    {
      key: "step_audio",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rocks.ogg",
        mimeType: "audio/ogg",
      }),
      x: 1250,
      y: 150,
    },
    {
      key: "del_4",
      type: "delay",
      config: JSON.stringify({ mode: "random", minSeconds: 5, maxSeconds: 10 }),
      x: 1450,
      y: 150,
    },
    {
      key: "step_video",
      type: "send_media",
      config: JSON.stringify({
        mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        caption: "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
        mimeType: "video/mp4",
      }),
      x: 1650,
      y: 150,
    },
    {
      key: "del_5",
      type: "delay",
      config: JSON.stringify({ mode: "random", minSeconds: 5, maxSeconds: 10 }),
      x: 1850,
      y: 150,
    },
    {
      key: "step_menu",
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
      x: 2050,
      y: 150,
    },
    {
      key: "end_flow",
      type: "end",
      config: JSON.stringify({}),
      x: 2250,
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

  const edges = [
    { src: "trig_vip", tgt: "del_1" },
    { src: "del_1", tgt: "step_text" },
    { src: "step_text", tgt: "del_2" },
    { src: "del_2", tgt: "step_image" },
    { src: "step_image", tgt: "del_3" },
    { src: "del_3", tgt: "step_audio" },
    { src: "step_audio", tgt: "del_4" },
    { src: "del_4", tgt: "step_video" },
    { src: "step_video", tgt: "del_5" },
    { src: "del_5", tgt: "step_menu" },
    { src: "step_menu", tgt: "end_flow" },
  ];

  const insertEdge = db.prepare(`
    INSERT INTO workflow_edges (workflow_id, source_key, target_key)
    VALUES (?, ?, ?)
  `);
  for (const e of edges) {
    insertEdge.run(workflowId, e.src, e.tgt);
  }

  console.log(`[Workflow Configured]`);
  console.log(`  Workflow #${workflowId} ('Safari VIP Luxury Concierge') configured with 12 nodes (5-10s random delays between all media).`);

  // 2. Send ONLY the trigger message programmatically from Patrick Simo (112691) to Safari (+237652474378)
  console.log(`\n[Triggering Outbound Real Message]`);
  console.log(`  Sending trigger message "VIP2026" from Patrick Simo (${patrickPhone}) -> Safari (${safariPhone})...`);

  const wasenderBaseUrl = process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api";
  const triggerRes = await fetch(`${wasenderBaseUrl}/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${patrick.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: safariPhone,
      text: "VIP2026",
    }),
  });

  const triggerBody = await triggerRes.text();
  console.log(`  Wasender API Status: ${triggerRes.status}`);
  console.log(`  Wasender API Response: ${triggerBody}`);

  if (triggerRes.ok) {
    console.log(`\n✅ Trigger message "VIP2026" successfully dispatched to Safari's real phone!`);
    console.log(`\n[Live Automation Engine Ingress]`);
    console.log(`  Safari's webhook is receiving the message at https://wassflow.orizongroup.online/webhooks/wasender/105947.`);
    console.log(`  The engine will execute each step with 5-10s human-like random pacing:`);
    console.log(`    ⏳ [Delay 5-10s] -> 💬 Step 1: Text Greeting`);
    console.log(`    ⏳ [Delay 5-10s] -> 🖼️ Step 2: Sunset Villa Image Photo`);
    console.log(`    ⏳ [Delay 5-10s] -> 🎙️ Step 3: Ocean Waves Audio Voice Note`);
    console.log(`    ⏳ [Delay 5-10s] -> 🎥 Step 4: 4K Cinematic Video Tour`);
    console.log(`    ⏳ [Delay 5-10s] -> 📋 Step 5: Options Menu Card`);
  }

  return { workflowId, triggerStatus: triggerRes.status, triggerBody };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveMultimediaTest().catch(console.error);
}
