import type { Position, World } from "./world.js";

/** The four single-cell actions available to the robot. */
export type MovementDirection = "up" | "down" | "left" | "right";

export type RejectedMoveReason = "out-of-bounds" | "obstacle";

export type MoveResult =
  | { readonly world: World; readonly succeeded: true }
  | { readonly world: World; readonly succeeded: false; readonly reason: RejectedMoveReason };

const directionOffsets: Record<MovementDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function isWithinWorld(world: World, position: Position): boolean {
  return position.x >= 0
    && position.x < world.width
    && position.y >= 0
    && position.y < world.height;
}

/**
 * Attempts a one-cell move without mutating the supplied world. A rejected
 * move returns the original world because its state has not changed.
 */
export function moveRobot(world: World, direction: MovementDirection): MoveResult {
  const offset = directionOffsets[direction];
  const nextRobotPosition = {
    x: world.robot.x + offset.x,
    y: world.robot.y + offset.y,
  };

  if (!isWithinWorld(world, nextRobotPosition)) {
    return { world, succeeded: false, reason: "out-of-bounds" };
  }

  if (world.obstacles.some((obstacle) => positionsMatch(obstacle, nextRobotPosition))) {
    return { world, succeeded: false, reason: "obstacle" };
  }

  return {
    world: {
      ...world,
      robot: nextRobotPosition,
    },
    succeeded: true,
  };
}
