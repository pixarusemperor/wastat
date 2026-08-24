/**
 * Multi-stage funnel & A/B winner statistics (TASK-07).
 * Shared by server and web so the math can never diverge.
 */

/** Standard normal CDF via the Abramowitz–Stegun 7.1.26 erf approximation (max err ~1.5e-7). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return x < 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}

export interface WilsonInterval {
  low: number;
  high: number;
}

/** Wilson score interval for a binomial proportion. Returns {0,0} for zero trials. */
export function wilsonInterval(successes: number, trials: number, z = 1.96): WilsonInterval {
  if (trials <= 0) return { low: 0, high: 0 };
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denom;
  const margin =
    (z / denom) * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

export interface FunnelStageCounts {
  reached: number;
  converted: number;
}

export interface FunnelStageStats extends FunnelStageCounts {
  /** converted / reached, 0 when nothing reached this stage yet */
  rate: number;
  interval: WilsonInterval;
}

export function funnelConversions(stages: FunnelStageCounts[]): FunnelStageStats[] {
  return stages.map(({ reached, converted }) => ({
    reached,
    converted,
    rate: reached > 0 ? converted / reached : 0,
    interval: wilsonInterval(converted, reached),
  }));
}

export interface VariantTrials {
  id: string;
  conversions: number;
  trials: number;
}

export interface WinnerRecommendation {
  winnerId: string | null;
  /** (1 − p-value) × 100, one decimal */
  confidence: number;
  isSignificant: boolean;
}

const MIN_TRIALS_PER_VARIANT = 5;

/** Two-proportion z-test of each variant against the current leader. Null winner until significant. */
export function recommendWinner(variants: VariantTrials[]): WinnerRecommendation {
  if (
    variants.length < 2 ||
    variants.some((v) => v.trials < MIN_TRIALS_PER_VARIANT)
  ) {
    return { winnerId: null, confidence: 0, isSignificant: false };
  }
  const sorted = [...variants].sort(
    (a, b) => b.conversions / b.trials - a.conversions / a.trials,
  );
  const best = sorted[0];
  const runnerUp = sorted[1];
  const p1 = best.conversions / best.trials;
  const p2 = runnerUp.conversions / runnerUp.trials;
  const pooled = (best.conversions + runnerUp.conversions) / (best.trials + runnerUp.trials);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / best.trials + 1 / runnerUp.trials));
  if (se === 0) return { winnerId: null, confidence: 100, isSignificant: false };
  const pValue = 2 * (1 - normalCdf(Math.abs((p1 - p2) / se)));
  const isSignificant = pValue < 0.05;
  return {
    winnerId: isSignificant ? best.id : null,
    confidence: Math.round((1 - pValue) * 1000) / 10,
    isSignificant,
  };
}
