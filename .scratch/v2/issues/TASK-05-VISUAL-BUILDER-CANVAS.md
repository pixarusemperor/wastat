# TASK-05: Visual Workflow Canvas & Live Edge Handles (React Flow)

- **Track**: Frontend Web
- **Status**: `READY_FOR_AGENT`
- **Blockers**: `NONE`
- **Isolation Seam**: `packages/web/src/WorkflowEditor.tsx`, `packages/web/src/graph.ts`, `packages/web/src/styles.css`

---

## 🎯 Objective
Complete visual workflow builder with React Flow dual-handle branching and Spintax preview:
1. **Dual Branch Handles**: Render `on_reply` (green) and `on_silence_2h` (amber) output connection handles on all question and input nodes.
2. **Spintax Live Inspector**: Interactive Spintax preview box that shows 5 randomized generated variations in real time.
3. **Milestone Node Drawer**: Config drawer to set milestone key, name, and conversion value.
4. **Random Jitter Delay Visualizer**: Configure min/max seconds slider with anti-ban safety indicator.

---

## 📦 Scope & Boundaries
- **Modify**:
  - `packages/web/src/WorkflowEditor.tsx` (Handle rendering & Milestone drawer)
  - `packages/web/src/graph.ts` (Graph serialization of dual handles)
  - `packages/web/src/styles.css` (Custom handle aesthetics)

---

## 🧪 Verification & Acceptance Criteria
1. `npm run typecheck --workspace=@wastat/web` passes with 0 errors.
2. `npm test --workspace=@wastat/web` passes all round-trip graph serialization tests.
3. `npm run build --workspace=@wastat/web` produces clean production assets.
