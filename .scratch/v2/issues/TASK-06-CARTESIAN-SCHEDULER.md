# TASK-06: Cartesian Group Broadcast Scheduler & Priority Preemption Queue (Wasposter)

- **Track**: Marketing Automation
- **Status**: `READY_FOR_AGENT`
- **Blockers**: `NONE`
- **Isolation Seam**: `packages/server/src/scheduler.ts` and `packages/server/src/routes/broadcasts.ts`

---

## 🎯 Objective
Build a multi-product Cartesian group broadcast scheduler pairing product catalog items (SKUs, Cloudflare R2 media, copy) across targeted WhatsApp groups with priority preemption (Priority 1 1-on-1 customer replies take precedence over Priority 2 batch broadcasts).

---

## 📦 Scope & Boundaries
- **Create / Modify**:
  - `packages/server/src/products.ts`: Product catalog repository linked to Cloudflare R2 media assets.
  - `packages/server/src/broadcast.ts`: Cartesian matrix generator pairing products $\times$ group JIDs.
  - `packages/server/src/scheduler.ts`: Preemption queue executing Priority 1 before Priority 2.
  - `packages/server/src/routes/broadcasts.ts`: Route plugin for broadcast management.

---

## 🧪 Verification & Acceptance Criteria
1. Priority queue unit tests verifying that 1-on-1 customer replies execute before queued group broadcast jobs.
2. Anti-ban rate limits respected between successive group dispatches.
