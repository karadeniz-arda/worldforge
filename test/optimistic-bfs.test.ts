import { describe, expect, it } from "vitest";
import { calculateShortestPathLength, generateWorld } from "../src/generation.js";
import { adjacentPosition, createUnknownMap, getKnownCell, updateKnownMap, type KnownMap } from "../src/known-map.js";
import { createAgentMission } from "../src/mission.js";
import { observeWorld, type Observation } from "../src/observation.js";
import { calculateOptimisticDistances, OptimisticBFSAgent } from "../src/optimistic-bfs.js";
import { PlanningAgent } from "../src/planning.js";
import { createReplayHtml } from "../src/replay.js";
import { createScenario } from "../src/scenarios.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import { generateBarrierWorld } from "../src/structural-generation.js";
import { generateMazeWorld } from "../src/maze-generation.js";
import { generateTrapWorld } from "../src/trap-generation.js";
import { parseWorld } from "../src/world.js";

describe("optimistic target-rooted BFS", () => {
  it("plans through an unknown target without changing terrain knowledge", () => {
    const map = createUnknownMap(3, 2);
    expect(calculateOptimisticDistances(map, { x: 2, y: 0 })).toEqual([2, 1, 0, 3, 2, 1]);
    expect(map.cells.every((cell) => cell === "unknown")).toBe(true);
  });

  it("routes around a known barrier through its only passage", () => {
    const map: KnownMap = { width: 3, height: 3, cells: [
      "free", "blocked", "free", "free", "blocked", "free", "free", "unknown", "free",
    ] };
    expect(calculateOptimisticDistances(map, { x: 2, y: 0 })).toEqual([6, Infinity, 0, 5, Infinity, 1, 4, 3, 2]);
  });

  it("raises distances when observations reveal a blocking cell", () => {
    const map = createUnknownMap(3, 2);
    const before = calculateOptimisticDistances(map, { x: 2, y: 0 });
    const updated = updateKnownMap(map, observeWorld(parseWorld([".#T", "R.."])));
    const afterObservation = updateKnownMap(updated, observeWorld(parseWorld([".#T", ".R."])));
    const after = calculateOptimisticDistances(afterObservation, { x: 2, y: 0 });
    expect(before[0]).toBe(2);
    expect(after[0]).toBe(4);
    expect(after[1]).toBe(Infinity);
  });

  it("leaves disconnected cells and blocked or out-of-bounds targets infinite", () => {
    const map: KnownMap = { width: 3, height: 1, cells: ["free", "blocked", "unknown"] };
    expect(calculateOptimisticDistances(map, { x: 2, y: 0 })).toEqual([Infinity, Infinity, 0]);
    for (const target of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 3, y: 0 }]) {
      expect(calculateOptimisticDistances(map, target)).toEqual([Infinity, Infinity, Infinity]);
    }
  });
});

