# A/B Testing Architecture — Design Decision

> Status: **DECISION NEEDED** · Author: Buffy (Codebuff) · Date: 2026-08-26
> Purpose: nail down *how* A/B variants work end-to-end before any code is written.
> Grounded in: `MASTER-PRODUCT-SOURCE-OF-TRUTH.md`, `packages/server/src/engine.ts`,
> `packages/server/src/api.ts`, `packages/web/src/Experiments.tsx`,
> `packages/web/src/WorkflowEditor.tsx`, `packages/shared/src/types.ts`,
> `packages/server/src/db/supabase-schema.sql`.

---

## 1. Agreed target behavior

From our conversation, the system must do this:

1. **One trigger, defined once.** Example: an inbound WhatsApp message containing a
   keyword (a customer arriving from a Facebook ad and typing "price").
2. **N "presentations" (variants)** — different message chains that run after that same
   trigger, to learn which one drives the most response.
3. **Distribution**: default **balanced** (every variant tested fairly/equitably);
   optionally **per-variant percentages** (e.g. A=70% / B=30%).
4. **Sticky** per contact — a contact who enters stays on their variant, so the
   measurement is clean.
5. **Metric (v1)**: **reply rate** per variant, with a statistical winner (p < 0.05).
   More metrics (funnel, qualified, closed) come later.
6. **Act / de-activate variants** from the statistics (pause a loser, adopt a winner).

---

## 2. Current state (what actually exists today)

There are **two half-built A/B mechanisms**, and neither is fully wired:

### Mechanism 1 — Experiment-level (the "Experiments" page)

- `experiments` → `workflows.experiment_id` → each **workflow is a variant** →
  `experiment_assignments (experiment_id, contact_id, workflow_id)` = sticky split.
- Routing in `engine.handleIncomingMessage`: an inbound message matches a workflow's
  **own trigger node**, then the contact is assigned to the least-loaded variant and
  that *workflow* runs.
- Stats exist: `GET /api/experiments/:id/stats` returns per-variant
  `assigned / messaged / replied / replyRate`, plus a z-test in the UI.
- **Gaps vs. target**: each variant has its **own trigger** (not shared); split is
  **balanced-only** (no per-variant %); "Adopt winner" only `alert()`s and does nothing.

### Mechanism 2 — the `split_test` node (dead in the engine)

- The editor already ships an **"A/B Split Test"** node: `variants: [{ id, name, weight }]`,
  weight sliders, and one dynamic handle per variant (`WorkflowEditor.tsx`).
- `SplitTestVariant { id, name, weight }` exists in `packages/shared/src/types.ts`.
- **The engine has no `case "split_test"`** — if execution reaches it, it silently
  completes. This node is exactly the shape described, but it does nothing.

So: your mental model ("one trigger → weighted split into presentations") matches
**Mechanism 2**, but the measurement (reply rate + z-test) only exists in **Mechanism 1**.

### Metric bugs to fix regardless of which design wins

1. **Reply-rate denominator is inconsistent.**
   - `stats` endpoint: `replyRate = replied / assigned`.
   - UI z-test: uses `replied / messaged`.
   - PRD §33: `Reply Rate = Replies within 120m / Presentations Delivered` (= `replied / messaged`).
   → Canonical should be **`replied / messaged`** (presentations actually delivered),
   with `assigned` shown separately. `assigned` ≠ `messaged` when a contact is assigned
   but the first message hasn't gone out yet.
2. **"Adopt winner" is cosmetic.** No traffic is shifted, no loser paused.
3. **No per-variant activation state** (only workflow-level `active`). Can't pause a
   single variant mid-test.

---

## 3. Candidate architectures

Three ways to satisfy "one trigger, N weighted presentations, reply-rate per variant".

---

### Option A — `split_test` node inside one workflow

**Shape:** one workflow = `keyword trigger → split_test node → N presentation branches`.
Each branch is a chain of nodes on the same canvas.

- **Data model:** reuse `workflow_nodes` (`type='split_test'`, `config.variants`).
  Add `variant_id TEXT` to `workflow_executions` (which branch this execution took).
  Add a sticky table `split_assignments (workflow_id, contact_id, variant_id)`.
- **Distribution:** when execution hits `split_test`, pick a branch by weight
  (default equal) using the injectable `rng`; if the contact already has a sticky
  assignment, reuse it. Advance down that variant's handle.
