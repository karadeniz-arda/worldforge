import { experiment006dConfiguration as config, type DiagnosticMazeCase, type MazeCondition } from "./experiment-006d-config.js";
import { annotateTreeTrajectory, recordOptimisticTrajectory } from "./experiment-006d-diagnostics.js";
import { mazeTerrainSignature, selectDiagnosticMissions } from "./experiment-006d-worlds.js";
import { describe, mean, quantile } from "./experiment-006-statistics.js";
import { stableSeed } from "./experiment-006.js";
import { generateMazeWorld } from "./maze-generation.js";
import { createAgentMission } from "./mission.js";
import { createSeededRandom } from "./random.js";

type AnnotatedDecision = ReturnType<typeof annotateTreeTrajectory>[number];
const marginCounts = (decisions: readonly AnnotatedDecision[]) => ({
  positive: decisions.filter((d) => d.oracle.marginClass === "positive").length,
  zero: decisions.filter((d) => d.oracle.marginClass === "zero").length,
  negative: decisions.filter((d) => d.oracle.marginClass === "negative").length,
  noAlternative: decisions.filter((d) => d.oracle.marginClass === "no-alternative").length,
});

export function summarizeDiagnosticEpisode(
  recorded: ReturnType<typeof recordOptimisticTrajectory>, decisions: readonly AnnotatedDecision[], oracle: number,
) {
  const { result } = recorded;
  const anomalies: string[] = [];
  if (result.rejectedMoves > 0) anomalies.push("rejected-movement");
  if (result.termination === "target-unreachable") anomalies.push("false-unreachable");
  const succeeded = result.termination === "goal-reached";
  if (succeeded && result.stepsTaken < oracle) anomalies.push("shorter-than-oracle");
  for (const d of decisions) {
    if (d.progression?.unchangedGraphOneStepDecrease === false) anomalies.push(`unchanged-graph-distance-violation/${d.decisionNumber}`);
    if (d.progression?.discoveryIncreaseAtCurrent !== null && d.progression?.discoveryIncreaseAtCurrent !== undefined
      && d.progression.discoveryIncreaseAtCurrent < 0) anomalies.push(`obstacle-removal-monotonicity-violation/${d.decisionNumber}`);
    if (d.oracle.wrongEdgeReturnStatus === "missing-return") anomalies.push(`missing-tree-edge-return/${d.decisionNumber}`);
    if (d.oracle.margin !== null && (d.oracle.margin % 2 !== 0 || Math.abs(d.oracle.margin) > 2)) {
      anomalies.push(`grid-neighbor-margin-violation/${d.decisionNumber}`);
    }
    if (typeof d.action === "string") {
      const selected = d.safeNeighbors.find((neighbor) => neighbor.direction === d.action);
      if (selected === undefined || selected.optimisticDistance === null || d.optimisticDistance === null
        || selected.optimisticDistance !== d.optimisticDistance - 1) anomalies.push(`unsafe-or-distance-inconsistent-action/${d.decisionNumber}`);
    }
  }
  return {
    termination: result.termination, movementAttempts: result.stepsTaken, successfulMoves: result.successfulMoves,
    rejectedMoves: result.rejectedMoves, decisionOpportunities: decisions.length,
    stopDecisions: decisions.filter((d) => typeof d.action !== "string").length,
    succeeded, oracleOptimal: succeeded && result.stepsTaken === oracle,
    spl: succeeded ? oracle / Math.max(oracle, result.stepsTaken) : 0,
    successfulActionOracleRatio: succeeded ? result.stepsTaken / oracle : null,
    wrongBranchChoices: decisions.filter((d) => d.oracle.wrongBranchChoice).length,
    observedWrongEdgeReturns: decisions.filter((d) => d.oracle.wrongEdgeReturnStatus === "observed-return").length,
    censoredWrongEdgeReturns: decisions.filter((d) => d.oracle.wrongEdgeReturnStatus === "censored-at-limit").length,
    optimisticTies: decisions.filter((d) => d.oracle.optimisticMinimumTie).length,
    margins: marginCounts(decisions), forwardChoiceMargins: marginCounts(decisions.filter((d) => d.oracle.genuineForwardChoice)),
    meanMargin: mean(decisions.flatMap((d) => d.oracle.margin === null ? [] : [d.oracle.margin])),
    meanForwardChoiceMargin: mean(decisions.flatMap((d) => !d.oracle.genuineForwardChoice || d.oracle.margin === null ? [] : [d.oracle.margin])),
    choiceCounts: {
      genuineForward: decisions.filter((d) => d.oracle.genuineForwardChoice).length,
      forcedCorridor: decisions.filter((d) => d.oracle.forcedCorridorMove).length,
      returnToParent: decisions.filter((d) => d.oracle.returnToDiscoveryParent).length,
      involvingPreviousCell: decisions.filter((d) => d.oracle.choiceInvolvingPreviousCell).length,
      trueBranchingVertex: decisions.filter((d) => d.oracle.trueBranchingVertex).length,
    },
    graphChanges: decisions.filter((d) => d.progression?.graphChanged).length,
    discoveryDistanceIncreases: decisions.filter((d) => (d.progression?.discoveryIncreaseAtCurrent ?? 0) > 0).length,
    repeatedVisits: result.movementAnalytics.repeatedVisits,
    immediateBacktracks: result.movementAnalytics.immediateBacktracks,
    anomalies,
  };
}
export type EpisodeSummary = ReturnType<typeof summarizeDiagnosticEpisode>;
export type DiagnosticEpisode = {
  readonly condition: MazeCondition;
  readonly status: "evaluated";
  readonly mission: ReturnType<typeof createAgentMission>;
  readonly oracle: number;
  readonly truePath: readonly { readonly x: number; readonly y: number }[];
  readonly knownMapStates: readonly string[];
  readonly decisions: readonly AnnotatedDecision[];
  readonly movements: ReturnType<typeof recordOptimisticTrajectory>["result"]["steps"];
  readonly finalPosition: { readonly x: number; readonly y: number };
  readonly summary: EpisodeSummary;
} | { readonly condition: MazeCondition; readonly status: "selection-failure" | "trajectory-failure"; readonly reason: string };
export interface DiagnosticMazeResult {
  readonly specification: DiagnosticMazeCase;
  readonly status: "evaluated" | "maze-failure";
  readonly signature: string | null;
  readonly reason: string | null;
  readonly episodes: readonly DiagnosticEpisode[];
}
type EvaluatedEpisode = Extract<DiagnosticEpisode, { status: "evaluated" }>;