describe("OptimisticBFSAgent", () => {
  it.each([["R...T"], ["R", ".", ".", "T"], ["RT"], ["R..", "...", "..T"]])("takes a Manhattan-length route in empty map %j", (...rows) => {
    const world = parseWorld(rows);
    const result = runSimulation(world, new OptimisticBFSAgent(createAgentMission(world)), 100);
    expect(result.termination).toBe("goal-reached");
    expect(result.stepsTaken).toBe(Math.abs(world.robot.x - world.deliveryTarget.x) + Math.abs(world.robot.y - world.deliveryTarget.y));
    expect(result.rejectedMoves).toBe(0);
  });

  it.each([
    ["...", ".R.", "..T", "right"],
    ["...", ".R.", "T..", "down"],
    ["T..", ".R.", "...", "left"],
  ])("resolves equal safe distances by cardinal priority (%s)", (top, middle, bottom, expected) => {
    const world = parseWorld([top, middle, bottom]);
    expect(new OptimisticBFSAgent(createAgentMission(world)).decide(observeWorld(world))).toBe(expected);
  });

  it("replans after discovering an obstacle on the direct route", () => {
    const world = parseWorld(["R.#T", "...."]);
    const result = runSimulation(world, new OptimisticBFSAgent(createAgentMission(world)), 100);
    expect(result.steps.map((step) => step.action)).toEqual(["right", "down", "right", "right", "up"]);
    expect(result.rejectedMoves).toBe(0);
    expect(result.termination).toBe("goal-reached");
  });

  it("ignores hidden obstacle differences until observations differ", () => {
    const first = parseWorld(["R..T", "...."]);
    const second = parseWorld(["R.#T", "...."]);
    const mission = createAgentMission(first);
    const a = new OptimisticBFSAgent(mission);
    const b = new OptimisticBFSAgent(mission);
    expect(observeWorld(first)).toEqual(observeWorld(second));
    expect(a.decide(observeWorld(first))).toBe(b.decide(observeWorld(second)));
    expect(a.decide(observeWorld({ ...first, robot: { x: 1, y: 0 } }))).toBe("right");
    expect(b.decide(observeWorld({ ...second, robot: { x: 1, y: 0 } }))).toBe("down");
    expect(Object.keys(mission).sort()).toEqual(["height", "start", "target", "width"]);
  });

  it("lets the simulator terminate at an initial target without requesting an action", () => {
    const world = { ...parseWorld(["RT"]), deliveryTarget: { x: 0, y: 0 } };
    const agent = new OptimisticBFSAgent(createAgentMission(world));
    expect(runSimulation(world, agent, 100)).toMatchObject({ termination: "goal-reached", stepsTaken: 0 });
    expect(() => agent.decide(observeWorld(world))).toThrow("decide called at the target");
  });

  it("throws on an inconsistent boundary observation instead of an arbitrary fallback", () => {
    const world = parseWorld(["RT"]);
    const agent = new OptimisticBFSAgent(createAgentMission(world));
    expect(() => agent.decide({ ...observeWorld(world), neighbors: { up: "boundary", down: "boundary", left: "boundary", right: "boundary" } })).toThrow("invariant violated");
  });

  it("keeps mission coordinates private copies and PlanningAgent replay diagnostics intact", () => {
    const world = createScenario("detour");
    const mission = createAgentMission(world);
    const optimistic = new OptimisticBFSAgent(mission);
    (mission.target as { x: number }).x = 0;
    const baseline = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { recordDiagnostics: true }), 100);
    const replay = runSimulationWithTrace(world, optimistic, 100, { target: world.deliveryTarget });
    expect(replay.result.termination).toBe("goal-reached");
    expect(replay.trace.steps.every((step) => step.planningDebug === undefined)).toBe(true);
    expect(replay.trace.publicMission?.target).toEqual(world.deliveryTarget);
    expect(createReplayHtml(replay.trace, "Optimistic")).toContain("Optimistic");
    expect(runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { recordDiagnostics: true }), 100)).toEqual(baseline);
    expect(baseline.result.stepsTaken).toBe(12);
  });
});

const worlds = [
  ...(["easy", "detour", "unreachable", "unreachableMaze"] as const).map((name) => ({ name, world: createScenario(name) })),
  ...(["doorway", "sealed"] as const).map((variant) => ({ name: variant, world: generateBarrierWorld({ width: 9, height: 15, worldSeed: 42, variant, ...(variant === "doorway" ? { doorRow: 14 } : {}) }).world })),
  { name: "maze", world: generateMazeWorld({ width: 15, height: 15, worldSeed: 5001 }).world },
  { name: "trap", world: generateTrapWorld({ width: 15, height: 15, worldSeed: 6001 }).world },
  ...[41, 91, 137].flatMap((worldSeed) => (["reachable", "unreachable"] as const).map((reachability) => ({
    name: `${reachability}-${worldSeed}`, world: generateWorld({ width: 6, height: 5, worldSeed, reachability, obstacleDensity: reachability === "reachable" ? 0.2 : 0.7 }),
  }))),
];

describe("oracle-backed optimistic trajectories", () => {
  it.each(worlds)("is safe, deterministic and oracle-consistent on $name", ({ world }) => {
    const agent = new OptimisticBFSAgent(createAgentMission(world));
    let map = createUnknownMap(world.width, world.height);
    const checked = {
      decide(observation: Observation) {
        map = updateKnownMap(map, observation);
        const decision = agent.decide(observation);
        if (typeof decision === "string") {
          expect(["empty", "target"]).toContain(observation.neighbors[decision]);
          const next = adjacentPosition(observation.robot, decision);
          expect(getKnownCell(map, next)).toBe("free");
          const distances = calculateOptimisticDistances(map, world.deliveryTarget);
          expect(distances[next.y * world.width + next.x]).toBe(distances[observation.robot.y * world.width + observation.robot.x]! - 1);
        }
        return decision;
      },
    };
    const result = runSimulation(world, checked, 2000);
    expect(result).toEqual(runSimulation(world, new OptimisticBFSAgent(createAgentMission(world)), 2000));
    expect(result.termination).toBe(calculateShortestPathLength(world) === null ? "target-unreachable" : "goal-reached");
    expect(result.rejectedMoves).toBe(0);
    expect(result.stepsTaken).toBe(result.successfulMoves);
  });
});
