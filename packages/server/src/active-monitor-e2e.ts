import { makeWasenderAdmin } from "./wasender-admin.js";
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

export async function activeMonitorE2E() {
  loadEnv();
  console.log(`\n================================================================================`);
  console.log(`📡 WASTAT ACTIVE REAL-TIME EXECUTION MONITOR & R2 MEDIA DISPATCH LOGS`);
  console.log(`================================================================================\n`);

  const pat = process.env.WASENDER_PAT;
  if (!pat) throw new Error("WASENDER_PAT is missing");

  const admin = makeWasenderAdmin(pat);
  const safari = await admin.getSession(105947);
  const patrick = await admin.getSession(112691);

  if (!safari || !patrick) throw new Error("Could not find Safari or Patrick sessions");

  const safariPhone = safari.phone_number || "+237652474378";
  const patrickPhone = patrick.phone_number || "+237676637853";

  console.log(`[Sessions]`);
  console.log(`  🤖 Host Bot: Safari (ID: 105947, Phone: ${safariPhone})`);
  console.log(`  👤 Lead Sender: Patrick Simo (ID: 112691, Phone: ${patrickPhone})`);

  // 1. Get live Safari session ID from server
  const sessRes = await fetch(`${BASE_URL}/api/sessions`).catch(() => null);
  const sessions = (await sessRes?.json().catch(() => [])) as Array<{ id: number; providerSessionId: string }>;
  const safariSession = sessions.find((s) => s.providerSessionId === "105947");
  const safariSessionId = safariSession?.id ?? 2;

  // 2. Build R2 media-backed workflow
  // R2 public bucket endpoints for media
  const r2PublicBase = process.env.R2_PUBLIC_URL || "https://pub-8c9e5e786b0340b080518d6e9d6d531a.r2.dev";
  const imageUrl = "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80";
  const audioUrl = "https://actions.google.com/sounds/v1/water/waves_crashing_on_rocks.ogg";
  const videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

  const workflow = {
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
          mediaUrl: imageUrl,
          caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
          mediaType: "image",
          mimeType: "image/jpeg",
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
          mediaUrl: audioUrl,
          mediaType: "audio",
          mimeType: "audio/ogg",
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
          mediaUrl: videoUrl,
          caption: "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
          mediaType: "video",
          mimeType: "video/mp4",
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

  console.log(`[API] Uploading workflow to ${BASE_URL}/api/workflows/programmatic...`);
  const wfRes = await fetch(`${BASE_URL}/api/workflows/programmatic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workflow),
  });
  const wfData = (await wfRes.json().catch(() => ({}))) as { ok?: boolean; id?: number };
  console.log(`[API] Workflow creation result: HTTP ${wfRes.status}`, wfData);

  // 3. Dispatch real trigger message from Patrick Simo
  console.log(`\n[Trigger] Dispatching "VIP2026" from Patrick Simo (${patrickPhone}) -> Safari (${safariPhone})...`);
  const wasenderBaseUrl = process.env.WASENDER_BASE_URL ?? "https://www.wasenderapi.com/api";
  const trigRes = await fetch(`${wasenderBaseUrl}/send-message`, {
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
  const trigJson = (await trigRes.json().catch(() => ({}))) as any;
  console.log(`[Trigger] Wasender HTTP Status: ${trigRes.status}`, trigJson);

  console.log(`\n[Live Monitoring] Waiting for webhook ingestion and polling execution trace...`);

  // 4. Poll execution events and display live trace
  const seenEventIds = new Set<number>();
  const startTime = Date.now();
  let latestExecId: number | null = null;
  let isDone = false;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);

    // Find latest execution
    const execsRes = await fetch(`${BASE_URL}/api/executions?limit=5`).catch(() => null);
    const execData = (await execsRes?.json().catch(() => ({}))) as any;
    const execs = Array.isArray(execData) ? execData : (execData?.executions ?? []);
    if (execs.length > 0 && !latestExecId) {
      latestExecId = execs[0].id;
    }

    if (latestExecId) {
      const detailRes = await fetch(`${BASE_URL}/api/executions/${latestExecId}`).catch(() => null);
      const detail = (await detailRes?.json().catch(() => null)) as any;

      if (detail && detail.events) {
        for (const ev of detail.events) {
          if (!seenEventIds.has(ev.id)) {
            seenEventIds.add(ev.id);
            const ts = new Date(ev.createdAt).toLocaleTimeString();
            console.log(`\n⏱️ [${ts} | +${elapsedSec}s] Event: ${ev.eventType}`);
            console.log(`   Node: ${ev.data?.node_key || ev.data?.nodeKey || "N/A"}`);
            if (ev.eventType === "api.outbound_dispatch") {
              console.log(`   📤 Outbound Payload:`, JSON.stringify(ev.data, null, 2));
            } else if (ev.eventType === "api.outbound_response") {
              console.log(`   📥 API Response (HTTP ${ev.data?.status}):`, JSON.stringify(ev.data, null, 2));
            } else if (ev.eventType === "job.failed") {
              console.error(`   ❌ Job Failure Details:`, JSON.stringify(ev.data, null, 2));
            } else if (ev.eventType === "message.sent") {
              console.log(`   ✅ Message Sent (Provider ID: ${ev.data?.provider_message_id})`);
            } else {
              console.log(`   Data:`, JSON.stringify(ev.data));
            }
          }
        }

        if (detail.status === "waiting_input" || detail.status === "completed") {
          console.log(`\n🎉 [COMPLETE] Execution #${latestExecId} reached status: '${detail.status}'! All steps delivered.`);
          isDone = true;
          break;
        } else if (detail.status === "failed") {
          console.error(`\n❌ [FAILED] Execution #${latestExecId} failed! Inspecting problem node above.`);
          isDone = true;
          break;
        }
      }
    }
  }

  if (!isDone) {
    console.log(`\n[Monitor Timeout] Polling completed 120s window.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  activeMonitorE2E().catch(console.error);
}