- **Stats view:** new "Split Test" results panel (a tab inside the workflow editor, or
  a card). Per-variant: assigned / messaged / replied / reply-rate / Wilson CI / z-test
  vs leader / winner banner. Attribution joins `messages.in_reply_to_id → execution → variant_id`.
- **Act / de-activate:** each variant weight is 0–100; **pause = weight 0** (no new
  assignments; existing sticky contacts continue or hard-stop per policy).
  **Adopt winner** = winner weight 100, losers 0, or a "promote to production" action.
- **Pros:** matches "one trigger → N presentations" most literally; reuses the built
  editor UI; the shared trigger cannot drift (it's one node).
- **Cons:** all variants live on one canvas (crowded for complex presentations);
  needs a **new** stats endpoint + **new** stats UI; needs `variant_id` attribution
  plumbing; stickiness is a new table. The existing Experiments page is bypassed.

---

### Option B — sibling workflows under an experiment (shared, copied trigger)

**Shape:** one experiment = N full workflows. Each workflow has an **identical** trigger
node (copied on create, validated to stay in sync). Weights on each workflow.

- **Data model:** add `traffic_share REAL` (0–100) to `workflows` (or a
  `experiment_variants` join table). Keep `experiment_assignments` for stickiness.
- **Distribution:** in `handleIncomingMessage`, group matching workflows by
  `experiment_id`, then weighted-random among active variants (default equal), sticky
  via `experiment_assignments`.
- **Stats view:** the **existing** Experiments page already shows assigned / messaged /
  replied / reply-rate / z-test / winner banner. Just add the weight column + wire the
  "Adopt winner" button for real.
- **Act / de-activate:** variants already have a live/draft toggle (`workflows.active`);
  add per-variant weight. **Adopt winner** = deactivate losers (or set winner weight 100).
- **Pros:** reuses the most working code (stats page, assignments, attribution by
  `workflow_id`); familiar UX.
- **Cons:** "same trigger" is the weak point — N copies that must not drift (needs
  copy-on-create + a sync/validation guard); heavier create-flow (N workflows to manage);
  trigger drift is a real footgun.

---

### Option C — Experiment owns the trigger + weights; variants are presentation workflows (RECOMMENDED)

**Shape:** the **experiment is the trigger container**. Variants are workflows that are
*presentations only* (no trigger node of their own). The experiment's trigger routes
into the selected variant.

- **Data model:**
  - Add to `experiments`: trigger config — `trigger_keywords TEXT[]`, `trigger_algorithm`,
    `trigger_threshold`, `session_id`, plus `distribution_mode` (balanced|weighted).
  - Add `experiment_variants (experiment_id, workflow_id, weight REAL, active BOOL)`
    — the weight + per-variant on/off lives here (variant = a presentation workflow).
  - Keep `experiment_assignments` for sticky per contact.
- **Distribution:** on an inbound message, match against **experiments'** triggers (not
  per-workflow). Pick the experiment, then weighted-random among its active variants
  (default equal), sticky via `experiment_assignments`. Start the selected *presentation*
  workflow at its first send node.
- **Stats view:** the **existing** Experiments page — per-variant assigned / messaged /
  replied / reply-rate / Wilson CI / z-test / winner banner. Attribution stays by
  `workflow_execution_id → workflow_id`.
- **Act / de-activate:** toggle `experiment_variants.active` (pause one variant) or edit
  `weight` (rebalance). **Adopt winner** = set winner active, deactivate losers, mark the
  experiment `completed` and promote the winner to "the" production automation.
- **Pros:** trigger is defined **once** (no drift, ever); each presentation is a clean,
  independently-editable workflow; reuses the existing stats/attribution/Experiments page;
  **unifies** the model — a standalone workflow is just "an experiment with one variant
  at 100%," so there's one mental model instead of two.
- **Cons:** the largest engine change (trigger matching moves to experiments; `startExecution`
  must enter a presentation without a trigger node); needs a small migration of the
  existing single workflow into "experiment + 1 variant."

---

## 4. Statistics view (concrete, shared across options)

Whatever the architecture, this is the stats surface we build:

**Per variant row:**
| Column | Definition |
|---|---|
| Variant | name |
| Status | active / paused |
| Weight | % of traffic (0–100) |
| Assigned | distinct contacts sticky-assigned to this variant |
| Messaged | distinct contacts who received ≥1 outbound message from this variant |
| Replied | distinct contacts whose inbound reply was attributed to this variant |
| Reply rate | `replied / messaged` (canonical, per §2) |
| Wilson 95% CI | confidence band on the rate (already in `@wastat/shared`) |

