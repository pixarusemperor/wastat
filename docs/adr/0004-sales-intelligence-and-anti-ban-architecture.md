# ADR 0004: Sales Intelligence, Spintax Engine, and Human Takeover Guard

## Status
Accepted

## Context
As the platform scales from simple keyword auto-responders to an autonomous WhatsApp sales and marketing engine (synthesizing WaStat, DeskcommCRM, and PostManagerwa), four critical architectural requirements emerged:

1. **Anti-Ban Behavioral Protection**: Sending static, identical text strings to multiple contacts triggers WhatsApp spam filters. We need native Spintax `{Option A|Option B}` randomized variation across all outbound messages.
2. **Cumulative Lead Intelligence (Customer 360)**: Variables collected during workflow steps (`budget`, `intent`, `email`) must persist beyond the lifetime of a single workflow execution into `contact_attributes` so future workflows, A/B experiments, and sales reps can leverage the contact's historical profile.
3. **2-Hour Standardized Attribution & Silence Sweeper**: To ensure fair A/B testing, every presentation is evaluated over a fixed 2-hour window. If silent, a variant-tailored follow-up is triggered.
4. **Human Takeover Safety Guard**: When a human operator manually replies to a lead (via WhatsApp Web, phone, or live inbox), automated bots and scheduled delay timers must pause immediately for 24 hours.

## Decisions

### 1. Spintax Resolution Engine (`@wastat/shared`)
- All template strings pass through a nested-capable Spintax parser supporting `{a|b|c}` syntax with deterministic pseudo-random or random selection.
- Spintax runs prior to variable interpolation.

### 2. Persistent Contact Attributes & Tags (`packages/server/src/db/schema.sql`)
- Created `contact_attributes` (contact_id, key, value, updated_at) with `UNIQUE(contact_id, key)`.
- Created `contact_tags` (contact_id, tag, created_at).
- Enhanced `contacts` table with `funnel_phase`, `bot_status` (`active`, `paused_human`, `opted_out`), and `bot_paused_until`.

### 3. Silence Sweeper Background Worker
- Background scheduler polls for executions in `waiting_input` past `silence_followup_at` (2h) and executes the variant's `on_silence_2h` branch.
- Organic replies received before 2h cancel the timer immediately.

### 4. Human Takeover Protocol
- Operator manual messages in the Inbox set `bot_status = 'paused_human'` and `bot_paused_until = now + 24h`.
- The inbox provides a 1-click `Advance to Phase 2 🚀` button to immediately launch the closing sequence once objections are resolved.

## Consequences
- Zero spam fingerprinting across mass automated dispatches.
- Persistent lead memory enabling advanced condition branching.
- Conflict-free co-existence between automated bots and human sales agents.
### 5. DeskcommCRM-Inspired Sales Learning Flywheel & Approval Gate
- Mode 1 (Day 1): AI is toggled OFF; human sales reps converse via the Inbox Panel.
- Golden Dialogue Pairs: Interactions where a human answer successfully converts a lead to Phase 2 are captured into `golden_dialogues`.
- Groq Distillation: Periodically analyzes golden dialogue clusters to extract structured `knowledge_playbooks`.
- Human Approval Gate: Proposed playbooks require 1-click human approval before being enabled for AI Co-Pilot (suggested replies) or Full AI Autopilot.
