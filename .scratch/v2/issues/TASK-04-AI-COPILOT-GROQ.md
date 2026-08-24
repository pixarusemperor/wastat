# TASK-04: AI Sales Co-Pilot & Sales Learning Flywheel (Groq Llama 3.3 70B)

- **Track**: AI Intelligence & CRM
- **Status**: `READY_FOR_AGENT`
- **Blockers**: `NONE`
- **Isolation Seam**: `packages/server/src/ai/` and `packages/server/src/routes/ai.ts`

---

## 🎯 Objective
Implement the DeskcommCRM sales learning flywheel using Groq Llama 3.3 70B Versatile:
1. **Mode 1 (Golden Dialogue Harvesting)**: Automatically captures successful (Customer Objection $\rightarrow$ Human Response $\rightarrow$ Phase 2 Conversion) dialogue pairs.
2. **Mode 2 (Playbook Distillation)**: Background worker periodically distills repeated objections into approved `knowledge_playbooks`.
3. **Mode 3 (Human-Guided Co-Pilot)**: Real-time recommendation suggestions in the operator Inbox with 1-Click "Approve & Send", "Guide AI / Adjust Tone", or "Pick Alternative".

---

## 📦 Scope & Boundaries
- **Create**:
  - `packages/server/src/ai/groq.ts`: Groq API client with structured JSON outputs.
  - `packages/server/src/ai/flywheel.ts`: Dialogue harvesting and playbook extraction pipeline.
  - `packages/server/src/routes/ai.ts`: Fastify route plugin (`POST /api/ai/suggest`, `POST /api/ai/distill`, `GET /api/playbooks`).
- **Deterministic Mocking**:
  - Provide `packages/server/src/ai/__mocks__/groq.ts` returning fixture responses when `GROQ_API_KEY` is not present in test runner.

---

## 🧪 Verification & Acceptance Criteria
1. `npm test packages/server/src/ai/groq.test.ts` passes 100%.
2. Verify dialogue harvesting records into `golden_dialogues` table in Supabase.
3. Verify playbook distillation outputs structured trigger patterns and approved answers into `knowledge_playbooks`.
