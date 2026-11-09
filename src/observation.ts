import type { MovementDirection } from "./movement.js";
import type { Position, World } from "./world.js";

export type NeighborContents = "empty" | "obstacle" | "target" | "boundary";

/** The limited information made available to an agent for one decision. */
export interface Observation {
  readonly robot: Position;
  readonly neighbors: Readonly<Record<MovementDirection, NeighborContents>>;
}

const directionOffsets: Record<MovementDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function describeCell(world: World, position: Position): NeighborContents {
  if (position.x < 0 || position.x >= world.width || position.y < 0 || position.y >= world.height) {
    return "boundary";
  }

  if (world.obstacles.some((obstacle) => positionsMatch(obstacle, position))) {
    return "obstacle";
  }

  if (positionsMatch(world.deliveryTarget, position)) {
    return "target";
  }

  return "empty";
}

/** Creates the complete, intentionally local view available to an agent. */
export function observeWorld(world: World): Observation {
  const robot = { ...world.robot };
  const neighbors = {} as Record<MovementDirection, NeighborContents>;

  for (const direction of Object.keys(directionOffsets) as MovementDirection[]) {
    const offset = directionOffsets[direction];
    neighbors[direction] = describeCell(world, {
      x: robot.x + offset.x,
      y: robot.y + offset.y,
    });
  }

  return { robot, neighbors };
}
