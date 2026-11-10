import { describe, expect, it } from "vitest";

import { createAgentMission } from "../src/mission.js";
import type { World } from "../src/world.js";

function createWorld(): World {
  return {
    width: 6,
    height: 4,
    robot: { x: 1, y: 2 },
    deliveryTarget: { x: 5, y: 0 },
    obstacles: [{ x: 2, y: 2 }, { x: 4, y: 1 }],
  };
}

describe("createAgentMission", () => {
  it("derives only the public mission metadata", () => {
    expect(createAgentMission(createWorld())).toEqual({
      start: { x: 1, y: 2 },
      target: { x: 5, y: 0 },
      width: 6,
      height: 4,
    });
  });

  it("does not expose hidden obstacle information", () => {
    const mission = createAgentMission(createWorld());

    expect(Object.keys(mission).sort()).toEqual(["height", "start", "target", "width"]);
    expect(mission).not.toHaveProperty("obstacles");
  });

  it("returns fresh mission and position values isolated from the world", () => {
    const world = createWorld();
    const first = createAgentMission(world);
    const second = createAgentMission(world);

    expect(first).not.toBe(second);
    expect(first.start).not.toBe(world.robot);
    expect(first.target).not.toBe(world.deliveryTarget);
    expect(first.start).not.toBe(second.start);
    expect(first.target).not.toBe(second.target);
  });
});
