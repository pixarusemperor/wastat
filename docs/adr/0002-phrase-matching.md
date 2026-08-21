# 0002 — Phrase similarity algorithm and builder preview

Date: 2026-08-21 · Issue: #6 · Status: accepted

## Decisions

1. **Three match modes**, configured per keyword node:
   - `exact` — normalized string equality (PRD §15 requires exact phrase support)
   - `dice` — Sørensen–Dice coefficient over character bigrams (default; good for word-order-tolerant sentence matching)
   - `levenshtein` — normalized Levenshtein ratio (`1 − dist/maxLen`; good for typos in short phrases)
2. **Threshold is a 0–100 integer.** Matches PRD examples ("80%", "≥90%") and the UI slider directly.
3. **Normalization** (shared by engine and preview, so they cannot diverge): NFD accent folding → lowercase → trim → collapse internal whitespace.
4. **Preview UX:** test inputs go in a textarea inside the keyword node's config panel, one input per line. Re-evaluation is live on keystroke (debounced ~200 ms) — matching is pure string math over a handful of lines, so there is no reason to gate it behind a button. Each line shows its score and a pass/fail badge at the current threshold.
5. **No separate similarity node type.** The graph has one `trigger` node (Wasender event entry) and N `keyword` nodes, each carrying `{ phrase, algorithm, threshold, priority }` — this mirrors PRD §17's multi-trigger routing diagram exactly.
6. **Tiebreakers when multiple keyword nodes match** (PRD §17): highest similarity → highest configured priority → lowest workflow id (deterministic final tiebreak; no randomness).

## Node config shape (workflow_nodes.config JSON)

```json
{ "phrase": "I want to know the price", "algorithm": "dice", "threshold": 80, "priority": 10 }
```

## Implementation

`packages/shared/src/matching.ts` — used by both server engine and web builder. Tests: `packages/shared/src/matching.test.ts`.

## Known PRD discrepancy

PRD §15 claims `"hello I want to know your price"` vs `"I want to know the price"` scores ≥80%. Standard Dice gives **0.784**. The example is treated as illustrative, not normative; users set thresholds via the live preview against real inputs.

## Consequences

- Dice on very short strings (<2 chars) returns 0; exact mode covers single-character keywords.
- If V1.1 adds fuzzy matching for media captions or multi-language tokenization, revisit normalization only — algorithm signatures stay stable.
