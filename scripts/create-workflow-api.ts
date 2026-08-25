/**
 * Programmatic Workflow Creator & Trigger CLI
 * Demonstrates creating workflows dynamically via REST API
 * and sending the trigger keyword to start live multi-media execution.
 */

import { makeWasenderAdmin } from "../packages/server/src/wasender-admin.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
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

const BASE_URL = process.env.WASTAT_API_URL || "https://wassflow.orizongroup.online";

export async function createAndTriggerWorkflow(baseUrl: string = BASE_URL) {
  loadEnv();
  console.log(`\n======================================================================`);
  console.log(`🚀 WASTAT PROGRAMMATIC WORKFLOW UPLOADER & REAL TRIGGER DISPATCH`);
  console.log(`======================================================================\n`);
  console.log(`[API Client] Connecting to WaStat API at: ${baseUrl}`);

  // Fetch production sessions to get Safari session ID
  const sessRes = await fetch(`${baseUrl}/api/sessions`).catch(() => null);
  const sessions = (await sessRes?.json().catch(() => [])) as Array<{ id: number; name: string; providerSessionId: string }>;
  const safariSession = sessions.find((s) => s.providerSessionId === "105947" || s.name.toLowerCase().includes("safari"));
  const safariSessionId = safariSession?.id ?? 2;

  console.log(`[API Client] Target Safari Session ID: ${safariSessionId}`);

  const safariWorkflow = {
    name: "Safari VIP Luxury Concierge",
    description: "Live multi-step multimedia sales flow with 5-10s random delays (Text -> Image -> Audio -> Video -> Menu)",
    active: 1,
    sessionId: safariSessionId,
    nodes: [
      {
        nodeKey: "trig_vip",
        type: "trigger",
        config: { keywords: ["VIP2026", "safari", "villa", "hello", "hi"] },
        positionX: 50,
        positionY: 150,
      },
      {
        nodeKey: "del_1",
        type: "delay",
        config: { mode: "random", minSeconds: 5, maxSeconds: 10 },
        positionX: 250,
        positionY: 150,
      },
      {
        nodeKey: "step_text",
        type: "send_text",
        config: {
          text: "Hello Patrick Simo! 🌴 Welcome to Safari Luxury Villas. Here is our exclusive beachfront collection:",
        },
        positionX: 450,
        positionY: 150,
      },
      {
        nodeKey: "del_2",
        type: "delay",
        config: { mode: "random", minSeconds: 5, maxSeconds: 10 },
        positionX: 650,
        positionY: 150,
      },
      {
        nodeKey: "step_image",
        type: "send_media",
        config: {
          mediaUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
          caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
          mediaType: "image",
        },
        positionX: 850,
        positionY: 150,
      },
      {
        nodeKey: "del_3",
        type: "delay",
        config: { mode: "random", minSeconds: 5, maxSeconds: 10 },
        positionX: 1050,
        positionY: 150,
      },
      {
        nodeKey: "step_audio",
        type: "send_media",
        config: {
          mediaUrl: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rocks.ogg",
          mediaType: "audio",
        },
        positionX: 1250,
        positionY: 150,
      },
      {
        nodeKey: "del_4",
        type: "delay",
        config: { mode: "random", minSeconds: 5, maxSeconds: 10 },
        positionX: 1450,
        positionY: 150,
      },
      {
        nodeKey: "step_video",
        type: "send_media",
        config: {
          mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          caption: "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
          mediaType: "video",
        },
        positionX: 1650,
        positionY: 150,
      },
      {
        nodeKey: "del_5",
        type: "delay",
        config: { mode: "random", minSeconds: 5, maxSeconds: 10 },
        positionX: 1850,
        positionY: 150,
      },
      {
        nodeKey: "step_menu",
        type: "send_menu",
        config: {
          header: "Safari VIP Concierge",
          bodyText: "What would you like to explore next?",
          options: [
            { id: "opt_1", title: "View 2026 Pricing & Availability PDF" },
            { id: "opt_2", title: "Schedule Private VIP Tour" },
            { id: "opt_3", title: "Speak with a Concierge Specialist" },
          ],
          footer: "Reply with 1, 2 or 3.",
        },
        positionX: 2050,
        positionY: 150,
      },
      {
        nodeKey: "end_flow",
        type: "end",
        config: {},
        positionX: 2250,
        positionY: 150,
      },
    ],
    edges: [
      { sourceKey: "trig_vip", targetKey: "del_1" },
      { sourceKey: "del_1", targetKey: "step_text" },
      { sourceKey: "step_text", targetKey: "del_2" },
      { sourceKey: "del_2", targetKey: "step_image" },
      { sourceKey: "step_image", targetKey: "del_3" },
      { sourceKey: "del_3", targetKey: "step_audio" },
      { sourceKey: "step_audio", targetKey: "del_4" },
      { sourceKey: "del_4", targetKey: "step_video" },
      { sourceKey: "step_video", targetKey: "del_5" },
      { sourceKey: "del_5", targetKey: "step_menu" },
      { sourceKey: "step_menu", targetKey: "end_flow" },
    ],
  };

  // 1. Dry-run Validation
  console.log(`[API Client] Validating workflow structure via POST /api/workflows/validate...`);
  const valRes = await fetch(`${baseUrl}/api/workflows/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safariWorkflow),
  });

  const valData = (await valRes.json().catch(() => ({}))) as { ok?: boolean; errors?: unknown[] };
  if (!valRes.ok || !valData.ok) {
    console.error(`[API Client] Validation failed:`, valData.errors);
    return;
  }
  console.log(`[API Client] ✅ Pre-flight validation passed with 0 errors.`);

  // 2. Programmatic Creation / Upsert
  console.log(`[API Client] Upserting workflow via POST /api/workflows/programmatic...`);
  const createRes = await fetch(`${baseUrl}/api/workflows/programmatic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safariWorkflow),
  });

  const createData = (await createRes.json().catch(() => ({}))) as { ok?: boolean; id?: number };
  console.log(`[API Client] Creation result: HTTP ${createRes.status}`, createData);

  if (!createData.ok || !createData.id) {
    console.error(`[API Client] Failed to create workflow:`, createData);
    return;
  }

  console.log(`[API Client] ✅ Workflow #${createData.id} ('Safari VIP Luxury Concierge') is now LIVE on server!`);

  // 3. Send ONLY the trigger message programmatically from Patrick Simo (112691) to Safari (+237652474378)
  const pat = process.env.WASENDER_PAT;
  if (!pat) {
    console.log(`[API Client] WASENDER_PAT not found in local env. Trigger can be sent from WhatsApp phone directly.`);
    return;
  }

  const admin = makeWasenderAdmin(pat);
  const patrickDetails = await admin.getSession(112691).catch(() => null);
  const safariDetails = await admin.getSession(105947).catch(() => null);

  if (!patrickDetails || !safariDetails) {
    console.error(`[API Client] Could not retrieve session credentials from Wasender.`);
    return;
  }

  const safariPhone = safariDetails.phone_number || "+237652474378";
  const patrickPhone = patrickDetails.phone_number || "+237676637853";

  console.log(`\n[Real Dispatch] Sending ONLY trigger message "VIP2026" from Patrick Simo (${patrickPhone}) -> Safari (${safariPhone})...`);

  const wasenderBaseUrl = process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api";
  const triggerRes = await fetch(`${wasenderBaseUrl}/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${patrickDetails.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: safariPhone,
      text: "VIP2026",
    }),
  });

  const triggerBody = await triggerRes.text();
  console.log(`[Real Dispatch] Wasender API Status: ${triggerRes.status}`);
  console.log(`[Real Dispatch] Wasender API Response: ${triggerBody}`);

  if (triggerRes.ok) {
    console.log(`\n🎉 SUCCESS! Real trigger message "VIP2026" dispatched from Patrick Simo to Safari.`);
    console.log(`Safari's production webhook will receive the message and execute the 5 media steps with 5-10s random delays:`);
    console.log(`  ⏳ 5-10s Delay -> 💬 Step 1: Text Greeting`);
    console.log(`  ⏳ 5-10s Delay -> 🖼️ Step 2: Sunset Villa Photo (Image)`);
    console.log(`  ⏳ 5-10s Delay -> 🎙️ Step 3: Ocean Waves Voice Note (Audio)`);
    console.log(`  ⏳ 5-10s Delay -> 🎥 Step 4: 4K Cinematic Walkthrough (Video)`);
    console.log(`  ⏳ 5-10s Delay -> 📋 Step 5: Options Menu Card`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createAndTriggerWorkflow().catch(console.error);
}
