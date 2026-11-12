import { createSeededRandom } from "./random.js";

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Linear interpolation of sorted data at (n-1)*p. */
export function quantile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low]! + (sorted[Math.ceil(index)]! - sorted[low]!) * (index - low);
}

export function describe(values: readonly number[]) {
  return { count: values.length, mean: mean(values), median: quantile(values, 0.5),
    p90: quantile(values, 0.9), maximum: values.length === 0 ? null : Math.max(...values) };
}

/** Resamples complete signature clusters, including their original multiplicity. */
export function pairedSummary(
  values: readonly { signature: string; difference: number }[],
  seed: number,
  sampling: boolean,
  iterations = 2000,
) {
  const groups = new Map<string, number[]>();
  for (const value of values) {
    const group = groups.get(value.signature) ?? [];
    group.push(value.difference);
    groups.set(value.signature, group);
  }
  let confidenceInterval: { lower: number; upper: number } | null = null;
  if (sampling && values.length > 0) {
    const clusters = [...groups.values()];
    const random = createSeededRandom(seed);
    const samples: number[] = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      let sum = 0;
      let count = 0;
      for (let index = 0; index < clusters.length; index += 1) {
        const cluster = clusters[Math.floor(random() * clusters.length)]!;
        sum += cluster.reduce((a, b) => a + b, 0);
        count += cluster.length;
      }
      samples.push(sum / count);
    }
    confidenceInterval = { lower: quantile(samples, 0.025)!, upper: quantile(samples, 0.975)! };
  }
  return {
    worldCount: values.length, uniqueLayoutCount: groups.size,
    meanDifference: mean(values.map((v) => v.difference)), confidenceInterval,
    positive: values.filter((v) => v.difference > 0).length,
    negative: values.filter((v) => v.difference < 0).length,
    ties: values.filter((v) => v.difference === 0).length,
  };
}
