import type { Agent, AgentDecision } from "./agent.js";
import type { AgentMission } from "./mission.js";
import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";

/** Terrain knowledge available to PlanningAgent; unknown is never traversable. */
export type KnownCell = "unknown" | "free" | "blocked";

export interface KnownMap {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly KnownCell[];
}

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
export type FrontierTieBreakPolicy = "coordinate" | "information-gain";

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
}

/** Fixed expansion order used for deterministic BFS path reconstruction. */
export const planningDirectionOrder: readonly MovementDirection[] = ["right", "down", "left", "up"];

const directionOffsets: Record<MovementDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Creates a map with no terrain knowledge. */
export function createUnknownMap(width: number, height: number): KnownMap {
  return { width, height, cells: Array.from({ length: width * height }, () => "unknown") };
}

/** Returns a new map updated only from one local observation. */
export function updateKnownMap(map: KnownMap, observation: Observation): KnownMap {
  const cells = [...map.cells];
  setCell(cells, map, observation.robot, "free");

  for (const direction of planningDirectionOrder) {
    const offset = directionOffsets[direction];
    const neighbor = { x: observation.robot.x + offset.x, y: observation.robot.y + offset.y };
    const contents = observation.neighbors[direction];
    if (contents === "boundary") {
      continue;
    }
    setCell(cells, map, neighbor, contents === "obstacle" ? "blocked" : "free");
  }

  return { ...map, cells };
}

/** Gets terrain knowledge for an in-bounds map position. */
export function getKnownCell(map: KnownMap, position: Position): KnownCell | undefined {
  return isInBounds(map, position) ? map.cells[toIndex(map, position)] : undefined;
}

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
 * top-to-bottom and left-to-right coordinates.
 */
export function selectGoalDirectedFrontier(
  map: KnownMap,
  start: Position,
  target: Position,
  tieBreakPolicy: FrontierTieBreakPolicy = "coordinate",
): Frontier | null {
  const frontiers = findReachableFrontiers(map, start);
  let best: Frontier | null = null;

  for (const frontier of frontiers) {
    if (best === null || compareFrontiers(frontier, best, map, target, tieBreakPolicy) < 0) {
      best = frontier;
    }
  }
  return best;
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
  }

  decide(observation: Observation): AgentDecision {
    this.map = updateKnownMap(this.map, observation);

    const goalPath = findKnownFreePath(this.map, observation.robot, this.mission.target);
    if (goalPath !== null && goalPath.length > 0) {
      return this.finishDecision(observation.robot, "target-route", goalPath[0]!, goalPath, null);
    }

    const frontier = selectGoalDirectedFrontier(this.map, observation.robot, this.mission.target, this.tieBreakPolicy);
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
      : tieBreakPolicy === "information-gain" && sameInformationGain.length === 1
        ? "Equal primary scores and known-safe distances were resolved by higher unknown-neighbor information gain."
      : "Equal scores and distances were resolved by stable coordinates: top-to-bottom, then left-to-right.";
  return `Policy ${tieBreakPolicy}. Selected frontier (${selected.position.x}, ${selected.position.y}) with score ${selected.combinedScore} = ${selected.knownSafeDistance} known-safe + ${selected.manhattanDistanceToTarget} Manhattan and ${selected.unknownNeighborCount} unknown neighbors. ${tieBreak}`;
}

function copyKnownMap(map: KnownMap): KnownMap {
  return { width: map.width, height: map.height, cells: [...map.cells] };
}

function hasUnknownNeighbor(map: KnownMap, position: Position): boolean {
  return countUnknownNeighbors(map, position) > 0;
}

function countUnknownNeighbors(map: KnownMap, position: Position): number {
  return planningDirectionOrder.filter((direction) => getKnownCell(map, movePosition(position, direction)) === "unknown").length;
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

function setCell(cells: KnownCell[], map: KnownMap, position: Position, value: KnownCell): void {
  if (isInBounds(map, position)) {
    cells[toIndex(map, position)] = value;
  }
}

function isInBounds(map: KnownMap, position: Position): boolean {
  return position.x >= 0 && position.x < map.width && position.y >= 0 && position.y < map.height;
}

function toIndex(map: KnownMap, position: Position): number {
  return position.y * map.width + position.x;
}

function movePosition(position: Position, direction: MovementDirection): Position {
  const offset = directionOffsets[direction];
  return { x: position.x + offset.x, y: position.y + offset.y };
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
