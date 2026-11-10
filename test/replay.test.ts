import { describe, expect, it } from "vitest";

import { RandomAgent, type Agent } from "../src/agent.js";
import type { MovementDirection } from "../src/movement.js";
import { createSeededRandom } from "../src/random.js";
import { reconstructRevealedWorld } from "../src/replay.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import type { World } from "../src/world.js";

class ScriptedAgent implements Agent {
  private actionIndex = 0;

  constructor(private readonly actions: readonly MovementDirection[]) {}

  decide(): MovementDirection {
    const action = this.actions[this.actionIndex];
    this.actionIndex += 1;
    return action ?? "up";
  }
}

function createWorld(): World {
  return {
    width: 4,
    height: 4,
    robot: { x: 0, y: 0 },
    obstacles: [{ x: 1, y: 1 }, { x: 3, y: 3 }],
    deliveryTarget: { x: 3, y: 2 },
  };
}

describe("simulation replay traces", () => {
  it("is deterministic with the same seeded agent", () => {
    const first = runSimulationWithTrace(createWorld(), new RandomAgent(createSeededRandom(42)), 10);
    const second = runSimulationWithTrace(createWorld(), new RandomAgent(createSeededRandom(42)), 10);

    expect(first).toEqual(second);
  });

  it("records observations and before/after positions for accepted and rejected moves", () => {
    const replay = runSimulationWithTrace(createWorld(), new ScriptedAgent(["right", "down", "left"]), 3);

    expect(replay.trace.steps).toEqual([
      {
        stepNumber: 1,
        action: "right",
        succeeded: true,
        positionBefore: { x: 0, y: 0 },
        positionAfter: { x: 1, y: 0 },
        observation: {
          robot: { x: 0, y: 0 },
          neighbors: { up: "boundary", down: "empty", left: "boundary", right: "empty" },
        },
      },
      {
        stepNumber: 2,
        action: "down",
        succeeded: false,
        reason: "obstacle",
        positionBefore: { x: 1, y: 0 },
        positionAfter: { x: 1, y: 0 },
        observation: {
          robot: { x: 1, y: 0 },
          neighbors: { up: "boundary", down: "obstacle", left: "empty", right: "empty" },
        },
      },
      {
        stepNumber: 3,
        action: "left",
        succeeded: true,
        positionBefore: { x: 1, y: 0 },
        positionAfter: { x: 0, y: 0 },
        observation: {
          robot: { x: 1, y: 0 },
          neighbors: { up: "boundary", down: "obstacle", left: "empty", right: "empty" },
        },
      },
    ]);
    expect(replay.trace.initialPosition).toEqual({ x: 0, y: 0 });
    expect(replay.trace.finalPosition).toEqual({ x: 0, y: 0 });
    expect(replay.trace.termination).toBe("step-limit");
  });

  it("preserves the untraced simulation result and does not add traces to normal runs", () => {
    const untraced = runSimulation(createWorld(), new RandomAgent(createSeededRandom(7)), 10);
    const traced = runSimulationWithTrace(createWorld(), new RandomAgent(createSeededRandom(7)), 10);

    expect(traced.result).toEqual(untraced);
    expect(untraced).not.toHaveProperty("trace");
  });

  it("records early goal termination and the matching trace step count", () => {
    const replay = runSimulationWithTrace(
      createWorld(),
      new ScriptedAgent(["right", "right", "right", "down", "down", "left"]),
      10,
    );

    expect(replay.result.termination).toBe("goal-reached");
    expect(replay.result.stepsTaken).toBe(5);
    expect(replay.trace.termination).toBe("goal-reached");
    expect(replay.trace.steps).toHaveLength(5);
    expect(replay.trace.finalPosition).toEqual({ x: 3, y: 2 });
  });

  it("reconstructs only observed cells without leaking distant terrain or an unseen target", () => {
    const replay = runSimulationWithTrace(createWorld(), new ScriptedAgent(["right"]), 1);
    const revealed = reconstructRevealedWorld(replay.trace, 1);
    const cellAt = (x: number, y: number) => revealed.cells[y * revealed.width + x];

    expect(cellAt(0, 0)).toBe("free");
    expect(cellAt(1, 0)).toBe("free");
    expect(cellAt(0, 1)).toBe("free");
    expect(cellAt(1, 1)).toBe("unknown");
    expect(cellAt(3, 3)).toBe("unknown");
    expect(cellAt(3, 2)).toBe("unknown");
  });
});
