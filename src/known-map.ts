import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";

export type KnownCell = "unknown" | "free" | "blocked";

export interface KnownMap {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly KnownCell[];
}

/** Stable cardinal order, also used for known-safe BFS path reconstruction. */
export const cardinalDirections: readonly MovementDirection[] = ["right", "down", "left", "up"];

const directionOffsets: Readonly<Record<MovementDirection, Position>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function adjacentPosition(position: Position, direction: MovementDirection): Position {
  const offset = directionOffsets[direction];
  return { x: position.x + offset.x, y: position.y + offset.y };
}

export function isKnownMapPositionInBounds(map: KnownMap, position: Position): boolean {
  return position.x >= 0 && position.x < map.width && position.y >= 0 && position.y < map.height;
}

/** Creates an independent map with no terrain knowledge. */
export function createUnknownMap(width: number, height: number): KnownMap {
  return { width, height, cells: Array.from({ length: width * height }, () => "unknown") };
}

/** Gets terrain knowledge for an in-bounds position, or undefined outside. */
export function getKnownCell(map: KnownMap, position: Position): KnownCell | undefined {
  return isKnownMapPositionInBounds(map, position) ? map.cells[position.y * map.width + position.x] : undefined;
}

/**
 * Incorporates only the current position and local observation. Static-world
 * observations may confirm known terrain, but contradictions throw explicitly.
 * Input maps remain unchanged even when an observation is inconsistent.
 */
export function updateKnownMap(map: KnownMap, observation: Observation): KnownMap {
  const cells = [...map.cells];
  const record = (position: Position, value: "free" | "blocked"): void => {
    if (!isKnownMapPositionInBounds(map, position)) return;
    const index = position.y * map.width + position.x;
    const previous = cells[index];
    if (previous !== "unknown" && previous !== value) {
      throw new Error(`Conflicting static terrain observation at (${position.x}, ${position.y}): ${previous} -> ${value}.`);
    }
    cells[index] = value;
  };
  record(observation.robot, "free");
  for (const direction of cardinalDirections) {
    const contents = observation.neighbors[direction];
    if (contents !== "boundary") {
      record(adjacentPosition(observation.robot, direction), contents === "obstacle" ? "blocked" : "free");
    }
  }
  return { ...map, cells };
}

export function copyKnownMap(map: KnownMap): KnownMap {
  return { width: map.width, height: map.height, cells: [...map.cells] };
}

/** Counts in-bounds unknown neighbours using agent knowledge alone. */
export function countUnknownNeighbors(map: KnownMap, position: Position): number {
  return cardinalDirections.filter((direction) => getKnownCell(map, adjacentPosition(position, direction)) === "unknown").length;
}
