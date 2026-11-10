import { MemoryRandomAgent, RandomAgent, ValidRandomAgent, type Agent } from "./agent.js";
import { type GeneratedWorld, generateWorldWithMetadata } from "./generation.js";
import { createSeededRandom } from "./random.js";
import { runSimulation, type SimulationResult } from "./simulation.js";
import { calculateWilsonScoreInterval, type WilsonScoreInterval } from "./statistics.js";
import type { World } from "./world.js";

export interface ProceduralMapConfiguration {
  readonly width: number;
  readonly height: number;
  readonly obstacleDensity: number;
  readonly minimumPathDistance?: number;
}

export interface ProceduralBenchmarkConfiguration {
  readonly maps: readonly ProceduralMapConfiguration[];
  readonly worldSeeds: readonly number[];
  readonly actionBudgets: readonly number[];
  readonly agentTrialsPerWorld: number;
  readonly maxGenerationAttempts: number;
}

export interface ProceduralAgentDefinition {
  readonly name: string;
  readonly createAgent: (random: () => number) => Agent;
}

export interface GeneratedMapRecord {
  readonly map: ProceduralMapConfiguration;
  readonly worldSeed: number;
  readonly attempts: number;
  readonly shortestPathLength: number;
  readonly world: World;
}

export interface GenerationFailure {
  readonly map: ProceduralMapConfiguration;
  readonly worldSeed: number;
  readonly error: string;
}

export interface ProceduralTrial {
  readonly result: SimulationResult;
  readonly shortestPathLength: number;
}

export interface ProceduralBenchmarkResult {
  readonly map: ProceduralMapConfiguration;
  readonly actionBudget: number;
  readonly agent: string;
  readonly generatedWorldCount: number;
  readonly generationFailureCount: number;
  readonly trialCount: number;
  readonly successCount: number;
  readonly successRate: number;
  readonly successConfidenceInterval: WilsonScoreInterval | null;
  readonly meanSuccessfulSteps: number | null;
  readonly meanUniqueCellsVisited: number;
  readonly meanRepeatedVisits: number;
  readonly meanImmediateBacktracks: number;
  readonly meanRepeatedVisitsPerSuccessfulMove: number | null;
  readonly meanImmediateBacktracksPerSuccessfulMove: number | null;
  readonly meanShortestPathLength: number | null;
  readonly meanSuccessfulPathEfficiency: number | null;
}

export interface ProceduralBenchmarkRun {
  readonly configuration: ProceduralBenchmarkConfiguration;
  readonly generatedMaps: readonly GeneratedMapRecord[];
  readonly generationFailures: readonly GenerationFailure[];
  readonly results: readonly ProceduralBenchmarkResult[];
}

/** The three existing stochastic policies used in procedural experiments. */
export function createProceduralAgents(): readonly ProceduralAgentDefinition[] {
  return [
    { name: "RandomAgent", createAgent: (random) => new RandomAgent(random) },
    { name: "ValidRandomAgent", createAgent: (random) => new ValidRandomAgent(random) },
    { name: "MemoryRandomAgent", createAgent: (random) => new MemoryRandomAgent(random) },
  ];
}

/**
 * Generates each map once, then reuses those same layouts across all action
 * budgets and agents. Agents receive only observations through runSimulation.
 */
