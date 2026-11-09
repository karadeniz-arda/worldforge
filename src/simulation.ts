import type { Agent } from "./agent.js";
import { moveRobot, type MovementDirection, type RejectedMoveReason } from "./movement.js";
import { observeWorld } from "./observation.js";
import type { World } from "./world.js";

export type SimulationStep =
  | { readonly action: MovementDirection; readonly succeeded: true }
  | { readonly action: MovementDirection; readonly succeeded: false; readonly reason: RejectedMoveReason };

export interface SimulationResult {
  readonly world: World;
  readonly steps: readonly SimulationStep[];
  readonly successfulMoves: number;
  readonly rejectedMoves: number;
}

/** Runs a fixed number of observe-decide-act cycles using the existing movement rules. */
export function runSimulation(world: World, agent: Agent, stepCount: number): SimulationResult {
  let currentWorld = world;
  let successfulMoves = 0;
  let rejectedMoves = 0;
  const steps: SimulationStep[] = [];

  for (let step = 0; step < stepCount; step += 1) {
    const action = agent.decide(observeWorld(currentWorld));
    const move = moveRobot(currentWorld, action);
    currentWorld = move.world;

    if (move.succeeded) {
      successfulMoves += 1;
      steps.push({ action, succeeded: true });
    } else {
      rejectedMoves += 1;
      steps.push({ action, succeeded: false, reason: move.reason });
    }
  }

  return { world: currentWorld, steps, successfulMoves, rejectedMoves };
}
