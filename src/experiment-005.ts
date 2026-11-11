import { calculateMovementAnalytics } from "./analytics.js";
import { experiment004Configuration } from "./experiment-004-config.js";
import { createAgentMission } from "./mission.js";
import { PlanningAgent, type FrontierTieBreakPolicy } from "./planning.js";
import { cloneWorld, runProceduralBenchmark, type GeneratedMapRecord, type ProceduralBenchmarkConfiguration, type ProceduralMapConfiguration } from "./procedural-benchmark.js";
import { MemoryRandomAgent } from "./agent.js";
import { createSeededRandom } from "./random.js";
import { runSimulationWithTrace, type ReplayStep, type SimulationTrace } from "./simulation.js";
import { calculateWilsonScoreInterval, type WilsonScoreInterval } from "./statistics.js";
import type { Position } from "./world.js";

export type Experiment005Agent = "MemoryRandomAgent" | "PlanningAgent-coordinate" | "PlanningAgent-information-gain";

export interface DerivedEpisodeOutcome {
  readonly succeeded: boolean;
  readonly stepsTaken: number;
  readonly rejectedMoves: number;
  readonly uniqueCellsVisited: number;
  readonly repeatedVisits: number;
  readonly immediateBacktracks: number;
  readonly revealedCells: number;
  /** Standard SPL contribution: zero for failures, shortest/max(shortest, steps) for success. */
  readonly spl: number;
  /** Actual/shortest ratio among successful runs, null for failures. */
  readonly pathEfficiencyRatio: number | null;
}

export interface Experiment005Aggregate {
  readonly map: ProceduralMapConfiguration;
  readonly actionBudget: number;
  readonly agent: Experiment005Agent;
  readonly trialCount: number;
  readonly successCount: number;
  readonly successRate: number;
  /** Wilson intervals are reported only for stochastic MemoryRandomAgent trials. */
  readonly successConfidenceInterval: WilsonScoreInterval | null;
  readonly meanSuccessfulSteps: number | null;
  readonly medianSuccessfulSteps: number | null;
  readonly meanUniqueCellsVisited: number;
  readonly meanRepeatedVisits: number;
  readonly meanImmediateBacktracks: number;
  readonly meanRevealedCells: number;
  readonly spl: number;
  readonly meanSuccessfulPathEfficiency: number | null;
  readonly medianSuccessfulPathEfficiency: number | null;
  readonly meanShortestPathLength: number;
  readonly medianShortestPathLength: number;
}

export interface PairedWorldOutcome {
  readonly map: ProceduralMapConfiguration;
  readonly worldSeed: number;
  readonly actionBudget: number;
  readonly coordinate: DerivedEpisodeOutcome;
  readonly informationGain: DerivedEpisodeOutcome;
}

export interface BootstrapInterval {
  readonly lower: number;
  readonly upper: number;
}

export interface PairedMetricComparison {
  /** Information-gain minus coordinate. For steps, only worlds where both succeed are included. */
  readonly meanDifference: number | null;
  readonly bootstrapConfidenceInterval: BootstrapInterval | null;
  readonly comparedWorldCount: number;
  readonly informationGainWins: number;
  readonly coordinateWins: number;
  readonly ties: number;
}

export interface PairedPlanningComparison {
  readonly map: ProceduralMapConfiguration;
  readonly actionBudget: number;
  readonly successDifference: PairedMetricComparison;
  readonly stepsWhenBothSucceedDifference: PairedMetricComparison;
  readonly splDifference: PairedMetricComparison;
  /** More revealed cells, not necessarily better, due to different episode lengths. */
  readonly revealedCellDifference: PairedMetricComparison;
}

export interface PlanningWorldRun {
  readonly map: ProceduralMapConfiguration;
  readonly worldSeed: number;
  readonly policy: FrontierTieBreakPolicy;
  readonly shortestPathLength: number;
  readonly firstGoalReachStep: number | null;
}

