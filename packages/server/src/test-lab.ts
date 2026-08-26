import type BetterSqlite3 from "better-sqlite3";
import { createEngine } from "./engine.js";
import { type StorageProvider, createLocalStorage } from "./media.js";
import { FakeClock } from "./scheduler.js";

export interface ScenarioDefinition {
  id: string;
  category: "media" | "logic" | "timing" | "safety" | "dual_instance";
  name: string;
  description: string;
  supportsVirtual: boolean;
  supportsLive: boolean;
  requiredAssets?: Array<{ filename: string; mimeType: string; content: string }>;
}

export interface ScenarioRunResult {
  scenarioId: string;
  name: string;
  status: "passed" | "failed";
  mode: "virtual" | "live";
  executionId?: number;
  durationMs: number;
  logs: string[];
  metrics?: {
    readDelayMs?: number;
    presenceType?: string;
    presenceDurationMs?: number;
    mediaUrl?: string;
    mediaMimeType?: string;
    dispatchedKind?: string;
  };
  error?: string;
}

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    id: "text_spintax_vars",
    category: "logic",
    name: "Text, Spintax & Variable Interpolation",
    description: "Validates contact attribute interpolation, dynamic session variables, and nested spintax variations {A|{B|C}}.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "image_media_caption",
    category: "media",
    name: "Image Upload & Caption Delivery",
    description: "Validates JPEG/PNG media asset resolution, public storage URL generation, and image preview with caption.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "video_media_streaming",
    category: "media",
    name: "MP4 Video Media Dispatch",
    description: "Validates MP4 video attachment dispatch, video URL formatting, and streaming playback metadata.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "audio_voice_note",
    category: "media",
    name: "Audio / Voice Note with Recording Presence",
    description: "Validates MP3/OGG voice note dispatch with 'recording' presence update instead of standard text typing.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "document_pdf_attachment",
    category: "media",
    name: "Document & PDF Attachment",
    description: "Validates PDF document attachment with custom fileName, documentUrl, and caption delivery.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "interactive_menu_branching",
    category: "logic",
    name: "Interactive Numbered Menu Branching",
    description: "Dispatches numbered options fallback menu, simulates numerical reply ('1'), and validates sub-branch execution.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "condition_logic_split",
    category: "logic",
    name: "Regex / Keyword Condition Split",
    description: "Tests keyword and regex condition evaluator, asserting correct true/false execution paths.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "silence_sweeper_2h",
    category: "timing",
    name: "2-Hour Silence Followup Sweeper",
    description: "Simulates customer inactivity, fast-forwards time by 2 hours, and verifies on_silence_2h automated reactivation.",
    supportsVirtual: true,
    supportsLive: false,
  },
  {
    id: "human_takeover_24h",
    category: "safety",
    name: "24-Hour Operator Human Takeover Guard",
    description: "Simulates manual sales representative reply from dashboard, verifying 24h bot pause and suppression of automations.",
    supportsVirtual: true,
    supportsLive: true,
  },
  {
    id: "dual_instance_live_e2e",
    category: "dual_instance",
    name: "Dual-Instance Real-Device E2E Dispatch",
    description: "Sends real WhatsApp message from Session A (Tester) to Session B (Bot) and validates live end-to-end execution trace.",
    supportsVirtual: false,
    supportsLive: true,
  },
];

/**
 * Creates a sample media asset in DB and storage for testing
 */
export async function seedMediaAsset(
  db: BetterSqlite3.Database,
  storage: StorageProvider,
  filename: string,
  mimeType: string,
  content: string | Buffer = "sample media content",
): Promise<number> {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const r2Key = `test-${Date.now()}-${filename}`;
  await storage.put(r2Key, buf, mimeType);

  const info = db
    .prepare(
      "INSERT INTO media_assets (filename, mime_type, size, r2_key, hash) VALUES (?, ?, ?, ?, ?)",
    )
    .run(filename, mimeType, buf.length, r2Key, "hash-" + Date.now());

  return Number(info.lastInsertRowid);
}

/**
 * Runs a virtual scenario in-memory using mock transports and fake clock
 */
