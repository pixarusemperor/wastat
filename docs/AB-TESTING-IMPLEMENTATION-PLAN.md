# A/B Testing — Option C Implementation Plan

> Status: **IN BUILD** · Date: 2026-08-26
> Architecture chosen: **Option C** — the *experiment* owns the shared trigger + distribution;
> variants are *presentation workflows* (no trigger node of their own).
> Grounded in: `docs/AB-TESTING-DESIGN.md`, current `engine.ts` (routing already 70% there),
> `api.ts` (stats endpoint), `Experiments.tsx` (stats UI), `supabase-schema.sql` + `schema.sql`.

---

## 0. Why C (short version)

- The one thing you emphasized twice — **"they should have the same trigger"** — is only
  structurally guaranteed by C (trigger defined once on the experiment, variants have no
  trigger node → drift is *impossible*, not just guarded).
- The engine **already** does sticky + balanced variant assignment and attribution by
  `workflow_id` (the hard 70%). C reuses all of it.
- The Experiments page already renders per-variant stats + z-test; we extend it, we don't
  rebuild it.
- It collapses the product to one mental model: **an automation = an experiment with one
  variant at 100%**. That kills the current "workflow vs experiment" confusion permanently.

**Rejected:** A (split_test node) strands the working stats page and needs new attribution
plumbing + new UI. B is fastest but inherits the trigger-drift footgun you explicitly
don't want.

---

## 1. Target model (Option C, concretely)

```
experiment (owns trigger: keywords, algorithm, threshold, session_id, distribution_mode)
  └── experiment_variants (experiment_id, workflow_id, weight 0-100, active bool)
        └── variant = a workflow with NO trigger node (presentation only)
              └── its graph starts at the first send node
experiment_assignments (experiment_id, contact_id, workflow_id)  ← existing, sticky
```

- Inbound message → match against **experiment triggers** (not per-workflow).
- Picked experiment → weighted-random among **active** variants (default balanced via equal
  weights), sticky through `experiment_assignments`.
