/**
 * Programmatic Workflow Creator CLI
 * Demonstrates creating and updating workflows dynamically via REST API
 * without any code redeployments or server restarts.
 */

const BASE_URL = process.env.WASTAT_API_URL || "https://wassflow.orizongroup.online";

export async function createProgrammaticWorkflow(baseUrl: string = BASE_URL) {
  console.log(`[API Client] Connecting to WaStat API at: ${baseUrl}`);

  const safariWorkflow = {
    name: "Safari VIP Luxury Concierge",
    description: "Programmatically created multimedia sales flow (Text -> Image -> Video -> Options Menu)",
    active: 1,
    nodes: [
      {
        nodeKey: "trig_vip",
        type: "trigger",
        config: { keywords: ["VIP2026", "safari", "villa", "hello", "hi"] },
        positionX: 60,
        positionY: 160,
      },
      {
        nodeKey: "text_greeting",
        type: "send_text",
        config: {
          text: "Hello {{contact.name|there}}! 🌴 Welcome to Safari Luxury Villas. Here is our handpicked beachfront collection:",
        },
        positionX: 340,
        positionY: 160,
      },
      {
        nodeKey: "img_villa_photo",
        type: "send_media",
        config: {
          mediaUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
          caption: "📸 Sunset Infinity Villa — Private Beach Access & Panoramic Ocean Views.",
          mediaType: "image",
        },
        positionX: 620,
        positionY: 160,
      },
      {
        nodeKey: "vid_cinematic_tour",
        type: "send_media",
        config: {
          mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          caption: "🎥 Full 4K Ultra-Luxury Cinematic Walkthrough Tour (45s).",
          mediaType: "video",
        },
        positionX: 900,
        positionY: 160,
      },
      {
        nodeKey: "menu_options",
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
        positionX: 1180,
        positionY: 160,
      },
      {
        nodeKey: "end_flow",
        type: "end",
        config: {},
        positionX: 1460,
        positionY: 160,
      },
    ],
    edges: [
      { sourceKey: "trig_vip", targetKey: "text_greeting" },
      { sourceKey: "text_greeting", targetKey: "img_villa_photo" },
      { sourceKey: "img_villa_photo", targetKey: "vid_cinematic_tour" },
      { sourceKey: "vid_cinematic_tour", targetKey: "menu_options" },
      { sourceKey: "menu_options", targetKey: "end_flow" },
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
  console.log(`[API Client] Result: HTTP ${createRes.status}`, createData);

  if (createData.ok && createData.id) {
    console.log(`[API Client] ✅ Workflow #${createData.id} is now LIVE on server (zero app redeploy needed)!`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createProgrammaticWorkflow().catch(console.error);
}