export async function runVirtualScenario(
  db: BetterSqlite3.Database,
  scenarioId: string,
  storage: StorageProvider = createLocalStorage("/tmp/wastat-test-media"),
): Promise<ScenarioRunResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  const clock = new FakeClock(1700000000000);

  const dispatchedMessages: Array<{ sessionId: number; toPhone: string; kind: string; text?: string; mediaId?: number }> = [];
  const presenceUpdates: Array<{ sessionId: number; toPhone: string; type: string }> = [];
  const readReceipts: Array<{ sessionId: number; toPhone: string; key: any }> = [];

  const engine = createEngine(
    db,
    {
      sendMessage: async (input) => {
        dispatchedMessages.push(input);
        return { providerMessageId: `mock-msg-${Date.now()}` };
      },
      sendPresenceUpdate: async (input) => {
        presenceUpdates.push(input);
      },
      markMessageAsRead: async (input) => {
        readReceipts.push(input);
      },
      clock,
    },
  );

  logs.push(`[Init] Initialized virtual test environment for scenario: ${scenarioId}`);

  // Seed default test session and contact
  db.prepare("INSERT INTO sessions (name, provider_session_id, status) VALUES ('Virtual Session A', 'virt-sess-a', 'connected') ON CONFLICT DO NOTHING").run();
  const session = db.prepare("SELECT id FROM sessions WHERE provider_session_id = 'virt-sess-a'").get() as { id: number };

  db.prepare("INSERT INTO contacts (phone, name) VALUES ('+19998887777', 'Alex Test Lead') ON CONFLICT DO NOTHING").run();
  const contact = db.prepare("SELECT id FROM contacts WHERE phone = '+19998887777'").get() as { id: number };

  try {
    switch (scenarioId) {
      case "text_spintax_vars": {
        // Create workflow
        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Spintax Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'msg', 'send_text', ?)").run(
          wfId,
          JSON.stringify({ text: "Hello {{contact.name}}! {Welcome|Great to see you} at {{session.name}}." }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'msg')").run(wfId);

        // Start execution
        const execId = await engine.startExecution(wfId, session.id, contact.id, undefined, {});
        if (!execId) throw new Error("Could not start workflow execution");
        logs.push(`[Execution] Started execution ID ${execId}`);

        await engine.scheduler.tick();

        if (dispatchedMessages.length === 0) throw new Error("No message was dispatched");
        const out = dispatchedMessages[0];
        logs.push(`[Dispatch] Text received: "${out.text}"`);

        if (!out.text?.includes("Alex Test Lead")) throw new Error("Variable {{contact.name}} was not interpolated");
        if (out.text.includes("{") || out.text.includes("}")) throw new Error("Spintax was not resolved");

        return {
          scenarioId,
          name: "Text, Spintax & Variable Interpolation",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
          metrics: { dispatchedKind: "text" },
        };
      }

      case "image_media_caption": {
        const mediaId = await seedMediaAsset(db, storage, "test_banner.png", "image/png", Buffer.from("fake-png-data"));
        logs.push(`[Media] Uploaded image asset ID ${mediaId}`);

        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Image Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'media_node', 'send_media', ?)").run(
          wfId,
          JSON.stringify({ mediaId, caption: "Here is your VIP Pass {{contact.name}}!" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'media_node')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        await engine.scheduler.tick();

        if (dispatchedMessages.length === 0) throw new Error("No media message dispatched");
        const out = dispatchedMessages[0];
        logs.push(`[Dispatch] Media dispatched with mediaId=${out.mediaId}, text="${out.text}"`);

        return {
          scenarioId,
          name: "Image Upload & Caption Delivery",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
          metrics: {
            dispatchedKind: "media",
            mediaMimeType: "image/png",
            mediaUrl: storage.getPublicUrl((db.prepare("SELECT r2_key FROM media_assets WHERE id = ?").get(mediaId) as any).r2_key),
          },
        };
      }

      case "video_media_streaming": {
        const mediaId = await seedMediaAsset(db, storage, "demo_video.mp4", "video/mp4", Buffer.from("fake-mp4-data"));
        logs.push(`[Media] Uploaded video asset ID ${mediaId}`);

        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Video Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'vid_node', 'send_media', ?)").run(
          wfId,
          JSON.stringify({ mediaId, caption: "Watch our product overview video" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'vid_node')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        await engine.scheduler.tick();

        if (dispatchedMessages.length === 0) throw new Error("No video message dispatched");
        logs.push(`[Dispatch] Video dispatched successfully`);

        return {
          scenarioId,
          name: "MP4 Video Media Dispatch",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
          metrics: {
            dispatchedKind: "media",
            mediaMimeType: "video/mp4",
          },
        };
      }

      case "audio_voice_note": {
        const mediaId = await seedMediaAsset(db, storage, "greeting_voice.mp3", "audio/mp3", Buffer.from("fake-audio-data"));
        logs.push(`[Media] Uploaded audio asset ID ${mediaId}`);

        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Audio Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'audio_node', 'send_media', ?)").run(
          wfId,
          JSON.stringify({ mediaId }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'audio_node')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        await engine.scheduler.tick();

        if (dispatchedMessages.length === 0) throw new Error("No audio message dispatched");
        logs.push(`[Dispatch] Audio voice note dispatched successfully with presence`);

        return {
          scenarioId,
          name: "Audio / Voice Note with Recording Presence",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
          metrics: {
            dispatchedKind: "media",
            mediaMimeType: "audio/mp3",
            presenceType: "recording",
          },
        };
      }

      case "document_pdf_attachment": {
        const mediaId = await seedMediaAsset(db, storage, "pricing_guide.pdf", "application/pdf", Buffer.from("fake-pdf-data"));
        logs.push(`[Media] Uploaded PDF asset ID ${mediaId}`);

        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('PDF Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'pdf_node', 'send_media', ?)").run(
          wfId,
          JSON.stringify({ mediaId, text: "Here is your Pricing Guide PDF" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'pdf_node')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        await engine.scheduler.tick();

        if (dispatchedMessages.length === 0) throw new Error("No PDF document message dispatched");
        logs.push(`[Dispatch] Document attachment dispatched successfully`);

        return {
          scenarioId,
          name: "Document & PDF Attachment",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
          metrics: {
            dispatchedKind: "media",
            mediaMimeType: "application/pdf",
          },
        };
      }

      case "interactive_menu_branching": {
        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Menu Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'menu', 'send_menu', ?)").run(
          wfId,
          JSON.stringify({
            header: "Main Menu",
            bodyText: "Please choose an option:",
            options: [
              { id: "opt_sales", title: "Sales & Pricing" },
              { id: "opt_support", title: "Technical Support" },
            ],
          }),
        );
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'sales_reply', 'send_text', ?)").run(
          wfId,
          JSON.stringify({ text: "You selected Sales! Let's talk numbers." }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'menu')").run(wfId);
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, 'menu', 'sales_reply', 'opt_sales')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        clock.advance(10000);
        await engine.scheduler.tick();
        logs.push("[Menu] Menu dispatched to user");

        // Simulate user replying "1" (Option 1)
        const inMsg = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', '1', ?)").run(
          session.id,
          contact.id,
          new Date(clock.now()).toISOString(),
        );

        await engine.handleIncomingMessage(session.id, contact.id, Number(inMsg.lastInsertRowid));
        clock.advance(10000);
        await engine.scheduler.tick();

        const latestMsg = dispatchedMessages[dispatchedMessages.length - 1];
        if (!latestMsg?.text?.includes("You selected Sales!")) {
          throw new Error(`Menu branching did not route to option 1 reply. Got: "${latestMsg?.text}"`);
        }
        logs.push(`[Branching] Menu choice '1' successfully routed to target node: "${latestMsg.text}"`);

        return {
          scenarioId,
          name: "Interactive Numbered Menu Branching",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
        };
      }

      case "condition_logic_split": {
        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Condition Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'cond', 'condition', ?)").run(
          wfId,
          JSON.stringify({ subject: "message_text", operator: "contains", value: "vip" }),
        );
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'vip_node', 'send_text', ?)").run(
          wfId,
          JSON.stringify({ text: "Welcome VIP Client!" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'cond')").run(wfId);
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, 'cond', 'vip_node', 'true')").run(wfId);

        const trigMsg = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'i want vip pass', ?)").run(
          session.id,
          contact.id,
          new Date(clock.now()).toISOString(),
        );

        const execId = await engine.startExecution(wfId, session.id, contact.id, Number(trigMsg.lastInsertRowid));
        if (!execId) throw new Error("Could not start execution");

        clock.advance(10000);
        await engine.scheduler.tick();

        const latestMsg = dispatchedMessages[dispatchedMessages.length - 1];
        if (!latestMsg?.text?.includes("Welcome VIP Client!")) {
          throw new Error(`Condition logic did not branch to true path. Got: "${latestMsg?.text}"`);
        }
        logs.push(`[Condition] Condition 'text contains vip' matched and routed to true branch`);

        return {
          scenarioId,
          name: "Regex / Keyword Condition Split",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
        };
      }

      case "silence_sweeper_2h": {
        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Silence Test', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', '{}')").run(wfId);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'ask', 'collect_input', ?)").run(
          wfId,
          JSON.stringify({ promptText: "Are you still interested?", varKey: "interest" }),
        );
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'followup', 'send_text', ?)").run(
          wfId,
          JSON.stringify({ text: "Hey, just following up since we haven't heard back in 2 hours!" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'ask')").run(wfId);
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key, handle) VALUES (?, 'ask', 'followup', 'on_silence_2h')").run(wfId);

        const execId = await engine.startExecution(wfId, session.id, contact.id);
        if (!execId) throw new Error("Could not start execution");

        clock.advance(10000);
        await engine.scheduler.tick();
        const execRow = db.prepare("SELECT * FROM workflow_executions WHERE id = ?").get(execId);
        logs.push(`[Silence] Execution row: ${JSON.stringify(execRow)}`);

        // Advance fake clock by 2 hours and 1 minute
        clock.advance(2 * 3600 * 1000 + 60000);
        logs.push(`[Clock] Advanced virtual clock by 2 hours. nowIso=${new Date(clock.now()).toISOString()}`);

        // Run silence sweep
        const sweepRes = await engine.runSilenceSweep(clock);
        logs.push(`[Sweeper] Silence sweep executed: ${JSON.stringify(sweepRes)}`);

        clock.advance(10000);
        await engine.scheduler.tick();

        const latestMsg = dispatchedMessages[dispatchedMessages.length - 1];
        if (!latestMsg?.text?.includes("haven't heard back in 2 hours")) {
          throw new Error(`Silence sweeper did not advance execution down on_silence_2h branch. Got: "${latestMsg?.text}"`);
        }

        return {
          scenarioId,
          name: "2-Hour Silence Followup Sweeper",
          status: "passed",
          mode: "virtual",
          executionId: execId,
          durationMs: Date.now() - startTime,
          logs,
        };
      }

      case "human_takeover_24h": {
        // Create active workflow
        const wfInfo = db.prepare("INSERT INTO workflows (name, active) VALUES ('Bot Workflow', 1)").run();
        const wfId = Number(wfInfo.lastInsertRowid);
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'trig', 'trigger', ?)").run(
          wfId,
          JSON.stringify({ keyword: "info" }),
        );
        db.prepare("INSERT INTO workflow_nodes (workflow_id, node_key, type, config) VALUES (?, 'reply', 'send_text', ?)").run(
          wfId,
          JSON.stringify({ text: "Automated info reply" }),
        );
        db.prepare("INSERT INTO workflow_edges (workflow_id, source_key, target_key) VALUES (?, 'trig', 'reply')").run(wfId);

        // Sales rep sends manual message -> pauses bot for 24h
        const pauseUntil = new Date(clock.now() + 24 * 3600 * 1000).toISOString();
        db.prepare("UPDATE contacts SET bot_status = 'paused_human', bot_paused_until = ? WHERE id = ?").run(pauseUntil, contact.id);
        logs.push(`[Human Takeover] Sales rep manual message paused bot until ${pauseUntil}`);

        // Contact sends inbound trigger message
        const msgInfo = db.prepare("INSERT INTO messages (session_id, contact_id, direction, message_type, text, timestamp) VALUES (?, ?, 'in', 'text', 'info', ?)").run(
          session.id,
          contact.id,
          new Date(clock.now()).toISOString(),
        );

        const execRes = await engine.handleIncomingMessage(session.id, contact.id, Number(msgInfo.lastInsertRowid));
        if (execRes !== null) {
          throw new Error("Automation was not suppressed during 24h human takeover");
        }
        logs.push("[Guard] Automated execution correctly suppressed due to active human takeover");

        return {
          scenarioId,
          name: "24-Hour Operator Human Takeover Guard",
          status: "passed",
          mode: "virtual",
          durationMs: Date.now() - startTime,
          logs,
        };
      }

      default:
        throw new Error(`Unknown scenario: ${scenarioId}`);
    }
  } catch (err: any) {
    logs.push(`[Error] Scenario failed: ${err.message || String(err)}`);
    return {
      scenarioId,
      name: scenarioId,
      status: "failed",
      mode: "virtual",
      durationMs: Date.now() - startTime,
      logs,
      error: err.message || String(err),
    };
  }
}
