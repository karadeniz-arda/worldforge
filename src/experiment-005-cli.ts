import { readFile, mkdir, writeFile } from "node:fs/promises";

import { runExperiment005, type Experiment004Metadata, type Experiment005Run } from "./experiment-005.js";

const experiment004Metadata = JSON.parse(
  await readFile("results/experiment-004.json", "utf8"),
) as Experiment004Metadata & { readonly results: readonly {
  readonly agent: string;
  readonly successCount: number;
  readonly trialCount: number;
  readonly actionBudget: number;
  readonly map: { readonly width: number; readonly height: number; readonly obstacleDensity: number; readonly minimumPathDistance?: number };
}[] };

const run = runExperiment005(undefined, experiment004Metadata);
validateMemoryBaseline(run, experiment004Metadata.results);

console.log("WorldForge Experiment 005: Planning under partial information");
console.log(`Generated worlds: ${run.generatedMaps.length}; actual simulations: ${run.actualSimulationCount}; derived budget outcomes: ${run.derivedObservationCount}.`);
console.log("Size   Density Budget Agent                         Success      Mean/median steps  SPL    Mean revealed  Mean/median efficiency");
console.log("----------------------------------------------------------------------------------------------------------------");
for (const aggregate of run.aggregates) {
  console.log([
    `${aggregate.map.width}x${aggregate.map.height}`.padEnd(7),
    aggregate.map.obstacleDensity.toFixed(2).padEnd(7),
    String(aggregate.actionBudget).padEnd(7),
    aggregate.agent.padEnd(29),
    `${aggregate.successCount}/${aggregate.trialCount}`.padEnd(12),
    `${format(aggregate.meanSuccessfulSteps)}/${format(aggregate.medianSuccessfulSteps)}`.padEnd(19),
    aggregate.spl.toFixed(3).padEnd(6),
    aggregate.meanRevealedCells.toFixed(1).padEnd(14),
    `${format(aggregate.meanSuccessfulPathEfficiency)}/${format(aggregate.medianSuccessfulPathEfficiency)}`,
  ].join(" "));
}

console.log("\nPaired PlanningAgent differences (information-gain minus coordinate; 100 worlds/configuration)");
console.log("Size   Density Budget Success Δ (CI)  Steps Δ both-success (CI)  SPL Δ (CI)     Revealed Δ (CI)");
console.log("-------------------------------------------------------------------------------------------------");
for (const comparison of run.pairedComparisons) {
  console.log([
    `${comparison.map.width}x${comparison.map.height}`.padEnd(7),
    comparison.map.obstacleDensity.toFixed(2).padEnd(7),
    String(comparison.actionBudget).padEnd(7),
    formatComparison(comparison.successDifference).padEnd(17),
    formatComparison(comparison.stepsWhenBothSucceedDifference).padEnd(26),
    formatComparison(comparison.splDifference).padEnd(14),
    formatComparison(comparison.revealedCellDifference),
  ].join(" "));
}

await mkdir("results", { recursive: true });
await writeFile("results/experiment-005.json", `${JSON.stringify(run, null, 2)}\n`);
console.log("\nValidated regenerated world metadata and MemoryRandom success counts against Experiment 004.");
console.log("Wrote machine-readable results/experiment-005.json");

function validateMemoryBaseline(
  experiment005: Experiment005Run,
  experiment004Results: readonly {
    readonly agent: string;
    readonly successCount: number;
    readonly trialCount: number;
    readonly actionBudget: number;
    readonly map: { readonly width: number; readonly height: number; readonly obstacleDensity: number; readonly minimumPathDistance?: number };
  }[],
): void {
  const memoryAggregates = experiment005.aggregates.filter((aggregate) => aggregate.agent === "MemoryRandomAgent");
  for (const aggregate of memoryAggregates) {
    const match = experiment004Results.find((result) => (
      result.agent === "MemoryRandomAgent"
      && result.actionBudget === aggregate.actionBudget
      && result.map.width === aggregate.map.width
      && result.map.height === aggregate.map.height
      && result.map.obstacleDensity === aggregate.map.obstacleDensity
      && result.map.minimumPathDistance === aggregate.map.minimumPathDistance
      && result.successCount === aggregate.successCount
      && result.trialCount === aggregate.trialCount
    ));
    if (match === undefined) {
      throw new Error(`MemoryRandomAgent success count ${aggregate.successCount}/${aggregate.trialCount} did not match Experiment 004.`);
    }
  }
}

function format(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(1);
}

function formatComparison(comparison: { readonly meanDifference: number | null; readonly bootstrapConfidenceInterval: { readonly lower: number; readonly upper: number } | null }): string {
  if (comparison.meanDifference === null || comparison.bootstrapConfidenceInterval === null) {
    return "N/A";
  }
  return `${comparison.meanDifference.toFixed(2)} [${comparison.bootstrapConfidenceInterval.lower.toFixed(2)}, ${comparison.bootstrapConfidenceInterval.upper.toFixed(2)}]`;
}
