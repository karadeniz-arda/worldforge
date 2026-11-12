import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Agent } from "../src/agent.js";
import { experiment006Configuration as config, fullEvaluationCases, pilotEvaluationCases } from "../src/experiment-006-config.js";
import { referenceDistance, referenceTreeDistance } from "../src/experiment-006-oracle.js";
import { describe as distribution, pairedSummary, quantile } from "../src/experiment-006-statistics.js";
import {
  classifyOutcome, createEvaluationAgent, deriveEvaluationOutcome, duplicateLayouts, evaluationAgentSeed,
  generateEvaluationWorld, mapSignature, pairWorldPolicies, runExperiment006, summarizeEvaluationGroup,
  summarizeWorldPolicy, validateEvaluationOracle, type EvaluatedWorld, type EvaluationOutcome,
} from "../src/experiment-006.js";
import { calculateShortestPathLength } from "../src/generation.js";
import { createAgentMission } from "../src/mission.js";
import { runSimulation } from "../src/simulation.js";
import { parseWorld } from "../src/world.js";

describe("Experiment 006 configuration and worlds", () => {
  it("has 638 cases with held-out seeds disjoint from development", () => {
    const cases = fullEvaluationCases();
    expect(cases).toHaveLength(638);
    expect(new Set(cases.map((c) => c.id)).size).toBe(638);
    expect(config.worldSeeds).toEqual(Array.from({ length: 100 }, (_, i) => 110000 + i));
    expect(config.worldSeeds.some((seed) => (config.developmentSeeds as readonly number[]).includes(seed))).toBe(false);
    expect(pilotEvaluationCases().every((c) => !config.worldSeeds.includes(c.worldSeed))).toBe(true);
    for (const height of [15, 21]) {
      expect(cases.filter((c) => c.family === "doorway" && c.height === height).map((c) => c.doorRow))
        .toEqual(Array.from({ length: height }, (_, i) => i));
      expect(cases.filter((c) => c.family === "sealed" && c.height === height)).toHaveLength(1);
    }
  });

  it("reproduces every full evaluation world and independently checks its oracle", () => {
    for (const record of fullEvaluationCases()) {
      const first = generateEvaluationWorld(record);
      const second = generateEvaluationWorld(record);
      expect(mapSignature(first.world), record.id).toBe(mapSignature(second.world));
      expect(first).toEqual(second);
      expect(first.world).not.toBe(second.world);
      validateEvaluationOracle(record, first);
    }
  });

  it("derives distinct fresh deterministic random trial seeds", () => {
    const seeds = fullEvaluationCases().flatMap((c) => Array.from({ length: 5 }, (_, i) => evaluationAgentSeed(c, i)));
    expect(new Set(seeds).size).toBe(3190);
    const record = pilotEvaluationCases()[0]!;
    const world = generateEvaluationWorld(record).world;
    const seed = evaluationAgentSeed(record, 0);
    const first = createEvaluationAgent("random", createAgentMission(world), seed);
    const second = createEvaluationAgent("random", createAgentMission(world), seed);
    expect(first).not.toBe(second);
    expect(runSimulation(world, first, 100)).toEqual(runSimulation(world, second, 100));
  });

  it("constructs all policies from the same public metadata with no oracle fields", () => {
    const world = parseWorld(["R..", ".#.", "..T"]);
    for (const agent of config.agents) {
      const accessed: string[] = [];
      const mission = createAgentMission(world);
      expect(Object.keys(mission).sort()).toEqual(["height", "start", "target", "width"]);
      const proxy = new Proxy(mission, { get(target, property, receiver) {
        accessed.push(String(property));
        return Reflect.get(target, property, receiver);
      } });
      const instance = createEvaluationAgent(agent, proxy, agent === "random" ? 210000 : null);
      expect(accessed.every((property) => ["height", "start", "target", "width"].includes(property))).toBe(true);
      expect(accessed).toContain("target");
      expect(runSimulation(world, instance, 100).termination).toBe("goal-reached");
      expect(mission.target).toEqual(world.deliveryTarget);
      expect(mission.target).not.toBe(world.deliveryTarget);
    }
  });

  it("detects duplicates independent of obstacle order and retains case IDs", () => {
    const record = pilotEvaluationCases()[2]!;
    const world = generateEvaluationWorld(record).world;
    expect(mapSignature(world)).toBe(mapSignature({ ...world, obstacles: [...world.obstacles].reverse() }));
    const signature = mapSignature(world);
    expect(duplicateLayouts([{ specification: record, signature }, { specification: { ...record, id: "copy" }, signature }])[0]?.caseIds)
      .toEqual([record.id, "copy"]);
  });

  it("repeats a small development pilot byte-identically", () => {
    expect(JSON.stringify(runExperiment006(pilotEvaluationCases()))).toBe(JSON.stringify(runExperiment006(pilotEvaluationCases())));
  });

  it("keeps the historical committed Experiment 005 artifact unchanged", () => {
    expect(readFileSync("results/experiment-005.json").equals(execFileSync("git", ["show", "HEAD:results/experiment-005.json"], { maxBuffer: 16 * 1024 * 1024 }))).toBe(true);
  });
});

