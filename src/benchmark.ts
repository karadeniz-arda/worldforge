import type { Agent } from "./agent.js";
import { createScenario, type ScenarioName } from "./scenarios.js";
import { runSimulation, type SimulationResult, type SimulationTermination } from "./simulation.js";
import { calculateWilsonScoreInterval, type WilsonScoreInterval } from "./statistics.js";
import { createAgentMission, type AgentMission } from "./mission.js";

export interface BenchmarkAgent {
  readonly name: string;
  readonly trialCount: number;
  readonly createAgent: (mission: AgentMission, trialIndex: number) => Agent;
  readonly stochastic: boolean;
}

export interface BenchmarkSummary {
  readonly scenario: ScenarioName;
  readonly agent: string;
  readonly trialCount: number;
  readonly successCount: number;
  readonly successRate: number;
  readonly successConfidenceInterval: WilsonScoreInterval | null;
  readonly meanSuccessfulSteps: number | null;
  readonly meanRejectedMoves: number;
  readonly meanUniqueCellsVisited: number;
  readonly meanRepeatedVisits: number;
  readonly meanImmediateBacktracks: number;
  readonly meanRepeatedVisitsPerSuccessfulMove: number | null;
  readonly meanImmediateBacktracksPerSuccessfulMove: number | null;
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
  const totalUniqueCellsVisited = trials.reduce(
    (sum, trial) => sum + trial.movementAnalytics.uniqueCellsVisited,
    0,
  );
  const totalRepeatedVisits = trials.reduce(
    (sum, trial) => sum + trial.movementAnalytics.repeatedVisits,
    0,
  );
  const totalImmediateBacktracks = trials.reduce(
    (sum, trial) => sum + trial.movementAnalytics.immediateBacktracks,
    0,
  );
  const repeatedVisitsPerSuccessfulMove = trials
    .map((trial) => trial.movementAnalytics.repeatedVisitsPerSuccessfulMove)
    .filter((value): value is number => value !== null);
  const immediateBacktracksPerSuccessfulMove = trials
    .map((trial) => trial.movementAnalytics.immediateBacktracksPerSuccessfulMove)
    .filter((value): value is number => value !== null);
  const terminationCounts: Record<SimulationTermination, number> = {
    "goal-reached": 0,
    "target-unreachable": 0,
    "step-limit": 0,
  };

  for (const trial of trials) {
    terminationCounts[trial.termination] += 1;
  }

  return {
    scenario,
    agent,
    trialCount: trials.length,
    successCount: successes.length,
    successRate: trials.length === 0 ? 0 : successes.length / trials.length,
    successConfidenceInterval: null,
    meanSuccessfulSteps: successes.length === 0
      ? null
      : successes.reduce((sum, trial) => sum + trial.stepsTaken, 0) / successes.length,
    meanRejectedMoves: trials.length === 0 ? 0 : totalRejectedMoves / trials.length,
    meanUniqueCellsVisited: trials.length === 0 ? 0 : totalUniqueCellsVisited / trials.length,
    meanRepeatedVisits: trials.length === 0 ? 0 : totalRepeatedVisits / trials.length,
    meanImmediateBacktracks: trials.length === 0 ? 0 : totalImmediateBacktracks / trials.length,
    meanRepeatedVisitsPerSuccessfulMove: repeatedVisitsPerSuccessfulMove.length === 0
      ? null
      : repeatedVisitsPerSuccessfulMove.reduce((sum, value) => sum + value, 0) / repeatedVisitsPerSuccessfulMove.length,
    meanImmediateBacktracksPerSuccessfulMove: immediateBacktracksPerSuccessfulMove.length === 0
      ? null
      : immediateBacktracksPerSuccessfulMove.reduce((sum, value) => sum + value, 0) / immediateBacktracksPerSuccessfulMove.length,
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
    const agent = benchmarkAgent.createAgent(createAgentMission(world), trialIndex);
    trials.push(runSimulation(world, agent, maxSteps));
  }

  const summary = summarizeBenchmark(scenario, benchmarkAgent.name, trials);
  return {
    ...summary,
    successConfidenceInterval: benchmarkAgent.stochastic
      ? calculateWilsonScoreInterval(summary.successCount, summary.trialCount)
      : null,
  };
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
