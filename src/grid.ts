import type { Position } from "./world.js";

const obstacleIndexes = new WeakMap<readonly Position[], ReadonlySet<string>>();

/**
 * Fast, cached obstacle lookup for immutable obstacle arrays. Different array
 * identities receive independent indexes; callers must create a new array if
 * future dynamic-world logic changes obstacle positions.
 */
export function hasObstacle(obstacles: readonly Position[], position: Position): boolean {
  let index = obstacleIndexes.get(obstacles);
  if (index === undefined) {
    index = new Set(obstacles.map(positionKey));
    obstacleIndexes.set(obstacles, index);
  }
  return index.has(positionKey(position));
}

export function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}
