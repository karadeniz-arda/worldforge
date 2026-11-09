import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";

/** Chooses one movement action from a local observation. */
export interface Agent {
  decide(observation: Observation): MovementDirection;
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