export function summarizeDiagnosticCondition(mazes: readonly DiagnosticMazeResult[], size: number, condition: MazeCondition) {
  const requested = mazes.filter((maze) => maze.specification.size === size);
  const episodes = requested.flatMap((maze) => maze.episodes.filter((e): e is EvaluatedEpisode => e.condition === condition && e.status === "evaluated"));
  const decisions = episodes.flatMap((e) => e.decisions);
  const successful = episodes.filter((e) => e.summary.succeeded);
  const margins = decisions.flatMap((d) => d.oracle.margin === null ? [] : [d.oracle.margin]);
  const forward = decisions.filter((d) => d.oracle.genuineForwardChoice);
  const sum = (key: "wrongBranchChoices" | "repeatedVisits" | "immediateBacktracks" | "optimisticTies" | "observedWrongEdgeReturns" | "censoredWrongEdgeReturns") => episodes.reduce((n, e) => n + e.summary[key], 0);
  return {
    size, condition, requestedMazes: requested.length, evaluatedEpisodes: episodes.length,
    selectionFailures: requested.flatMap((m) => m.episodes).filter((e) => e.condition === condition && e.status === "selection-failure").length,
    trajectoryFailures: requested.flatMap((m) => m.episodes).filter((e) => e.condition === condition && e.status === "trajectory-failure").length,
    mazeFailures: requested.filter((m) => m.status === "maze-failure").length,
    successes: successful.length, oracleOptimal: successful.filter((e) => e.summary.oracleOptimal).length,
    nonOptimalSuccessful: successful.filter((e) => !e.summary.oracleOptimal).length,
    stepLimits: episodes.filter((e) => e.summary.termination === "step-limit").length,
    falseUnreachable: episodes.filter((e) => e.summary.termination === "target-unreachable").length,
    successRate: mean(episodes.map((e) => Number(e.summary.succeeded))),
    optimalityRate: mean(episodes.map((e) => Number(e.summary.oracleOptimal))),
    meanSPL: mean(episodes.map((e) => e.summary.spl)),
    successfulActionOracleRatios: describe(successful.map((e) => e.summary.successfulActionOracleRatio!)),
    wrongBranchChoices: sum("wrongBranchChoices"), optimisticTies: sum("optimisticTies"),
    observedWrongEdgeReturns: sum("observedWrongEdgeReturns"), censoredWrongEdgeReturns: sum("censoredWrongEdgeReturns"),
    margins: marginCounts(decisions), marginDistribution: describe(margins),
    forwardChoiceMargins: marginCounts(forward), forwardMarginDistribution: describe(forward.flatMap((d) => d.oracle.margin === null ? [] : [d.oracle.margin])),
    repeatedVisits: sum("repeatedVisits"), immediateBacktracks: sum("immediateBacktracks"),
    anomalies: episodes.flatMap((e) => e.summary.anomalies),
  };
}

