# WaStat V2 — Universal Agent Handoff Document

This document provides complete state and context for any AI agent or human engineer continuing work on WaStat V2 across any coding harness (Claude Code, Cursor, Windsurf, Codex, Block Buzz, Antigravity).

---

## 1. Project Identity & Purpose
WaStat V2 is a **high-volume WhatsApp Sales Automation, Sales Intelligence, and Anti-Ban A/B Testing platform** designed to maximize conversion rates across a 2-phase sales funnel:
- **Phase 1**: Inbound Hook $\rightarrow$ Multi-Action Presentation (Video / Audio Voice Note / Text) $\rightarrow$ Qualifying Question $\rightarrow$ Objection Resolution $\rightarrow$ Qualification.
- **Phase 2**: 1-Click Closing, Personalized Pricing Proposal, Payment, and VIP Onboarding.

---

## 2. Infrastructure & Cloud Verification Status
- **Supabase Cloud Database**:  **100% Live & Verified**
  - Project Reference: `ljjokmpuhyjgglxahmmv`
  - All 19 production tables migrated and queryable (`contacts`, `contact_attributes`, `contact_tags`, `private_notes`, `funnel_transitions`, `sessions`, `messages`, `media_assets`, `experiments`, `workflows`, `workflow_nodes`, `workflow_edges`, `experiment_assignments`, `workflow_executions`, `jobs`, `events`, `golden_dialogues`, `knowledge_playbooks`, `funnel_conversions`).
- **Cloudflare R2 Media Storage**:  **100% Live & Verified**
  - Bucket: `wastat` (S3-compatible, zero egress fees for product videos, voice notes, catalogs).
- **Core Engine & Anti-Ban**:  **100% Passing Tests (45 Server, 14 Shared, 3 Web)**
  - Nested Spintax parser `{A|{B|C}}` with deterministic/random seed support.
  - 2-Hour windowed silence sweeper advancing down `on_silence_2h` branch.
  - Human takeover freeze (pauses bot for 24h on manual representative reply).
  - Customer 360 dynamic attribute capture and micro-milestone tracking.

---

## 3. Parallel Task Registry (Matt Pocock System)
Tasks are mapped in `TASKS.md`. The following tasks are in `READY_FOR_AGENT` state and can be worked on in parallel:

| Task ID | Component / Track | Scope & Files | Verification Command |
| :--- | :--- | :--- | :--- |
| **`TASK-03`** | **WaStat MCP Server** | Create `packages/mcp-server/` with `@modelcontextprotocol/sdk` exposing tools (`system_summary`, `list_stuck_leads`, `send_operator_reply`, `advance_phase`, `create_note`) for Block Buzz and Antigravity CLI. | `npm test --workspace=@wastat/mcp-server` |
| **`TASK-04`** | **AI Sales Co-Pilot (Groq)** | Implement DeskcommCRM learning flywheel in `packages/server/src/ai/` using Groq Llama 3.3 70B (Harvest golden dialogues $\rightarrow$ distill playbooks $\rightarrow$ live inbox suggestions). | `npm test --workspace=@wastat/server` |
| **`TASK-05`** | **Visual Workflow Builder Canvas** | Polish `packages/web/src/WorkflowEditor.tsx` with React Flow dual-handle visual edges (`on_reply` vs `on_silence_2h`), Spintax live variation preview, and Milestone node drawer. | `npm test --workspace=@wastat/web` |
| **`TASK-06`** | **Cartesian Broadcast Scheduler** | Implement multi-product matrix dispatcher pairing catalog items across WhatsApp groups with Priority 1 preemptive queue over broadcasts. | `npm test --workspace=@wastat/server` |

---

## 4. Suggested Skills & Reference Docs
- **Agent Skills**: `supabase`, `cloudflare`, `wrangler`, `agents-sdk`, `source-driven-development`, `tdd`.
- **Reference Docs**:
  - `docs/ARCHITECTURE.md` (Master system architecture)
  - `CONTEXT.md` (Domain glossary & ubiquitous language)
  - `docs/adr/0001` through `0005` (Architectural Decision Records)
  - `AGENTS.md` (Coolify deployment rules and quality gates)
