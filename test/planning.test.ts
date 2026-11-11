import { describe, expect, it } from "vitest";

import { createAgentMission } from "../src/mission.js";
import {
  PlanningAgent,
  createUnknownMap,
  findKnownFreePath,
  findReachableFrontiers,
  getKnownCell,
  selectGoalDirectedFrontier,
  updateKnownMap,
  type KnownMap,
} from "../src/planning.js";
import { createScenario } from "../src/scenarios.js";
import { runSimulation } from "../src/simulation.js";
import type { Observation } from "../src/observation.js";

function observation(
  robot: { x: number; y: number },
  neighbors: Observation["neighbors"],
): Observation {
  return { robot, neighbors };
}

function map(width: number, height: number, cells: KnownMap["cells"]): KnownMap {
  return { width, height, cells };
}

describe("PlanningAgent known map", () => {
  it("updates knowledge strictly from the current local observation", () => {
    const updated = updateKnownMap(createUnknownMap(4, 3), observation(
      { x: 1, y: 1 },
      { up: "empty", down: "target", left: "obstacle", right: "boundary" },
    ));

    expect(getKnownCell(updated, { x: 1, y: 1 })).toBe("free");
    expect(getKnownCell(updated, { x: 1, y: 0 })).toBe("free");
    expect(getKnownCell(updated, { x: 1, y: 2 })).toBe("free");
    expect(getKnownCell(updated, { x: 0, y: 1 })).toBe("blocked");
    expect(getKnownCell(updated, { x: 3, y: 2 })).toBe("unknown");
  });

  it("takes a directly observed target through a known-safe path", () => {
    const agent = new PlanningAgent({ start: { x: 0, y: 0 }, target: { x: 1, y: 0 }, width: 2, height: 1 });

    expect(agent.decide(observation(
      { x: 0, y: 0 },
      { up: "boundary", down: "boundary", left: "boundary", right: "target" },
    ))).toBe("right");
  });
});

