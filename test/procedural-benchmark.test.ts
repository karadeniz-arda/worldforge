import { describe, expect, it } from "vitest";

import { cloneWorld, runProceduralBenchmark, summarizeProceduralTrials, type GeneratedMapRecord, type ProceduralAgentDefinition, type ProceduralBenchmarkConfiguration } from "../src/procedural-benchmark.js";
import type { AgentMission } from "../src/mission.js";
import type { SimulationResult } from "../src/simulation.js";

const configuration: ProceduralBenchmarkConfiguration = {
  maps: [{ width: 6, height: 5, obstacleDensity: 0.15, minimumPathDistance: 4 }],
  worldSeeds: [11, 12],
  actionBudgets: [5, 10],
  agentTrialsPerWorld: 2,
  maxGenerationAttempts: 1_000,
};

describe("procedural benchmark", () => {
  it("is reproducible from its map and agent seed configuration", () => {
    expect(runProceduralBenchmark(configuration)).toEqual(runProceduralBenchmark(configuration));
  });

  it("reuses generated maps across budgets while isolating trial worlds", () => {
    const run = runProceduralBenchmark(configuration);
    const generated = run.generatedMaps[0]!;
    const before = JSON.parse(JSON.stringify(generated.world));
    const cloned = cloneWorld(generated.world);

    expect(run.generatedMaps).toHaveLength(2);
    expect(run.results).toHaveLength(6);
    expect(generated.world).toEqual(before);
    expect(cloned).toEqual(generated.world);
    expect(cloned).not.toBe(generated.world);
    expect(cloned.robot).not.toBe(generated.world.robot);
    expect(cloned.obstacles).not.toBe(generated.world.obstacles);
    expect(run.results.filter((result) => result.actionBudget === 5)[0]?.meanShortestPathLength)
      .toBe(run.results.filter((result) => result.actionBudget === 10)[0]?.meanShortestPathLength);
  });

  it("provides fresh public missions to procedural agent factories", () => {
    const missions: AgentMission[] = [];
    const agents: readonly ProceduralAgentDefinition[] = [{
      name: "RightAgent",
      createAgent: (mission) => {
        missions.push(mission);
        return { decide: () => "right" };
      },
    }];
    const oneTrialConfiguration: ProceduralBenchmarkConfiguration = {
      ...configuration,
      actionBudgets: [1],
      agentTrialsPerWorld: 1,
    };

    const run = runProceduralBenchmark(oneTrialConfiguration, agents);

    expect(missions).toHaveLength(2);
    expect(missions[0]).not.toBe(missions[1]);
    expect(missions[0]).not.toHaveProperty("obstacles");
    expect(run.generatedMaps[0]?.world.robot).toEqual(missions[0]?.start);
    expect(run.generatedMaps[0]?.world.deliveryTarget).toEqual(missions[0]?.target);
  });

  it("aggregates procedural success and path-efficiency metrics correctly", () => {
    const map = configuration.maps[0]!;
    const generatedMap: GeneratedMapRecord = {
      map,
      worldSeed: 1,
      attempts: 1,
      shortestPathLength: 4,
      world: {
        width: 6,
        height: 5,
        robot: { x: 0, y: 0 },
        deliveryTarget: { x: 5, y: 4 },
        obstacles: [],
      },
    };
    const success = createResult("goal-reached", 8);
    const failure = createResult("step-limit", 10);

    const summary = summarizeProceduralTrials(map, 10, "TestAgent", [generatedMap], 0, [
      { result: success, shortestPathLength: 4 },
      { result: failure, shortestPathLength: 4 },
    ]);

    expect(summary).toMatchObject({
      trialCount: 2,
      successCount: 1,
      successRate: 0.5,
      meanSuccessfulSteps: 8,
      meanUniqueCellsVisited: 3,
      meanRepeatedVisits: 2,
      meanImmediateBacktracks: 1,
      meanSuccessfulPathEfficiency: 2,
      meanShortestPathLength: 4,
    });
  });
});

function createResult(termination: SimulationResult["termination"], stepsTaken: number): SimulationResult {
  return {
    world: {
      width: 2,
      height: 2,
      robot: { x: 0, y: 0 },
      deliveryTarget: { x: 1, y: 1 },
      obstacles: [],
    },
    steps: [],
    successfulMoves: stepsTaken,
    rejectedMoves: 0,
    stepsTaken,
    termination,
    movementAnalytics: {
      uniqueCellsVisited: 3,
      repeatedVisits: 2,
      immediateBacktracks: 1,
      repeatedVisitsPerSuccessfulMove: 0.2,
      immediateBacktracksPerSuccessfulMove: 0.1,
    },
  };
}
