import { describe, expect, it } from "vitest";

import { hasReachedTarget } from "../src/goal.js";
import type { World } from "../src/world.js";

describe("hasReachedTarget", () => {
  it("recognizes when the robot occupies the target position", () => {
    const world: World = {
      width: 2,
      height: 2,
      robot: { x: 1, y: 1 },
      obstacles: [],
      deliveryTarget: { x: 1, y: 1 },
    };

    expect(hasReachedTarget(world)).toBe(true);
    expect(hasReachedTarget({ ...world, robot: { x: 0, y: 1 } })).toBe(false);
  });
});
