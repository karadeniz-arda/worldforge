import { describe, expect, it } from "vitest";

import { type Agent, type AgentDecision } from "../src/agent.js";
import { calculateShortestPathLength, generateWorld } from "../src/generation.js";
import { createAgentMission } from "../src/mission.js";
import { PlanningAgent, type KnownCell } from "../src/planning.js";
import { createScenario } from "../src/scenarios.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import type { World } from "../src/world.js";

class StopAgent implements Agent {
  public decisions = 0;

  decide(): AgentDecision {
    this.decisions += 1;
    return { kind: "stop", reason: "target-unreachable" };
  }
}

function directTargetWorld(): World {
  return {
    width: 2,
    height: 1,
    robot: { x: 0, y: 0 },
    deliveryTarget: { x: 1, y: 0 },
    obstacles: [],
  };
}

describe("explicit agent termination", () => {
  it("stops immediately without a phantom rejected movement", () => {
    const world = createScenario("unreachable");
    const agent = new PlanningAgent(createAgentMission(world));
    const result = runSimulation(world, agent, 10);

    expect(result).toMatchObject({
      termination: "target-unreachable",
      stepsTaken: 0,
      successfulMoves: 0,
      rejectedMoves: 0,
      steps: [],
    });
  });

  it("uses target-unreachable only after the agent receives an observation", () => {
    const agent = new StopAgent();
    const result = runSimulation(createScenario("easy"), agent, 0);

    expect(result.termination).toBe("step-limit");
    expect(agent.decisions).toBe(0);
  });

  it("does not falsely stop when a known-safe target route exists", () => {
    const world = directTargetWorld();
    const result = runSimulation(world, new PlanningAgent(createAgentMission(world)), 1);

    expect(result.termination).toBe("goal-reached");
    expect(result.stepsTaken).toBe(1);
  });

  it("does not stop while a reachable frontier remains", () => {
    const world = createScenario("detour");
    const result = runSimulation(world, new PlanningAgent(createAgentMission(world)), 1);

    expect(result.termination).toBe("step-limit");
    expect(result.stepsTaken).toBe(1);
    expect(result.steps[0]?.action).toBe("right");
  });

  it("continues around observed obstacles to reach a reachable target", () => {
    const world = createScenario("detour");
    const result = runSimulation(world, new PlanningAgent(createAgentMission(world)), 100);

    expect(result.termination).toBe("goal-reached");
    expect(result.world.robot).toEqual(world.deliveryTarget);
  });

  it("does not ask the agent when the robot already occupies the target", () => {
    const world: World = { ...directTargetWorld(), robot: { x: 1, y: 0 } };
    const agent = new StopAgent();
    const result = runSimulation(world, agent, 5);

    expect(result.termination).toBe("goal-reached");
    expect(agent.decisions).toBe(0);
  });

  it("records an immutable terminal replay event and agrees with untraced execution", () => {
    const world = createScenario("unreachable");
    const tracedAgent = new PlanningAgent(createAgentMission(world), { recordDiagnostics: true });
    const traced = runSimulationWithTrace(world, tracedAgent, 10, { target: world.deliveryTarget });
    const untraced = runSimulation(world, new PlanningAgent(createAgentMission(world)), 10);
    const terminal = traced.trace.terminalEvent;

    expect(traced.result).toEqual(untraced);
    expect(terminal).toMatchObject({
      kind: "agent-stop",
      afterMovementSteps: 0,
      position: { x: 0, y: 0 },
      decision: { kind: "stop", reason: "target-unreachable" },
      planningDebug: { mode: "unreachable", frontierCandidates: [] },
    });
    const callerCopy = tracedAgent.getLatestDecisionDebug()!;
    (callerCopy.discoveredMap.cells as KnownCell[])[0] = "blocked";
    expect(terminal?.planningDebug?.discoveredMap.cells[0]).not.toBe("blocked");
  });

  it("matches oracle BFS reachability only in tests for representative generated worlds", () => {
    const reachable = generateWorld({
      width: 8,
      height: 5,
      worldSeed: 91,
      obstacleDensity: 0.2,
      reachability: "reachable",
      maxAttempts: 1_000,
    });
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
    expect(runSimulation(reachable, new PlanningAgent(createAgentMission(reachable)), 500).termination).toBe("goal-reached");
    expect(runSimulation(unreachable, new PlanningAgent(createAgentMission(unreachable)), 500).termination).toBe("target-unreachable");
  });
});