function pairedBootstrap(values: readonly number[], seed: number, mode: "pilot" | "full") {
  if (mode === "pilot" || values.length === 0 || values.every((v) => v === values[0])) return null;
  const random = createSeededRandom(seed);
  const samples: number[] = [];
  for (let i = 0; i < config.bootstrapIterations; i += 1) {
    let sum = 0;
    for (let j = 0; j < values.length; j += 1) sum += values[Math.floor(random() * values.length)]!;
    samples.push(sum / values.length);
  }
  return { lower: quantile(samples, 0.025)!, upper: quantile(samples, 0.975)! };
}

export function summarizeDiagnosticPairs(mazes: readonly DiagnosticMazeResult[], size: number, first: MazeCondition, second: MazeCondition, mode: "pilot" | "full") {
  const pairs = mazes.filter((m) => m.specification.size === size).map((maze) => ({ maze,
    first: maze.episodes.find((e): e is EvaluatedEpisode => e.condition === first && e.status === "evaluated"),
    second: maze.episodes.find((e): e is EvaluatedEpisode => e.condition === second && e.status === "evaluated"),
  }));
  const sharedTarget = (first === "A" && second === "C") || (first === "B" && second === "D");
  for (const pair of pairs) {
    if (pair.first === undefined || pair.second === undefined) continue;
    const a = sharedTarget ? pair.first.mission.target : pair.first.mission.start;
    const b = sharedTarget ? pair.second.mission.target : pair.second.mission.start;
    if (a.x !== b.x || a.y !== b.y) throw new Error(`Mismatched ${sharedTarget ? "target" : "start"} in paired contrast ${first}-${second}.`);
  }
  const metrics = {
    spl: (e: EpisodeSummary) => e.spl, optimality: (e: EpisodeSummary) => Number(e.oracleOptimal),
    wrongBranches: (e: EpisodeSummary) => e.wrongBranchChoices, repeats: (e: EpisodeSummary) => e.repeatedVisits,
    backtracks: (e: EpisodeSummary) => e.immediateBacktracks,
    meanMargin: (e: EpisodeSummary) => e.meanMargin,
    meanForwardChoiceMargin: (e: EpisodeSummary) => e.meanForwardChoiceMargin,
    negativeMarginFraction: (e: EpisodeSummary) => {
      const count = e.margins.positive + e.margins.zero + e.margins.negative;
      return count === 0 ? null : e.margins.negative / count;
    },
    successfulRatio: (e: EpisodeSummary) => e.successfulActionOracleRatio,
  };
  return { size, contrast: `${first}-${second}`, matchedOn: sharedTarget ? "terrain-and-target" : "terrain-and-start", metrics: Object.fromEntries(Object.entries(metrics).map(([name, metric]) => {
    const valid = pairs.flatMap((p) => {
      if (p.first === undefined || p.second === undefined) return [];
      const a = metric(p.first.summary);
      const b = metric(p.second.summary);
      return a === null || b === null ? [] : [{ id: p.maze.specification.id, difference: a - b }];
    });
    const values = valid.map((v) => v.difference);
    return [name, { pairedMazeCount: values.length, excludedMazeIds: pairs.filter((p) => !valid.some((v) => v.id === p.maze.specification.id)).map((p) => p.maze.specification.id),
      values: valid, meanDifference: mean(values),
      confidenceInterval: pairedBootstrap(values, stableSeed([config.bootstrapSeedBase, size, `${first}-${second}`, name], config.bootstrapSeedBase), mode),
      intervalStatus: mode === "pilot" ? "pilot-omitted" : values.length === 0 ? "empty" : values.every((v) => v === values[0]) ? "degenerate-omitted" : "paired-maze-bootstrap",
    }];
  })) };
}

