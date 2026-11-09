import { describe, expect, it } from "vitest";

import { observeWorld } from "../src/observation.js";
import type { World } from "../src/world.js";

function createWorld(robot: World["robot"]): World {
  return {
    width: 3,
    height: 3,
    robot,
    obstacles: [{ x: 2, y: 1 }],
    deliveryTarget: { x: 1, y: 2 },
  };
}

describe("observeWorld", () => {
  it("reports neighboring obstacles, targets, and empty cells without exposing the world", () => {
    expect(observeWorld(createWorld({ x: 1, y: 1 }))).toEqual({
      robot: { x: 1, y: 1 },
      neighbors: {
        up: "empty",
        down: "target",
        left: "empty",
        right: "obstacle",
      },
    });
  });

  it("reports boundaries around an edge position", () => {
    expect(observeWorld(createWorld({ x: 0, y: 0 }))).toEqual({
      robot: { x: 0, y: 0 },
      neighbors: {
        up: "boundary",
        down: "empty",
        left: "boundary",
        right: "empty",
      },
    });
  });
});
