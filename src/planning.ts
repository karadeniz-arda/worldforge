import type { Agent } from "./agent.js";
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
 * Manhattan distance to the public target. Ties prefer shorter safe paths,
 * then top-to-bottom and left-to-right coordinates.
 */
export function selectGoalDirectedFrontier(
  map: KnownMap,
  start: Position,
  target: Position,
): Frontier | null {
  const frontiers = findReachableFrontiers(map, start);
  let best: Frontier | null = null;

  for (const frontier of frontiers) {
    if (best === null || compareFrontiers(frontier, best, target) < 0) {
      best = frontier;
    }
  }
  return best;
}

/**
 * Goal-directed, map-based exploration over observations only. It replans on
 * every observation and falls back to "up" when no route or frontier exists;
 * Agent currently has no explicit action for reporting an unreachable mission.
 */
export class PlanningAgent implements Agent {
  private readonly mission: AgentMission;
  private map: KnownMap;

  constructor(mission: AgentMission) {
    this.mission = {
      start: { ...mission.start },
      target: { ...mission.target },
      width: mission.width,
      height: mission.height,
    };
    this.map = createUnknownMap(this.mission.width, this.mission.height);
  }

  decide(observation: Observation): MovementDirection {
    this.map = updateKnownMap(this.map, observation);

    const goalPath = findKnownFreePath(this.map, observation.robot, this.mission.target);
    if (goalPath !== null && goalPath.length > 0) {
      return goalPath[0]!;
    }

    const frontier = selectGoalDirectedFrontier(this.map, observation.robot, this.mission.target);
    if (frontier !== null && frontier.path.length > 0) {
      return frontier.path[0]!;
    }

    return "up";
  }
}

function compareFrontiers(first: Frontier, second: Frontier, target: Position): number {
  const firstScore = first.path.length + manhattanDistance(first.position, target);
  const secondScore = second.path.length + manhattanDistance(second.position, target);
  if (firstScore !== secondScore) {
    return firstScore - secondScore;
  }
  if (first.path.length !== second.path.length) {
    return first.path.length - second.path.length;
  }
  if (first.position.y !== second.position.y) {
    return first.position.y - second.position.y;
  }
  return first.position.x - second.position.x;
}

function hasUnknownNeighbor(map: KnownMap, position: Position): boolean {
  return planningDirectionOrder.some((direction) => getKnownCell(map, movePosition(position, direction)) === "unknown");
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
