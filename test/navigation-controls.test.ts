import { describe, expect, it, vi } from "vitest";
import { calculateShortestPathLength } from "../src/generation.js";
import { createUnknownMap, getKnownCell, updateKnownMap, type KnownMap } from "../src/known-map.js";
import { createAgentMission } from "../src/mission.js";
import { calculateOptimisticDistances, OptimisticBFSAgent } from "../src/optimistic-bfs.js";
import { describeFrontiers, PlanningAgent, selectGoalDirectedFrontier } from "../src/planning.js";
import { createSeededRandom } from "../src/random.js";
import { createScenario } from "../src/scenarios.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import { parseWorld } from "../src/world.js";

describe("optimistic non-optimality counterexample", () => {
  it("reproduces the first counterexample from the bounded mask search", () => {
    const positions = Array.from({ length: 14 }, (_, i) => ({ x: (i + 1) % 4, y: Math.floor((i + 1) / 4) }));
    let firstMask: number | undefined;
    // Search bound was 4096 masks; stop at the first successful non-optimal run.
    for (let mask = 0; mask < 4096; mask += 1) {
      const world = { width: 4, height: 4, robot: { x: 0, y: 0 }, deliveryTarget: { x: 3, y: 3 },
        obstacles: positions.filter((_, i) => (mask & (1 << i)) !== 0) };
      const oracle = calculateShortestPathLength(world);
      if (oracle === null) continue;
      const result = runSimulation(world, new OptimisticBFSAgent(createAgentMission(world)), 200);
      if (result.termination === "goal-reached" && result.stepsTaken > oracle) {
        firstMask = mask;
        break;
      }
    }
    expect(firstMask).toBe(18);
  });

  it("identifies the first wasted action and the unseen obstacles", () => {
    const world = parseWorld(["R.#.", ".#..", "....", "...T"]);
    const run = runSimulationWithTrace(world, new OptimisticBFSAgent(createAgentMission(world)), 200);
    expect(calculateShortestPathLength(world)).toBe(6);
    expect(run.result).toMatchObject({ termination: "goal-reached", stepsTaken: 8, rejectedMoves: 0 });
    expect(run.result.steps.map((step) => step.action)).toEqual(["right", "left", "down", "down", "right", "right", "right", "down"]);
    const initialMap = updateKnownMap(createUnknownMap(4, 4), run.trace.steps[0]!.observation);
    for (const obstacle of world.obstacles) expect(getKnownCell(initialMap, obstacle)).toBe("unknown");
    const distances = calculateOptimisticDistances(initialMap, world.deliveryTarget);
    expect(distances[1]).toBe(5); // right
    expect(distances[4]).toBe(5); // down
    expect(calculateShortestPathLength({ ...world, robot: { x: 1, y: 0 } })).toBe(7);
    expect(calculateShortestPathLength({ ...world, robot: { x: 0, y: 1 } })).toBe(5);
    const discovered = updateKnownMap(initialMap, run.trace.steps[1]!.observation);
    world.obstacles.forEach((obstacle) => expect(getKnownCell(discovered, obstacle)).toBe("blocked"));
    expect(calculateOptimisticDistances(discovered, world.deliveryTarget)[1]).toBe(7);
  });
});

const tiedMap: KnownMap = { width: 5, height: 5, cells: [
  "free", "free", "blocked", "unknown", "unknown",
  "free", "free", "blocked", "unknown", "unknown",
  "unknown", "free", "unknown", "unknown", "unknown",
  "unknown", "unknown", "unknown", "unknown", "unknown",
  "unknown", "unknown", "unknown", "unknown", "unknown",
] };

