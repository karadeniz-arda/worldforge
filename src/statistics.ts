export interface WilsonScoreInterval {
  readonly lower: number;
  readonly upper: number;
}

/**
 * Calculates a two-sided 95% Wilson score interval for a binomial success
 * rate. Returns null when no trials exist.
 */
export function calculateWilsonScoreInterval(
  successes: number,
  trials: number,
): WilsonScoreInterval | null {
  if (trials === 0) {
    return null;
  }

  const z = 1.959963984540054;
  const zSquared = z ** 2;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = z * Math.sqrt(
    (proportion * (1 - proportion) + zSquared / (4 * trials)) / trials,
  ) / denominator;

  return {
    lower: successes === 0 ? 0 : Math.max(0, center - margin),
    upper: successes === trials ? 1 : Math.min(1, center + margin),
  };
}