describe("known-safe BFS", () => {
  it("returns a deterministic shortest path and never crosses known obstacles", () => {
    const knownMap = map(3, 3, [
      "free", "free", "free",
      "free", "blocked", "free",
      "free", "free", "free",
    ]);

    expect(findKnownFreePath(knownMap, { x: 0, y: 1 }, { x: 2, y: 1 }))
      .toEqual(["down", "right", "right", "up"]);
  });

  it("does not treat unknown cells as traversable", () => {
    const knownMap = map(3, 1, ["free", "unknown", "free"]);

    expect(findKnownFreePath(knownMap, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(findKnownFreePath(knownMap, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });
});

describe("goal-directed frontiers", () => {
  it("excludes fully explored dead ends", () => {
    const knownMap = map(3, 3, [
      "free", "blocked", "unknown",
      "free", "blocked", "unknown",
      "free", "free", "free",
    ]);

    const frontiers = findReachableFrontiers(knownMap, { x: 0, y: 1 });

    expect(frontiers.map((frontier) => frontier.position)).not.toContainEqual({ x: 0, y: 0 });
    expect(frontiers.map((frontier) => frontier.position)).toContainEqual({ x: 2, y: 2 });
  });

  it("can reuse explored known-free cells to reach a frontier", () => {
    const knownMap = map(4, 1, ["free", "free", "free", "unknown"]);
    const frontier = selectGoalDirectedFrontier(knownMap, { x: 0, y: 0 }, { x: 3, y: 0 });

    expect(frontier).toEqual({ position: { x: 2, y: 0 }, path: ["right", "right"] });
  });

  it("uses combined safe-distance and target-distance scoring, not nearest frontier", () => {
    const knownMap = map(6, 3, [
      "free", "free", "free", "free", "unknown", "unknown",
      "free", "blocked", "blocked", "blocked", "unknown", "unknown",
      "unknown", "unknown", "unknown", "unknown", "unknown", "unknown",
    ]);

    const frontier = selectGoalDirectedFrontier(knownMap, { x: 0, y: 0 }, { x: 5, y: 0 });

    expect(frontier).toEqual({ position: { x: 3, y: 0 }, path: ["right", "right", "right"] });
  });

  it("uses stable coordinates when frontier scores and distances tie", () => {
    const knownMap = map(3, 3, [
      "unknown", "free", "unknown",
      "free", "free", "blocked",
      "unknown", "blocked", "unknown",
    ]);

    const frontier = selectGoalDirectedFrontier(knownMap, { x: 1, y: 1 }, { x: 0, y: 0 });

    expect(frontier).toEqual({ position: { x: 1, y: 0 }, path: ["up"] });
  });

  it("uses information gain when primary frontier scores tie", () => {
    const knownMap = map(5, 5, [
      "free", "free", "blocked", "unknown", "unknown",
      "free", "free", "blocked", "unknown", "unknown",
      "unknown", "free", "unknown", "unknown", "unknown",
      "unknown", "unknown", "unknown", "unknown", "unknown",
      "unknown", "unknown", "unknown", "unknown", "unknown",
    ]);

    expect(selectGoalDirectedFrontier(knownMap, { x: 1, y: 1 }, { x: 4, y: 0 }, "coordinate"))
      .toEqual({ position: { x: 0, y: 1 }, path: ["left"] });
    expect(selectGoalDirectedFrontier(knownMap, { x: 1, y: 1 }, { x: 4, y: 0 }, "information-gain"))
      .toEqual({ position: { x: 1, y: 2 }, path: ["down"] });
  });

  it("does not let information gain override an unequal primary score", () => {
    const knownMap = map(5, 4, [
      "blocked", "blocked", "unknown", "unknown", "unknown",
      "free", "free", "unknown", "unknown", "unknown",
      "free", "free", "unknown", "unknown", "unknown",
      "blocked", "unknown", "unknown", "unknown", "unknown",
    ]);

    expect(selectGoalDirectedFrontier(knownMap, { x: 0, y: 1 }, { x: 4, y: 1 }, "information-gain"))
      .toEqual({ position: { x: 1, y: 1 }, path: ["right"] });
  });

  it("does not let information gain override a shorter known-safe distance", () => {
    const knownMap = map(6, 3, [
      "blocked", "free", "free", "unknown", "unknown", "unknown",
      "free", "free", "unknown", "unknown", "unknown", "unknown",
      "blocked", "blocked", "unknown", "unknown", "unknown", "unknown",
    ]);

    expect(selectGoalDirectedFrontier(knownMap, { x: 0, y: 1 }, { x: 5, y: 0 }, "information-gain"))
      .toEqual({ position: { x: 1, y: 1 }, path: ["right"] });
  });

  it("keeps the original coordinate policy as the default", () => {
    const knownMap = map(3, 3, [
      "unknown", "free", "unknown",
      "free", "free", "blocked",
      "unknown", "blocked", "unknown",
    ]);

    expect(selectGoalDirectedFrontier(knownMap, { x: 1, y: 1 }, { x: 0, y: 0 }))
      .toEqual(selectGoalDirectedFrontier(knownMap, { x: 1, y: 1 }, { x: 0, y: 0 }, "coordinate"));
  });
});

describe("PlanningAgent simulation", () => {
  it.each(["easy", "corridor", "detour"] as const)("reaches %s with a sufficient action budget", (scenario) => {
    const world = createScenario(scenario);
    const result = runSimulation(world, new PlanningAgent(createAgentMission(world)), 100);

    expect(result.termination).toBe("goal-reached");
    expect(result.world.robot).toEqual(world.deliveryTarget);
  });

  it("reports target-unreachable when no frontier is reachable", () => {
    const world = createScenario("unreachable");
    const result = runSimulation(world, new PlanningAgent(createAgentMission(world)), 10);

    expect(result.termination).toBe("target-unreachable");
    expect(result.stepsTaken).toBe(0);
    expect(result.rejectedMoves).toBe(0);
  });

  it("keeps learned state isolated to each agent instance and remains deterministic", () => {
    const world = createScenario("detour");
    const first = runSimulation(world, new PlanningAgent(createAgentMission(world)), 100);
    const second = runSimulation(world, new PlanningAgent(createAgentMission(world)), 100);

    expect(first).toEqual(second);
  });
});
