import { describe, expect, it } from "vitest";
import { dice, evaluateMatch, levenshteinRatio, normalize, similarity } from "./matching.js";

describe("normalize", () => {
  it("lowercases, folds accents, collapses whitespace", () => {
    expect(normalize("  Héllo   WORLD ")).toBe("hello world");
  });
});

describe("dice", () => {
  it("identical strings score 1, disjoint score 0", () => {
    expect(dice("price", "price")).toBe(1);
    expect(dice("abc", "xyz")).toBe(0);
  });
  it("short strings don't crash", () => {
    expect(dice("", "a")).toBe(0);
    expect(dice("a", "a")).toBe(1);
  });
});

describe("levenshteinRatio", () => {
  it("one edit in a short word", () => {
    expect(levenshteinRatio("prce", "price")).toBeCloseTo(1 - 1 / 5);
  });
  it("both empty is a perfect match", () => {
    expect(levenshteinRatio("", "")).toBe(1);
  });
});

describe("PRD §15 example", () => {
  const target = "I want to know the price";
  const incoming = "hello I want to know your price";
  // PRD claims this is ≥80%, but standard Dice gives ~0.784. The PRD example
  // is illustrative, not normative (see docs/adr/0002-phrase-matching.md).
  it("scores close to but below 0.8 under dice", () => {
    expect(similarity("dice", target, incoming)).toBeCloseTo(0.784, 2);
  });
});

describe("evaluateMatch", () => {
  const cfg = { phrase: "I want to know the price", algorithm: "dice" as const, threshold: 75 };
  it("matches the PRD example at a 75% threshold", () => {
    expect(evaluateMatch(cfg, "hello I want to know your price").matched).toBe(true);
  });
  it("rejects unrelated input", () => {
    expect(evaluateMatch(cfg, "what time do you open").matched).toBe(false);
  });
  it("exact mode ignores near-misses and accent/case differences", () => {
    const exact = { phrase: "Precio", algorithm: "exact" as const, threshold: 100 };
    expect(evaluateMatch(exact, "precio!").matched).toBe(false);
    expect(evaluateMatch(exact, "PRECIÓ").matched).toBe(true);
  });
});
