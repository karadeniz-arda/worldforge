import { describe, expect, it } from "vitest";

import { calculateWilsonScoreInterval } from "../src/statistics.js";

describe("calculateWilsonScoreInterval", () => {
  it("returns null when there are no trials", () => {
    expect(calculateWilsonScoreInterval(0, 0)).toBeNull();
  });

  it("handles zero and all successes without leaving the probability range", () => {
    expect(calculateWilsonScoreInterval(0, 1_000)).toMatchObject({ lower: 0 });
    expect(calculateWilsonScoreInterval(0, 1_000)?.upper).toBeCloseTo(0.0038268, 6);
    expect(calculateWilsonScoreInterval(1_000, 1_000)?.lower).toBeCloseTo(0.9961732, 6);
    expect(calculateWilsonScoreInterval(1_000, 1_000)).toMatchObject({ upper: 1 });
  });

  it("calculates a symmetric interval around an intermediate rate", () => {
    const interval = calculateWilsonScoreInterval(50, 100);

    expect(interval?.lower).toBeCloseTo(0.4038, 4);
    expect(interval?.upper).toBeCloseTo(0.5962, 4);
  });
});