describe("independent reference checks", () => {
  it.each([
    { rows: ["R.T"], distance: 2 },
    { rows: ["R#T"], distance: null },
    { rows: ["R.#.", ".#..", "....", "...T"], distance: 6 },
    { rows: ["R#T", "..."], distance: 4 },
  ])("matches hand-calculated $rows", ({ rows, distance }) => {
    expect(referenceDistance(parseWorld(rows))).toBe(distance);
    expect(calculateShortestPathLength(parseWorld(rows))).toBe(distance);
  });
  it("rejects a cyclic maze and validates a unique tree path", () => {
    expect(() => referenceTreeDistance(parseWorld(["R.", ".T"]))).toThrow("acyclicity");
    expect(referenceTreeDistance(parseWorld(["R#T", "..."]))).toBe(4);
  });
});

function scripted(actionsBeforeStop: number, action: "right" | "left" = "right"): Agent {
  let count = 0;
  return { decide: () => count++ < actionsBeforeStop ? action : { kind: "stop", reason: "target-unreachable" } };
}

describe("budget derivation and safety classification", () => {
  it.each([
    { rows: ["R..#T"], stop: 0, budgets: [0, 1, 2] },
    { rows: ["R..#T"], stop: 2, budgets: [0, 1, 2, 3, 5] },
    { rows: ["R.T"], stop: 10, budgets: [0, 1, 2, 3] },
    { rows: ["R..#T"], stop: 100, budgets: [0, 1, 2, 3, 5] },
  ])("matches fresh direct simulations for $rows, stop=$stop", ({ rows, stop, budgets }) => {
    const world = parseWorld(rows);
    const oracle = calculateShortestPathLength(world);
    const maximum = runSimulation(world, scripted(stop), 5);
    for (const budget of budgets) {
      const direct = runSimulation(world, scripted(stop), budget);
      const derived = deriveEvaluationOutcome(maximum, world, oracle, budget);
      expect(derived.termination).toBe(direct.termination);
      expect(derived.actions).toBe(direct.stepsTaken);
      expect(derived.successfulMoves).toBe(direct.successfulMoves);
      expect(derived.rejectedMoves).toBe(direct.rejectedMoves);
      expect(derived.decisionOpportunities).toBe(direct.stepsTaken + Number(direct.termination === "target-unreachable"));
      expect(derived.repeatedVisits).toBe(direct.movementAnalytics.repeatedVisits);
      expect(derived.immediateBacktracks).toBe(direct.movementAnalytics.immediateBacktracks);
    }
    if (stop === 2) {
      expect(deriveEvaluationOutcome(maximum, world, oracle, 2)).toMatchObject({ termination: "step-limit", actions: 2, stopDecisions: 0 });
      expect(deriveEvaluationOutcome(maximum, world, oracle, 3)).toMatchObject({ category: "correct-unreachable", actions: 2, stopDecisions: 1, decisionOpportunities: 3, spl: null });
    }
  });

  it("classifies false unreachable as critical and failures as zero reachable SPL", () => {
    const world = parseWorld(["R.T"]);
    const stopped = runSimulation(world, scripted(0), 5);
    expect(deriveEvaluationOutcome(stopped, world, 2, 5)).toMatchObject({ category: "false-unreachable", spl: 0, successfulRatio: null });
    expect(classifyOutcome("target-unreachable", null)).toBe("correct-unreachable");
    const goal = runSimulation(world, scripted(10), 5);
    expect(deriveEvaluationOutcome(goal, world, 2, 2)).toMatchObject({ spl: 1, successfulRatio: 1, actions: 2 });
    expect(deriveEvaluationOutcome(goal, world, 2, 1)).toMatchObject({ spl: 0, successfulRatio: null });
    expect(() => deriveEvaluationOutcome(goal, world, 0, 5)).toThrow("positive");
  });

  it("preserves initial-goal semantics and zero decisions", () => {
    const initial = parseWorld(["RT"]);
    const world = { ...initial, deliveryTarget: initial.robot };
    const result = runSimulation(world, { decide: () => { throw new Error("Should never be called"); } }, 0);
    // Initial goals are tested at the simulator boundary; evaluation requires distinct endpoints.
    expect(result).toMatchObject({ termination: "goal-reached", stepsTaken: 0 });
  });

  it("matches prefixes for each actual policy including seeded random state", () => {
    for (const record of pilotEvaluationCases()) {
      const { world, shortestPathLength } = generateEvaluationWorld(record);
      for (const agent of config.agents) {
        const seed = agent === "random" ? evaluationAgentSeed(record, 0) : null;
        const maximum = runSimulation(world, createEvaluationAgent(agent, createAgentMission(world), seed), 1000);
        for (const budget of [0, maximum.stepsTaken, maximum.stepsTaken + 1, 100, 500, 1000].filter((b) => b <= 1000)) {
          const direct = runSimulation(world, createEvaluationAgent(agent, createAgentMission(world), seed), budget);
          const prefix = deriveEvaluationOutcome(maximum, world, shortestPathLength, budget);
          expect(prefix.termination).toBe(direct.termination);
          expect(prefix.actions).toBe(direct.stepsTaken);
        }
      }
    }
  });
});

