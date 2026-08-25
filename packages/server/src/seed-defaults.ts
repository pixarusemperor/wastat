import type BetterSqlite3 from "better-sqlite3";

export function autoSeedProductionWorkflows(db: BetterSqlite3.Database): void {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM workflows").get() as { count: number } | undefined;
  if (countRow && countRow.count > 0) {
    return; // Already has workflows
  }

  // Find or create Safari session
  let safariSession = db.prepare("SELECT id FROM sessions WHERE provider_session_id = '105947'").get() as { id: number } | undefined;
  if (!safariSession) {
    const info = db.prepare(`
      INSERT INTO sessions (name, provider_session_id, status)
      VALUES ('Safari', '105947', 'connected')
    `).run();
    safariSession = { id: Number(info.lastInsertRowid) };
  }

  const wfInfo = db.prepare(`
    INSERT INTO workflows (name, description, active, session_id, ai_enabled)
    VALUES ('Safari VIP Luxury Concierge', 'Live multi-step multimedia sales automation with 5-10s random delays', 1, ?, 1)
  `).run(safariSession.id);
  const workflowId = Number(wfInfo.lastInsertRowid);

  const nodes = [
    {
      key: "trig_vip",
      type: "trigger",
      config: JSON.stringify({ keywords: ["VIP2026", "safari", "villa", "hello", "hi"] }),
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
        mediaType: "image",
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
        mediaType: "audio",
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
        mediaType: "video",
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

  console.log(`[AutoSeed] Seeded default Safari VIP Luxury Concierge workflow (#${workflowId}) on startup.`);
}
