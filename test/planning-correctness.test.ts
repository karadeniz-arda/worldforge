import { describe, expect, it } from "vitest";

import { type AgentMission } from "../src/mission.js";
import { moveRobot } from "../src/movement.js";
import { observeWorld } from "../src/observation.js";
import { PlanningAgent } from "../src/planning.js";
import { calculateShortestPathLength, generateWorld } from "../src/generation.js";
import { runSimulation } from "../src/simulation.js";
import { parseWorld, type World } from "../src/world.js";

const sharedMission: AgentMission = {
  start: { x: 0, y: 1 },
  target: { x: 4, y: 1 },
  width: 5,
  height: 3,
};

const hiddenFreeWorld: World = parseWorld([
  ".....",
  "R...T",
  ".....",
]);

const hiddenBlockedWorld: World = parseWorld([
  ".....",
  "R.#.T",
  ".....",
]);

describe("PlanningAgent information boundary", () => {
  it.each(["coordinate", "information-gain"] as const)(
    "does not react to hidden terrain before observing it (%s)",
    (tieBreakPolicy) => {
      const firstAgent = new PlanningAgent(sharedMission, { recordDiagnostics: true, tieBreakPolicy });
      const secondAgent = new PlanningAgent(sharedMission, { recordDiagnostics: true, tieBreakPolicy });

      const firstAction = firstAgent.decide(observeWorld(hiddenFreeWorld));
      const secondAction = secondAgent.decide(observeWorld(hiddenBlockedWorld));

      expect(firstAction).toBe(secondAction);
      expect(firstAgent.getLatestDecisionDebug()?.discoveredMap)
        .toEqual(secondAgent.getLatestDecisionDebug()?.discoveredMap);

      // Both worlds expose the same first observation. A stop would make this
      // fixture unsuitable rather than indicating a behavior difference.
      expect(typeof firstAction).toBe("string");
      expect(typeof secondAction).toBe("string");
      if (typeof firstAction !== "string" || typeof secondAction !== "string") {
        throw new Error("Expected the initial decision to be a movement direction.");
      }

      const firstAfterMove = moveRobot(hiddenFreeWorld, firstAction).world;
      const secondAfterMove = moveRobot(hiddenBlockedWorld, secondAction).world;
      expect(observeWorld(firstAfterMove)).not.toEqual(observeWorld(secondAfterMove));

      const firstAfterDiscovery = firstAgent.decide(observeWorld(firstAfterMove));
      const secondAfterDiscovery = secondAgent.decide(observeWorld(secondAfterMove));

      expect(firstAgent.getLatestDecisionDebug()?.discoveredMap)
        .not.toEqual(secondAgent.getLatestDecisionDebug()?.discoveredMap);
      expect(firstAfterDiscovery).not.toEqual(secondAfterDiscovery);
    },
  );
});

describe("PlanningAgent reachability fixtures", () => {
  it.each(["coordinate", "information-gain"] as const)(
    "distinguishes a full wall from a bottom passage (%s)",
    (tieBreakPolicy) => {
      const fullWall = parseWorld([
        "R.#.T",
        "..#..",
        "..#..",
        "..#..",
        "..#..",
      ]);
      const bottomGap = parseWorld([
        "R.#.T",
        "..#..",
        "..#..",
        "..#..",
        ".....",
      ]);
      const budget = 200;
      const fullWallResult = runSimulation(
        fullWall,
        new PlanningAgent({ start: fullWall.robot, target: fullWall.deliveryTarget, width: fullWall.width, height: fullWall.height }, { tieBreakPolicy }),
        budget,
      );
      const bottomGapResult = runSimulation(
        bottomGap,
        new PlanningAgent({ start: bottomGap.robot, target: bottomGap.deliveryTarget, width: bottomGap.width, height: bottomGap.height }, { tieBreakPolicy }),
        budget,
      );

      expect(calculateShortestPathLength(fullWall)).toBeNull();
      expect(calculateShortestPathLength(bottomGap)).not.toBeNull();
      expect(fullWallResult.termination).toBe("target-unreachable");
      expect(fullWallResult.rejectedMoves).toBe(0);
      expect(bottomGapResult.termination).toBe("goal-reached");
      expect(bottomGapResult.world.robot).toEqual(bottomGap.deliveryTarget);
    },
  );
});

describe("PlanningAgent oracle-backed small-world checks", () => {
  it.each<readonly ["reachable" | "unreachable", number]>([
    ["reachable", 41],
    ["reachable", 91],
    ["unreachable", 41],
    ["unreachable", 91],
  ])("matches oracle reachability for %s generated world seed %i", (reachability, worldSeed) => {
    const world = generateWorld({
      width: 6,
      height: 5,
      worldSeed,
      obstacleDensity: reachability === "reachable" ? 0.2 : 0.7,
      reachability,
      maxAttempts: 1_000,
    });
    const oracleDistance = calculateShortestPathLength(world);
    // This is a deliberately generous regression-test budget (4 * cells²),
    // not a claimed theoretical completion bound for the greedy policy.
    const conservativeBudget = 4 * world.width * world.height * world.width * world.height;
    const result = runSimulation(
      world,
      new PlanningAgent({ start: world.robot, target: world.deliveryTarget, width: world.width, height: world.height }),
      conservativeBudget,
    );

    if (oracleDistance === null) {
      expect(result.termination).toBe("target-unreachable");
    } else {
      expect(result.termination).toBe("goal-reached");
      expect(result.world.robot).toEqual(world.deliveryTarget);
    }
  });
});
