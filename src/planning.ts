import type { Agent, AgentDecision } from "./agent.js";
import type { AgentMission } from "./mission.js";
import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";
import {
  adjacentPosition as movePosition, cardinalDirections, copyKnownMap,
  countUnknownNeighbors, createUnknownMap, getKnownCell, updateKnownMap, type KnownMap,
} from "./known-map.js";

// Preserve existing imports while making knowledge reusable by other policies.
export { createUnknownMap, getKnownCell, updateKnownMap, type KnownCell, type KnownMap } from "./known-map.js";

export interface Frontier {
  readonly position: Position;
  /** A shortest path through known-free cells from the current robot position. */
  readonly path: readonly MovementDirection[];
}

export interface FrontierDiagnostic {
  readonly position: Position;
  readonly knownSafeDistance: number;
  readonly manhattanDistanceToTarget: number;
  readonly combinedScore: number;
  readonly unknownNeighborCount: number;
  readonly path: readonly MovementDirection[];
}

export type PlanningDecisionMode = "target-route" | "frontier" | "unreachable";
export type FrontierTieBreakPolicy = "coordinate" | "information-gain" | "random";

/** Read-only explanation of one decision, derived solely from known state. */
export interface PlanningDecisionDebug {
  readonly robot: Position;
  readonly discoveredMap: KnownMap;
  readonly frontierCandidates: readonly FrontierDiagnostic[];
  readonly selectedFrontier: Position | null;
  readonly selectionReason: string;
  readonly plannedRoute: readonly MovementDirection[];
  readonly mode: PlanningDecisionMode;
  readonly action: AgentDecision;
  readonly tieBreakPolicy: FrontierTieBreakPolicy;
}

export interface PlanningAgentOptions {
  /** Records detached decision snapshots for replay and tests. Disabled by default. */
  readonly recordDiagnostics?: boolean;
  /** Defaults to the original coordinate-based tie-break behavior. */
  readonly tieBreakPolicy?: FrontierTieBreakPolicy;
  /** Required for the random policy. Must return a value in [0, 1). */
  readonly random?: () => number;
}

/** Fixed expansion order used for deterministic BFS path reconstruction. */
export const planningDirectionOrder: readonly MovementDirection[] = cardinalDirections;

/**
 * Finds a deterministic shortest route through known-free cells only. Unknown
 * and blocked cells are excluded, including when they are the destination.
 */
export function findKnownFreePath(
  map: KnownMap,
  start: Position,
  destination: Position,
): readonly MovementDirection[] | null {
  if (getKnownCell(map, start) !== "free" || getKnownCell(map, destination) !== "free") {
    return null;
  }
  if (samePosition(start, destination)) {
    return [];
  }

  const queue: Position[] = [{ ...start }];
  const parents = new Map<string, { readonly previous: Position; readonly direction: MovementDirection }>();
  const visited = new Set<string>([positionKey(start)]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const direction of planningDirectionOrder) {
      const next = movePosition(current, direction);
      const key = positionKey(next);
      if (getKnownCell(map, next) !== "free" || visited.has(key)) {
        continue;
      }
      visited.add(key);
      parents.set(key, { previous: current, direction });
      if (samePosition(next, destination)) {
        return reconstructPath(start, destination, parents);
      }
      queue.push(next);
    }
  }

  return null;
}

/** Finds known-free cells that can reveal at least one still-unknown neighbor. */
export function findReachableFrontiers(map: KnownMap, start: Position): readonly Frontier[] {
  const frontiers: Frontier[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const position = { x, y };
      if (getKnownCell(map, position) !== "free" || !hasUnknownNeighbor(map, position)) {
        continue;
      }
      const path = findKnownFreePath(map, start, position);
      if (path !== null) {
        frontiers.push({ position, path });
      }
    }
  }

  return frontiers;
}

/**
 * Chooses the agreed hybrid frontier: shortest known-safe distance plus
 * Manhattan distance to the public target. Ties prefer shorter safe paths;
 * information-gain policy then prefers more unknown neighbors before stable
 * top-to-bottom and left-to-right coordinates. Random policy samples uniformly
 * from the minimum-score/minimum-distance set, consuming one draw only when
 * that set contains multiple candidates. Enumeration is row-major.
 */
