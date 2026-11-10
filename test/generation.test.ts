import { describe, expect, it } from "vitest";

import { calculateShortestPathLength, generateWorld, type WorldGenerationConfig } from "../src/generation.js";

const reachableConfig: WorldGenerationConfig = {
  width: 8,
  height: 5,
  worldSeed: 42,
  obstacleDensity: 0.2,
  reachability: "reachable",
  maxAttempts: 1_000,
};

describe("generateWorld", () => {
  it("is deterministic for identical configurations", () => {
    expect(generateWorld(reachableConfig)).toEqual(generateWorld(reachableConfig));
  });

  it("usually varies layout across different seeds", () => {
    const layouts = new Set(
      [1, 2, 3, 4, 5].map((worldSeed) => JSON.stringify(generateWorld({ ...reachableConfig, worldSeed }))),
    );

    expect(layouts.size).toBeGreaterThan(1);
  });

  it("creates rectangular worlds with in-bounds, non-overlapping entities", () => {
    const world = generateWorld({ ...reachableConfig, width: 9, height: 4, worldSeed: 77 });
    const occupied = new Set(world.obstacles.map((obstacle) => `${obstacle.x},${obstacle.y}`));

    expect(world.width).toBe(9);
    expect(world.height).toBe(4);
    expect(world.robot).not.toEqual(world.deliveryTarget);
    expect(occupied).not.toContain(`${world.robot.x},${world.robot.y}`);
    expect(occupied).not.toContain(`${world.deliveryTarget.x},${world.deliveryTarget.y}`);
    expect(world.obstacles.every((obstacle) => (
      obstacle.x >= 0 && obstacle.x < world.width && obstacle.y >= 0 && obstacle.y < world.height
    ))).toBe(true);
  });

  it("uses the requested density over available non-endpoint cells", () => {
    const empty = generateWorld({ ...reachableConfig, obstacleDensity: 0, worldSeed: 3 });
    const dense = generateWorld({ ...reachableConfig, obstacleDensity: 0.5, worldSeed: 3 });

    expect(empty.obstacles).toHaveLength(0);
    expect(dense.obstacles).toHaveLength(Math.floor(0.5 * (dense.width * dense.height - 2)));
  });

  it("generates worlds with the requested reachability", () => {
    const reachable = generateWorld({ ...reachableConfig, worldSeed: 91 });
    const unreachable = generateWorld({
      width: 6,
      height: 5,
      worldSeed: 91,
      obstacleDensity: 0.7,
      reachability: "unreachable",
      maxAttempts: 1_000,
    });

    expect(calculateShortestPathLength(reachable)).not.toBeNull();
    expect(calculateShortestPathLength(unreachable)).toBeNull();
  });

  it("enforces a minimum shortest-path distance for reachable worlds", () => {
    const world = generateWorld({
      width: 9,
      height: 6,
      worldSeed: 123,
      obstacleDensity: 0.2,
      reachability: "reachable",
      minimumPathDistance: 8,
      maxAttempts: 1_000,
    });

    expect(calculateShortestPathLength(world)).toBeGreaterThanOrEqual(8);
  });

  it("returns independent world values for repeated generation", () => {
    const first = generateWorld(reachableConfig);
    const second = generateWorld(reachableConfig);

    expect(first).not.toBe(second);
    expect(first.robot).not.toBe(second.robot);
    expect(first.deliveryTarget).not.toBe(second.deliveryTarget);
    expect(first.obstacles).not.toBe(second.obstacles);
    expect(first.obstacles[0]).not.toBe(second.obstacles[0]);
  });

  it.each([
    [{ ...reachableConfig, width: 0 }, "width"],
    [{ ...reachableConfig, height: 1.5 }, "height"],
    [{ ...reachableConfig, width: 1, height: 1 }, "at least two cells"],
    [{ ...reachableConfig, worldSeed: 1.5 }, "seed"],
    [{ ...reachableConfig, obstacleDensity: -0.1 }, "density"],
    [{ ...reachableConfig, reachability: "unreachable" as const, minimumPathDistance: 1 }, "only be requested"],
    [{ ...reachableConfig, maxAttempts: 0 }, "attempts"],
  ])("rejects invalid configuration: %o", (config, message) => {
    expect(() => generateWorld(config)).toThrow(message);
  });

  it("throws after bounded attempts when constraints cannot be satisfied", () => {
    expect(() => generateWorld({
      width: 3,
      height: 3,
      worldSeed: 1,
      obstacleDensity: 1,
      reachability: "reachable",
      minimumPathDistance: 2,
      maxAttempts: 1,
    })).toThrow("after 1 attempts");
  });
});