export interface Experiment005Run {
  readonly configuration: ProceduralBenchmarkConfiguration;
  readonly generatedMaps: readonly Omit<GeneratedMapRecord, "world">[];
  readonly generationFailureCount: number;
  readonly aggregates: readonly Experiment005Aggregate[];
  readonly planningWorldRuns: readonly PlanningWorldRun[];
  readonly pairedWorldOutcomes: readonly PairedWorldOutcome[];
  readonly pairedComparisons: readonly PairedPlanningComparison[];
  readonly actualSimulationCount: number;
  readonly derivedObservationCount: number;
}

export interface Experiment004Metadata {
  readonly configuration: ProceduralBenchmarkConfiguration;
  readonly generatedMaps: readonly Omit<GeneratedMapRecord, "world">[];
}

export interface FullTrajectory {
  readonly trace: SimulationTrace;
  readonly shortestPathLength: number;
  readonly firstGoalReachStep: number | null;
}

const planningPolicies: readonly FrontierTieBreakPolicy[] = ["coordinate", "information-gain"];

/** Runs Experiment 005 with the fixed Experiment 004 world set by default. */
export function runExperiment005(
  configuration: ProceduralBenchmarkConfiguration = experiment004Configuration,
  experiment004Metadata?: Experiment004Metadata,
): Experiment005Run {
  const generated = runProceduralBenchmark(configuration, []);
  if (generated.generationFailures.length > 0) {
    throw new Error(`Experiment 005 requires all worlds; generation failed ${generated.generationFailures.length} times.`);
  }
  if (experiment004Metadata !== undefined) {
    validateExperiment004Metadata(generated.generatedMaps, experiment004Metadata);
  }

  const planningTrajectories = new Map<string, FullTrajectory>();
  const memoryTrajectories = new Map<string, FullTrajectory>();
  const maximumActionBudget = Math.max(...configuration.actionBudgets);
  let actualSimulationCount = 0;

  for (const generatedMap of generated.generatedMaps) {
    for (const policy of planningPolicies) {
      const trajectory = runPlanningTrajectory(generatedMap, policy, maximumActionBudget);
      planningTrajectories.set(trajectoryKey(generatedMap, policy), trajectory);
      actualSimulationCount += 1;
    }
    for (let trialIndex = 0; trialIndex < configuration.agentTrialsPerWorld; trialIndex += 1) {
      const trajectory = runMemoryTrajectory(generatedMap, trialIndex, maximumActionBudget);
      memoryTrajectories.set(memoryKey(generatedMap, trialIndex), trajectory);
      actualSimulationCount += 1;
    }
  }

  const aggregates: Experiment005Aggregate[] = [];
  const planningWorldRuns: PlanningWorldRun[] = [];
  const pairedWorldOutcomes: PairedWorldOutcome[] = [];
  const pairedComparisons: PairedPlanningComparison[] = [];

  for (const map of configuration.maps) {
    const mapsForConfiguration = generated.generatedMaps.filter((record) => matchesMap(record.map, map));
    for (const actionBudget of configuration.actionBudgets) {
      const memoryOutcomes = mapsForConfiguration.flatMap((record) => (
        Array.from({ length: configuration.agentTrialsPerWorld }, (_, trialIndex) => (
          deriveBudgetOutcome(memoryTrajectories.get(memoryKey(record, trialIndex))!, actionBudget)
        ))
      ));
      aggregates.push(summarizeExperiment005Outcomes(
        map,
        actionBudget,
        "MemoryRandomAgent",
        memoryOutcomes,
        mapsForConfiguration.map((record) => record.shortestPathLength),
      ));

      const coordinateOutcomes: DerivedEpisodeOutcome[] = [];
      const informationGainOutcomes: DerivedEpisodeOutcome[] = [];
      for (const record of mapsForConfiguration) {
        const coordinateTrajectory = planningTrajectories.get(trajectoryKey(record, "coordinate"))!;
        const informationGainTrajectory = planningTrajectories.get(trajectoryKey(record, "information-gain"))!;
        const coordinate = deriveBudgetOutcome(coordinateTrajectory, actionBudget);
        const informationGain = deriveBudgetOutcome(informationGainTrajectory, actionBudget);
        coordinateOutcomes.push(coordinate);
        informationGainOutcomes.push(informationGain);
        pairedWorldOutcomes.push({ map, worldSeed: record.worldSeed, actionBudget, coordinate, informationGain });
      }
      aggregates.push(summarizeExperiment005Outcomes(
        map,
        actionBudget,
        "PlanningAgent-coordinate",
        coordinateOutcomes,
        mapsForConfiguration.map((record) => record.shortestPathLength),
      ));
      aggregates.push(summarizeExperiment005Outcomes(
        map,
        actionBudget,
        "PlanningAgent-information-gain",
        informationGainOutcomes,
        mapsForConfiguration.map((record) => record.shortestPathLength),
      ));
      pairedComparisons.push(summarizePairedPlanningOutcomes(map, actionBudget, pairedWorldOutcomes.filter((outcome) => (
        matchesMap(outcome.map, map) && outcome.actionBudget === actionBudget
      ))));
    }

    for (const record of mapsForConfiguration) {
      for (const policy of planningPolicies) {
        const trajectory = planningTrajectories.get(trajectoryKey(record, policy))!;
        planningWorldRuns.push({
          map,
          worldSeed: record.worldSeed,
          policy,
          shortestPathLength: record.shortestPathLength,
          firstGoalReachStep: trajectory.firstGoalReachStep,
        });
      }
    }
  }

  return {
    configuration,
    generatedMaps: generated.generatedMaps.map(({ world, ...record }) => record),
    generationFailureCount: generated.generationFailures.length,
    aggregates,
    planningWorldRuns,
    pairedWorldOutcomes,
    pairedComparisons,
    actualSimulationCount,
    derivedObservationCount: aggregates.reduce((sum, aggregate) => sum + aggregate.trialCount, 0),
  };
}

