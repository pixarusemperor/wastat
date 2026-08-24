# AGENTS.md — Agent Guidelines & Instructions for WaStat V2
<!-- Specification: https://agents.md/ -->

This file defines the operating instructions, architecture contracts, commands, quality gates, and deployment guardrails for AI coding agents operating on `pixarusemperor/wastat`.

---

## 🛠️ Essential Commands
- **Typecheck**: `npm run typecheck` (0 errors required across `@wastat/shared`, `@wastat/server`, `@wastat/web`)
- **Run Tests**: `npm test` (100% pass required before pushing)
- **Production Build**: `npm run build`
- **Dev Server**: `npm run dev`

---

## 🏗️ Architecture & Data Stack
- **Database**: Supabase PostgreSQL (`supabase/migrations/20260824000000_wastat_v2_schema.sql`). 19 tables in production.
- **Storage**: Cloudflare R2 (`packages/server/src/media.ts` via AWS S3 SDK, zero egress fees).
- **AI Intelligence**: Groq Llama 3.3 70B (`GROQ_API_KEY`) for DeskcommCRM Sales Learning Flywheel & Live Co-Pilot.
- **WhatsApp Web Companion**: Wasender API transport (`WASENDER_PAT`).
- **Frontend**: React 18 + Vite + React Flow (`packages/web/`).

---

## 🚦 Task Orchestration (Matt Pocock Style)
- Source of truth: `TASKS.md`.
- Always pick tasks labeled `READY_FOR_AGENT`.
- Maintain strict **tracer-bullet vertical slice isolation** so multiple sub-agents can work in parallel without merge conflicts.
- Always execute `npm run typecheck && npm test && npm run build` before marking any task `DONE`.

---

## 🛡️ Critical Anti-Ban & Business Rules
1. **Spintax & Variables**:
   - Interpolate `{{vars.x}}` and `{{contact.attr}}` first, then evaluate Spintax variations `{A|{B|C}}` using `parseSpintax` (`packages/shared/src/spintax.ts`).
2. **2-Hour Attribution Window & Silence Sweeper**:
   - When an execution enters `waiting_input`, set `silence_followup_at = now + 2h`.
   - Inbound replies within 2 hours advance down `on_reply` and clear the timer.
   - If 2 hours elapse without a response, the background poller (`engine.runSilenceSweep()`) triggers `on_silence_2h`.
3. **Human Takeover Guard**:
   - When a human sales representative sends a manual message from the Inbox or physical device, `bot_status` flips to `paused_human` and pauses automated workflows for 24 hours.
4. **Priority Preemption Queue**:
   - 1-on-1 customer chat messages (Priority 1) preempt outbound bulk group dispatches (Priority 2).
5. **Security & Secrets**:
   - Never log, commit, or echo API tokens, service keys, private keys, or credentials.

---

## 🚢 Deployment (Coolify) — MANDATORY RULES
Source of truth: https://github.com/pixarusemperor/coolify-deploy-playbook (vendored at `docs/coolify-deploy-playbook/AGENTS-RULES.md`).

This project auto-deploys to production on push to `main` via GitHub Actions → Coolify (app `wastat` at `https://wassflow.orizongroup.online`).

### Before Deploying
1. **Read the env contract first** (`.env.example`, server env reads). A required var missing in prod = 100% of requests return 500 while the container shows "healthy".
2. **Set ALL required env vars BEFORE the first deploy.**
3. **Never retry failed deploys blindly.** Diagnose from deployment/build logs first.
4. **Never push to the deploy branch with failing typecheck, lint, or tests.**

### While Deploying
5. **One deploy at a time** — the workflow concurrency group enforces this; never trigger concurrent manual API deploys while a workflow run is active.
6. **Poll to completion** — green means deployment status = `finished`, not merely triggered.

### Hard Limits — NEVER
7. No destructive system or volume pruning on shared infrastructure (`docker system prune -af`, `docker volume prune`).
8. No stopping, pausing, or deleting other apps; no reassigning other apps' domains.
9. No changing repo visibility without explicit user confirmation.
10. No logging or committing API tokens, private keys, or credentials.

### If Things Break
11. **Panel down ≠ rebuild.** Follow the recovery runbook in order: disk → database container (`coolify-db`) → panel container (`coolify`) → application.
12. **Document incidents** in `docs/DIAGNOSTIC-AND-FIX.md` — facts and timestamps, appended, never deleted.
