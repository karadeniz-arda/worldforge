import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { experiment004Configuration } from "../src/experiment-004-config.js";
import {
  deriveBudgetOutcome,
  runExperiment005,
  summarizeExperiment005Outcomes,
  summarizePairedPlanningOutcomes,
  validateExperiment004Metadata,
  type FullTrajectory,
} from "../src/experiment-005.js";
import { runProceduralBenchmark } from "../src/procedural-benchmark.js";
import type { SimulationTrace } from "../src/simulation.js";

const trace: SimulationTrace = {
  map: { width: 3, height: 1, obstacles: [], target: { x: 2, y: 0 } },
  publicMission: null,
  initialPosition: { x: 0, y: 0 },
  finalPosition: { x: 2, y: 0 },
  termination: "goal-reached",
  steps: [
    {
      stepNumber: 1,
      action: "right",
      succeeded: true,
      positionBefore: { x: 0, y: 0 },
      positionAfter: { x: 1, y: 0 },
      observation: { robot: { x: 0, y: 0 }, neighbors: { up: "boundary", down: "boundary", left: "boundary", right: "empty" } },
    },
    {
      stepNumber: 2,
      action: "right",
      succeeded: true,
      positionBefore: { x: 1, y: 0 },
      positionAfter: { x: 2, y: 0 },
      observation: { robot: { x: 1, y: 0 }, neighbors: { up: "boundary", down: "boundary", left: "empty", right: "target" } },
    },
  ],
};

const trajectory: FullTrajectory = { trace, shortestPathLength: 2, firstGoalReachStep: 2 };
const map = { width: 3, height: 1, obstacleDensity: 0, minimumPathDistance: 1 };

describe("Experiment 005 derivation", () => {
  it("derives lower budgets from first goal reach time and assigns failed runs zero SPL", () => {
    expect(deriveBudgetOutcome(trajectory, 1)).toMatchObject({
      succeeded: false,
      stepsTaken: 1,
      spl: 0,
      pathEfficiencyRatio: null,
    });
    expect(deriveBudgetOutcome(trajectory, 2)).toMatchObject({
      succeeded: true,
      stepsTaken: 2,
      spl: 1,
      pathEfficiencyRatio: 1,
    });
  });

  it("keeps failed runs out of successful-run summaries", () => {
    const failed = deriveBudgetOutcome(trajectory, 1);
    const succeeded = deriveBudgetOutcome(trajectory, 2);
    const summary = summarizeExperiment005Outcomes(map, 2, "PlanningAgent-coordinate", [failed, succeeded], [2]);

    expect(summary).toMatchObject({ successCount: 1, meanSuccessfulSteps: 2, medianSuccessfulSteps: 2, spl: 0.5 });
  });

  it("calculates paired wins and differences by world", () => {
    const success = deriveBudgetOutcome(trajectory, 2);
    const failure = deriveBudgetOutcome(trajectory, 1);
    const comparison = summarizePairedPlanningOutcomes(map, 2, [
      { map, worldSeed: 1, actionBudget: 2, coordinate: failure, informationGain: success },
      { map, worldSeed: 2, actionBudget: 2, coordinate: success, informationGain: success },
    ]);

    expect(comparison.successDifference).toMatchObject({ comparedWorldCount: 2, informationGainWins: 1, coordinateWins: 0, ties: 1 });
    expect(comparison.stepsWhenBothSucceedDifference).toMatchObject({ comparedWorldCount: 1, ties: 1 });
  });

  it("regenerates metadata matching Experiment 004 and rejects altered metadata", () => {
    const metadata = JSON.parse(readFileSync("results/experiment-004.json", "utf8"));
    const generated = runProceduralBenchmark(experiment004Configuration, []);

    expect(() => validateExperiment004Metadata(generated.generatedMaps, metadata)).not.toThrow();
    const altered = {
      ...metadata,
      generatedMaps: metadata.generatedMaps.map((record: { shortestPathLength: number }, index: number) => (
        index === 0 ? { ...record, shortestPathLength: record.shortestPathLength + 1 } : record
      )),
    };
    expect(() => validateExperiment004Metadata(generated.generatedMaps, altered)).toThrow("Generated metadata does not match");
  });

  it("uses fresh deterministic PlanningAgent instances for each policy/world run", () => {
    const configuration = {
      maps: [{ width: 4, height: 4, obstacleDensity: 0.1, minimumPathDistance: 2 }],
      worldSeeds: [91],
      actionBudgets: [3, 10],
      agentTrialsPerWorld: 1,
      maxGenerationAttempts: 1_000,
    };

    expect(runExperiment005(configuration)).toEqual(runExperiment005(configuration));
  });
});