- Start the selected presentation workflow **at its first node** (skip trigger matching;
  `startExecution` gains a `startAtFirstNode` path — it already computes `first` from the
  trigger's out-edge, we just bypass the trigger existence check for presentations).
- Standalone workflows (no experiment) keep today's exact behavior (their own trigger node).

---

## 2. Data model changes (both schemas, in lockstep)

`supabase-schema.sql` + `db/schema.sql` (tests run sqlite; production runs pg):

```sql
-- experiments gains the trigger + distribution config
ALTER TABLE experiments ADD COLUMN trigger_keywords  TEXT;       -- JSON array; pg: TEXT[] later
ALTER TABLE experiments ADD COLUMN trigger_algorithm TEXT NOT NULL DEFAULT 'dice';
ALTER TABLE experiments ADD COLUMN trigger_threshold REAL NOT NULL DEFAULT 75;
ALTER TABLE experiments ADD COLUMN session_id       BIGINT REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE experiments ADD COLUMN distribution_mode TEXT NOT NULL DEFAULT 'balanced'; -- balanced|weighted

-- per-variant weight + on/off (variant = presentation workflow)
CREATE TABLE IF NOT EXISTS experiment_variants (
  experiment_id BIGINT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  workflow_id   BIGINT NOT NULL REFERENCES workflows(id)  ON DELETE CASCADE,
  weight        REAL   NOT NULL DEFAULT 100,
  active        BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (experiment_id, workflow_id)
);
```

- Keep `workflows.experiment_id` and `experiment_assignments` as-is (already live).
- `distribution_mode='balanced'` → ignore weights, equal pick (today's behavior).
  `'weighted'` → weighted random among active variants.

**Migration of existing data:** on boot, for every workflow that has `experiment_id`
today (a v1 experiment), backfill `experiment_variants` rows with `weight=100, active=true`
and set that experiment's `distribution_mode='balanced'` + `session_id` from the workflow.
(Idempotent upsert; safe to run every boot.)

---

## 3. Engine changes (`engine.ts`)

1. **Trigger matching moves up a level.** In `handleIncomingMessage`, after the
   waiting_input/menu handling, first try **experiment triggers**: load experiments with
   `active=true` and `session_id IS NULL OR session_id = ?`, evaluate their
   `trigger_keywords` with the same `evaluateMatch`/algorithm/threshold logic that
   workflow trigger nodes use today (extract that into a shared helper).
   - If an experiment matches → pick variant (step 2) → start presentation workflow.
   - Else → fall through to today's per-workflow matching (standalone automations).
2. **Weighted + sticky variant pick** (replaces the current least-assigned query when
   `distribution_mode='weighted'`):
   - sticky: existing `experiment_assignments` row wins (same as today);
   - else weighted-random over `experiment_variants WHERE active` (seeded `rng()`),
     insert assignment (via `execRun`, no RETURNING — composite PK).
   - `'balanced'` keeps today's least-assigned query untouched.
3. **`startExecution` gains a presentation path**: `startExecution(id, session, contact, triggerMsgId?, vars?, { skipTrigger: true })` — resolve `first` from the workflow's first node without requiring a trigger node. (Currently it returns `null` if no trigger; presentations must not.)
4. **Distribution unit-tested** with the injectable `rng` (seed → deterministic picks),
   same pattern as the existing experiment tests in `engine.test.ts`.

---

## 4. API changes (`api.ts` + `routes/`)

1. **`POST /api/experiments`** — accept trigger config (`triggerKeywords`, `algorithm`,
   `threshold`, `sessionId`, `distributionMode`) and create.
2. **`PUT /api/experiments/:id`** — update trigger + distribution (already exists; extend body).
3. **`POST /api/experiments/:id/variants`** — add a variant: creates a presentation
   workflow (copy of a template or empty) + `experiment_variants` row.
4. **`PUT /api/experiments/:id/variants/:workflowId`** — update `weight` / `active`
   (pause/rebalance).
5. **`DELETE /api/experiments/:id/variants/:workflowId`** — remove variant (hard delete
   of assignment rows + variant row; workflow kept, unlinked).
6. **`POST /api/experiments/:id/adopt-winner`** — real action: winner → weight 100 + active,
   losers → `active=false`, experiment `distribution_mode` stays, return new state.
7. **Stats endpoint fix** (`GET /api/experiments/:id/stats`):
   - `replyRate = replied / messaged` (**canonical per PRD §33** — today it's
     `replied / assigned`, a bug).
   - Add `weight` + `active` per variant from `experiment_variants`.
   - Keep totals; add Wilson CI per variant (already in `@wastat/shared`).

---

## 5. Web changes (`Experiments.tsx` + workflow editor)

1. **Create/Edit experiment**: trigger config form (keywords, algorithm, threshold,
   session, distribution mode balanced/weighted) — replaces the bare name/description form.
2. **Variant manager**: list of presentation workflows with weight slider + active toggle +
   "add presentation" (opens the workflow editor for a new variant workflow).
3. **Stats screen** (mostly exists): show `weight`, `active`, Wilson CI; switch the z-test
   input to `replied/messaged` (matches the fixed endpoint); replace the `alert()` on
   **Adopt Winner** with a real `POST /adopt-winner` + refetch.
4. **Variant editor**: presentation workflows open in the existing editor; validate that a
   variant workflow has no trigger node (block saving one into a variant).

---

## 6. TDD slices (vertical, one test → one impl, green gates each)

Each slice ends with `npm run typecheck && npm test` green.

| # | Slice | RED test (seam) | What ships |
|---|---|---|---|
| 1 | Schema + migration | `db.test.ts`: `experiment_variants` + experiment trigger columns exist after boot; backfill idempotent | Both schema files + boot migration |
| 2 | Stats denominator fix | `api.test.ts`: `/stats` returns `replied/messaged`, includes weight/active | `api.ts` stats endpoint |
| 3 | Trigger matching → experiments | `engine.test.ts`: inbound message matches an *experiment* trigger and starts its variant (no per-workflow trigger) | Engine step 1 |
| 4 | Weighted distribution | `engine.test.ts`: seeded rng → deterministic weighted pick; sticky still wins; balanced unchanged | Engine step 2 |
| 5 | Presentation start | `engine.test.ts`: `startExecution(skipTrigger)` enters a trigger-less workflow at first node | Engine step 3 |
| 6 | Variant CRUD API | `api.test.ts`: create/update/delete variant + weight/active round-trips | api.ts routes |
| 7 | Adopt-winner action | `api.test.ts`: winners promoted, losers soft-paused, state returned | api.ts route |
| 8 | Web create-flow + variant manager + real adopt button | (Playwright / manual QA) | Experiments.tsx |
| 9 | Full QA on Supabase | run `scripts/qa-automation-loop.sh` + a real experiment live | E2E verified |

---

## 7. Decisions — LOCKED (2026-08-26, user-confirmed)

1. **Pause semantics** → **Soft pause**: no new assignments to a paused variant;
   already-assigned contacts keep receiving it (sticky) so test data stays clean.
2. **Reply-rate denominator** → **`replied / messaged`** is canonical (per PRD §33);
   fix the current `replied / assigned`. `assigned` still shown separately.
3. **Adopt-winner** → winner to 100%, losers soft-paused (`active=false`), and the
   experiment is marked **`completed`**.

**Build starts with slice 1.**
