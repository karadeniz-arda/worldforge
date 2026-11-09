import type { Agent } from "./agent.js";
import { createScenario, type ScenarioName } from "./scenarios.js";
import { runSimulation, type SimulationResult, type SimulationTermination } from "./simulation.js";
import type { World } from "./world.js";

export interface BenchmarkAgent {
  readonly name: string;
  readonly trialCount: number;
  readonly createAgent: (world: World, trialIndex: number) => Agent;
}

export interface BenchmarkSummary {
  readonly scenario: ScenarioName;
  readonly agent: string;
  readonly trialCount: number;
  readonly successRate: number;
  readonly meanSuccessfulSteps: number | null;
  readonly meanRejectedMoves: number;
  readonly terminationCounts: Readonly<Record<SimulationTermination, number>>;
  readonly trials: readonly SimulationResult[];
}

/** Aggregates completed trials without treating valid movement as task success. */
export function summarizeBenchmark(
  scenario: ScenarioName,
  agent: string,
  trials: readonly SimulationResult[],
): BenchmarkSummary {
  const successes = trials.filter((trial) => trial.termination === "goal-reached");
  const totalRejectedMoves = trials.reduce((sum, trial) => sum + trial.rejectedMoves, 0);
  const terminationCounts: Record<SimulationTermination, number> = {
    "goal-reached": 0,
    "step-limit": 0,
  };

  for (const trial of trials) {
    terminationCounts[trial.termination] += 1;
  }

  return {
    scenario,
    agent,
    trialCount: trials.length,
    successRate: trials.length === 0 ? 0 : successes.length / trials.length,
    meanSuccessfulSteps: successes.length === 0
      ? null
      : successes.reduce((sum, trial) => sum + trial.stepsTaken, 0) / successes.length,
    meanRejectedMoves: trials.length === 0 ? 0 : totalRejectedMoves / trials.length,
    terminationCounts,
    trials,
  };
}

/** Runs independent trials for one agent/scenario pairing. */
export function runScenarioBenchmark(
  scenario: ScenarioName,
  benchmarkAgent: BenchmarkAgent,
  maxSteps: number,
): BenchmarkSummary {
  const trials: SimulationResult[] = [];

  for (let trialIndex = 0; trialIndex < benchmarkAgent.trialCount; trialIndex += 1) {
    const world = createScenario(scenario);
    const agent = benchmarkAgent.createAgent(world, trialIndex);
    trials.push(runSimulation(world, agent, maxSteps));
  }

  return summarizeBenchmark(scenario, benchmarkAgent.name, trials);
}

/** Runs every requested agent/scenario pairing with the same action budget. */
export function runBenchmarks(
  scenarios: readonly ScenarioName[],
  agents: readonly BenchmarkAgent[],
  maxSteps: number,
): readonly BenchmarkSummary[] {
  return scenarios.flatMap((scenario) => agents.map((agent) => (
    runScenarioBenchmark(scenario, agent, maxSteps)
  )));
}