export function selectGoalDirectedFrontier(
  map: KnownMap,
  start: Position,
  target: Position,
  tieBreakPolicy: FrontierTieBreakPolicy = "coordinate",
  random?: () => number,
): Frontier | null {
  if (tieBreakPolicy === "random" && random === undefined) {
    throw new Error("Random frontier policy requires an injected random function.");
  }
  const frontiers = findReachableFrontiers(map, start);
  let best: Frontier | null = null;

  for (const frontier of frontiers) {
    if (best === null || compareFrontiers(frontier, best, map, target, tieBreakPolicy) < 0) {
      best = frontier;
    }
  }
  if (tieBreakPolicy !== "random" || best === null) return best;
  const bestScore = best.path.length + manhattanDistance(best.position, target);
  const tied = frontiers.filter((frontier) => frontier.path.length === best.path.length
    && frontier.path.length + manhattanDistance(frontier.position, target) === bestScore);
  if (tied.length === 1) return tied[0]!;
  const draw = random!();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new Error("Random frontier policy requires random values in [0, 1).");
  }
  return tied[Math.floor(draw * tied.length)]!;
}

/** Scores every reachable frontier using the v1 goal-directed hybrid formula. */
export function describeFrontiers(
  map: KnownMap,
  start: Position,
  target: Position,
): readonly FrontierDiagnostic[] {
  return findReachableFrontiers(map, start).map((frontier) => ({
    position: { ...frontier.position },
    knownSafeDistance: frontier.path.length,
    manhattanDistanceToTarget: manhattanDistance(frontier.position, target),
    combinedScore: frontier.path.length + manhattanDistance(frontier.position, target),
    unknownNeighborCount: countUnknownNeighbors(map, frontier.position),
    path: [...frontier.path],
  }));
}

/**
 * Goal-directed, map-based exploration over observations only. It replans on
 * every observation and explicitly reports target-unreachable when no route or
 * reachable frontier remains.
 */
export class PlanningAgent implements Agent {
  private readonly mission: AgentMission;
  private readonly recordDiagnostics: boolean;
  private readonly tieBreakPolicy: FrontierTieBreakPolicy;
  private readonly random: (() => number) | undefined;
  private map: KnownMap;
  private latestDecisionDebug: PlanningDecisionDebug | null = null;

  constructor(mission: AgentMission, options: PlanningAgentOptions = {}) {
    this.mission = {
      start: { ...mission.start },
      target: { ...mission.target },
      width: mission.width,
      height: mission.height,
    };
    this.map = createUnknownMap(this.mission.width, this.mission.height);
    this.recordDiagnostics = options.recordDiagnostics ?? false;
    this.tieBreakPolicy = options.tieBreakPolicy ?? "coordinate";
    this.random = options.random;
    if (this.tieBreakPolicy === "random" && this.random === undefined) {
      throw new Error("Random frontier policy requires an injected random function.");
    }
  }

  decide(observation: Observation): AgentDecision {
    this.map = updateKnownMap(this.map, observation);

    const goalPath = findKnownFreePath(this.map, observation.robot, this.mission.target);
    if (goalPath !== null && goalPath.length > 0) {
      return this.finishDecision(observation.robot, "target-route", goalPath[0]!, goalPath, null);
    }

    const frontier = selectGoalDirectedFrontier(this.map, observation.robot, this.mission.target, this.tieBreakPolicy, this.random);
    if (frontier !== null && frontier.path.length > 0) {
      return this.finishDecision(observation.robot, "frontier", frontier.path[0]!, frontier.path, frontier);
    }

    return this.finishDecision(
      observation.robot,
      "unreachable",
      { kind: "stop", reason: "target-unreachable" },
      [],
      null,
    );
  }

  /** Returns a detached snapshot so later decisions cannot rewrite history. */
  getLatestDecisionDebug(): PlanningDecisionDebug | null {
    return this.latestDecisionDebug === null ? null : copyPlanningDecisionDebug(this.latestDecisionDebug);
  }

  private finishDecision(
    robot: Position,
    mode: PlanningDecisionMode,
    action: AgentDecision,
    plannedRoute: readonly MovementDirection[],
    selectedFrontier: Frontier | null,
  ): AgentDecision {
    if (!this.recordDiagnostics) {
      return action;
    }

    const candidates = describeFrontiers(this.map, robot, this.mission.target);
    this.latestDecisionDebug = {
      robot: { ...robot },
      discoveredMap: copyKnownMap(this.map),
      frontierCandidates: candidates,
      selectedFrontier: selectedFrontier === null ? null : { ...selectedFrontier.position },
      selectionReason: describeDecisionReason(mode, candidates, selectedFrontier, this.mission.target, this.tieBreakPolicy),
      plannedRoute: [...plannedRoute],
      mode,
      action,
      tieBreakPolicy: this.tieBreakPolicy,
    };
    return action;
  }
}

