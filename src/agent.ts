import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";

/** Chooses one movement action from a local observation. */
export interface Agent {
  decide(observation: Observation): MovementDirection;
}

const directions: readonly MovementDirection[] = ["up", "down", "left", "right"];

/** A baseline agent that ignores its observation and chooses a random direction. */
export class RandomAgent implements Agent {
  constructor(private readonly random: () => number = Math.random) {}

  decide(_observation: Observation): MovementDirection {
    return directions[Math.floor(this.random() * directions.length)]!;
  }
}