export function runExperiment006d(cases: readonly DiagnosticMazeCase[], mode: "pilot" | "full") {
  if (new Set(cases.map((c) => c.id)).size !== cases.length) throw new Error("Duplicate diagnostic maze IDs.");
  const mazes = cases.map((record) => {
    try {
      const generated = generateMazeWorld({ width: record.size, height: record.size, worldSeed: record.worldSeed });
      const selected = selectDiagnosticMissions(generated.world, record);
      const episodes: DiagnosticEpisode[] = selected.missions.map((mission) => {
        if (mission.status === "selection-failure") return mission;
        try {
          const recorded = recordOptimisticTrajectory(mission.world, config.movementBudget);
          const decisions = annotateTreeTrajectory(mission.world, selected.tree, recorded);
          return { condition: mission.condition, status: "evaluated", mission: createAgentMission(mission.world),
            oracle: mission.oracle, truePath: mission.truePath,
            knownMapStates: recorded.knownMapStates, decisions, movements: recorded.result.steps,
            finalPosition: recorded.result.world.robot,
            summary: summarizeDiagnosticEpisode(recorded, decisions, mission.oracle),
          };
        } catch (error) { return { condition: mission.condition, status: "trajectory-failure", reason: String(error) }; }
      });
      if (mazeTerrainSignature(generated.world) !== selected.signature) throw new Error("Terrain changed during diagnostics.");
      return { specification: record, status: "evaluated" as const, signature: selected.signature, reason: null,
        root: config.root, terrain: { width: generated.world.width, height: generated.world.height, obstacles: generated.world.obstacles },
        tree: { vertices: selected.tree.vertices.length, edges: selected.tree.edgeCount, connected: true, acyclic: true },
        endpoints: selected.endpoints, selections: selected.selections, episodes };
    } catch (error) {
      return { specification: record, status: "maze-failure" as const, signature: null, reason: String(error), episodes: [] };
    }
  });
  const duplicateGroups = new Map<string, string[]>();
  for (const maze of mazes) if (maze.signature !== null) {
    const key = `${maze.specification.size}/${maze.signature}`;
    const ids = duplicateGroups.get(key) ?? [];
    ids.push(maze.specification.id);
    duplicateGroups.set(key, ids);
  }
  const conditions = config.sizes.flatMap((size) => config.conditions.map((condition) => summarizeDiagnosticCondition(mazes, size, condition)));
  return {
    mode, configuration: config, caseSchedule: cases,
    generatorIdentity: "maze-generation.ts/generateMazeWorld", agentIdentity: "optimistic-bfs.ts/OptimisticBFSAgent",
    mapStateEncoding: { unknown: "?", free: ".", blocked: "#", layout: "row-major; decision state index references knownMapStates" },
    requestedMazes: cases.length, expectedPrimaryTrajectories: cases.length * 4,
    actualTrajectories: mazes.reduce((n, m) => n + m.episodes.filter((e) => e.status === "evaluated").length, 0),
    mazes, duplicateLayouts: [...duplicateGroups].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, mazeIds: ids })),
    conditions,
    paired: config.sizes.flatMap((size) => [...config.primaryContrasts, ...config.secondaryContrasts].map(([a, b]) => summarizeDiagnosticPairs(mazes, size, a, b, mode))),
    failures: mazes.flatMap((m) => m.status === "maze-failure" ? [{ id: m.specification.id, phase: "maze", reason: m.reason }]
      : m.episodes.flatMap((e) => e.status === "evaluated" ? [] : [{ id: `${m.specification.id}/${e.condition}`, phase: e.status, reason: e.reason }])),
    criticalAnomalies: mazes.flatMap((m) => m.episodes.flatMap((e) => e.status !== "evaluated" ? []
      : e.summary.anomalies.map((reason) => ({ id: m.specification.id, condition: e.condition, reason })))),
    hypothesisChallenges: mazes.flatMap((m) => m.episodes.flatMap((e) => e.status !== "evaluated" ? [] : [
      ...((e.condition === "A" || e.condition === "B") && e.summary.succeeded && !e.summary.oracleOptimal
        ? [{ id: `${m.specification.id}/${e.condition}`, kind: "root-nonoptimal" }] : []),
      ...e.decisions.filter((d) => (e.condition === "A" || e.condition === "B") && d.oracle.onOriginalStartTargetPath && d.oracle.margin !== null && d.oracle.margin <= 0)
        .map((d) => ({ id: `${m.specification.id}/${e.condition}/decision-${d.decisionNumber}`, kind: "root-nonstrict-margin" })),
    ])),
  };
}
