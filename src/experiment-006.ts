import { createHash } from "node:crypto";
import type { Agent } from "./agent.js";
import { calculateMovementAnalytics } from "./analytics.js";
import { experiment006Configuration as config, trialSeedTuple, type EvaluationCase } from "./experiment-006-config.js";
import { referenceDistance, referenceTreeDistance } from "./experiment-006-oracle.js";
import { describe, mean, pairedSummary } from "./experiment-006-statistics.js";
import { calculateShortestPathLength, generateWorldWithMetadata } from "./generation.js";
import { generateMazeWorld } from "./maze-generation.js";
import { createAgentMission, type AgentMission } from "./mission.js";
import { OptimisticBFSAgent } from "./optimistic-bfs.js";
import { PlanningAgent } from "./planning.js";
import { cloneWorld } from "./procedural-benchmark.js";
import { createSeededRandom } from "./random.js";
import { runSimulation, type SimulationResult, type SimulationTermination } from "./simulation.js";
import { generateBarrierWorld } from "./structural-generation.js";
import { generateTrapWorld } from "./trap-generation.js";
import type { World } from "./world.js";

export type EvaluationAgent = typeof config.agents[number];
export type OutcomeCategory = "goal-reached" | "step-limit" | "correct-unreachable" | "false-unreachable";

export function stableSeed(tuple: readonly (string | number)[], base: number): number {
  return (base + createHash("sha256").update(JSON.stringify(tuple)).digest().readUInt32BE(0)) >>> 0;
}

export function evaluationAgentSeed(record: EvaluationCase, replication: number): number {
  return stableSeed(trialSeedTuple(record, replication), config.agentSeedBase);
}

export function mapSignature(world: World): string {
  return createHash("sha256").update(JSON.stringify([
    world.width, world.height, world.robot, world.deliveryTarget,
    world.obstacles.map((p) => p.y * world.width + p.x).sort((a, b) => a - b),
  ])).digest("hex");
}

export interface GeneratedEvaluationWorld {
  readonly world: World;
  readonly attempts: number;
  readonly shortestPathLength: number | null;
  readonly geometry?: ReturnType<typeof generateTrapWorld>["geometry"];
}

export function generateEvaluationWorld(record: EvaluationCase): GeneratedEvaluationWorld {
  const basic = { width: record.width, height: record.height, worldSeed: record.worldSeed };
  switch (record.family) {
    case "random-obstacles": return generateWorldWithMetadata({ ...basic,
      obstacleDensity: config.obstacleDensity, reachability: "reachable",
      minimumPathDistance: Math.max(5, Math.floor((record.width + record.height) / 3)), maxAttempts: config.maxGenerationAttempts });
    case "maze": return { ...generateMazeWorld(basic), attempts: 1 };
    case "trap": return { ...generateTrapWorld(basic), attempts: 1 };
    case "doorway": return { ...generateBarrierWorld({ ...basic, variant: "doorway", doorRow: record.doorRow! }), attempts: 1 };
    case "sealed": return { ...generateBarrierWorld({ ...basic, variant: "sealed" }), attempts: 1 };
  }
}

export function validateEvaluationOracle(record: EvaluationCase, generated: ReturnType<typeof generateEvaluationWorld>): void {
  const actual = calculateShortestPathLength(generated.world);
  let reference: number | null;
  switch (record.family) {
    case "doorway": reference = record.width - 1 + 2 * record.doorRow!; break;
    case "sealed": reference = null; break;
    case "maze": reference = referenceTreeDistance(generated.world); break;
    case "trap": {
      if (generated.geometry === undefined) throw new Error("Missing trap geometry for independent validation.");
      const { depth, span } = generated.geometry;
      const middle = Math.floor((span - 1) / 2);
      reference = 2 * depth + 2 * Math.min(middle + 1, span - middle);
      break;
    }
    case "random-obstacles": reference = referenceDistance(generated.world); break;
  }
  if (actual !== reference || actual !== generated.shortestPathLength
    || (record.family !== "sealed" && (actual === null || !Number.isFinite(actual) || actual <= 0))) {
    throw new Error(`Independent oracle mismatch for ${record.id}: generated=${generated.shortestPathLength}, oracle=${actual}, reference=${reference}`);
  }
}

/** Only this public descriptor crosses into an agent constructor. */
export function createEvaluationAgent(agent: EvaluationAgent, mission: AgentMission, seed: number | null): Agent {
  if (agent === "optimistic") return new OptimisticBFSAgent(mission);
  if (agent === "random") {
    if (seed === null) throw new Error("Random evaluation agent requires its trial seed.");
    return new PlanningAgent(mission, { tieBreakPolicy: "random", random: createSeededRandom(seed) });
  }
  return new PlanningAgent(mission, { tieBreakPolicy: agent });
}

