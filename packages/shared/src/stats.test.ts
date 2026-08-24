import { describe, expect, it } from "vitest";
import { funnelConversions, normalCdf, recommendWinner, wilsonInterval } from "./stats.js";

describe("normalCdf", () => {
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("wilsonInterval", () => {
  it("returns zeros for zero trials", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
  });
  it("brackets the observed proportion for a balanced sample", () => {
    const iv = wilsonInterval(5, 10);
    expect(iv.low).toBeCloseTo(0.2366, 3);
    expect(iv.high).toBeCloseTo(0.7634, 3);
  });
  it("stays within [0,1] at 100% conversion", () => {
    const iv = wilsonInterval(10, 10);
    expect(iv.low).toBeGreaterThan(0.7);
    expect(iv.high).toBeLessThanOrEqual(1);
  });
  it("clamps to [0,1] at zero conversions", () => {
    const iv = wilsonInterval(0, 10);
    expect(iv.low).toBe(0);
    expect(iv.high).toBeLessThan(0.35);
  });
});

describe("funnelConversions", () => {
  it("computes per-stage rate and interval", () => {
    const [first, second] = funnelConversions([
      { reached: 100, converted: 50 },
      { reached: 50, converted: 10 },
    ]);
    expect(first.rate).toBeCloseTo(0.5, 6);
    expect(first.interval.low).toBeLessThan(0.5);
    expect(first.interval.high).toBeGreaterThan(0.5);
    expect(second.rate).toBeCloseTo(0.2, 6);
  });
  it("yields zero rates when nothing reached the stage", () => {
    const [stage] = funnelConversions([{ reached: 0, converted: 0 }]);
    expect(stage.rate).toBe(0);
    expect(stage.interval).toEqual({ low: 0, high: 0 });
  });
  it("handles full conversion", () => {
    const [stage] = funnelConversions([{ reached: 8, converted: 8 }]);
    expect(stage.rate).toBe(1);
    expect(stage.interval.low).toBeGreaterThan(0.6);
    expect(stage.interval.high).toBeLessThanOrEqual(1);
  });
});

describe("recommendWinner", () => {
  it("returns null below min samples", () => {
    const r = recommendWinner([
      { id: "a", conversions: 4, trials: 4 },
      { id: "b", conversions: 0, trials: 20 },
    ]);
    expect(r.winnerId).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.isSignificant).toBe(false);
  });

  it("detects a significant winner (30/50 vs 15/50)", () => {
    const r = recommendWinner([
      { id: "a", conversions: 30, trials: 50 },
      { id: "b", conversions: 15, trials: 50 },
    ]);
    expect(r.winnerId).toBe("a");
    expect(r.isSignificant).toBe(true);
    expect(r.confidence).toBeGreaterThan(99);
  });

  it("withholds the winner when not significant", () => {
    const r = recommendWinner([
      { id: "a", conversions: 20, trials: 50 },
      { id: "b", conversions: 12, trials: 50 },
    ]);
    expect(r.winnerId).toBeNull();
    expect(r.isSignificant).toBe(false);
  });

  it("returns null on an exact tie", () => {
    const r = recommendWinner([
      { id: "a", conversions: 25, trials: 50 },
      { id: "b", conversions: 25, trials: 50 },
    ]);
    expect(r.winnerId).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("returns null when both variants convert everyone", () => {
    const r = recommendWinner([
      { id: "a", conversions: 10, trials: 10 },
      { id: "b", conversions: 8, trials: 8 },
    ]);
    expect(r.winnerId).toBeNull();
  });

  it("needs at least two variants", () => {
    expect(recommendWinner([{ id: "solo", conversions: 9, trials: 10 }]).winnerId).toBeNull();
  });

  it("compares the leader against the runner-up, not the worst variant", () => {
    const r = recommendWinner([
      { id: "best", conversions: 40, trials: 50 },
      { id: "mid", conversions: 38, trials: 50 },
      { id: "worst", conversions: 2, trials: 50 },
    ]);
    expect(r.winnerId).toBeNull();
    expect(r.isSignificant).toBe(false);
  });
});