function outcome(actions: number, succeeded: boolean, oracle = 2): EvaluationOutcome {
  return { budget: 100, termination: succeeded ? "goal-reached" : "step-limit", category: succeeded ? "goal-reached" : "step-limit",
    actions, successfulMoves: actions, rejectedMoves: 0, decisionOpportunities: actions, stopDecisions: 0,
    spl: succeeded ? oracle / actions : 0, successfulActions: succeeded ? actions : null,
    successfulRatio: succeeded ? actions / oracle : null, oracleOptimal: succeeded && actions === oracle,
    repeatedVisits: 0, immediateBacktracks: 0 };
}
function worldRecord(id: string, outcomes: readonly EvaluationOutcome[]): EvaluatedWorld {
  return { specification: { ...pilotEvaluationCases()[0]!, id }, signature: id, attempts: 1, oracle: 2,
    trials: outcomes.map((value, replication) => ({ agent: "random", replication, seed: replication, outcomes: [value] })) };
}

describe("world-level aggregation and paired statistics", () => {
  it("averages five random runs before comparing worlds", () => {
    const first = worldRecord("one", [outcome(2, true), outcome(4, true), outcome(100, false), outcome(100, false), outcome(100, false)]);
    const second = worldRecord("two", Array.from({ length: 5 }, () => outcome(4, true)));
    expect(summarizeWorldPolicy(first, "random", 100)).toMatchObject({ spl: 0.3, successRate: 0.4, successfulActions: 3, successfulRatio: 1.5 });
    const aggregate = summarizeEvaluationGroup([first, second], "random", 100);
    expect(aggregate).toMatchObject({ worldCount: 2, trialCount: 10, meanSPL: 0.4, worldMeanSuccessRate: 0.7, oracleOptimalTrajectories: 1 });
    expect(aggregate.successfulWorldActions).toMatchObject({ count: 2, mean: 3.5, median: 3.5, maximum: 4 });
    expect(aggregate.successfulTrialActions.mean).toBeCloseTo(26 / 7);
  });

  it("distinguishes medians, p90 and maximum and leaves empty statistics null", () => {
    expect(distribution([1, 2, 3, 10])).toMatchObject({ count: 4, mean: 4, median: 2.5, maximum: 10 });
    expect(distribution([1, 2, 3, 10]).p90).toBeCloseTo(7.9);
    expect(quantile([], 0.9)).toBeNull();
    const empty = summarizeEvaluationGroup([], "random", 100);
    expect(empty).toMatchObject({ trialCount: 0, meanSPL: null, worldMeanSuccessRate: null });
    const failed = summarizeEvaluationGroup([worldRecord("one", [outcome(100, false)])], "random", 100);
    expect(failed).toMatchObject({ meanSPL: 0, successfulWorldActions: { count: 0, mean: null, median: null, p90: null, maximum: null } });
  });

  it("returns null SPL and ratios for unreachable groups", () => {
    const o: EvaluationOutcome = { ...outcome(3, false), termination: "target-unreachable", category: "correct-unreachable", spl: null, stopDecisions: 1, decisionOpportunities: 4 };
    const record = { ...worldRecord("sealed", [o]), oracle: null };
    expect(summarizeEvaluationGroup([record], "random", 100)).toMatchObject({ meanSPL: null, successfulTrialRatios: { mean: null }, categories: { "correct-unreachable": 1 }, actionsBeforeCorrectStop: { mean: 3 } });
  });

  it("refuses mismatched paired worlds and budgets", () => {
    const one = summarizeWorldPolicy(worldRecord("one", [outcome(2, true)]), "random", 100);
    expect(() => pairWorldPolicies([one], [{ ...one, id: "different" }])).toThrow("mismatch");
    expect(() => pairWorldPolicies([one], [{ ...one, budget: 500 }])).toThrow("mismatch");
    expect(() => pairWorldPolicies([one], [{ ...one, signature: "different" }])).toThrow("mismatch");
    expect(() => pairWorldPolicies([one, one], [one, one])).toThrow("duplicate");
    expect(pairWorldPolicies([one], [one])).toHaveLength(1);
  });

  it("bootstraps signature clusters deterministically and omits finite-set CIs", () => {
    const values = [{ signature: "a", difference: 0 }, { signature: "a", difference: 0 }, { signature: "b", difference: 3 }];
    const summary = pairedSummary(values, 310000, true);
    expect(summary).toEqual(pairedSummary(values, 310000, true));
    expect(summary).toMatchObject({ worldCount: 3, uniqueLayoutCount: 2, meanDifference: 1, confidenceInterval: { lower: 0, upper: 3 } });
    expect(pairedSummary(values, 1, false).confidenceInterval).toBeNull();
    expect(pairedSummary([], 1, true)).toMatchObject({ meanDifference: null, confidenceInterval: null });
  });
});
