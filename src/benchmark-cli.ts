import { RandomAgent, RuleBasedAgent } from "./agent.js";
import { runBenchmarks, type BenchmarkSummary } from "./benchmark.js";
import { createSeededRandom } from "./random.js";
import { scenarioRows, type ScenarioName } from "./scenarios.js";

const maxSteps = 100;
const scenarioNames = Object.keys(scenarioRows) as ScenarioName[];
const benchmarkResults = runBenchmarks(scenarioNames, [
  {
    name: "RandomAgent",
    trialCount: 50,
    createAgent: (_world, trialIndex) => new RandomAgent(createSeededRandom(10_000 + trialIndex)),
  },
  {
    name: "RuleBasedAgent",
    trialCount: 1,
    createAgent: (world) => new RuleBasedAgent(world.deliveryTarget),
  },
], maxSteps);

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatSteps(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(1);
}

const columnWidths = [13, 15, 8, 10, 16, 14, 14, 12];

function formatCells(cells: readonly string[]): string {
  return cells.map((cell, index) => cell.padEnd(columnWidths[index]!)).join(" ");
}

function formatRow(result: BenchmarkSummary): string {
  return formatCells([
    result.scenario,
    result.agent,
    String(result.trialCount),
    formatPercent(result.successRate),
    formatSteps(result.meanSuccessfulSteps),
    result.meanRejectedMoves.toFixed(1),
    String(result.terminationCounts["goal-reached"]),
    String(result.terminationCounts["step-limit"]),
  ]);
}

console.log(`WorldForge benchmark: ${maxSteps} actions per trial`);
console.log(formatCells([
  "Scenario", "Agent", "Trials", "Success", "Mean success steps", "Mean rejected", "Goal reached", "Step limit",
]));
console.log("-".repeat(120));
for (const result of benchmarkResults) {
  console.log(formatRow(result));
}