**Experiment header KPIs:** total assigned, total messaged, total replied, overall reply
rate.

**Statistical decision banner:** two-proportion z-test of the leader vs runner-up.
- Show: `z`, `p-value`, `confidence = (1 − p) × 100`.
- Rule: significant when `p < 0.05` **and** each variant has `≥ 5` messaged contacts
  (`MIN_TRIALS_PER_VARIANT` in `recommendWinner`).
- Banner states: `Collecting data (min 5 leads/var)` → `Test in progress` →
  `🎯 Winner detected (p < 0.05)`.

**Actions from the stats screen:**
- **Pause variant** — stop new assignments (weight → 0 / `active=false`).
- **Rebalance** — edit per-variant weights.
- **Adopt winner** — promote winner to 100%, deactivate losers, mark experiment complete.
  (This becomes a real backend action, not an `alert()`.)

---

## 5. Activate / de-activate semantics (needs your call)

One behavioral question to settle regardless of architecture — what happens to contacts
**already assigned** to a variant when you pause/adopt:

- **Soft pause (recommended for tests):** no **new** assignments; contacts already on the
  variant keep receiving it (sticky) so the test data stays clean.
- **Hard pause:** the variant fully stops sending, including to its already-assigned
  contacts (used for emergency kill / offensive message).
- **Adopt winner:** soft-pause losers, winner → 100%. Existing loser contacts stay on
  their variant until they convert or fall off, or are optionally migrated to the winner.

---

## 6. Comparison matrix

| Aspect | A — split_test node | B — sibling workflows | C — experiment owns trigger |
|---|---|---|---|
| "Same trigger, defined once" | ✅ one node | ❌ N copies (drift risk) | ✅ on experiment |
| Presentations independent & editable | ⚠️ branches on one canvas | ✅ separate workflows | ✅ separate workflows |
| Weighted distribution (balanced default) | ✅ weights in node | ✅ add column | ✅ add column |
| Sticky per contact | ❌ new table | ✅ existing | ✅ existing |
| Reply-rate attribution | ❌ new `variant_id` plumbing | ✅ by workflow | ✅ by workflow |
| Stats UI | ❌ new view needed | ✅ existing | ✅ existing |
| Act / de-activate variant | ✅ weight=0 | ✅ active flag | ✅ active flag + weight |
| Engine change size | small (1 node case) | medium (group matching) | **large** (trigger→experiment) |
| Unifies standalone + A/B into one model | ❌ | ⚠️ | ✅ |
| Fastest to value | medium | **fast** | slowest |

---

## 7. Recommendation

**Recommend Option C**, with B as the pragmatic fast-path and A as the fallback.

- **Why C:** it is the only option that is *correct* on the two things you emphasized —
  "one shared trigger" (defined once, no drift) and "independent presentations" — while
  **reusing** the working stats/attribution/Experiments UI. It also collapses the system
  to a single mental model (an automation = experiment with 1 variant), which removes the
  current "workflow vs experiment" confusion permanently.
- **Why not A alone:** it matches the phrasing but strands the working Experiments stats
  page and forces all variants onto one canvas.
- **Why not B alone:** it's fastest to ship but inherits the trigger-drift footgun you
  explicitly wanted to avoid ("they should have the same trigger").

**Suggested phasing if we go C:**
1. Schema: `experiments.trigger_*` + `experiment_variants` (+ migrate the existing
   workflow into "experiment + 1 variant").
2. Engine: match inbound messages against experiment triggers; weighted + sticky variant
   selection; enter a presentation workflow at its first node.
3. Stats: fix the reply-rate denominator (`replied/messaged`), wire the z-test banner to
   the same metric, and make "Adopt winner" a real backend action.
4. UI: experiment create-flow (define trigger once → add presentations → set distribution),
   per-variant activate/deactivate from the stats screen.
5. (Later) source attribution (Facebook ad → contact), funnel/qualified/closed metrics.

---

## 8. Open questions to confirm before implementation

1. **Architecture**: A, B, or C? (Recommend C.)
2. **Pause semantics**: soft (stop new assignments, keep existing) vs hard (kill entirely)?
3. **Reply-rate denominator**: confirm `replied / messaged` as canonical (and fix the
   current `replied / assigned`).
4. **Winner adoption**: on adopting a winner, should the losing variants be soft-paused,
   fully stopped, and should the experiment auto-`complete`?