/** Ensures regenerated maps use exactly the metadata stored by Experiment 004. */
export function validateExperiment004Metadata(
  generatedMaps: readonly GeneratedMapRecord[],
  expected: Experiment004Metadata,
): void {
  if (JSON.stringify(expected.configuration) !== JSON.stringify(experiment004Configuration)) {
    throw new Error("Experiment 004 metadata configuration does not match the canonical configuration.");
  }
  if (generatedMaps.length !== expected.generatedMaps.length) {
    throw new Error(`Generated map count ${generatedMaps.length} does not match Experiment 004 count ${expected.generatedMaps.length}.`);
  }
  for (const generatedMap of generatedMaps) {
    const match = expected.generatedMaps.find((record) => (
      matchesMap(record.map, generatedMap.map) && record.worldSeed === generatedMap.worldSeed
    ));
    if (
      match === undefined
      || match.attempts !== generatedMap.attempts
      || match.shortestPathLength !== generatedMap.shortestPathLength
    ) {
      throw new Error(`Generated metadata does not match Experiment 004 for seed ${generatedMap.worldSeed}.`);
    }
  }
}

/** Derives lower-budget outcomes from one deterministic maximum-budget trajectory. */
export function deriveBudgetOutcome(trajectory: FullTrajectory, actionBudget: number): DerivedEpisodeOutcome {
  const successAtBudget = trajectory.firstGoalReachStep !== null && trajectory.firstGoalReachStep <= actionBudget;
  const stepCount = successAtBudget
    ? trajectory.firstGoalReachStep!
    : Math.min(actionBudget, trajectory.trace.steps.length);
  const steps = trajectory.trace.steps.slice(0, stepCount);
  const successfulMoves = steps.filter((step) => step.succeeded).length;
  const analytics = calculateMovementAnalytics(trajectory.trace.initialPosition, steps);
  const revealedCells = countRevealedCells(trajectory.trace, steps);
  const stepsTaken = steps.length;

  return {
    succeeded: successAtBudget,
    stepsTaken,
    rejectedMoves: stepsTaken - successfulMoves,
    uniqueCellsVisited: analytics.uniqueCellsVisited,
    repeatedVisits: analytics.repeatedVisits,
    immediateBacktracks: analytics.immediateBacktracks,
    revealedCells,
    spl: successAtBudget ? trajectory.shortestPathLength / Math.max(trajectory.shortestPathLength, stepsTaken) : 0,
    pathEfficiencyRatio: successAtBudget ? stepsTaken / trajectory.shortestPathLength : null,
  };
}