/** Copies a diagnostic snapshot without giving callers mutable agent state. */
export function copyPlanningDecisionDebug(snapshot: PlanningDecisionDebug): PlanningDecisionDebug {
  return {
    robot: { ...snapshot.robot },
    discoveredMap: copyKnownMap(snapshot.discoveredMap),
    frontierCandidates: snapshot.frontierCandidates.map((candidate) => ({
      position: { ...candidate.position },
      knownSafeDistance: candidate.knownSafeDistance,
      manhattanDistanceToTarget: candidate.manhattanDistanceToTarget,
      combinedScore: candidate.combinedScore,
      unknownNeighborCount: candidate.unknownNeighborCount,
      path: [...candidate.path],
    })),
    selectedFrontier: snapshot.selectedFrontier === null ? null : { ...snapshot.selectedFrontier },
    selectionReason: snapshot.selectionReason,
    plannedRoute: [...snapshot.plannedRoute],
    mode: snapshot.mode,
    action: snapshot.action,
    tieBreakPolicy: snapshot.tieBreakPolicy,
  };
}

function compareFrontiers(
  first: Frontier,
  second: Frontier,
  map: KnownMap,
  target: Position,
  tieBreakPolicy: FrontierTieBreakPolicy,
): number {
  const firstScore = first.path.length + manhattanDistance(first.position, target);
  const secondScore = second.path.length + manhattanDistance(second.position, target);
  if (firstScore !== secondScore) {
    return firstScore - secondScore;
  }
  if (first.path.length !== second.path.length) {
    return first.path.length - second.path.length;
  }
  if (tieBreakPolicy === "information-gain") {
    const firstInformationGain = countUnknownNeighbors(map, first.position);
    const secondInformationGain = countUnknownNeighbors(map, second.position);
    if (firstInformationGain !== secondInformationGain) {
      return secondInformationGain - firstInformationGain;
    }
  }
  if (first.position.y !== second.position.y) {
    return first.position.y - second.position.y;
  }
  return first.position.x - second.position.x;
}

function describeDecisionReason(
  mode: PlanningDecisionMode,
  candidates: readonly FrontierDiagnostic[],
  selectedFrontier: Frontier | null,
  target: Position,
  tieBreakPolicy: FrontierTieBreakPolicy,
): string {
  if (mode === "target-route") {
    return "Target is reachable through known-free cells; following deterministic BFS order right, down, left, up.";
  }
  if (mode === "unreachable") {
    return "No known-safe route to the target and no reachable frontier remains; reporting target-unreachable.";
  }

  const selected = candidates.find((candidate) => samePosition(candidate.position, selectedFrontier!.position));
  if (selected === undefined) {
    return "Selected a reachable frontier through known-free cells.";
  }
  const sameScore = candidates.filter((candidate) => candidate.combinedScore === selected.combinedScore);
  const sameDistance = sameScore
    .filter((candidate) => candidate.knownSafeDistance === selected.knownSafeDistance);
  const sameInformationGain = sameDistance
    .filter((candidate) => candidate.unknownNeighborCount === selected.unknownNeighborCount);
  const tieBreak = sameScore.length === 1
    ? "No tie required."
    : sameDistance.length === 1
      ? "Equal scores were resolved by shorter known-safe distance."
      : tieBreakPolicy === "random"
        ? `Uniform random selection among ${sameDistance.length} equal-score, equal-distance frontiers in row-major order.`
      : tieBreakPolicy === "information-gain" && sameInformationGain.length === 1
        ? "Equal primary scores and known-safe distances were resolved by higher unknown-neighbor information gain."
      : "Equal scores and distances were resolved by stable coordinates: top-to-bottom, then left-to-right.";
  return `Policy ${tieBreakPolicy}. Selected frontier (${selected.position.x}, ${selected.position.y}) with score ${selected.combinedScore} = ${selected.knownSafeDistance} known-safe + ${selected.manhattanDistanceToTarget} Manhattan and ${selected.unknownNeighborCount} unknown neighbors. ${tieBreak}`;
}

function hasUnknownNeighbor(map: KnownMap, position: Position): boolean {
  return countUnknownNeighbors(map, position) > 0;
}

function reconstructPath(
  start: Position,
  destination: Position,
  parents: ReadonlyMap<string, { readonly previous: Position; readonly direction: MovementDirection }>,
): readonly MovementDirection[] {
  const path: MovementDirection[] = [];
  let current = destination;
  while (!samePosition(current, start)) {
    const parent = parents.get(positionKey(current));
    if (parent === undefined) {
      return [];
    }
    path.push(parent.direction);
    current = parent.previous;
  }
  return path.reverse();
}

function manhattanDistance(first: Position, second: Position): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

function samePosition(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}