export function runProceduralBenchmark(
  configuration: ProceduralBenchmarkConfiguration,
  agents: readonly ProceduralAgentDefinition[] = createProceduralAgents(),
): ProceduralBenchmarkRun {
  const generatedMaps: GeneratedMapRecord[] = [];
  const generationFailures: GenerationFailure[] = [];

  for (const map of configuration.maps) {
    for (const worldSeed of configuration.worldSeeds) {
      try {
        const generated = generateWorldWithMetadata({
          ...map,
          worldSeed,
          reachability: "reachable",
          maxAttempts: configuration.maxGenerationAttempts,
        });
        generatedMaps.push(toGeneratedMapRecord(map, worldSeed, generated));
      } catch (error) {
        generationFailures.push({
          map,
          worldSeed,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const results: ProceduralBenchmarkResult[] = [];
  for (const map of configuration.maps) {
    const mapsForConfiguration = generatedMaps.filter((record) => matchesMap(record.map, map));
    const failuresForConfiguration = generationFailures.filter((failure) => matchesMap(failure.map, map));

    for (const actionBudget of configuration.actionBudgets) {
      for (const agentDefinition of agents) {
        const trials: ProceduralTrial[] = [];
        for (const generatedMap of mapsForConfiguration) {
          for (let trialIndex = 0; trialIndex < configuration.agentTrialsPerWorld; trialIndex += 1) {
            const agent = agentDefinition.createAgent(createSeededRandom(agentSeed(generatedMap.worldSeed, trialIndex)));
            const result = runSimulation(cloneWorld(generatedMap.world), agent, actionBudget);
            trials.push({ result, shortestPathLength: generatedMap.shortestPathLength });
          }
        }
        results.push(summarizeProceduralTrials(
          map,
          actionBudget,
          agentDefinition.name,
          mapsForConfiguration,
          failuresForConfiguration.length,
          trials,
        ));
      }
    }
  }

  return { configuration, generatedMaps, generationFailures, results };
}

/** Aggregates trial-level outcomes for one map/budget/agent grouping. */
export function summarizeProceduralTrials(
  map: ProceduralMapConfiguration,
  actionBudget: number,
  agent: string,
  generatedMaps: readonly GeneratedMapRecord[],
  generationFailureCount: number,
  trials: readonly ProceduralTrial[],
): ProceduralBenchmarkResult {
  const successes = trials.filter((trial) => trial.result.termination === "goal-reached");
  const normalizedRepeats = trials
    .map((trial) => trial.result.movementAnalytics.repeatedVisitsPerSuccessfulMove)
    .filter((value): value is number => value !== null);
  const normalizedBacktracks = trials
    .map((trial) => trial.result.movementAnalytics.immediateBacktracksPerSuccessfulMove)
    .filter((value): value is number => value !== null);
  const pathEfficiencies = successes.map((trial) => trial.result.stepsTaken / trial.shortestPathLength);

  return {
    map,
    actionBudget,
    agent,
    generatedWorldCount: generatedMaps.length,
    generationFailureCount,
    trialCount: trials.length,
    successCount: successes.length,
    successRate: trials.length === 0 ? 0 : successes.length / trials.length,
    successConfidenceInterval: calculateWilsonScoreInterval(successes.length, trials.length),
    meanSuccessfulSteps: meanOrNull(successes.map((trial) => trial.result.stepsTaken)),
    meanUniqueCellsVisited: meanOrZero(trials.map((trial) => trial.result.movementAnalytics.uniqueCellsVisited)),
    meanRepeatedVisits: meanOrZero(trials.map((trial) => trial.result.movementAnalytics.repeatedVisits)),
    meanImmediateBacktracks: meanOrZero(trials.map((trial) => trial.result.movementAnalytics.immediateBacktracks)),
    meanRepeatedVisitsPerSuccessfulMove: meanOrNull(normalizedRepeats),
    meanImmediateBacktracksPerSuccessfulMove: meanOrNull(normalizedBacktracks),
    meanShortestPathLength: meanOrNull(generatedMaps.map((generatedMap) => generatedMap.shortestPathLength)),
    meanSuccessfulPathEfficiency: meanOrNull(pathEfficiencies),
  };
}

/** Removes mutable object identity between procedural trials. */
export function cloneWorld(world: World): World {
  return {
    ...world,
    robot: { ...world.robot },
    deliveryTarget: { ...world.deliveryTarget },
    obstacles: world.obstacles.map((obstacle) => ({ ...obstacle })),
  };
}

function toGeneratedMapRecord(
  map: ProceduralMapConfiguration,
  worldSeed: number,
  generated: GeneratedWorld,
): GeneratedMapRecord {
  if (generated.shortestPathLength === null) {
    throw new Error("Reachable procedural generation returned an unreachable world.");
  }
  return {
    map,
    worldSeed,
    attempts: generated.attempts,
    shortestPathLength: generated.shortestPathLength,
    world: generated.world,
  };
}

function matchesMap(first: ProceduralMapConfiguration, second: ProceduralMapConfiguration): boolean {
  return first.width === second.width
    && first.height === second.height
    && first.obstacleDensity === second.obstacleDensity
    && first.minimumPathDistance === second.minimumPathDistance;
}

function agentSeed(worldSeed: number, trialIndex: number): number {
  return worldSeed * 10_007 + trialIndex;
}

function meanOrZero(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}
