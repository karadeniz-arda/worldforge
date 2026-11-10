import type { Position, World } from "./world.js";

/**
 * Public information supplied when an agent is created. Terrain remains
 * private to the simulation and is revealed only through observations.
 */
export interface AgentMission {
  readonly start: Position;
  readonly target: Position;
  readonly width: number;
  readonly height: number;
}

/** Creates a fresh public mission descriptor without exposing world obstacles. */
export function createAgentMission(world: World): AgentMission {
  return {
    start: { ...world.robot },
    target: { ...world.deliveryTarget },
    width: world.width,
    height: world.height,
  };
}
