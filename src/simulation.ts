import type { Agent } from "./agent.js";
import { hasReachedTarget } from "./goal.js";
import { moveRobot, type MovementDirection, type RejectedMoveReason } from "./movement.js";
import { observeWorld } from "./observation.js";
import type { World } from "./world.js";

export type SimulationStep =
  | { readonly action: MovementDirection; readonly succeeded: true }
  | { readonly action: MovementDirection; readonly succeeded: false; readonly reason: RejectedMoveReason };

export type SimulationTermination = "goal-reached" | "step-limit";

export interface SimulationResult {
  readonly world: World;
  readonly steps: readonly SimulationStep[];
  readonly successfulMoves: number;
  readonly rejectedMoves: number;
  readonly stepsTaken: number;
  readonly termination: SimulationTermination;
}

/**
 * Runs observe-decide-act cycles until the target is reached or the step limit
 * is used. Movement legality remains the responsibility of moveRobot.
 */
export function runSimulation(world: World, agent: Agent, stepCount: number): SimulationResult {
  let currentWorld = world;
  let successfulMoves = 0;
  let rejectedMoves = 0;
  const steps: SimulationStep[] = [];
  let termination: SimulationTermination = hasReachedTarget(currentWorld) ? "goal-reached" : "step-limit";

  for (let step = 0; step < stepCount && termination !== "goal-reached"; step += 1) {
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

    if (hasReachedTarget(currentWorld)) {
      termination = "goal-reached";
    }
  }

  return {
    world: currentWorld,
    steps,
    successfulMoves,
    rejectedMoves,
    stepsTaken: steps.length,
    termination,
  };
}
