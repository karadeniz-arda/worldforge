import { describe, expect, it } from "vitest";

import type { Agent } from "../src/agent.js";
import type { MovementDirection } from "../src/movement.js";
import { runSimulation } from "../src/simulation.js";
import type { World } from "../src/world.js";

class ScriptedAgent implements Agent {
  private nextAction = 0;

  constructor(private readonly actions: readonly MovementDirection[]) {}

  decide(): MovementDirection {
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
      steps: [
        { action: "right", succeeded: true },
        { action: "down", succeeded: false, reason: "obstacle" },
        { action: "left", succeeded: true },
        { action: "up", succeeded: false, reason: "out-of-bounds" },
      ],
    });
  });

  it("preserves movement rules by leaving the robot in place for rejected actions", () => {
    const result = runSimulation(createWorld(), new ScriptedAgent(["up", "left"]), 2);

    expect(result.world.robot).toEqual({ x: 0, y: 0 });
    expect(result.steps).toEqual([
      { action: "up", succeeded: false, reason: "out-of-bounds" },
      { action: "left", succeeded: false, reason: "out-of-bounds" },
    ]);
  });
});