describe("random frontier tie-break", () => {
  it("selects uniformly indexed members of the genuine tied-best set", () => {
    const start = { x: 1, y: 1 };
    const target = { x: 4, y: 0 };
    const candidates = describeFrontiers(tiedMap, start, target);
    expect(candidates.map((candidate) => [candidate.position, candidate.combinedScore, candidate.knownSafeDistance]))
      .toEqual([[{ x: 0, y: 1 }, 6, 1], [{ x: 1, y: 2 }, 6, 1]]);
    for (const draw of [0, 0.25, 0.49999, 0.5, 0.75, 0.99999]) {
      const random = vi.fn(() => draw);
      const selected = selectGoalDirectedFrontier(tiedMap, start, target, "random", random);
      expect(selected?.position).toEqual(draw < 0.5 ? { x: 0, y: 1 } : { x: 1, y: 2 });
      expect(random).toHaveBeenCalledTimes(1);
    }
  });

  it.each([
    { width: 5, height: 4, cells: ["blocked", "blocked", "unknown", "unknown", "unknown", "free", "free", "unknown", "unknown", "unknown", "free", "free", "unknown", "unknown", "unknown", "blocked", "unknown", "unknown", "unknown", "unknown"] },
    { width: 6, height: 3, cells: ["blocked", "free", "free", "unknown", "unknown", "unknown", "free", "free", "unknown", "unknown", "unknown", "unknown", "blocked", "blocked", "unknown", "unknown", "unknown", "unknown"] },
  ] satisfies KnownMap[])("preserves primary and secondary minima on $width-wide fixture", (map) => {
    const random = vi.fn(() => 0.999);
    const selected = selectGoalDirectedFrontier(map, { x: 0, y: 1 }, { x: map.width - 1, y: map.height === 3 ? 0 : 1 }, "random", random);
    expect(selected?.position).toEqual({ x: 1, y: 1 });
    expect(random).not.toHaveBeenCalled();
  });

  it.each(["coordinate", "information-gain"] as const)("leaves %s independent of random state", (tieBreakPolicy) => {
    const world = createScenario("detour");
    const random = vi.fn(() => { throw new Error("Unexpected RNG consumption"); });
    const before = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy, recordDiagnostics: true }), 100);
    const after = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy, recordDiagnostics: true, random }), 100);
    expect(after).toEqual(before);
    expect(after.result.stepsTaken).toBe(tieBreakPolicy === "coordinate" ? 12 : 10);
    expect(random).not.toHaveBeenCalled();
  });

  it("reproduces fresh seeded runs and diagnostics consume no randomness", () => {
    const world = createScenario("detour");
    const run = (recordDiagnostics: boolean) => {
      const rng = createSeededRandom(73);
      const random = vi.fn(rng);
      const result = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy: "random", random, recordDiagnostics }), 200);
      return { result, draws: random.mock.calls.length };
    };
    const first = run(true);
    expect(run(true)).toEqual(first);
    const disabled = run(false);
    expect(disabled.result.result).toEqual(first.result.result);
    expect(disabled.draws).toBe(first.draws);
    expect(first.result.trace.steps.some((step) => step.planningDebug?.selectionReason.includes("Uniform random selection"))).toBe(true);
  });

  it("requires an explicit RNG and rejects invalid draws", () => {
    const mission = createAgentMission(createScenario("detour"));
    expect(() => new PlanningAgent(mission, { tieBreakPolicy: "random" })).toThrow("injected random function");
    for (const draw of [-0.1, 1, NaN, Infinity]) {
      expect(() => selectGoalDirectedFrontier(tiedMap, { x: 1, y: 1 }, { x: 4, y: 0 }, "random", () => draw)).toThrow("[0, 1)");
    }
  });

  it("does not consume randomness for a known target route or terminal stop", () => {
    for (const name of ["unreachable"] as const) {
      const world = createScenario(name);
      const random = vi.fn(() => 0);
      runSimulation(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy: "random", random }), 100);
      expect(random).not.toHaveBeenCalled();
    }
    const world = parseWorld(["RT"]);
    const random = vi.fn(() => 0);
    runSimulation(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy: "random", random }), 100);
    expect(random).not.toHaveBeenCalled();
  });
});