/** Aggregates outcomes while keeping failed runs out of successful-run metrics. */
export function summarizeExperiment005Outcomes(
  map: ProceduralMapConfiguration,
  actionBudget: number,
  agent: Experiment005Agent,
  outcomes: readonly DerivedEpisodeOutcome[],
  shortestPathLengths: readonly number[],
): Experiment005Aggregate {
  const successes = outcomes.filter((outcome) => outcome.succeeded);
  const successfulSteps = successes.map((outcome) => outcome.stepsTaken);
  const efficiencies = successes.map((outcome) => outcome.pathEfficiencyRatio!);
  return {
    map,
    actionBudget,
    agent,
    trialCount: outcomes.length,
    successCount: successes.length,
    successRate: outcomes.length === 0 ? 0 : successes.length / outcomes.length,
    successConfidenceInterval: agent === "MemoryRandomAgent"
      ? calculateWilsonScoreInterval(successes.length, outcomes.length)
      : null,
    meanSuccessfulSteps: meanOrNull(successfulSteps),
    medianSuccessfulSteps: medianOrNull(successfulSteps),
    meanUniqueCellsVisited: meanOrZero(outcomes.map((outcome) => outcome.uniqueCellsVisited)),
    meanRepeatedVisits: meanOrZero(outcomes.map((outcome) => outcome.repeatedVisits)),
    meanImmediateBacktracks: meanOrZero(outcomes.map((outcome) => outcome.immediateBacktracks)),
    meanRevealedCells: meanOrZero(outcomes.map((outcome) => outcome.revealedCells)),
    spl: meanOrZero(outcomes.map((outcome) => outcome.spl)),
    meanSuccessfulPathEfficiency: meanOrNull(efficiencies),
    medianSuccessfulPathEfficiency: medianOrNull(efficiencies),
    meanShortestPathLength: meanOrZero(shortestPathLengths),
    medianShortestPathLength: medianOrNull(shortestPathLengths) ?? 0,
  };
}

/** Summarizes paired deterministic planning outcomes across independent worlds. */
export function summarizePairedPlanningOutcomes(
  map: ProceduralMapConfiguration,
  actionBudget: number,
  outcomes: readonly PairedWorldOutcome[],
): PairedPlanningComparison {
  const seedBase = map.width * 1_000_000 + Math.round(map.obstacleDensity * 100) * 10_000 + actionBudget;
  return {
    map,
    actionBudget,
    successDifference: summarizePairedMetric(outcomes.map((outcome) => (
      (outcome.informationGain.succeeded ? 1 : 0) - (outcome.coordinate.succeeded ? 1 : 0)
    )), false, seedBase + 1),
    stepsWhenBothSucceedDifference: summarizePairedMetric(outcomes.flatMap((outcome) => (
      outcome.coordinate.succeeded && outcome.informationGain.succeeded
        ? [outcome.informationGain.stepsTaken - outcome.coordinate.stepsTaken]
        : []
    )), true, seedBase + 2),
    splDifference: summarizePairedMetric(outcomes.map((outcome) => (
      outcome.informationGain.spl - outcome.coordinate.spl
    )), false, seedBase + 3),
    revealedCellDifference: summarizePairedMetric(outcomes.map((outcome) => (
      outcome.informationGain.revealedCells - outcome.coordinate.revealedCells
    )), false, seedBase + 4),
  };
}

