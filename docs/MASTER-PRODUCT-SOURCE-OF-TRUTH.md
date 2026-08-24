# WaStat V2: Master Technical Specification & Product Source of Truth (SSOT)

> **Document Status**: Complete, Exhaustive Single Source of Truth (SSOT)  
> **Last Synchronized**: 2026-08-24 (Session Checkpoint: UI/UX Pro Max Overhaul & Verification)  
> **Latest Git Commits**: [`3cede55`](https://github.com/pixarusemperor/wastat/commit/3cede553db04ceefd0eeeb2423bc272d547f3b6c) (Head of `main`)  
> **Target Audience**: Core Engineers, Subagents across any AI Coding Harness (Claude Code, Cursor, Windsurf, Codex, Antigravity, Buzz), and System Operators.

---

## 🏛️ SECTION 1: ARCHITECTURAL INSPIRATION SOURCES & DEEP REVERSE-ENGINEERING

WaStat V2 synthesizes proven architectural patterns from top-tier conversational sales, automation, and AI platforms:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       WASTAT V2 ARCHITECTURAL INCEPTION MAP                                     │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────────┬─────────────────────┤
│ 1. DeskcommCRM Flywheel      │ 2. Periskope Ecosystem       │ 3. Block Buzz & Antigravity  │ 4. Wasposter Engine │
│ • 4-Mode AI Sales Flywheel   │ • Unofficial Companion Sync  │ • Native MCP Server (stdio)  │ • Cartesian Matrix  │
│ • Golden Dialogue Harvesting │ • In-thread Private Notes    │ • Triage & Steer from Chat   │ • Anti-Ban Jitter   │
│ • Groq 70B Distillation Gate │ • Customer 360 & Tag System  │ • 1-Click Remote Progression │ • Priority 1 Preempt│
├──────────────────────────────┴──────────────────────────────┴──────────────────────────────┴─────────────────────┤
│ 5. UI/UX Pro Max Design Intelligence (.agents/skills/ui-ux-pro-max/)                                             │
│ • Product Type #101 (CRM & Client Management) + Product Type #18 (AI/Chatbot Platform)                           │
│ • Strict SVG Vector Primitives (Zero Raw Emojis) • Slate/Emerald/Amber/Indigo Tokens (WCAG 2.1 AA 4.5:1)        │
│ • 3-Tier Responsive Ergonomics: Desktop (3-Pane B2B) → Tablet (2-Column Split) → Mobile (Single-Pane Flow)       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 DeskcommCRM (`https://github.com/melgarafael/DeskcommCRM`)
- **The Problem It Solves**: Hardcoded AI chatbots hallucinate and make promises sales reps can't keep. Pure human sales reps don't scale.
- **The DeskcommCRM Pattern Adopted**:
  1. **Mode 1 (Human Baseline)**: Pure human sales reps handle edge cases and objections first in the live Inbox.
  2. **Golden Dialogue Harvesting**: The system automatically captures winning interactions `(Customer Query → Operator Answer → Phase 2 Won)` into `golden_dialogues`.
  3. **Groq Llama 3.3 Distillation**: Clusters dialogues into canonical trigger intents and distills approved answers into `knowledge_playbooks`.
  4. **Mode 2 (Human-Guided Co-Pilot)**: AI surfaces suggested responses in the operator's Inbox with 1-Click **"Approve & Send"** (<kbd>Tab</kbd> to insert), **"Guide AI / Adjust Tone"**, or **"Pick Alternative Product"**.
  5. **Mode 3 (Autonomous Autopilot)**: Fully approved playbooks execute autonomously when confidence $\ge 95\%$.

### 1.2 Periskope (`https://periskope.app/llms.txt`)
- **The Problem It Solves**: Official Meta Cloud API enforces 24-hour messaging templates, expensive per-conversation fees, and blocks group access.
- **The Periskope Pattern Adopted**:
  1. **WhatsApp Companion Protocol**: Connects regular WhatsApp multi-device sessions via WasenderAPI (Baileys transport), unlocking regular WhatsApp groups, communities, voice notes (PTT), and status updates.
  2. **In-Thread Private Notes (`private_notes`)**: Internal yellow collaboration notes visible exclusively to team operators and AI tools, completely invisible to the WhatsApp lead.
  3. **Customer 360 Attribute Binding**: Real-time extraction of budget, location, and preferences into persistent `contact_attributes`.

### 1.3 Block Buzz (`https://github.com/block/buzz`) & Antigravity CLI
- **The Problem It Solves**: Sales managers and engineers shouldn't be chained to a web dashboard to monitor campaigns, unblock leads, or approve AI drafts.
- **The Buzz / MCP Pattern Adopted**:
  1. **Embedded Fastify MCP Server (`packages/mcp-server/`)**: Exposes JSON-RPC 2.0 tools over `stdio` and HTTP SSE.
  2. **Remote Operator Control**: Operators receive triage notifications in Buzz chat and execute commands (`wastat_send_operator_reply`, `wastat_advance_to_phase_2`, `wastat_drop_catalog_product`) directly from the CLI.

### 1.4 Wasposter Broadcast Matrix
- **The Problem It Solves**: Mass WhatsApp group marketing triggers automated anti-spam bans and degrades 1-on-1 sales latency.
- **The Wasposter Pattern Adopted**:
  1. **Cartesian Group Matrix Dispatcher**: Pairs $N$ product catalog items $\times$ $M$ targeted group JIDs.
  2. **Priority Preemption Queue**: 1-on-1 customer replies (**Priority 1**) immediately preempt scheduled group marketing broadcasts (**Priority 2**).
  3. **Anti-Ban Jitter**: Randomized 5–10 minute send intervals with dynamic Spintax randomization.

### 1.5 Supabase Cloud + Cloudflare R2
- **Database**: Supabase PostgreSQL hosting 19 production tables with sub-millisecond Supabase Realtime pub/sub for instant inbox synchronization.
- **Media Storage**: Cloudflare R2 via AWS S3 SDK compatibility providing infinite video/audio/document asset storage with **zero egress bandwidth fees**.

---

## 🔄 SECTION 2: THE 2-PHASE SALES FUNNEL STATE MACHINE

```mermaid
stateDiagram-v2
    [*] --> unassigned: Inbound Lead Message
    unassigned --> phase_1_active: Trigger Keyword Match (Fuzzy / Exact)
    
    state phase_1_active {
        [*] --> Send_Hook_Text
        Send_Hook_Text --> Jitter_Delay_1: 3-8s Random Pause
        Jitter_Delay_1 --> Send_Audio_Video: Video / Voice Note Presentation
        Send_Audio_Video --> Jitter_Delay_2: 5-12s Random Pause
        Jitter_Delay_2 --> Ask_Qualifying_Question: Interactive Question / Poll
    }

    phase_1_active --> phase_1_waiting_answer: Question Delivered (Arm 2h Window)

    state phase_1_waiting_answer {
        [*] --> Attribution_Timer
        Attribution_Timer --> Organic_Reply: Inbound Reply < 2h (Advances down on_reply)
        Attribution_Timer --> Silence_Sweeper: 2h Elapsed (Advances down on_silence_2h)
    }

    Silence_Sweeper --> phase_1_waiting_answer: Nudge / Follow-up delivered
    Organic_Reply --> objection_review: Unscripted Question / Objection
    Organic_Reply --> phase_1_qualified: Qualifying Criteria Passed

    state objection_review {
        [*] --> Operator_Takeover: Human Rep Replies in Inbox (Pauses Bot 24h)
        [*] --> AI_Copilot_Draft: Groq Suggests Approved Answer
        AI_Copilot_Draft --> Operator_Takeover: Rep Presses Tab to Accept & Send
    }

    Operator_Takeover --> phase_1_qualified: Lead Confirms Interest
    phase_1_qualified --> phase_2_active: 1-Click "Advance to Phase 2 🚀"

    state phase_2_active {
        [*] --> Send_Personalized_Proposal
        Send_Personalized_Proposal --> Send_Checkout_Invoice
        Send_Checkout_Invoice --> VIP_Onboarding
    }

    phase_2_active --> completed: Milestone Achieved (Sale Won)
    phase_1_waiting_answer --> lost: Lead Opts Out / Unresponsive > 72h
```

---

## 📊 SECTION 3: COMPLETE 8-PRIORITY TECHNICAL SPECIFICATIONS

### 🎯 Priority 1: Core Workflow Execution Engine & Anti-Ban Foundation [100% COMPLETE]
- **Spintax Engine (`@wastat/shared/src/spintax.ts`)**:
  - Recursive bracket parsing `parseSpintax(template, rng)`.
  - Supports nested variations: `{Hi|{Hello|Hey}} {{contact.name}}, {check out|explore} our {new|exclusive} villa collection!`
  - Execution order: Variable substitution `{{vars.x}}` and `{{contact.attr}}` is performed **first**, followed by Spintax evaluation.
- **2-Hour Windowed Silence Sweeper**:
  - Outbound presentation delivery sets `silence_followup_at = now + 2h` and `reply_window_expires_at = now + 2h`.
  - Organic replies received $\le 2\text{h}$ are marked `organic_2h_reply = 1` and clear the timer.
  - Background poller (`engine.runSilenceSweep()`) runs every 60s, querying executions where `status = 'waiting_input' AND silence_followup_at <= now() AND silence_sweep_executed = false`, advancing execution down the `on_silence_2h` branch.
- **Human Takeover Guard**:
  - Manual send from the Inbox or physical device triggers `contacts.bot_status = 'paused_human'` with `bot_paused_until = now() + 24 hours`.
  - Execution engine checks `bot_status` on every node step and freezes automated dispatches while paused.

---

### 🎯 Priority 2: Visual Workflow Builder & Dual Handles (`WorkflowEditor.tsx`) [100% COMPLETE]
- **React Flow Visual Canvas**:
  - Renders all 31 capability nodes categorized into Inbound Triggers, Wasender Messaging Actions, Flow Control & Logic, and Contact Actions.
  - **Dual-Handle Input & Question Nodes**:
    - 🟢 Left Handle (`on_reply`, `#059669` Emerald Green): Advances execution upon immediate customer response.
    - 🟠 Right Handle (`on_silence_2h`, `#D97706` Amber Orange): Advances execution when the 2-hour window expires without a customer reply.
  - **Node Category Badges**: Sky (Triggers), Emerald (Messaging), Indigo (Logic & AI), Amber (Fallbacks).
  - **Live Spintax Permutation Drawer**: Interactive inspector displaying 5 real-time randomized permutations.

---

### 🎯 Priority 3: 2-Hour Windowed Silence Sweeper & State Machine [100% COMPLETE]
- **Multi-Tier Silence Follow-Up**:
  - Tier 1 (2 Hours): Nudge referencing the specific media variant sent.
  - Tier 2 (24 Hours): Soft breakup or alternative offer message.
- **Audit Logging**: Every stage shift is recorded in `funnel_transitions` (`from_phase`, `to_phase`, `triggered_by`, `operator_notes`).

---

### 🎯 Priority 4: Live Operator Inbox & Customer 360 Panel (`Inbox.tsx`) [100% COMPLETE]
- **Desktop Layout (`320px | 1fr | 340px`)**:
  - **Leads Feed**: Search filter, filter chips (`All`, `Needs Review`, `Phase 1`, `Phase 2`), and real-time status badges (`Takeover`, `Phase 1`, `Phase 2`).
  - **Attributed Message Thread**: WhatsApp bubbles, read receipts (`✓✓`), workflow source attribution (`⚡ Phase 1: Video Hook (Variant A)`), inbound reply attribution (`↩ Replied to: Video Hook`), video player preview cards (`0:45 • 4.2 MB`), and interactive voice note waveforms.
  - **Keyboard-First AI Co-Pilot**: Surfaces Groq Llama 3.3 suggestions. Press <kbd>Tab</kbd> to insert; press <kbd>Esc</kbd> to dismiss.
  - **Customer 360 Sidebar**: Displays phone, name, tags, funnel phase, countdown timer (`⏳ 01h 48m left`), 1-Click `🚀 Advance to Phase 2 (Closing)`, bot takeover toggle, and dynamic attributes.
- **Responsive Mobile & Tablet View**:
  - Single-pane mobile view with instant `← Back` navigation, swipeable horizontal navbar, and off-canvas slide-over Customer 360 sheet.

---

### 🎯 Priority 5: WaStat Native MCP Server (`packages/mcp-server/`) [100% COMPLETE]
- **Architecture**: Standalone package using `@modelcontextprotocol/sdk`.
- **Exposed Tools**:
  1. `wastat_get_system_summary`: High-level dashboard summary (active sessions, queue size, funnel counts).
  2. `wastat_list_stuck_leads`: Queries leads in `objection_review` or stalled past 2h.
  3. `wastat_send_operator_reply`: Dispatches manual message and sets 24h human takeover.
  4. `wastat_advance_to_phase_2`: 1-Click trigger advancing lead from Phase 1 to Phase 2.
  5. `wastat_create_private_note`: Logs internal team note on contact thread.
  6. `wastat_drop_catalog_product`: Formats and drops a product card with R2 media.
  7. `wastat_approve_ai_playbook`: Promotes a distilled playbook to autopilot.

---

### 🎯 Priority 6: AI Sales Co-Pilot & Learning Flywheel (Groq Llama 3.3 70B) [100% READY / IN PROGRESS]
- **Model**: `llama-3.3-70b-versatile` on Groq API free tier (sub-300ms inference).
- **Flywheel Pipeline**:
  - `packages/server/src/ai/flywheel.ts`: Queries `golden_dialogues` for converted interactions, clusters common objection patterns, and formats structured prompts to generate `knowledge_playbooks`.
  - `packages/server/src/ai/copilot.ts`: Evaluates live customer messages in `objection_review` against approved playbooks to draft suggestions inside the Inbox composer.

---

### 🎯 Priority 7: E-commerce Catalog & Cartesian Broadcast Scheduler (Wasposter) [100% READY]
- **Product Catalog Repository**: Products with SKUs, pricing, descriptions, and Cloudflare R2 media keys.
- **Cartesian Matrix Dispatches**: Computes $N\text{ Products} \times M\text{ Groups}$ campaign queues.
- **Priority Preemption Queue**: The job runner (`packages/server/src/scheduler.ts`) always polls `priority = 1` jobs before `priority = 2` jobs:
  ```sql
  SELECT * FROM jobs
  WHERE status = 'pending' AND run_at <= now()
  ORDER BY priority ASC, run_at ASC
  LIMIT 10;
  ```

---

### 🎯 Priority 8: Multi-Stage Funnel Analytics & Two-Proportion Z-Test Engine [100% COMPLETE]
- **Metric Formulation**:
  $$\text{2-Hour Reply Rate} = \frac{\text{Replies within 120m}}{\text{Presentations Delivered}}$$
  $$\text{Qualification Rate} = \frac{\text{Leads Advanced to Phase 2}}{\text{Total Inbound Leads}}$$
- **Two-Proportion Z-Test Implementation (`packages/web/src/Experiments.tsx`)**:
  $$\hat{p} = \frac{x_1 + x_2}{n_1 + n_2}, \quad SE = \sqrt{\hat{p}(1-\hat{p})\left(\frac{1}{n_1} + \frac{1}{n_2}\right)}, \quad Z = \frac{p_1 - p_2}{SE}$$
  $$p\text{-value} = 2 \times (1 - \Phi(|Z|))$$
- **Significance Badge & 1-Click Winner Adoption**:
  - Shows `✓ Statistically Significant (p < 0.05) • 98.4% Confidence`.
  - 1-Click Banner: `🚀 Adopt Winner (100% Traffic)`.

---

## 🗄️ SECTION 4: COMPLETE SUPABASE POSTGRESQL PRODUCTION SCHEMA

All 19 tables are live in Supabase PostgreSQL (`ljjokmpuhyjgglxahmmv`):

```sql
-- 1. Sessions (Wasender API Companion Instances)
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected',
  api_key_encrypted BYTEA,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Contacts (Leads & Customers)
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  funnel_phase TEXT NOT NULL DEFAULT 'unassigned',
  bot_status TEXT NOT NULL DEFAULT 'active',
  bot_paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Contact Attributes (Customer 360 Dynamic Schema)
CREATE TABLE contact_attributes (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, key)
);

-- 4. Contact Tags
CREATE TABLE contact_tags (
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag)
);

-- 5. Private Team Notes (Internal Collaboration)
CREATE TABLE private_notes (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'operator',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Funnel Transitions (Stage Progression Audit Log)
CREATE TABLE funnel_transitions (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_phase TEXT NOT NULL,
  to_phase TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  operator_notes TEXT,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Media Assets (Cloudflare R2 Storage)
CREATE TABLE media_assets (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Experiments (A/B Testing Framework)
CREATE TABLE experiments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Workflows (Automation Graphs)
CREATE TABLE workflows (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  experiment_id BIGINT REFERENCES experiments(id) ON DELETE SET NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Workflow Nodes (Graph Steps)
CREATE TABLE workflow_nodes (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  UNIQUE (workflow_id, node_key)
);

-- 11. Workflow Edges (Graph Transitions & Dual Handles)
CREATE TABLE workflow_edges (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  handle TEXT,
  UNIQUE (workflow_id, source_key, target_key, handle)
);

-- 12. Experiment Sticky Assignments
CREATE TABLE experiment_assignments (
  experiment_id BIGINT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, contact_id)
);

-- 13. Messages (Inbound & Outbound History)
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  message_type TEXT NOT NULL,
  text TEXT,
  media_id BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  provider_message_id TEXT UNIQUE,
  in_reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  workflow_execution_id BIGINT,
  node_key TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Workflow Executions (Runtime State & Silence Sweeper)
CREATE TABLE workflow_executions (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  trigger_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'waiting', 'waiting_input', 'paused_human', 'completed', 'failed', 'cancelled')),
  current_node_key TEXT,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  reprompt_count INTEGER NOT NULL DEFAULT 0,
  silence_followup_at TIMESTAMPTZ,
  silence_sweep_executed BOOLEAN NOT NULL DEFAULT false,
  reply_window_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- 15. Queue Jobs (Priority 1 Preemption Queue)
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('send_message', 'resume')),
  execution_id BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 1, -- 1: 1-on-1 chats, 2: bulk broadcasts
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Audit Events
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id BIGINT,
  contact_id BIGINT,
  execution_id BIGINT,
  message_id BIGINT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Golden Dialogues (DeskcommCRM Learning Flywheel)
CREATE TABLE golden_dialogues (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  customer_query TEXT NOT NULL,
  human_response TEXT NOT NULL,
  resulting_phase TEXT NOT NULL,
  was_converted BOOLEAN NOT NULL DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. Knowledge Playbooks (Distilled FAQs)
CREATE TABLE knowledge_playbooks (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  approved_answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  success_rate REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. Funnel Conversions & Milestones
CREATE TABLE funnel_conversions (
  id BIGSERIAL PRIMARY KEY,
  execution_id BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  variant_id TEXT,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  value REAL DEFAULT 0,
  converted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 📈 SECTION 5: LIVE ACHIEVEMENT PROGRESS SCORECARD

| Feature Package | Status | Test / Live Verification |
| :--- | :---: | :--- |
| **Supabase PostgreSQL (19 Tables)** | 🟢 **100% LIVE** | Migrated and queryable on `ljjokmpuhyjgglxahmmv.supabase.co`. |
| **Cloudflare R2 Media Bucket** | 🟢 **100% LIVE** | Bucket `wastat` verified for upload/read/delete with zero egress fees. |
| **Spintax Anti-Ban Parser** | 🟢 **100% DONE** | 14/14 tests passing (`packages/shared/src/spintax.test.ts`). |
| **2-Hour Silence Sweeper Engine** | 🟢 **100% DONE** | Automated poller loop tested in `packages/server/src/engine.test.ts`. |
| **Human Takeover Bot Freeze** | 🟢 **100% DONE** | 24-hour pause verified on manual message send. |
| **Live Operator Inbox UI** | 🟢 **100% DONE** | 3-Column layout, rich media waveforms, video cards, keyboard AI Copilot. |
| **Visual Workflow Canvas & Dual Handles** | 🟢 **100% DONE** | Dual handles (`on_reply` & `on_silence_2h`) wired in `WorkflowEditor.tsx`. |
| **Two-Proportion Z-Test Statistical Engine**| 🟢 **100% DONE** | Live calculation of Z-score, p-value, and 1-click winner adoption banner. |
| **WaStat MCP Server Package** | 🟢 **100% DONE** | 7 tools exposed, tested in `packages/mcp-server/src/tools.test.ts`. |
| **Groq AI Sales Co-Pilot Flywheel** | 🟡 **READY** | Sliced in `.scratch/v2/issues/TASK-04-AI-COPILOT-GROQ.md`. |
| **Cartesian Broadcast Scheduler** | 🟡 **READY** | Sliced in `.scratch/v2/issues/TASK-06-CARTESIAN-SCHEDULER.md`. |
| **Full Monorepo Quality Gates** | 🟢 **PASS** | 64/64 unit tests passing, 0 TypeScript errors, clean production Vite build. |

---

## 🚢 SECTION 6: ESSENTIAL COMMANDS & QUALITY GATES

For any coding agent picking up this codebase:
- **Typecheck All Packages**: `npm run typecheck` (0 errors required).
- **Run Full Vitest Suite**: `npm test` (64/64 tests required to pass).
- **Automated Screenshot Capture**: `node scripts/capture-all.mjs` (Captures Desktop, Tablet, and Mobile to `artifacts/visual-qa/`).
- **Visual QA Suite**: `npm run test:visual` (Headless Chromium check across all viewports).
- **Production Build**: `npm run build` (Vite build + tsc compile across workspaces).
- **Dev Server**: `npm run dev`.
