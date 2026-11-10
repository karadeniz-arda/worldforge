import { mkdir, writeFile } from "node:fs/promises";

import { runProceduralBenchmark, type ProceduralBenchmarkResult } from "./procedural-benchmark.js";

const worldSeeds = Array.from({ length: 100 }, (_, index) => 30_000 + index);
const mapSizes = [10, 20, 50] as const;
const obstacleDensities = [0.15, 0.25] as const;
const configuration = {
  maps: mapSizes.flatMap((size) => obstacleDensities.map((obstacleDensity) => ({
    width: size,
    height: size,
    obstacleDensity,
    minimumPathDistance: Math.max(5, Math.floor((size * 2) / 3)),
  }))),
  worldSeeds,
  actionBudgets: [100, 500, 1_000],
  agentTrialsPerWorld: 10,
  maxGenerationAttempts: 1_000,
} as const;

const run = runProceduralBenchmark(configuration);

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(1);
}

function formatInterval(result: ProceduralBenchmarkResult): string {
  const interval = result.successConfidenceInterval;
  return interval === null ? "N/A" : `${formatPercent(interval.lower)}–${formatPercent(interval.upper)}`;
}

console.log("WorldForge Experiment 004: procedural worlds");
console.log("100 map seeds/configuration; 10 seeded agent trials/map; reachable maps only.");
console.log("Size   Density Budget Agent              Successes      95% CI          Steps  Unique Repeats Backs  Repeat/s Back/s Path  Efficiency  Gen fail");
console.log("-".repeat(145));
for (const result of run.results) {
  console.log([
    `${result.map.width}x${result.map.height}`.padEnd(7),
    result.map.obstacleDensity.toFixed(2).padEnd(7),
    String(result.actionBudget).padEnd(7),
    result.agent.padEnd(18),
    `${result.successCount}/${result.trialCount}`.padEnd(14),
    formatInterval(result).padEnd(15),
    formatNumber(result.meanSuccessfulSteps).padEnd(7),
    formatNumber(result.meanUniqueCellsVisited).padEnd(7),
    formatNumber(result.meanRepeatedVisits).padEnd(7),
    formatNumber(result.meanImmediateBacktracks).padEnd(6),
    formatNumber(result.meanRepeatedVisitsPerSuccessfulMove).padEnd(9),
    formatNumber(result.meanImmediateBacktracksPerSuccessfulMove).padEnd(7),
    formatNumber(result.meanShortestPathLength).padEnd(6),
    formatNumber(result.meanSuccessfulPathEfficiency).padEnd(11),
    String(result.generationFailureCount),
  ].join(" "));
}

if (run.generationFailures.length > 0) {
  console.log("\nGeneration failures:");
  for (const failure of run.generationFailures) {
    console.log(`${failure.map.width}x${failure.map.height} d=${failure.map.obstacleDensity} seed=${failure.worldSeed}: ${failure.error}`);
  }
}

const machineRecord = {
  configuration: run.configuration,
  generatedMaps: run.generatedMaps.map(({ world, ...record }) => record),
  generationFailures: run.generationFailures,
  results: run.results,
};
await mkdir("results", { recursive: true });
await writeFile("results/experiment-004.json", `${JSON.stringify(machineRecord, null, 2)}\n`);
console.log("\nWrote machine-readable results/experiment-004.json");
