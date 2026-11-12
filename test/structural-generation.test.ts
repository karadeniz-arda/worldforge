import { describe, expect, it } from "vitest";
import { calculateShortestPathLength } from "../src/generation.js";
import { createAgentMission } from "../src/mission.js";
import { PlanningAgent } from "../src/planning.js";
import { runSimulation } from "../src/simulation.js";
import { generateBarrierWorld } from "../src/structural-generation.js";

const config = { width: 9, height: 11, worldSeed: 42, variant: "doorway" } as const;

describe("single-doorway barriers", () => {
  it("reproduces seeded doorways and produces multiple layouts across seeds", () => {
    expect(generateBarrierWorld(config)).toEqual(generateBarrierWorld(config));
    const rows = new Set(Array.from({ length: 20 }, (_, worldSeed) =>
      generateBarrierWorld({ ...config, worldSeed }).doorRow));
    expect(rows.size).toBeGreaterThan(1);
  });

  it.each([0, 5, 10])("has exactly one gap at configured row %i", (doorRow) => {
    const generated = generateBarrierWorld({ ...config, doorRow });
    const { world, wallColumn } = generated;
    expect(world.obstacles).toEqual(Array.from({ length: 11 }, (_, y) => ({ x: 4, y }))
      .filter((position) => position.y !== doorRow));
    expect(world.robot.x).toBeLessThan(wallColumn);
    expect(world.deliveryTarget.x).toBeGreaterThan(wallColumn);
    expect(calculateShortestPathLength(world)).toBe(8 + 2 * doorRow);
    expect(generated.shortestPathLength).toBe(8 + 2 * doorRow);
    expect(generated.detourRatio).toBe((8 + 2 * doorRow) / 8);
  });

  it("seals the entire wall and PlanningAgent stops without phantom movement", () => {
    const generated = generateBarrierWorld({ ...config, variant: "sealed" });
    expect(generated.world.obstacles).toHaveLength(11);
    expect(calculateShortestPathLength(generated.world)).toBeNull();
    expect(generated.shortestPathLength).toBeNull();
    expect(generated.detourRatio).toBeNull();
    const result = runSimulation(generated.world, new PlanningAgent(createAgentMission(generated.world)), 2000);
    expect(result.termination).toBe("target-unreachable");
    expect(result.rejectedMoves).toBe(0);
    expect(result.stepsTaken).toBe(result.successfulMoves);
  });

  it("keeps generated state independent and mission information public", () => {
    const first = generateBarrierWorld(config);
    const second = generateBarrierWorld(config);
    expect(first.world).not.toBe(second.world);
    expect(first.world.robot).not.toBe(second.world.robot);
    expect(first.world.deliveryTarget).not.toBe(second.world.deliveryTarget);
    expect(first.world.obstacles).not.toBe(second.world.obstacles);
    expect(first.world.obstacles[0]).not.toBe(second.world.obstacles[0]);
    expect(Object.keys(createAgentMission(first.world)).sort()).toEqual(["height", "start", "target", "width"]);
    runSimulation(first.world, new PlanningAgent(createAgentMission(first.world)), 2000);
    expect(first).toEqual(second);
  });

  it.each([
    { width: 2 }, { height: 1 }, { width: 3.5 }, { height: NaN },
    { worldSeed: Infinity }, { doorRow: -1 }, { doorRow: 11 },
    { variant: "sealed" as const, doorRow: 0 },
  ])("rejects invalid configuration %j", (overrides) => {
    expect(() => generateBarrierWorld({ ...config, ...overrides })).toThrow();
  });
});
