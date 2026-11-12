import { describe, expect, it } from "vitest";
import { generateTrapWorld, type TrapOpening } from "../src/trap-generation.js";
import { calculateShortestPathLength } from "../src/generation.js";
import { createAgentMission } from "../src/mission.js";
import { PlanningAgent } from "../src/planning.js";
import { runSimulationWithTrace } from "../src/simulation.js";

const config = { width: 15, height: 15, worldSeed: 6001 };

describe("U-shaped traps", () => {
  it("reproduces seeds and varies actual layouts", () => {
    expect(generateTrapWorld(config)).toEqual(generateTrapWorld(config));
    const layouts = new Set(Array.from({ length: 20 }, (_, worldSeed) => JSON.stringify(generateTrapWorld({ ...config, worldSeed }).world)));
    expect(layouts.size).toBeGreaterThan(15);
  });

  it.each(["up", "right", "down", "left"] as const)("has three complete sides and an open %s entrance", (opening: TrapOpening) => {
    const depth = 8;
    const span = 7;
    const origin = { x: 2, y: 3 };
    const generated = generateTrapWorld({ ...config, opening, depth, span, origin });
    const { world } = generated;
    // Independently rotate the actual obstacle coordinates into the U frame.
    const local = (p: { x: number; y: number }) => {
      const x = p.x - origin.x;
      const y = p.y - origin.y;
      if (opening === "down") return [x, y];
      if (opening === "up") return [x, depth - 1 - y];
      if (opening === "right") return [y, x];
      return [y, depth - 1 - x];
    };
    const actual = new Set(world.obstacles.map((p) => local(p).join(",")));
    const expected = new Set<string>();
    for (let v = 0; v < depth; v += 1) {
      for (let u = 0; u < span; u += 1) {
        if (v === 0 || u === 0 || u === span - 1) expected.add(`${u},${v}`);
      }
    }
    expect(actual).toEqual(expected);
    expect(local(world.robot)).toEqual([3, -1]);
    expect(local(world.deliveryTarget)).toEqual([3, 1]);
    expect(actual.has("3,0")).toBe(true);
    for (let u = 1; u < span - 1; u += 1) expect(actual.has(`${u},${depth - 1}`)).toBe(false);
    for (const p of [...world.obstacles, world.robot, world.deliveryTarget]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(world.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(world.height);
    }
    // Around the nearer arm, past its tip, and back to the target.
    expect(calculateShortestPathLength(world)).toBe(2 * depth + 2 * 4);
    expect(generated.shortestPathLength).toBe(24);
    expect(generated.manhattanDistance).toBe(2);
    expect(generated.detourRatio).toBe(12);
  });

  it("keeps fresh state and public missions isolated during replay", () => {
    const first = generateTrapWorld(config);
    const second = generateTrapWorld(config);
    expect(first.world.robot).not.toBe(second.world.robot);
    expect(first.world.deliveryTarget).not.toBe(second.world.deliveryTarget);
    expect(first.world.obstacles).not.toBe(second.world.obstacles);
    expect(first.world.obstacles[0]).not.toBe(second.world.obstacles[0]);
    const mission = createAgentMission(first.world);
    expect(Object.keys(mission).sort()).toEqual(["height", "start", "target", "width"]);
    for (const tieBreakPolicy of ["coordinate", "information-gain"] as const) {
      const run = runSimulationWithTrace(first.world, new PlanningAgent(mission, { tieBreakPolicy }), 2000);
      expect(run.result.termination).toBe("goal-reached");
      expect(run.result.rejectedMoves).toBe(0);
    }
    expect(first).toEqual(second);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])("has a reachable substantial detour for seed %i", (worldSeed) => {
    const generated = generateTrapWorld({ ...config, worldSeed });
    expect(calculateShortestPathLength(generated.world)).toBe(generated.shortestPathLength);
    expect(generated.detourRatio).toBeGreaterThan(2);
  });

  it.each([
    { width: 5 }, { height: 2 }, { width: 9.5 }, { worldSeed: Infinity },
    { depth: 3 }, { depth: 14 }, { span: 2 }, { span: 14 },
    { origin: { x: 0, y: 1 } }, { origin: { x: 14, y: 14 } },
  ])("rejects impossible configuration %j", (override) => {
    expect(() => generateTrapWorld({ ...config, ...override })).toThrow();
  });
});