export function classifyOutcome(termination: SimulationTermination, oracle: number | null): OutcomeCategory {
  return termination === "target-unreachable" ? (oracle === null ? "correct-unreachable" : "false-unreachable") : termination;
}

/** No replay data required. Stop is available only with a decision beyond its k movements. */
export function deriveEvaluationOutcome(result: SimulationResult, initialWorld: World, oracle: number | null, budget: number) {
  const goalVisible = result.termination === "goal-reached" && result.stepsTaken <= budget;
  const stopVisible = result.termination === "target-unreachable" && result.stepsTaken < budget;
  const termination: SimulationTermination = goalVisible ? "goal-reached" : stopVisible ? "target-unreachable" : "step-limit";
  const steps = result.steps.slice(0, budget);
  const successfulMoves = steps.filter((step) => step.succeeded).length;
  const analytics = calculateMovementAnalytics(initialWorld.robot, steps);
  if (oracle !== null && (!Number.isFinite(oracle) || oracle <= 0)) throw new Error("Reachable oracle distance must be positive and finite.");
  return {
    budget, termination, category: classifyOutcome(termination, oracle),
    actions: steps.length, successfulMoves, rejectedMoves: steps.length - successfulMoves,
    decisionOpportunities: steps.length + Number(stopVisible), stopDecisions: Number(stopVisible),
    spl: oracle === null ? null : goalVisible ? oracle / Math.max(oracle, steps.length) : 0,
    successfulActions: goalVisible ? steps.length : null,
    successfulRatio: goalVisible && oracle !== null ? steps.length / oracle : null,
    oracleOptimal: goalVisible && oracle !== null && steps.length === oracle,
    repeatedVisits: analytics.repeatedVisits, immediateBacktracks: analytics.immediateBacktracks,
  };
}
export type EvaluationOutcome = ReturnType<typeof deriveEvaluationOutcome>;
export interface EvaluationTrial {
  readonly agent: EvaluationAgent;
  readonly replication: number;
  readonly seed: number | null;
  readonly outcomes: readonly EvaluationOutcome[];
}
export interface EvaluatedWorld {
  readonly specification: EvaluationCase;
  readonly signature: string;
  readonly attempts: number;
  readonly oracle: number | null;
  readonly trials: readonly EvaluationTrial[];
}

const nonnull = (values: readonly (number | null)[]): number[] => values.filter((v): v is number => v !== null);

/** Five random replications collapse to one world value before comparisons. */
export function summarizeWorldPolicy(world: EvaluatedWorld, agent: EvaluationAgent, budget: number) {
  const outcomes = world.trials.filter((trial) => trial.agent === agent)
    .map((trial) => trial.outcomes.find((outcome) => outcome.budget === budget)!);
  if (outcomes.length === 0 || outcomes.some((outcome) => outcome === undefined)) throw new Error("Missing trial/budget in world policy summary.");
  const spls = nonnull(outcomes.map((o) => o.spl));
  return {
    id: world.specification.id, stratum: world.specification.stratum, signature: world.signature, agent, budget,
    trialCount: outcomes.length, successRate: mean(outcomes.map((o) => Number(o.termination === "goal-reached")))!,
    spl: mean(spls), successfulActions: mean(nonnull(outcomes.map((o) => o.successfulActions))),
    successfulRatio: mean(nonnull(outcomes.map((o) => o.successfulRatio))),
    correctStopActions: mean(outcomes.filter((o) => o.category === "correct-unreachable").map((o) => o.actions)),
    rejectedMoves: mean(outcomes.map((o) => o.rejectedMoves))!,
    repeatedVisits: mean(outcomes.map((o) => o.repeatedVisits))!,
    immediateBacktracks: mean(outcomes.map((o) => o.immediateBacktracks))!,
    splRange: spls.length === 0 ? null : Math.max(...spls) - Math.min(...spls),
    actionRange: Math.max(...outcomes.map((o) => o.actions)) - Math.min(...outcomes.map((o) => o.actions)),
  };
}
export type WorldPolicySummary = ReturnType<typeof summarizeWorldPolicy>;

