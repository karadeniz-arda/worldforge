import { describe, expect, it } from "vitest";

import { RandomAgent, RuleBasedAgent, type Agent } from "../src/agent.js";
import { runScenarioBenchmark, summarizeBenchmark, type BenchmarkAgent } from "../src/benchmark.js";
import { createSeededRandom } from "../src/random.js";
import type { SimulationResult } from "../src/simulation.js";
import { createScenario } from "../src/scenarios.js";
import type { World } from "../src/world.js";

function createResult(
  termination: SimulationResult["termination"],
  stepsTaken: number,
  rejectedMoves: number,
): SimulationResult {
  return {
    world: createScenario("easy"),
    steps: [],
    successfulMoves: stepsTaken - rejectedMoves,
    rejectedMoves,
    stepsTaken,
    termination,
  };
}

describe("benchmark runner", () => {
  it("aggregates task success separately from rejected movement", () => {
    const summary = summarizeBenchmark("easy", "TestAgent", [
      createResult("goal-reached", 4, 1),
      createResult("step-limit", 10, 0),
      createResult("goal-reached", 8, 3),
    ]);

    expect(summary).toMatchObject({
      trialCount: 3,
      successRate: 2 / 3,
      meanSuccessfulSteps: 6,
      meanRejectedMoves: 4 / 3,
      terminationCounts: { "goal-reached": 2, "step-limit": 1 },
    });
  });

  it("reports N/A successful-task steps when no trial succeeds", () => {
    const summary = summarizeBenchmark("unreachable", "TestAgent", [
      createResult("step-limit", 5, 5),
      createResult("step-limit", 5, 2),
    ]);

    expect(summary.successRate).toBe(0);
    expect(summary.meanSuccessfulSteps).toBeNull();
    expect(summary.meanRejectedMoves).toBe(3.5);
  });

  it("creates fresh worlds and agents for every trial", () => {
    const worlds: World[] = [];
    const agents: Agent[] = [];
    const benchmarkAgent: BenchmarkAgent = {
      name: "RightAgent",
      trialCount: 2,
      createAgent: (world) => {
        worlds.push(world);
        const agent: Agent = { decide: () => "right" };
        agents.push(agent);
        return agent;
      },
    };

    runScenarioBenchmark("easy", benchmarkAgent, 1);

    expect(worlds).toHaveLength(2);
    expect(worlds[0]).not.toBe(worlds[1]);
    expect(worlds[0]?.robot).toEqual({ x: 0, y: 0 });
    expect(worlds[1]?.robot).toEqual({ x: 0, y: 0 });
    expect(agents[0]).not.toBe(agents[1]);
  });

  it("is reproducible when random trials use deterministic distinct seeds", () => {
    const seededRandomAgent: BenchmarkAgent = {
      name: "RandomAgent",
      trialCount: 3,
      createAgent: (_world, trialIndex) => new RandomAgent(createSeededRandom(500 + trialIndex)),
    };

    expect(runScenarioBenchmark("easy", seededRandomAgent, 100))
      .toEqual(runScenarioBenchmark("easy", seededRandomAgent, 100));
  });

  it("records the intentional unreachable scenario as a failed task", () => {
    const benchmarkAgent: BenchmarkAgent = {
      name: "RuleBasedAgent",
      trialCount: 1,
      createAgent: (world) => new RuleBasedAgent(world.deliveryTarget),
    };

    const summary = runScenarioBenchmark("unreachable", benchmarkAgent, 100);

    expect(summary).toMatchObject({
      successRate: 0,
      meanSuccessfulSteps: null,
      meanRejectedMoves: 100,
      terminationCounts: { "goal-reached": 0, "step-limit": 1 },
    });
  });
});
