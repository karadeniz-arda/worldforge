import { describe, expect, it } from "vitest";
import { generateMazeWorld } from "../src/maze-generation.js";
import { calculateShortestPathLength } from "../src/generation.js";
import { createAgentMission } from "../src/mission.js";
import { PlanningAgent } from "../src/planning.js";
import { runSimulationWithTrace } from "../src/simulation.js";
import { createReplayHtml } from "../src/replay.js";

const config = { width: 15, height: 15, worldSeed: 5001 };

describe("perfect mazes", () => {
  it("reproduces seeds with independent state and varies layouts across seeds", () => {
    const first = generateMazeWorld(config);
    const second = generateMazeWorld(config);
    expect(first).toEqual(second);
    expect(first.world).not.toBe(second.world);
    expect(first.world.robot).not.toBe(second.world.robot);
    expect(first.world.deliveryTarget).not.toBe(second.world.deliveryTarget);
    expect(first.world.obstacles).not.toBe(second.world.obstacles);
    expect(first.world.obstacles[0]).not.toBe(second.world.obstacles[0]);
    const layouts = new Set(Array.from({ length: 10 }, (_, worldSeed) => JSON.stringify(generateMazeWorld({ ...config, worldSeed }).world.obstacles)));
    expect(layouts.size).toBe(10);
  });

  it.each([[5, 5], [7, 11], [15, 15], [21, 21]])("generates a connected tree with valid walls at %ix%i", (width, height) => {
    const { world, shortestPathLength } = generateMazeWorld({ ...config, width, height });
    const blocked = new Set(world.obstacles.map((p) => p.y * width + p.x));
    const free: number[] = [];
    let edges = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = y * width + x;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || (x % 2 === 0 && y % 2 === 0)) expect(blocked.has(cell)).toBe(true);
        if (x % 2 === 1 && y % 2 === 1) expect(blocked.has(cell)).toBe(false);
        if (blocked.has(cell)) continue;
        free.push(cell);
        if (x + 1 < width && !blocked.has(cell + 1)) edges += 1;
        if (y + 1 < height && !blocked.has(cell + width)) edges += 1;
      }
    }
    // Independent graph traversal checks connectivity and farthest endpoint.
    const start = world.robot.y * width + world.robot.x;
    const distances = new Map([[start, 0]]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
      const cell = queue[i]!;
      for (const next of [cell - width, cell + width, cell - 1, cell + 1]) {
        if (next < 0 || next >= width * height || blocked.has(next) || distances.has(next)) continue;
        distances.set(next, distances.get(cell)! + 1);
        queue.push(next);
      }
    }
    expect(queue.length).toBe(free.length);
    // Connected + E = V - 1 proves acyclicity and exactly one simple path.
    expect(edges).toBe(free.length - 1);
    const target = world.deliveryTarget.y * width + world.deliveryTarget.x;
    expect(target).not.toBe(start);
    expect(blocked.has(target)).toBe(false);
    const maximum = Math.max(...distances.values());
    expect(distances.get(target)).toBe(maximum);
    expect(target).toBe(Math.min(...[...distances].filter(([, distance]) => distance === maximum).map(([cell]) => cell)));
    expect(shortestPathLength).toBe(maximum);
    expect(calculateShortestPathLength(world)).toBe(maximum);
    expect(world.width).toBe(width);
    expect(world.height).toBe(height);
  });

  it("runs through the existing traced simulation and replay renderer", () => {
    const { world } = generateMazeWorld(config);
    const before = structuredClone(world);
    const run = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { recordDiagnostics: true, tieBreakPolicy: "information-gain" }), 2000);
    expect(run.result.termination).toBe("goal-reached");
    expect(run.result.rejectedMoves).toBe(0);
    expect(createReplayHtml(run.trace, "Maze")).toContain("Maze");
    expect(world).toEqual(before);
  });

  it.each([{ width: 3 }, { height: 4 }, { width: 10 }, { height: 7.5 }, { width: Infinity }, { worldSeed: NaN }])("rejects invalid configuration %j", (override) => {
    expect(() => generateMazeWorld({ ...config, ...override })).toThrow();
  });
});
