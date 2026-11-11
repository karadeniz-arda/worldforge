import { describe, expect, it } from "vitest";

import { createAgentMission } from "../src/mission.js";
import { PlanningAgent, type KnownCell } from "../src/planning.js";
import { createScenario } from "../src/scenarios.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import type { World } from "../src/world.js";

function cellAt(cells: readonly KnownCell[], width: number, x: number, y: number): KnownCell {
  return cells[y * width + x]!;
}

describe("PlanningAgent diagnostics", () => {
  it("records a snapshot from the decision observation with scored frontier candidates", () => {
    const world = createScenario("detour");
    const replay = runSimulationWithTrace(
      world,
      new PlanningAgent(createAgentMission(world), { recordDiagnostics: true }),
      1,
      { target: world.deliveryTarget },
    );
    const snapshot = replay.trace.steps[0]?.planningDebug;

    expect(snapshot).toMatchObject({
      robot: { x: 0, y: 0 },
      mode: "frontier",
      action: "right",
      selectedFrontier: { x: 1, y: 0 },
      plannedRoute: ["right"],
    });
    expect(snapshot?.frontierCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        position: { x: 1, y: 0 },
        knownSafeDistance: 1,
        manhattanDistanceToTarget: 3,
        combinedScore: 4,
      }),
    ]));
    expect(snapshot?.selectionReason).toContain("score 4 = 1 known-safe + 3 Manhattan");
  });

  it("does not include distant hidden obstacles in its snapshot", () => {
    const world: World = {
      width: 4,
      height: 4,
      robot: { x: 0, y: 0 },
      deliveryTarget: { x: 3, y: 3 },
      obstacles: [{ x: 3, y: 2 }],
    };
    const replay = runSimulationWithTrace(
      world,
      new PlanningAgent(createAgentMission(world), { recordDiagnostics: true }),
      1,
    );
    const snapshot = replay.trace.steps[0]?.planningDebug;

    expect(snapshot).toBeDefined();
    expect(cellAt(snapshot!.discoveredMap.cells, 4, 3, 2)).toBe("unknown");
    expect(JSON.stringify(snapshot)).not.toContain('"obstacles"');
  });

  it("keeps historical trace snapshots detached from later decisions and callers", () => {
    const world = createScenario("detour");
    const agent = new PlanningAgent(createAgentMission(world), { recordDiagnostics: true });
    const replay = runSimulationWithTrace(world, agent, 3);
    const firstSnapshot = replay.trace.steps[0]?.planningDebug!;
    const recordedFirstMap = [...firstSnapshot.discoveredMap.cells];
    const callerCopy = agent.getLatestDecisionDebug()!;

    (callerCopy.discoveredMap.cells as KnownCell[])[0] = "blocked";

    expect(firstSnapshot.discoveredMap.cells).toEqual(recordedFirstMap);
    expect(agent.getLatestDecisionDebug()?.discoveredMap.cells[0]).not.toBe("blocked");
    expect(replay.trace.steps[1]?.planningDebug).not.toEqual(firstSnapshot);
  });

  it("keeps actions and simulation results identical with diagnostics disabled or enabled", () => {
    const world = createScenario("detour");
    const withoutDiagnostics = runSimulation(world, new PlanningAgent(createAgentMission(world)), 100);
    const withDiagnostics = runSimulation(
      world,
      new PlanningAgent(createAgentMission(world), { recordDiagnostics: true }),
      100,
    );

    expect(withDiagnostics).toEqual(withoutDiagnostics);
    const normalTrace = runSimulationWithTrace(world, new PlanningAgent(createAgentMission(world)), 1);
    expect(normalTrace.trace.steps[0]).not.toHaveProperty("planningDebug");
  });

  it("records information-gain scores and the selected replay decision", () => {
    const world = createScenario("detour");
    const replay = runSimulationWithTrace(
      world,
      new PlanningAgent(createAgentMission(world), { recordDiagnostics: true, tieBreakPolicy: "information-gain" }),
      3,
    );
    const decision = replay.trace.steps[2];
    const snapshot = decision?.planningDebug;

    expect(decision?.positionBefore).toEqual({ x: 1, y: 1 });
    expect(decision?.action).toBe("down");
    expect(snapshot).toMatchObject({
      action: "down",
      tieBreakPolicy: "information-gain",
      selectedFrontier: { x: 1, y: 2 },
    });
    expect(snapshot?.frontierCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ position: { x: 0, y: 1 }, combinedScore: 6, unknownNeighborCount: 1 }),
      expect.objectContaining({ position: { x: 1, y: 2 }, combinedScore: 6, unknownNeighborCount: 3 }),
    ]));
    expect(snapshot?.selectionReason).toContain("higher unknown-neighbor information gain");
  });
});
