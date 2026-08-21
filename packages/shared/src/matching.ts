/**
 * Phrase matching for keyword trigger nodes.
 * Shared by server (execution engine) and web (builder live preview)
 * so they can never diverge. See docs/adr/0002-phrase-matching.md.
 */

export type MatchAlgorithm = "exact" | "dice" | "levenshtein";

/** Lowercase, strip accents, collapse whitespace. Used by matcher AND preview. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice coefficient over character bigrams, 0..1. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

/** Levenshtein edit distance (classic DP, single row). */
export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Normalized Levenshtein similarity, 0..1. */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Similarity between target phrase and incoming text, 0..1. */
export function similarity(
  algorithm: MatchAlgorithm,
  target: string,
  input: string,
): number {
  const t = normalize(target);
  const i = normalize(input);
  switch (algorithm) {
    case "exact":
      return t === i ? 1 : 0;
    case "dice":
      return dice(t, i);
    case "levenshtein":
      return levenshteinRatio(t, i);
  }
}

export interface KeywordMatchConfig {
  phrase: string;
  algorithm: MatchAlgorithm;
  /** 0–100 integer. */
  threshold: number;
}

export interface MatchResult {
  score: number;
  matched: boolean;
}

/** Evaluate one incoming text against one keyword-node config. */
export function evaluateMatch(config: KeywordMatchConfig, input: string): MatchResult {
  const score = similarity(config.algorithm, config.phrase, input);
  return { score, matched: score * 100 >= config.threshold };
}