function runPlanningTrajectory(
  record: GeneratedMapRecord,
  policy: FrontierTieBreakPolicy,
  maximumActionBudget: number,
): FullTrajectory {
  const world = cloneWorld(record.world);
  const result = runSimulationWithTrace(
    world,
    new PlanningAgent(createAgentMission(world), { tieBreakPolicy: policy }),
    maximumActionBudget,
  );
  return {
    trace: result.trace,
    shortestPathLength: record.shortestPathLength,
    firstGoalReachStep: result.result.termination === "goal-reached" ? result.result.stepsTaken : null,
  };
}

function runMemoryTrajectory(
  record: GeneratedMapRecord,
  trialIndex: number,
  maximumActionBudget: number,
): FullTrajectory {
  const world = cloneWorld(record.world);
  const result = runSimulationWithTrace(
    world,
    new MemoryRandomAgent(createSeededRandom(record.worldSeed * 10_007 + trialIndex)),
    maximumActionBudget,
  );
  return {
    trace: result.trace,
    shortestPathLength: record.shortestPathLength,
    firstGoalReachStep: result.result.termination === "goal-reached" ? result.result.stepsTaken : null,
  };
}

function countRevealedCells(trace: SimulationTrace, steps: readonly ReplayStep[]): number {
  const revealed = new Set<string>([positionKey(trace.initialPosition)]);
  for (const step of steps) {
    revealed.add(positionKey(step.observation.robot));
    for (const [direction, contents] of Object.entries(step.observation.neighbors)) {
      if (contents === "boundary") {
        continue;
      }
      const position = adjacentPosition(step.observation.robot, direction);
      if (position.x >= 0 && position.x < trace.map.width && position.y >= 0 && position.y < trace.map.height) {
        revealed.add(positionKey(position));
      }
    }
  }
  return revealed.size;
}

function adjacentPosition(position: Position, direction: string): Position {
  switch (direction) {
    case "up": return { x: position.x, y: position.y - 1 };
    case "down": return { x: position.x, y: position.y + 1 };
    case "left": return { x: position.x - 1, y: position.y };
    case "right": return { x: position.x + 1, y: position.y };
    default: throw new Error(`Unsupported direction ${direction}.`);
  }
}

function summarizePairedMetric(values: readonly number[], lowerIsBetter: boolean, seed: number): PairedMetricComparison {
  const informationGainWins = values.filter((value) => lowerIsBetter ? value < 0 : value > 0).length;
  const coordinateWins = values.filter((value) => lowerIsBetter ? value > 0 : value < 0).length;
  return {
    meanDifference: meanOrNull(values),
    bootstrapConfidenceInterval: pairedBootstrapInterval(values, seed),
    comparedWorldCount: values.length,
    informationGainWins,
    coordinateWins,
    ties: values.filter((value) => value === 0).length,
  };
}

function pairedBootstrapInterval(values: readonly number[], seed: number): BootstrapInterval | null {
  if (values.length === 0) {
    return null;
  }
  const random = createSeededRandom(seed);
  const samples: number[] = [];
  for (let sample = 0; sample < 2_000; sample += 1) {
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      total += values[Math.floor(random() * values.length)]!;
    }
    samples.push(total / values.length);
  }
  samples.sort((first, second) => first - second);
  return { lower: percentile(samples, 0.025), upper: percentile(samples, 0.975) };
}

function percentile(values: readonly number[], probability: number): number {
  const index = (values.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return values[lower]! + (values[upper]! - values[lower]!) * (index - lower);
}

function trajectoryKey(record: GeneratedMapRecord, policy: FrontierTieBreakPolicy): string {
  return `${mapKey(record.map)}:${record.worldSeed}:${policy}`;
}

function memoryKey(record: GeneratedMapRecord, trialIndex: number): string {
  return `${mapKey(record.map)}:${record.worldSeed}:${trialIndex}`;
}

function mapKey(map: ProceduralMapConfiguration): string {
  return `${map.width}x${map.height}:${map.obstacleDensity}:${map.minimumPathDistance ?? "none"}`;
}

function matchesMap(first: ProceduralMapConfiguration, second: ProceduralMapConfiguration): boolean {
  return mapKey(first) === mapKey(second);
}

function meanOrZero(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : meanOrZero(values);
}

function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}
