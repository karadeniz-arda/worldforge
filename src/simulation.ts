import type { Agent } from "./agent.js";
import { calculateMovementAnalytics, type MovementAnalytics } from "./analytics.js";
import { hasReachedTarget } from "./goal.js";
import { moveRobot, type MovementDirection, type RejectedMoveReason } from "./movement.js";
import { observeWorld, type Observation } from "./observation.js";
import type { Position, World } from "./world.js";

export type SimulationStep =
  | {
    readonly action: MovementDirection;
    readonly succeeded: true;
    readonly positionBefore: Position;
    readonly positionAfter: Position;
  }
  | {
    readonly action: MovementDirection;
    readonly succeeded: false;
    readonly reason: RejectedMoveReason;
    readonly positionBefore: Position;
    readonly positionAfter: Position;
  };

export type SimulationTermination = "goal-reached" | "step-limit";

export interface SimulationResult {
  readonly world: World;
  readonly steps: readonly SimulationStep[];
  readonly successfulMoves: number;
  readonly rejectedMoves: number;
  readonly stepsTaken: number;
  readonly termination: SimulationTermination;
  readonly movementAnalytics: MovementAnalytics;
}

/** The static ground truth needed by a replay viewer, stored once per run. */
export interface ReplayMap {
  readonly width: number;
  readonly height: number;
  readonly obstacles: readonly Position[];
  readonly target: Position;
}

export type ReplayStep = SimulationStep & {
  readonly stepNumber: number;
  /** Exactly the local information supplied to the agent before this action. */
  readonly observation: Observation;
};

export interface SimulationTrace {
  readonly map: ReplayMap;
  /** Public mission capabilities actually supplied to the replayed agent. */
  readonly publicMission: ReplayPublicMission | null;
  readonly initialPosition: Position;
  readonly finalPosition: Position;
  readonly termination: SimulationTermination;
  readonly steps: readonly ReplayStep[];
}

/** Optional public facts used only to render what an agent could know. */
export interface ReplayPublicMission {
  readonly target?: Position;
}

export interface TracedSimulation {
  readonly result: SimulationResult;
  readonly trace: SimulationTrace;
}

/**
 * Runs observe-decide-act cycles until the target is reached or the step limit
 * is used. Movement legality remains the responsibility of moveRobot.
 */
export function runSimulation(world: World, agent: Agent, stepCount: number): SimulationResult {
  return runSimulationInternal(world, agent, stepCount).result;
}

/**
 * Runs the same simulation while recording the local observation before every
 * action. This is intentionally separate from runSimulation so benchmarks do
 * not allocate replay data unless they explicitly opt in.
 */
export function runSimulationWithTrace(
  world: World,
  agent: Agent,
  stepCount: number,
  publicMission: ReplayPublicMission | null = null,
): TracedSimulation {
  const traceSteps: ReplayStep[] = [];
  const run = runSimulationInternal(world, agent, stepCount, traceSteps);

  return {
    result: run.result,
    trace: {
      map: {
        width: world.width,
        height: world.height,
        obstacles: world.obstacles.map((obstacle) => ({ ...obstacle })),
        target: { ...world.deliveryTarget },
      },
      publicMission: publicMission === null ? null : copyPublicMission(publicMission),
      initialPosition: { ...world.robot },
      finalPosition: { ...run.result.world.robot },
      termination: run.result.termination,
      steps: traceSteps,
    },
  };
}

function runSimulationInternal(
  world: World,
  agent: Agent,
  stepCount: number,
  traceSteps?: ReplayStep[],
): { readonly result: SimulationResult } {
  let currentWorld = world;
  let successfulMoves = 0;
  let rejectedMoves = 0;
  const steps: SimulationStep[] = [];
  let termination: SimulationTermination = hasReachedTarget(currentWorld) ? "goal-reached" : "step-limit";

  for (let step = 0; step < stepCount && termination !== "goal-reached"; step += 1) {
    const positionBefore = { ...currentWorld.robot };
    const observation = observeWorld(currentWorld);
    const action = agent.decide(observation);
    const move = moveRobot(currentWorld, action);
    currentWorld = move.world;
    const positionAfter = { ...currentWorld.robot };

    if (move.succeeded) {
      successfulMoves += 1;
      const simulationStep = { action, succeeded: true, positionBefore, positionAfter } as const;
      steps.push(simulationStep);
      traceSteps?.push({ ...simulationStep, stepNumber: step + 1, observation: copyObservation(observation) });
    } else {
      rejectedMoves += 1;
      const simulationStep = { action, succeeded: false, reason: move.reason, positionBefore, positionAfter } as const;
      steps.push(simulationStep);
      traceSteps?.push({ ...simulationStep, stepNumber: step + 1, observation: copyObservation(observation) });
    }

    if (hasReachedTarget(currentWorld)) {
      termination = "goal-reached";
    }
  }

  return {
    result: {
      world: currentWorld,
      steps,
      successfulMoves,
      rejectedMoves,
      stepsTaken: steps.length,
      termination,
      movementAnalytics: calculateMovementAnalytics(world.robot, steps),
    },
  };
}

function copyObservation(observation: Observation): Observation {
  return {
    robot: { ...observation.robot },
    neighbors: { ...observation.neighbors },
  };
}

function copyPublicMission(mission: ReplayPublicMission): ReplayPublicMission {
  return mission.target === undefined ? {} : { target: { ...mission.target } };
}
