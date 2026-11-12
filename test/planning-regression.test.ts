import { describe, expect, it } from "vitest";
import { calculateShortestPathLength, generateWorld } from "../src/generation.js";
import { adjacentPosition, getKnownCell } from "../src/known-map.js";
import { createAgentMission } from "../src/mission.js";
import type { Observation } from "../src/observation.js";
import { PlanningAgent } from "../src/planning.js";
import { createScenario, scenarioRows, type ScenarioName } from "../src/scenarios.js";
import { runSimulation, runSimulationWithTrace } from "../src/simulation.js";
import { generateBarrierWorld } from "../src/structural-generation.js";
import { generateMazeWorld } from "../src/maze-generation.js";
import { generateTrapWorld } from "../src/trap-generation.js";

const cases = [
  ...Object.keys(scenarioRows).map((name) => ({ name, world: createScenario(name as ScenarioName) })),
  ...[41, 91, 137].flatMap((worldSeed) => (["reachable", "unreachable"] as const).map((reachability) => ({
    name: `${reachability}-${worldSeed}`,
    world: generateWorld({ width: 6, height: 5, worldSeed, obstacleDensity: reachability === "reachable" ? 0.2 : 0.7, reachability }),
  }))),
  ...(["doorway", "sealed"] as const).map((variant) => ({ name: variant,
    world: generateBarrierWorld({ width: 9, height: 15, worldSeed: 42, doorRow: variant === "doorway" ? 14 : undefined, variant }).world,
  })),
  { name: "maze-5001", world: generateMazeWorld({ width: 9, height: 11, worldSeed: 5001 }).world },
  { name: "trap-6001", world: generateTrapWorld({ width: 15, height: 15, worldSeed: 6001 }).world },
];

describe.each(["coordinate", "information-gain"] as const)("PlanningAgent regression (%s)", (tieBreakPolicy) => {
  it.each(cases)("preserves safe deterministic execution for $name", ({ name, world }) => {
    const agent = new PlanningAgent(createAgentMission(world), { tieBreakPolicy, recordDiagnostics: true });
    const configurations = new Map<string, number>();
    let decisionNumber = 0;
    const checkedAgent = {
      decide(observation: Observation) {
        const decision = agent.decide(observation);
        const debug = agent.getLatestDecisionDebug()!;
        decisionNumber += 1;
        const configuration = JSON.stringify([observation.robot, debug.discoveredMap]);
        const previous = configurations.get(configuration);
        if (previous !== undefined) {
          throw new Error(`${name}/${tieBreakPolicy}: configuration repeats at decision ${decisionNumber}, first seen at ${previous}. Snapshot: ${JSON.stringify(debug)}`);
        }
        configurations.set(configuration, decisionNumber);
        if (typeof decision === "string") {
          const next = adjacentPosition(observation.robot, decision);
          expect(getKnownCell(debug.discoveredMap, next), `Unsafe decision ${decisionNumber}: ${JSON.stringify(debug)}`).toBe("free");
        }
        return decision;
      },
      getLatestDecisionDebug: () => agent.getLatestDecisionDebug(),
    };
    // Fixed test budget for this bounded collection, not a universal completion bound.
    const budget = 2000;
    const traced = runSimulationWithTrace(world, checkedAgent, budget);
    const ordinary = runSimulation(world, new PlanningAgent(createAgentMission(world), { tieBreakPolicy }), budget);
    expect(traced.result).toEqual(ordinary);
    const oracle = calculateShortestPathLength(world);
    expect(traced.result.termination, `${name} exceeded test budget ${budget}`).toBe(oracle === null ? "target-unreachable" : "goal-reached");
    expect(traced.result.rejectedMoves).toBe(0);
    expect(traced.result.stepsTaken).toBe(traced.result.successfulMoves);
    expect(traced.trace.terminalEvent !== null).toBe(oracle === null);
  });
});