export function summarizeEvaluationGroup(worlds: readonly EvaluatedWorld[], agent: EvaluationAgent, budget: number) {
  const perWorld = worlds.map((world) => summarizeWorldPolicy(world, agent, budget));
  const outcomes = worlds.flatMap((world) => world.trials.filter((trial) => trial.agent === agent)
    .flatMap((trial) => trial.outcomes.filter((o) => o.budget === budget)));
  const signatures = new Set(worlds.map((world) => world.signature));
  const categories: Record<OutcomeCategory, number> = { "goal-reached": 0, "step-limit": 0, "correct-unreachable": 0, "false-unreachable": 0 };
  for (const outcome of outcomes) categories[outcome.category] += 1;
  return {
    agent, budget, worldCount: worlds.length, uniqueLayoutCount: signatures.size, trialCount: outcomes.length,
    categories, successCount: categories["goal-reached"], worldMeanSuccessRate: mean(perWorld.map((w) => w.successRate)),
    meanSPL: mean(nonnull(perWorld.map((w) => w.spl))),
    uniqueLayoutMeanSPL: mean(nonnull([...signatures].map((signature) => mean(nonnull(perWorld.filter((w) => w.signature === signature).map((w) => w.spl)))))),
    successfulWorldActions: describe(nonnull(perWorld.map((w) => w.successfulActions))),
    successfulWorldRatios: describe(nonnull(perWorld.map((w) => w.successfulRatio))),
    successfulTrialActions: describe(nonnull(outcomes.map((o) => o.successfulActions))),
    successfulTrialRatios: describe(nonnull(outcomes.map((o) => o.successfulRatio))),
    oracleOptimalTrajectories: outcomes.filter((o) => o.oracleOptimal).length,
    meanRejectedMoves: mean(perWorld.map((w) => w.rejectedMoves)), totalRejectedMoves: outcomes.reduce((sum, o) => sum + o.rejectedMoves, 0),
    meanRepeatedVisits: mean(perWorld.map((w) => w.repeatedVisits)), meanImmediateBacktracks: mean(perWorld.map((w) => w.immediateBacktracks)),
    actionsBeforeCorrectStop: describe(outcomes.filter((o) => o.category === "correct-unreachable").map((o) => o.actions)),
    meanWithinWorldSPLRange: mean(nonnull(perWorld.map((w) => w.splRange))),
    meanWithinWorldActionRange: mean(perWorld.map((w) => w.actionRange)),
    meanDecisionOpportunities: mean(outcomes.map((o) => o.decisionOpportunities)),
    stopDecisions: outcomes.reduce((sum, o) => sum + o.stopDecisions, 0),
  };
}

export function pairWorldPolicies(left: readonly WorldPolicySummary[], right: readonly WorldPolicySummary[]) {
  const rightById = new Map(right.map((value) => [value.id, value]));
  if (rightById.size !== right.length || new Set(left.map((w) => w.id)).size !== left.length || left.length !== right.length) throw new Error("Paired world sets differ or contain duplicate IDs.");
  return left.map((first) => {
    const second = rightById.get(first.id);
    if (second === undefined || first.signature !== second.signature || first.stratum !== second.stratum || first.budget !== second.budget) throw new Error(`Paired world metadata mismatch for ${first.id}.`);
    return { first, second };
  });
}

export function summarizeEvaluationPairs(worlds: readonly EvaluatedWorld[], stratum: string, agent: EvaluationAgent, baseline: EvaluationAgent, budget: number) {
  const pairs = pairWorldPolicies(worlds.map((w) => summarizeWorldPolicy(w, agent, budget)), worlds.map((w) => summarizeWorldPolicy(w, baseline, budget)));
  const sampling = worlds.length > 0 && ["random-obstacles", "maze", "trap"].includes(worlds[0]!.specification.family);
  const comparison = `${agent}-minus-${baseline}`;
  const metric = (name: "spl" | "successRate" | "successfulActions" | "correctStopActions") => pairedSummary(
    pairs.flatMap(({ first, second }) => first[name] === null || second[name] === null ? [] : [{ signature: first.signature, difference: first[name]! - second[name]! }]),
    stableSeed([config.bootstrapSeedBase, stratum, budget, comparison, name], config.bootstrapSeedBase), sampling, config.bootstrapIterations,
  );
  return { stratum, budget, comparison, spl: metric("spl"), successRate: metric("successRate"),
    successfulActions: metric("successfulActions"), correctStopActions: metric("correctStopActions") };
}

export function duplicateLayouts(worlds: readonly { specification: EvaluationCase; signature: string }[]) {
  const groups = new Map<string, string[]>();
  for (const world of worlds) {
    const key = `${world.specification.stratum}/${world.signature}`;
    const ids = groups.get(key) ?? [];
    ids.push(world.specification.id);
    groups.set(key, ids);
  }
  return [...groups].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, caseIds: ids }));
}

