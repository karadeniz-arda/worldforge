import { describe, expect, it } from "vitest";

import { RuleBasedAgent, type Agent } from "../src/agent.js";
import type { MovementDirection } from "../src/movement.js";
import { runSimulation } from "../src/simulation.js";
import type { World } from "../src/world.js";

class ScriptedAgent implements Agent {
  private nextAction = 0;
  public decisions = 0;

  constructor(private readonly actions: readonly MovementDirection[]) {}

  decide(): MovementDirection {
    this.decisions += 1;
    const action = this.actions[this.nextAction];
    this.nextAction += 1;
    return action ?? "up";
  }
}

function createWorld(): World {
  return {
    width: 3,
    height: 3,
    robot: { x: 0, y: 0 },
    obstacles: [{ x: 1, y: 1 }],
    deliveryTarget: { x: 2, y: 2 },
  };
}

describe("runSimulation", () => {
  it("runs observe-decide-act cycles and records successful and rejected moves", () => {
    const result = runSimulation(createWorld(), new ScriptedAgent(["right", "down", "left", "up"]), 4);

    expect(result).toEqual({
      world: expect.objectContaining({ robot: { x: 0, y: 0 } }),
      successfulMoves: 2,
      rejectedMoves: 2,
      stepsTaken: 4,
      termination: "step-limit",
      movementAnalytics: {
        uniqueCellsVisited: 2,
        repeatedVisits: 1,
        immediateBacktracks: 1,
        repeatedVisitsPerSuccessfulMove: 0.5,
        immediateBacktracksPerSuccessfulMove: 0.5,
      },
      steps: [
        { action: "right", succeeded: true, positionBefore: { x: 0, y: 0 }, positionAfter: { x: 1, y: 0 } },
        { action: "down", succeeded: false, reason: "obstacle", positionBefore: { x: 1, y: 0 }, positionAfter: { x: 1, y: 0 } },
        { action: "left", succeeded: true, positionBefore: { x: 1, y: 0 }, positionAfter: { x: 0, y: 0 } },
        { action: "up", succeeded: false, reason: "out-of-bounds", positionBefore: { x: 0, y: 0 }, positionAfter: { x: 0, y: 0 } },
      ],
    });
  });

  it("preserves movement rules by leaving the robot in place for rejected actions", () => {
    const result = runSimulation(createWorld(), new ScriptedAgent(["up", "left"]), 2);

    expect(result.world.robot).toEqual({ x: 0, y: 0 });
    expect(result.steps).toEqual([
      { action: "up", succeeded: false, reason: "out-of-bounds", positionBefore: { x: 0, y: 0 }, positionAfter: { x: 0, y: 0 } },
      { action: "left", succeeded: false, reason: "out-of-bounds", positionBefore: { x: 0, y: 0 }, positionAfter: { x: 0, y: 0 } },
    ]);
  });

  it("terminates early on success and does not request actions after reaching the target", () => {
    const agent = new ScriptedAgent(["right", "right", "down", "down", "left"]);

    const result = runSimulation(createWorld(), agent, 10);

    expect(result.termination).toBe("goal-reached");
    expect(result.stepsTaken).toBe(4);
    expect(result.world.robot).toEqual({ x: 2, y: 2 });
    expect(result.successfulMoves).toBe(4);
    expect(result.rejectedMoves).toBe(0);
    expect(agent.decisions).toBe(4);
  });

  it("reports success when the target is reached on the final allowed step", () => {
    const result = runSimulation(
      createWorld(),
      new ScriptedAgent(["right", "right", "down", "down"]),
      4,
    );

    expect(result.termination).toBe("goal-reached");
    expect(result.stepsTaken).toBe(4);
    expect(result.world.robot).toEqual({ x: 2, y: 2 });
  });

  it("terminates successfully without actions when the robot starts on the target", () => {
    const world: World = { ...createWorld(), robot: { x: 2, y: 2 } };
    const agent = new ScriptedAgent(["left"]);

    expect(runSimulation(world, agent, 5)).toEqual({
      world,
      steps: [],
      successfulMoves: 0,
      rejectedMoves: 0,
      stepsTaken: 0,
      termination: "goal-reached",
      movementAnalytics: {
        uniqueCellsVisited: 1,
        repeatedVisits: 0,
        immediateBacktracks: 0,
        repeatedVisitsPerSuccessfulMove: null,
        immediateBacktracksPerSuccessfulMove: null,
      },
    });
    expect(agent.decisions).toBe(0);
  });

  it("reports a step-limit failure when the target is not reached", () => {
    const result = runSimulation(createWorld(), new ScriptedAgent(["up", "left"]), 2);

    expect(result.termination).toBe("step-limit");
    expect(result.stepsTaken).toBe(2);
    expect(result.world.robot).toEqual({ x: 0, y: 0 });
  });

  it("does not mutate the starting world", () => {
    const world = createWorld();
    const originalRobot = world.robot;
    const originalObstacle = world.obstacles[0];
    const originalTarget = world.deliveryTarget;

    const result = runSimulation(world, new ScriptedAgent(["right"]), 1);

    expect(result.world).not.toBe(world);
    expect(world.robot).toBe(originalRobot);
    expect(world.robot).toEqual({ x: 0, y: 0 });
    expect(world.obstacles[0]).toBe(originalObstacle);
    expect(world.deliveryTarget).toBe(originalTarget);
  });

  it("can loop when its local greedy fallback cannot get around an unseen wall", () => {
    const world: World = {
      width: 3,
      height: 3,
      robot: { x: 0, y: 1 },
      obstacles: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      deliveryTarget: { x: 2, y: 1 },
    };

    const result = runSimulation(world, new RuleBasedAgent(world.deliveryTarget), 4);

    expect(result.termination).toBe("step-limit");
    expect(result.world.robot).toEqual({ x: 0, y: 1 });
    expect(result.steps).toEqual([
      { action: "down", succeeded: true, positionBefore: { x: 0, y: 1 }, positionAfter: { x: 0, y: 2 } },
      { action: "up", succeeded: true, positionBefore: { x: 0, y: 2 }, positionAfter: { x: 0, y: 1 } },
      { action: "down", succeeded: true, positionBefore: { x: 0, y: 1 }, positionAfter: { x: 0, y: 2 } },
      { action: "up", succeeded: true, positionBefore: { x: 0, y: 2 }, positionAfter: { x: 0, y: 1 } },
    ]);
    expect(result.movementAnalytics).toEqual({
      uniqueCellsVisited: 2,
      repeatedVisits: 3,
      immediateBacktracks: 3,
      repeatedVisitsPerSuccessfulMove: 0.75,
      immediateBacktracksPerSuccessfulMove: 0.75,
    });
  });
});
