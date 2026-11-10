import { MemoryRandomAgent, RandomAgent, RuleBasedAgent, ValidRandomAgent } from "./agent.js";
import { runBenchmarks, type BenchmarkSummary } from "./benchmark.js";
import { createSeededRandom } from "./random.js";
import { scenarioRows, type ScenarioName } from "./scenarios.js";

const maxSteps = 100;
const validationMode = process.argv.includes("--validate");
const stochasticTrialCount = validationMode ? 1_000 : 50;
const scenarioNames = Object.keys(scenarioRows) as ScenarioName[];
const benchmarkResults = runBenchmarks(scenarioNames, [
  {
    name: "RandomAgent",
    trialCount: stochasticTrialCount,
    createAgent: (_world, trialIndex) => new RandomAgent(createSeededRandom(10_000 + trialIndex)),
    stochastic: true,
  },
  {
    name: "ValidRandomAgent",
    trialCount: stochasticTrialCount,
    createAgent: (_world, trialIndex) => new ValidRandomAgent(createSeededRandom(10_000 + trialIndex)),
    stochastic: true,
  },
  {
    name: "MemoryRandomAgent",
    trialCount: stochasticTrialCount,
    createAgent: (_world, trialIndex) => new MemoryRandomAgent(createSeededRandom(10_000 + trialIndex)),
    stochastic: true,
  },
  {
    name: "RuleBasedAgent",
    trialCount: 1,
    createAgent: (world) => new RuleBasedAgent(world.deliveryTarget),
    stochastic: false,
  },
], maxSteps);

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatConfidencePercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSteps(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(1);
}

function formatSuccess(result: BenchmarkSummary): string {
  const confidenceInterval = result.successConfidenceInterval;
  const interval = confidenceInterval === null
    ? "N/A"
    : `${formatConfidencePercent(confidenceInterval.lower)}–${formatConfidencePercent(confidenceInterval.upper)}`;
  return `${result.successCount}/${result.trialCount} (${formatPercent(result.successRate)}; ${interval})`;
}

const columnWidths = [13, 18, 27, 16, 14, 12, 13, 15, 14, 14, 14, 12];

function formatCells(cells: readonly string[]): string {
  return cells.map((cell, index) => cell.padEnd(columnWidths[index]!)).join(" ");
}

function formatRow(result: BenchmarkSummary): string {
  return formatCells([
    result.scenario,
    result.agent,
    formatSuccess(result),
    formatSteps(result.meanSuccessfulSteps),
    result.meanRejectedMoves.toFixed(1),
    result.meanUniqueCellsVisited.toFixed(1),
    result.meanRepeatedVisits.toFixed(1),
    result.meanImmediateBacktracks.toFixed(1),
    formatSteps(result.meanRepeatedVisitsPerSuccessfulMove),
    formatSteps(result.meanImmediateBacktracksPerSuccessfulMove),
    String(result.terminationCounts["goal-reached"]),
    String(result.terminationCounts["step-limit"]),
  ]);
}

console.log(`WorldForge benchmark: ${maxSteps} actions per trial`);
console.log(`Mode: ${validationMode ? "validation (1,000 stochastic trials)" : "quick (50 stochastic trials)"}`);
console.log(formatCells([
  "Scenario", "Agent", "Successes / trials (95% CI)", "Mean success steps", "Mean rejected", "Mean unique", "Mean repeats", "Mean backtracks", "Repeat/success", "Backtrack/success", "Goal reached", "Step limit",
]));
console.log("-".repeat(210));
for (const result of benchmarkResults) {
  console.log(formatRow(result));
}
