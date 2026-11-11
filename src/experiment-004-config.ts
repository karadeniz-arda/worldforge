import type { ProceduralBenchmarkConfiguration } from "./procedural-benchmark.js";

/** Shared, immutable configuration for Experiments 004 and 005. */
export const experiment004Configuration: ProceduralBenchmarkConfiguration = {
  maps: [10, 20, 50].flatMap((size) => [0.15, 0.25].map((obstacleDensity) => ({
    width: size,
    height: size,
    obstacleDensity,
    minimumPathDistance: Math.max(5, Math.floor((size * 2) / 3)),
  }))),
  worldSeeds: Array.from({ length: 100 }, (_, index) => 30_000 + index),
  actionBudgets: [100, 500, 1_000],
  agentTrialsPerWorld: 10,
  maxGenerationAttempts: 1_000,
};