export function runExperiment006(cases: readonly EvaluationCase[], progress: (message: string) => void = () => {}) {
  if (new Set(cases.map((record) => record.id)).size !== cases.length) throw new Error("Duplicate evaluation case IDs.");
  const usedSeeds = new Set<number>();
  for (const record of cases) for (let replication = 0; replication < config.randomReplications; replication += 1) {
    const seed = evaluationAgentSeed(record, replication);
    if (usedSeeds.has(seed)) throw new Error(`Trial seed collision for ${record.id}/${replication}.`);
    usedSeeds.add(seed);
  }
  const worlds: EvaluatedWorld[] = [];
  const generationFailures: { caseId: string; error: string }[] = [];
  for (const record of cases) {
    let generated: ReturnType<typeof generateEvaluationWorld>;
    try { generated = generateEvaluationWorld(record); }
    catch (error) {
      generationFailures.push({ caseId: record.id, error: String(error) });
      continue;
    }
    const signature = mapSignature(generated.world);
    if (signature !== mapSignature(generateEvaluationWorld(record).world)) throw new Error(`World reproduction failure: ${record.id}`);
    validateEvaluationOracle(record, generated);
    const trials: EvaluationTrial[] = [];
    for (const agent of config.agents) {
      const count = agent === "random" ? config.randomReplications : 1;
      for (let replication = 0; replication < count; replication += 1) {
        const seed = agent === "random" ? evaluationAgentSeed(record, replication) : null;
        const world = cloneWorld(generated.world);
        const instance = createEvaluationAgent(agent, createAgentMission(world), seed);
        const result = runSimulation(world, instance, 1000);
        trials.push({ agent, replication, seed, outcomes: config.actionBudgets.map((budget) => deriveEvaluationOutcome(result, world, generated.shortestPathLength, budget)) });
      }
    }
    if (mapSignature(generated.world) !== signature) throw new Error(`World mutation: ${record.id}`);
    worlds.push({ specification: record, signature, attempts: generated.attempts, oracle: generated.shortestPathLength, trials });
    if (worlds.length % 25 === 0) progress(`${worlds.length}/${cases.length} cases completed (${record.stratum})`);
  }
  const strata = [...new Set(cases.map((record) => record.stratum))];
  const comparisons: readonly (readonly [EvaluationAgent, EvaluationAgent])[] = [
    ["information-gain", "coordinate"], ["random", "coordinate"], ["optimistic", "coordinate"],
    ["information-gain", "random"], ["optimistic", "information-gain"],
  ];
  const groups = strata.map((stratum) => {
    const subset = worlds.filter((world) => world.specification.stratum === stratum);
    return { stratum, requestedWorldCount: cases.filter((record) => record.stratum === stratum).length,
      generatedWorldCount: subset.length, uniqueLayoutCount: new Set(subset.map((w) => w.signature)).size,
      oracleDistances: describe(nonnull(subset.map((w) => w.oracle))),
      aggregates: config.actionBudgets.flatMap((budget) => config.agents.map((agent) => summarizeEvaluationGroup(subset, agent, budget))),
      paired: config.actionBudgets.flatMap((budget) => comparisons.map(([agent, baseline]) => summarizeEvaluationPairs(subset, stratum, agent, baseline, budget))),
    };
  });
  const anomalies = worlds.flatMap((world) => world.trials.flatMap((trial) => trial.outcomes.flatMap((outcome) =>
    outcome.category === "false-unreachable" || outcome.rejectedMoves > 0 ? [{ caseId: world.specification.id, agent: trial.agent, replication: trial.replication, budget: outcome.budget, category: outcome.category, rejectedMoves: outcome.rejectedMoves }] : [])));
  return {
    configuration: config, cases, generatorIdentities: {
      "random-obstacles": "generation.ts/generateWorldWithMetadata", maze: "maze-generation.ts/generateMazeWorld",
      trap: "trap-generation.ts/generateTrapWorld", doorway: "structural-generation.ts/generateBarrierWorld", sealed: "structural-generation.ts/generateBarrierWorld",
    },
    generationFailures, worlds, duplicateLayouts: duplicateLayouts(worlds), groups,
    worldPolicyMeans: worlds.flatMap((world) => config.actionBudgets.flatMap((budget) => config.agents.map((agent) => summarizeWorldPolicy(world, agent, budget)))),
    actualSimulationCount: worlds.reduce((sum, world) => sum + world.trials.length, 0),
    derivedOutcomeCount: worlds.reduce((sum, world) => sum + world.trials.reduce((n, trial) => n + trial.outcomes.length, 0), 0),
    criticalFalseUnreachable: anomalies.filter((a) => a.category === "false-unreachable"), anomalies,
  };
}
