import { describe, expect, it } from "vitest";

import { moveRobot, type MovementDirection } from "../src/movement.js";
import type { World } from "../src/world.js";

function createWorld(robot: World["robot"], obstacles: World["obstacles"] = []): World {
  return {
    width: 5,
    height: 5,
    robot,
    obstacles,
    deliveryTarget: { x: 4, y: 4 },
  };
}

describe("moveRobot", () => {
  it.each<[MovementDirection, World["robot"], World["robot"]]>([
    ["up", { x: 2, y: 2 }, { x: 2, y: 1 }],
    ["down", { x: 2, y: 2 }, { x: 2, y: 3 }],
    ["left", { x: 2, y: 2 }, { x: 1, y: 2 }],
    ["right", { x: 2, y: 2 }, { x: 3, y: 2 }],
  ])("moves one cell %s when the destination is clear", (direction, robot, expectedPosition) => {
    const result = moveRobot(createWorld(robot), direction);

    expect(result).toEqual({
      succeeded: true,
      world: expect.objectContaining({ robot: expectedPosition }),
    });
  });

  it("rejects movement into an obstacle", () => {
    const world = createWorld({ x: 1, y: 1 }, [{ x: 2, y: 1 }]);

    expect(moveRobot(world, "right")).toEqual({
      world,
      succeeded: false,
      reason: "obstacle",
    });
  });

  it.each<[MovementDirection, World["robot"]]>([
    ["up", { x: 2, y: 0 }],
    ["down", { x: 2, y: 4 }],
    ["left", { x: 0, y: 2 }],
    ["right", { x: 4, y: 2 }],
  ])("rejects %s at a world boundary", (direction, robot) => {
    const world = createWorld(robot);

    expect(moveRobot(world, direction)).toEqual({
      world,
      succeeded: false,
      reason: "out-of-bounds",
    });
  });

  it("does not mutate the original world or any of its nested positions", () => {
    const world = createWorld(
      { x: 1, y: 1 },
      [{ x: 3, y: 3 }],
    );
    const originalRobot = world.robot;
    const originalObstacle = world.obstacles[0];
    const originalTarget = world.deliveryTarget;

    const result = moveRobot(world, "right");

    expect(result.succeeded).toBe(true);
    expect(result.world).not.toBe(world);
    expect(result.world.robot).toEqual({ x: 2, y: 1 });
    expect(result.world.robot).not.toBe(originalRobot);
    expect(world.robot).toBe(originalRobot);
    expect(world.robot).toEqual({ x: 1, y: 1 });
    expect(world.obstacles[0]).toBe(originalObstacle);
    expect(world.deliveryTarget).toBe(originalTarget);
  });
});
