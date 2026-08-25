import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DATA_DIR = "/home/stevenjossu/.gemini/antigravity-cli/brain";
const MAIN_CONV_ID = "c36ddea7-945f-4f89-8821-b4d50c8b3451";

const SUBAGENTS = [
  { id: "5689936a-9215-4ef7-905e-353392430154", name: "clawflow_analysis", title: "Clawflow Architecture Analyst" },
  { id: "3b8b5c1a-4174-4b53-9d79-f534f5245c6b", name: "workflow_audit", title: "Workflow & API Auditor" },
  { id: "2f2705d7-6e83-4341-a822-e03e221065ea", name: "r2_media_generator", title: "Media Generator & R2 Uploader" },
];

const OUTPUT_DIR = join(process.cwd(), "docs", "transcripts");
const SUBAGENTS_OUTPUT_DIR = join(OUTPUT_DIR, "subagents");

function redactSensitiveData(text: string): string {
  if (!text) return "";
  return text
    .replace(/(?:Bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/(?:api_key["':\s]+)[a-f0-9]{32,64}/gi, 'api_key: "[REDACTED_API_KEY]"')
    .replace(/(?:apiKey["':\s]+)[a-f0-9]{32,64}/gi, 'apiKey: "[REDACTED_API_KEY]"')
    .replace(/(?:WASENDER_PAT=)[^\s\n]+/gi, "WASENDER_PAT=[REDACTED_PAT]")
    .replace(/(?:COOLIFY_TOKEN=)[^\s\n]+/gi, "COOLIFY_TOKEN=[REDACTED_TOKEN]")
    .replace(/(?:webhook_secret["':\s]+)[a-f0-9]{20,64}/gi, 'webhook_secret: "[REDACTED_SECRET]"');
}

export async function extractSessionTranscripts() {
  console.log(`[Transcript Extractor] Initializing transcript export...`);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(SUBAGENTS_OUTPUT_DIR, { recursive: true });

  // 1. Process Main Agent Transcript
  const mainLogPathFull = join(APP_DATA_DIR, MAIN_CONV_ID, ".system_generated", "logs", "transcript_full.jsonl");
  const mainLogPathCompact = join(APP_DATA_DIR, MAIN_CONV_ID, ".system_generated", "logs", "transcript.jsonl");

  const sourceLogPath = existsSync(mainLogPathFull) ? mainLogPathFull : mainLogPathCompact;
  if (!existsSync(sourceLogPath)) {
    throw new Error(`Main transcript log file not found at: ${sourceLogPath}`);
  }

  console.log(`[Transcript Extractor] Reading main transcript from: ${sourceLogPath}`);
  const rawLogContent = readFileSync(sourceLogPath, "utf8");
  const redactedLogContent = redactSensitiveData(rawLogContent);

  // Write raw JSONL copy
  const rawJsonlDest = join(OUTPUT_DIR, "session_full_transcript.jsonl");
  writeFileSync(rawJsonlDest, redactedLogContent, "utf8");
  console.log(`[Transcript Extractor] ✅ Wrote raw JSONL: ${rawJsonlDest}`);

  // Format into clean Markdown
  const lines = redactedLogContent.trim().split("\n");
  const mdSections: string[] = [];

  mdSections.push(`# WaStat V2 — Complete Session Chronological Transcript\n`);
  mdSections.push(`- **Conversation ID**: \`${MAIN_CONV_ID}\``);
  mdSections.push(`- **Extracted At**: ${new Date().toISOString()}`);
  mdSections.push(`- **Total Steps Processed**: ${lines.length}`);
  mdSections.push(`- **Production Host**: \`https://wassflow.orizongroup.online\`\n`);
  mdSections.push(`---\n`);

  let stepNum = 1;
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const step = JSON.parse(line);
      const timestamp = step.created_at ? new Date(step.created_at).toLocaleTimeString() : `Step ${stepNum}`;
      const type = step.type || step.source || "STEP";

      mdSections.push(`### 🔹 Step ${stepNum} — \`${type}\` (${timestamp})\n`);

      if (step.type === "USER_INPUT") {
        mdSections.push(`**👤 User Prompt / Directive**:\n`);
        mdSections.push(`\`\`\`markdown\n${step.content || ""}\n\`\`\`\n`);
      } else if (step.type === "PLANNER_RESPONSE") {
        if (step.thinking) {
          mdSections.push(`<details>\n<summary>💭 Agent Internal Reasoning (Chain of Thought)</summary>\n\n${step.thinking}\n\n</details>\n`);
        }
        if (step.content) {
          mdSections.push(`**🤖 Agent Explanation & Actions**:\n\n${step.content}\n`);
        }
        if (Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
          mdSections.push(`**🛠️ Tool Calls Executed**:\n`);
          for (const tc of step.tool_calls) {
            mdSections.push(`- **Tool**: \`${tc.name}\` — *${tc.arguments?.toolSummary || tc.arguments?.toolAction || tc.name}*`);
            mdSections.push(`\`\`\`json\n${JSON.stringify(tc.arguments, null, 2)}\n\`\`\`\n`);
          }
        }
      } else if (step.content) {
        mdSections.push(`**Output / Result**:\n`);
        const snippet = String(step.content).length > 2000 ? String(step.content).slice(0, 2000) + "\n... [truncated]" : String(step.content);
        mdSections.push(`\`\`\`\n${snippet}\n\`\`\`\n`);
      }

      mdSections.push(`\n---\n`);
      stepNum++;
    } catch {
      // Skip invalid JSON lines
    }
  }

  const formattedMdDest = join(OUTPUT_DIR, "session_formatted_transcript.md");
  writeFileSync(formattedMdDest, mdSections.join("\n"), "utf8");
  console.log(`[Transcript Extractor] ✅ Wrote formatted Markdown transcript: ${formattedMdDest}`);

  // 2. Extract Subagents Transcripts
  for (const sub of SUBAGENTS) {
    const subLogPathFull = join(APP_DATA_DIR, sub.id, ".system_generated", "logs", "transcript_full.jsonl");
    const subLogPathCompact = join(APP_DATA_DIR, sub.id, ".system_generated", "logs", "transcript.jsonl");
    const subSource = existsSync(subLogPathFull) ? subLogPathFull : subLogPathCompact;

    if (existsSync(subSource)) {
      console.log(`[Transcript Extractor] Processing subagent '${sub.name}' (${sub.id})...`);
      const subContent = redactSensitiveData(readFileSync(subSource, "utf8"));
      const subDest = join(SUBAGENTS_OUTPUT_DIR, `${sub.name}.jsonl`);
      writeFileSync(subDest, subContent, "utf8");
      console.log(`[Transcript Extractor] ✅ Wrote subagent transcript: ${subDest}`);
    }
  }

  // 3. Write Session Summary Document
  const summaryMd = `# WaStat V2 — Session Architecture & Milestone Summary

> **Conversation ID**: \`${MAIN_CONV_ID}\`  
> **Extraction Date**: ${new Date().toISOString()}  
> **Production App**: \`https://wassflow.orizongroup.online\`  
> **Live Branch**: \`main\`

---

## 🎯 1. Mission Accomplished
In this session, we engineered and verified the **Multi-Media Sales Automation Engine** for WaStat with **real physical WhatsApp delivery**, **direct Cloudflare R2 media hosting**, and **zero-downtime programmatic workflow creation**.

---

## 🌐 2. Live Environment & Sessions
- **Host Bot**: \`Safari\` (Session ID: \`105947\`, Phone: \`+237652474378\`, Webhook: \`https://wassflow.orizongroup.online/webhooks/wasender/105947\`)
- **Lead Sender**: \`Patrick Simo\` (Session ID: \`112691\`, Phone: \`+237676637853\`, Webhook: \`https://wassflow.orizongroup.online/webhooks/wasender/112691\`)
- **Cloudflare R2 Bucket**: \`pub-6f72df8c13ae4e02ab8b2c6671367a41.r2.dev\`

---

## 🛠️ 3. Solved Technical Breakthroughs
1. **Programmatic Workflow APIs**: \`POST /api/workflows/validate\` and \`POST /api/workflows/programmatic\` allow dynamic workflow creation via REST API without server redeployments.
2. **Scheduler Media Forwarding**: Fixed \`executeJob\` in \`engine.ts\` to forward \`mediaUrl\`, \`mediaType\`, \`mimeType\`, and \`filename\` to \`deps.sendMessage\`.
3. **URL Query Stripping & Safe Extension Routing**: Stripped query strings in \`wasender.ts\` and prioritized explicit \`mediaType\` over regex fallbacks (preventing images from being sent as PDFs).
4. **Anti-Echo Human Takeover Guard**: Fixed \`app.ts\` to distinguish bot-sent automated messages from manual sales rep physical device messages, preventing false 24h pauses.
5. **Programmatic Binary Media Generation**: Built \`generate-and-upload-r2.ts\` generating standalone PNG images, OGG audio voice notes, and MP4 video containers hosted in Cloudflare R2.

---

## 📡 4. Verified Live Multi-Media Execution Receipts
Trigger: Keyword \`"VIP2026"\` sent from **Patrick Simo** (\`+237676637853\`) $\\rightarrow$ **Safari** (\`+237652474378\`):

- 💬 **Step 1: Text Greeting** $\\rightarrow$ \`HTTP 200 OK\` (Message ID: \`74140370\`)
- 🖼️ **Step 2: PNG Image (R2 Hosted)** $\\rightarrow$ \`https://pub-6f72df8c13ae4e02ab8b2c6671367a41.r2.dev/safari-luxury-villa.png\` $\\rightarrow$ \`HTTP 200 OK\` (Message ID: \`74140406\`)
- 🎙️ **Step 3: OGG Voice Note (R2 Hosted)** $\\rightarrow$ \`https://pub-6f72df8c13ae4e02ab8b2c6671367a41.r2.dev/safari-welcome-audio.ogg\` $\\rightarrow$ \`HTTP 200 OK\` (Message ID: \`74140449\`)
- 🎥 **Step 4: MP4 Video Walkthrough (R2 Hosted)** $\\rightarrow$ \`https://pub-6f72df8c13ae4e02ab8b2c6671367a41.r2.dev/safari-luxury-tour.mp4\` $\\rightarrow$ \`HTTP 200 OK\` (Message ID: \`74140474\`)
- 📋 **Step 5: Numbered Options Menu** $\\rightarrow$ \`HTTP 200 OK\` (Message ID: \`74140517\`)
- 🏁 **Execution Status**: \`waiting_input\` (100% complete).

---

## 🧭 5. Next Tasks for Future Coding Agents
- \`TASK-03: WaStat Native Model Context Protocol (MCP) Server\`
- \`TASK-04: AI Sales Co-Pilot & Sales Learning Flywheel (Groq Llama 3.3)\`
- \`TASK-05: Visual Workflow Canvas & Live Edge Handles (React Flow)\`
- \`TASK-06: Product Catalog & Cartesian Group Broadcast Scheduler (Wasposter)\`
`;

  const summaryDest = join(OUTPUT_DIR, "session_summary.md");
  writeFileSync(summaryDest, summaryMd, "utf8");
  console.log(`[Transcript Extractor] ✅ Wrote session summary: ${summaryDest}`);

  console.log(`\n🎉 [Transcript Extractor] Extraction completed successfully in ${OUTPUT_DIR}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extractSessionTranscripts().catch(console.error);
}
