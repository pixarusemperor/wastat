# Domain Glossary — WaStat

## Core Concepts

### Experiment
A top-level testing container that balances incoming WhatsApp traffic across two or more distinct presentation methodologies (Variants) to determine which yields the highest conversion rate.

### Variant
A specific workflow implementation or presentation strategy (e.g. Video Walkthrough vs. Audio Voice Note) evaluated for delivery rate, 2-hour reply rate, and qualification rate.

### Attribution Window
A standardized time duration (default: 2 hours) starting when an outbound presentation is delivered. A customer response received within this window is attributed as an organic reply to that variant.

### Silence Sweep
A periodic background worker that identifies leads who have remained silent past their Attribution Window and executes a variant-tailored follow-up nudge.

### Human Takeover
An operational state triggered when a human sales representative sends a manual message from the Inbox Panel or physical phone. Automatically pauses automated workflow timers and AI responses for a configurable period (default: 24 hours).

### Funnel Phase
The macro progression stage of a lead in the sales process:
- `unassigned`: Initial state prior to workflow entry.
- `phase_1_active`: Multi-action hook and presentation sequence in progress.
- `phase_1_waiting_answer`: Waiting for customer to respond to the qualifying question.
- `objection_review`: Customer asked an unscripted question requiring AI or human response.
- `phase_1_qualified`: Customer successfully answered the qualifying criteria.
- `phase_2_active`: Closing, pricing proposal, payment, or VIP onboarding sequence in progress.
- `completed`: Workflow successfully finished.
- `lost`: Customer opted out or became permanently unresponsive.

### Spintax
Template syntax `{option_a|option_b|option_c}` that dynamically selects random wording per outbound send to prevent WhatsApp spam-filter hash detection.

### Companion Session
A WhatsApp Web instance linked through WasenderAPI (Baileys transport) acting as a multi-device companion to the primary WhatsApp account.
### Multi-Tier Silence Escalation
A configurable sequence of time-delayed follow-up messages triggered during prolonged customer inactivity (e.g. Tier 1 at 2 hours, Tier 2 at 24 hours). Each tier can evaluate custom condition filters (e.g. tag checks, budget thresholds) before sending.
### Sales Learning Flywheel
The continuous human-to-AI feedback loop adapted from DeskcommCRM:
1. **Human Baseline (Mode 1)**: Human sales agents resolve customer objections in the Inbox.
2. **Golden Dialogue Harvesting**: The system records successful (Customer Query → Human Response → Phase 2 Won) interactions in SQLite.
3. **Groq Distillation**: Groq analyzes high-converting dialogue pairs and extracts proposed Knowledge Playbooks.
4. **Human Approval Gate**: Business owners approve distilled answers before promoting them to AI Co-Pilot (Mode 2) or Full AI Autopilot (Mode 3).
### Priority Preemption Queue
A two-tier execution policy where 1-on-1 customer conversational replies (Priority 1) immediately preempt scheduled outbound group marketing dispatches (Priority 2), ensuring zero latency for warm closing leads while maintaining anti-ban safety intervals.
### Human-Guided AI Product Co-Pilot
A collaborative recommendation pattern where:
1. The AI queries the product catalog (SKUs, R2/Supabase media, pricing, descriptions).
2. The AI generates a suggested alternative product recommendation inside the operator's Inbox Panel.
3. The human operator can 1-click approve & send, guide the AI with steering feedback (e.g. 'pick a lower price tier'), or manually select another item from the catalog drawer.
### Private Notes
Internal team notes recorded inside a WhatsApp conversation thread that are visible only to human sales agents, managers, and AI assistants, and never delivered to the external customer.

### Supabase & Cloudflare R2 Infrastructure
The unified cloud foundation powering WaStat V2:
- **Supabase PostgreSQL & Realtime**: Single-source-of-truth database storing sessions, contacts, customer attributes, private notes, workflows, executions, and dialogue flywheel playbooks with sub-millisecond pub/sub updates to connected operator panels.
- **Cloudflare R2**: High-performance S3-compatible asset storage for WhatsApp product images, audio voice notes, video demos, and PDF catalogs with zero egress fees.

### WaStat MCP Server
A native Model Context Protocol (MCP) server that exposes WaStat operations (e.g. system summaries, stuck lead triage, operator replies, 1-click Phase 2 progression, product drops) to external AI workspaces such as Block Buzz and Antigravity CLI.
