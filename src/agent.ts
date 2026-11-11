import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";

export type AgentDecision =
  | MovementDirection
  | {
    readonly kind: "stop";
    readonly reason: "target-unreachable";
  };

/** Chooses one movement action from a local observation. */
export interface Agent {
  decide(observation: Observation): AgentDecision;
}

const directions: readonly MovementDirection[] = ["up", "down", "left", "right"];
const ruleBasedPriority: readonly MovementDirection[] = ["right", "down", "left", "up"];

const directionOffsets: Record<MovementDirection, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** A baseline agent that ignores its observation and chooses a random direction. */
export class RandomAgent implements Agent {
  constructor(private readonly random: () => number = Math.random) {}

  decide(_observation: Observation): MovementDirection {
    return directions[Math.floor(this.random() * directions.length)]!;
  }
}

/**
 * A random policy that avoids moves already known to be invalid from its local
 * observation. With no observed-safe neighbor, it deterministically returns
 * "up" so the existing movement engine records the rejected action.
 */
export class ValidRandomAgent implements Agent {
  constructor(private readonly random: () => number = Math.random) {}

  decide(observation: Observation): MovementDirection {
    const validDirections = directions.filter((direction) => {
      const contents = observation.neighbors[direction];
      return contents !== "obstacle" && contents !== "boundary";
    });

    if (validDirections.length === 0) {
      return "up";
    }

    return validDirections[Math.floor(this.random() * validDirections.length)]!;
  }
}

/**
 * A random local policy that remembers observed positions and prefers safe
 * adjacent cells it has not seen before. It has no map or pathfinding state.
 */
export class MemoryRandomAgent implements Agent {
  private readonly visitedPositions = new Set<string>();

  constructor(private readonly random: () => number = Math.random) {}

  decide(observation: Observation): MovementDirection {
    this.visitedPositions.add(positionKey(observation.robot));
    const validDirections = directions.filter((direction) => {
      const contents = observation.neighbors[direction];
      return contents === "empty" || contents === "target";
    });

    if (validDirections.length === 0) {
      return "up";
    }

    const unvisitedDirections = validDirections.filter((direction) => {
      const offset = directionOffsets[direction];
      return !this.visitedPositions.has(positionKey({
        x: observation.robot.x + offset.x,
        y: observation.robot.y + offset.y,
      }));
    });
    const choices = unvisitedDirections.length > 0 ? unvisitedDirections : validDirections;

    return choices[Math.floor(this.random() * choices.length)]!;
  }
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * A local greedy policy. It knows the public target coordinate, but sees only
 * the supplied observation; it can get stuck or loop around unseen layouts.
 */
export class RuleBasedAgent implements Agent {
  constructor(private readonly target: Position) {}

  decide(observation: Observation): MovementDirection {
    const currentDistance = this.distanceToTarget(observation.robot);
    const safeDirections = ruleBasedPriority.filter((direction) => {
      const contents = observation.neighbors[direction];
      return contents !== "obstacle" && contents !== "boundary";
    });

    const reducingDirection = safeDirections.find((direction) => {
      const offset = directionOffsets[direction];
      return this.distanceToTarget({
        x: observation.robot.x + offset.x,
        y: observation.robot.y + offset.y,
      }) < currentDistance;
    });

    // If no safe move improves distance, use a stable safe fallback. If the
    // robot is completely enclosed, an action is still required by Agent.
    return reducingDirection ?? safeDirections[0] ?? "up";
  }

  private distanceToTarget(position: Position): number {
    return Math.abs(position.x - this.target.x) + Math.abs(position.y - this.target.y);
  }
}
