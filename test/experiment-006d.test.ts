import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { diagnosticCases, experiment006dConfiguration as config } from "../src/experiment-006d-config.js";
import { annotateTreeTrajectory, compareOracleNeighbor, observedDecisionEvidence, recordOptimisticTrajectory, type SafeNeighbor } from "../src/experiment-006d-diagnostics.js";
import {
  assertFrozenHashes, assertFullCheckpoint, assertPublishedDiagnosticCheckpoint, baseline006dSources,
  diagnostic006dSources, frozen006dHashes, inspectDiagnosticInputs, parseDiagnosticMode,
} from "../src/experiment-006d-freeze.js";
import { buildTreeIndex, cellIndex, mazeTerrainSignature, selectDiagnosticMissions, treeDistances, uniqueTreePath } from "../src/experiment-006d-worlds.js";
import { runExperiment006d, summarizeDiagnosticEpisode, summarizeDiagnosticPairs } from "../src/experiment-006d.js";
import { createUnknownMap } from "../src/known-map.js";
import * as mazeModule from "../src/maze-generation.js";
import { createAgentMission } from "../src/mission.js";
import * as missionModule from "../src/mission.js";
import { observeWorld } from "../src/observation.js";
import { calculateOptimisticDistances, OptimisticBFSAgent } from "../src/optimistic-bfs.js";
import { runSimulation } from "../src/simulation.js";
import { parseWorld } from "../src/world.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

const developmentCase = { id: "15x15/5001", size: 15, worldSeed: 5001 };
const developmentMaze = () => mazeModule.generateMazeWorld({ width: 15, height: 15, worldSeed: 5001 }).world;
const handTree = () => parseWorld(["R.##", ".###", "....", "###T"]);

describe("006-D case selection", () => {
  it("enumerates metadata without generating held-out worlds", () => {
    const generator = vi.spyOn(mazeModule, "generateMazeWorld");
    expect(diagnosticCases("pilot")).toHaveLength(4);
    expect(diagnosticCases("full")).toHaveLength(200);
    expect(diagnosticCases("full").length * config.conditions.length).toBe(800);
    expect(new Set(diagnosticCases("full").map((c) => c.id)).size).toBe(200);
    expect(config.pilotSeeds.some((s) => config.heldOutSeeds.includes(s))).toBe(false);
    expect(generator).not.toHaveBeenCalled();
    generator.mockRestore();
  });

  it("deterministically selects traversable matched missions without changing terrain", () => {
    const base = developmentMaze();
    const original = structuredClone(base);
    const a = selectDiagnosticMissions(base, developmentCase);
    const b = selectDiagnosticMissions(base, developmentCase);
    expect(a).toEqual(b);
    expect(base).toEqual(original);
    const starts: number[] = [];
    for (const mission of a.missions) {
      expect(mission.status).toBe("selected");
      if (mission.status !== "selected") throw Error("Selection failed");
      expect(mission.oracle).toBeGreaterThan(0);
      expect(mission.world.robot).not.toEqual(mission.world.deliveryTarget);
      expect(mazeTerrainSignature(mission.world)).toBe(a.signature);
      expect(mission.world.obstacles).not.toBe(base.obstacles);
      expect(mission.world.obstacles[0]).not.toBe(base.obstacles[0]);
      expect(mission.world.obstacles).not.toContainEqual(mission.world.robot);
      expect(mission.world.obstacles).not.toContainEqual(mission.world.deliveryTarget);
      if (mission.condition === "B" || mission.condition === "D") {
        expect(mission.oracle).toBeGreaterThanOrEqual(6);
        expect(mission.world.deliveryTarget.x % 2).toBe(1);
        expect(mission.world.deliveryTarget.y % 2).toBe(1);
      }
      if (mission.condition === "C" || mission.condition === "D") {
        expect(mission.world.robot).not.toEqual(config.root);
        starts.push(cellIndex(base.width, mission.world.robot));
        expect(a.tree.depth.get(cellIndex(base.width, mission.world.robot))).toBeGreaterThanOrEqual(4);
      }
    }
    expect(starts[0]).toBe(starts[1]);
    expect(a.selections.every((s) => s.selectedIndex !== null && s.selectedIndex < s.candidateCount)).toBe(true);
    expect(new Set(a.selections.map((s) => s.seed)).size).toBe(2);
    const missions = a.missions.flatMap((m) => m.status === "selected" ? [m] : []);
    const [A, B, C, D] = missions;
    expect(A!.world.deliveryTarget).toEqual(C!.world.deliveryTarget);
    expect(B!.world.deliveryTarget).toEqual(D!.world.deliveryTarget);
    expect(A!.world.robot).not.toEqual(C!.world.robot);
    expect(B!.world.robot).not.toEqual(D!.world.robot);
    expect(A!.world.robot).toEqual(B!.world.robot);
    expect(C!.world.robot).toEqual(D!.world.robot);
    expect(a.endpoints.F).toEqual(base.deliveryTarget);
    expect(A!.world.deliveryTarget).toEqual(a.endpoints.F);
    expect(C!.world.deliveryTarget).toEqual(a.endpoints.F);
    expect(B!.world.deliveryTarget).toEqual(a.endpoints.Q);
    expect(D!.world.deliveryTarget).toEqual(a.endpoints.Q);
    expect(a.endpoints.S).not.toEqual(a.endpoints.F);
    expect(a.endpoints.Q).not.toEqual(a.endpoints.F);
    expect(a.endpoints.Q).not.toEqual(a.endpoints.S);
    expect(a.endpoints.Q).not.toEqual(a.endpoints.R);
    expect(C!.world.robot.x % 2).toBe(1);
    expect(C!.world.robot.y % 2).toBe(1);
    expect(mazeTerrainSignature(A!.world)).toBe(mazeTerrainSignature(C!.world));
    expect(mazeTerrainSignature(B!.world)).toBe(mazeTerrainSignature(D!.world));
  });

  it("records Q failure explicitly while retaining matched A/C when S exists", () => {
    const base = mazeModule.generateMazeWorld({ width: 5, height: 5, worldSeed: 5001 }).world;
    const selected = selectDiagnosticMissions(base, { id: "small-dev", size: 5, worldSeed: 5001 });
    expect(selected.endpoints.S).not.toBeNull();
    expect(selected.endpoints.Q).toBeNull();
    expect(selected.missions.map((m) => [m.condition, m.status])).toEqual([
      ["A", "selected"], ["B", "selection-failure"], ["C", "selected"], ["D", "selection-failure"],
    ]);
    expect(selected.selections[1]?.failureReason).toContain("distance >=6 from both");
  });

  it("selects endpoints without consuming or rerunning the generator stream", () => {
    const base = developmentMaze();
    const generator = vi.spyOn(mazeModule, "generateMazeWorld");
    const first = selectDiagnosticMissions(base, developmentCase);
    selectDiagnosticMissions(base, { ...developmentCase, worldSeed: 5002 });
    expect(selectDiagnosticMissions(base, developmentCase)).toEqual(first);
    expect(generator).not.toHaveBeenCalled();
    generator.mockRestore();
    expect(developmentMaze()).toEqual(base);
  });

  it("records selection failures without changing thresholds", () => {
    const tiny = parseWorld(["###", "#RT", "###"]);
    const selected = selectDiagnosticMissions(tiny, { id: "tiny", size: 3, worldSeed: 5001 });
    expect(selected.missions.filter((m) => m.status === "selection-failure").map((m) => m.condition)).toEqual(["B", "C", "D"]);
    expect(() => selectDiagnosticMissions({ ...tiny, robot: { x: 2, y: 1 } }, developmentCase)).toThrow("root metadata");
  });

  it("retains generation failures and unique case identities explicitly", () => {
    const failed = runExperiment006d([{ id: "invalid-dev", size: 4, worldSeed: 5001 }], "pilot");
    expect(failed.mazes[0]?.status).toBe("maze-failure");
    expect(failed.failures).toHaveLength(1);
    expect(failed.actualTrajectories).toBe(0);
    expect(() => runExperiment006d([developmentCase, developmentCase], "pilot")).toThrow("Duplicate");
  });
});

describe("independent tree oracle", () => {
  it("checks connectivity, edge count, unique paths and distance changes", () => {
    const world = handTree();
    const tree = buildTreeIndex(world, world.robot);
    const path = uniqueTreePath(tree, world.robot, world.deliveryTarget);
    expect(tree.edgeCount).toBe(tree.vertices.length - 1);
    expect(path).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }]);
    expect(uniqueTreePath(tree, { x: 0, y: 1 }, world.deliveryTarget).length - 1).toBe(5);
    expect(uniqueTreePath(tree, { x: 1, y: 0 }, world.deliveryTarget).length - 1).toBe(7);
    expect(treeDistances(tree, world.robot).get(cellIndex(world.width, world.deliveryTarget))).toBe(6);
  });
  it.each([
    { rows: ["R.", ".T"], message: "Cyclic" },
    { rows: ["R#T"], message: "Disconnected" },
  ])("rejects invalid graph $rows", ({ rows, message }) => {
    const world = parseWorld(rows);
    expect(() => buildTreeIndex(world, world.robot)).toThrow(message);
  });
  it("rejects blocked endpoints/root and invalid coordinates", () => {
    const world = handTree();
    expect(() => buildTreeIndex(world, { x: 2, y: 0 })).toThrow("blocked");
    expect(() => buildTreeIndex({ ...world, deliveryTarget: { x: 2, y: 0 } }, world.robot)).toThrow("blocked");
    expect(() => buildTreeIndex(world, { x: -1, y: 0 })).toThrow("coordinates");
  });
});

describe("optimistic evidence and oracle annotations", () => {
  it("verifies bipartite parity and the two-edge bound on finite neighbour distances", () => {
    const maps = [
      parseWorld([".....", ".....", "..R..", ".....", "....T"]),
      parseWorld(["R.##", ".###", "....", "###T"]),
      developmentMaze(),
    ];
    let comparisons = 0;
    for (const world of maps) {
      const map = { width: world.width, height: world.height,
        cells: Array.from({ length: world.width * world.height }, (_, i) => world.obstacles.some((p) => p.y * world.width + p.x === i) ? "blocked" as const : "free" as const) };
      for (const knowledge of [createUnknownMap(map.width, map.height), map]) {
        const distances = calculateOptimisticDistances(knowledge, world.deliveryTarget);
        for (let y = 1; y < world.height - 1; y += 1) for (let x = 1; x < world.width - 1; x += 1) {
          if (knowledge.cells[y * world.width + x] === "blocked") continue;
          const neighbors = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
            .filter((p) => knowledge.cells[p.y * world.width + p.x] !== "blocked" && Number.isFinite(distances[p.y * world.width + p.x]));
          for (const a of neighbors) for (const b of neighbors) {
            const difference = distances[a.y * world.width + a.x]! - distances[b.y * world.width + b.x]!;
            expect(Math.abs(difference) % 2).toBe(0);
            expect([-2, 0, 2]).toContain(difference);
            comparisons += 1;
          }
        }
      }
    }
    expect(comparisons).toBeGreaterThan(100);
  });
  it("learns only local cells and leaves a distant public target unknown", () => {
    const world = handTree();
    const map = createUnknownMap(4, 4);
    const evidence = observedDecisionEvidence(map, observeWorld(world), world.deliveryTarget);
    expect(evidence.map.cells[15]).toBe("unknown");
    expect(evidence.newlyFree).toHaveLength(3);
    expect(evidence.newlyBlocked).toHaveLength(0);
    expect(map.cells.every((c) => c === "unknown")).toBe(true);
    expect(evidence.safeNeighbors.map((n) => n.optimisticDistance)).toEqual([5, 5]);
  });
  it.each([
    { correct: 1, wrong: 3, margin: 2, classification: "positive" },
    { correct: 3, wrong: 3, margin: 0, classification: "zero" },
    { correct: 3, wrong: 1, margin: -2, classification: "negative" },
  ])("classifies $classification margins independently of actual tree-distance ordering", ({ correct, wrong, margin, classification }) => {
    const safe: SafeNeighbor[] = [
      { direction: "right", position: { x: 1, y: 0 }, optimisticDistance: correct },
      { direction: "down", position: { x: 0, y: 1 }, optimisticDistance: wrong },
    ];
    expect(compareOracleNeighbor(safe, { x: 1, y: 0 }, 3)).toMatchObject({ margin, marginClass: classification });
    expect(compareOracleNeighbor(safe.slice(0, 1), { x: 1, y: 0 }, 3)).toMatchObject({ margin: null, minimumIncorrectOptimisticDistance: null });
  });
  it("records ties, wrong branches, reverse crossings and distance increases", () => {
    const world = handTree();
    const run = recordOptimisticTrajectory(world, 1000);
    const annotated = annotateTreeTrajectory(world, buildTreeIndex(world, world.robot), run);
    expect(annotated[0]?.oracle).toMatchObject({ trueDistance: 6, chosenTrueDistance: 7, correctNextCell: { x: 0, y: 1 }, margin: 0, optimisticMinimumTie: true,
      wrongBranchChoice: true, genuineForwardChoice: true, wrongEdgeReturnDecision: 2, wrongEdgeReturnStatus: "observed-return" });
    expect(annotated[1]?.oracle).toMatchObject({ trueDistance: 7, chosenTrueDistance: 6, chosenPreviouslyVisited: true, returnToDiscoveryParent: true });
    expect(annotated[1]?.progression).toMatchObject({ graphChanged: true, discoveryIncreaseAtCurrent: 2, distanceChangeFromPreviousDecision: 1 });
    expect(annotated[2]?.progression).toMatchObject({ graphChanged: false, unchangedGraphOneStepDecrease: true });
    expect(summarizeDiagnosticEpisode(run, annotated, 6).anomalies).toEqual([]);
    const short = recordOptimisticTrajectory(world, 1);
    expect(annotateTreeTrajectory(world, buildTreeIndex(world, world.robot), short)[0]?.oracle.wrongEdgeReturnStatus).toBe("censored-at-limit");
  });
  it("distinguishes forward choices, corridor moves and previous-cell choices", () => {
    const world = parseWorld(["#####", "#R..#", "##.##", "##T##", "#####"]);
    const run = recordOptimisticTrajectory(world, 100);
    const annotated = annotateTreeTrajectory(world, buildTreeIndex(world, world.robot), run);
    expect(annotated[1]?.oracle).toMatchObject({ trueDegree: 3, trueBranchingVertex: true, nonParentSafeCount: 2, genuineForwardChoice: true, choiceInvolvingPreviousCell: true });
    expect(annotated[2]?.oracle).toMatchObject({ trueDegree: 2, nonParentSafeCount: 1, forcedCorridorMove: true });
  });
  it("keeps historical knowledge states detached", () => {
    const run = recordOptimisticTrajectory(handTree(), 100);
    const first = run.knownMapStates[run.decisions[0]!.knownMapStateIndex];
    const last = run.knownMapStates[run.decisions.at(-1)!.knownMapStateIndex];
    expect(first?.[15]).toBe("?");
    expect(last?.[15]).toBe(".");
  });
  it("passes only public missions and local observations into the production agent", () => {
    const missions = vi.spyOn(missionModule, "createAgentMission");
    const decisions = vi.spyOn(OptimisticBFSAgent.prototype, "decide");
    recordOptimisticTrajectory(handTree(), 100);
    expect(missions).toHaveBeenCalledTimes(1);
    expect(Object.keys(missions.mock.results[0]!.value).sort()).toEqual(["height", "start", "target", "width"]);
    for (const [observation] of decisions.mock.calls) {
      expect(Object.keys(observation).sort()).toEqual(["neighbors", "robot"]);
      expect(Object.keys(observation.neighbors).sort()).toEqual(["down", "left", "right", "up"]);
    }
    missions.mockRestore();
    decisions.mockRestore();
  });
});

describe("production equivalence and experimental integrity", () => {
  const root = developmentMaze();
  const selected = selectDiagnosticMissions(root, developmentCase);
  const nonRoot = selected.missions.find((m) => m.condition === "C");
  if (nonRoot?.status !== "selected") throw Error("Development selection failed");
  it.each([
    { name: "hand tree", world: handTree() }, { name: "development root", world: root },
    { name: "development non-root", world: nonRoot.world },
    { name: "cyclic optimistic counterexample", world: parseWorld(["R.#.", ".#..", "....", "...T"]) },
  ])("matches normal simulation exactly for $name", ({ name, world }) => {
    const ordinary = runSimulation(world, new OptimisticBFSAgent(createAgentMission(world)), 1000);
    const instrumented = recordOptimisticTrajectory(world, 1000);
    expect(instrumented.result).toEqual(ordinary);
    expect(instrumented.decisions.map((d) => d.action)).toEqual(ordinary.steps.map((s) => s.action));
    if (name.includes("counterexample")) expect(ordinary.stepsTaken).toBe(8);
  });
  it("runs a deterministic pilot with no held-out generation", () => {
    const original = mazeModule.generateMazeWorld;
    const spy = vi.spyOn(mazeModule, "generateMazeWorld").mockImplementation((c) => {
      expect(config.pilotSeeds as readonly number[]).toContain(c.worldSeed);
      return original(c);
    });
    const first = runExperiment006d(diagnosticCases("pilot"), "pilot");
    expect(JSON.stringify(runExperiment006d(diagnosticCases("pilot"), "pilot"))).toBe(JSON.stringify(first));
    const reversed = runExperiment006d([...diagnosticCases("pilot")].reverse(), "pilot");
    for (const maze of first.mazes) {
      expect(reversed.mazes.find((m) => m.specification.id === maze.specification.id)).toEqual(maze);
    }
    expect(first.actualTrajectories).toBe(16);
    expect(first.failures).toEqual([]);
    expect(first.criticalAnomalies).toEqual([]);
    expect(first.paired.every((p) => Object.values(p.metrics).every((m) => m.confidenceInterval === null))).toBe(true);
    spy.mockRestore();
  });
  it("pairs A-C and B-D on fixed targets with normalized and margin metrics", () => {
    const run = runExperiment006d([developmentCase], "pilot");
    const comparison = summarizeDiagnosticPairs(run.mazes, 15, "A", "C", "pilot");
    expect(comparison.matchedOn).toBe("terrain-and-target");
    expect(Object.keys(comparison.metrics)).toEqual(expect.arrayContaining(["successfulRatio", "backtracks", "meanMargin", "meanForwardChoiceMargin", "negativeMarginFraction"]));
    const maze = run.mazes[0]!;
    const A = maze.episodes.find((e) => e.condition === "A");
    const C = maze.episodes.find((e) => e.condition === "C");
    if (A?.status !== "evaluated" || C?.status !== "evaluated") throw Error("Missing pair");
    expect(comparison.metrics.successfulRatio!.meanDifference).toBe(A.summary.successfulActionOracleRatio! - C.summary.successfulActionOracleRatio!);
    const corrupted = { ...maze, episodes: maze.episodes.map((e) => e.condition === "C" && e.status === "evaluated"
      ? { ...e, mission: { ...e.mission, target: { x: 1, y: 1 } } } : e) };
    expect(() => summarizeDiagnosticPairs([corrupted], 15, "A", "C", "pilot")).toThrow("Mismatched target");
    expect(run.paired.filter((p) => p.size === 15).map((p) => p.contrast)).toEqual(["A-C", "B-D", "B-A", "D-C"]);
  });
  it("keeps production files and historical artifacts byte-identical", () => {
    for (const path of ["src/optimistic-bfs.ts", "src/planning.ts", "src/known-map.ts", "src/simulation.ts", "src/maze-generation.ts",
      "src/experiment-006-config.ts", "docs/experiment-006-protocol.md", "results/experiment-005.json", "results/experiment-006.json"]) {
      expect(readFileSync(path).equals(execFileSync("git", ["show", `${config.productionCommit}:${path}`], { maxBuffer: 32 * 1024 * 1024 })), path).toBe(true);
    }
  });
  it("rejects unfrozen configuration and an unapproved full checkpoint without running it", () => {
    expect(() => assertFrozenHashes({ ...frozen006dHashes })).not.toThrow();
    for (const path of Object.keys(frozen006dHashes)) expect(() => assertFrozenHashes({ ...frozen006dHashes, [path]: "changed" })).toThrow("hash");
    const head = "a".repeat(40);
    const valid = { head, gitStatus: "", upstreamContainsHead: true, approvedCommit: head, committedSourcesMatch: true };
    expect(() => assertFullCheckpoint(valid)).not.toThrow();
    for (const change of [{ head: config.productionCommit }, { approvedCommit: undefined }, { upstreamContainsHead: false }, { gitStatus: " M src/experiment-006d.ts\n" }, { committedSourcesMatch: false }]) {
      expect(() => assertFullCheckpoint({ ...valid, ...change })).toThrow();
    }
    expect(() => assertFullCheckpoint({ ...valid, gitStatus: "?? results/experiment-006d.json\n" })).not.toThrow();
  });
  it("requires exactly one explicit mode and verifies the actual frozen file hashes", () => {
    for (const args of [[], ["--pilot", "--full"], ["--full", "--full"], ["--other"]]) expect(() => parseDiagnosticMode(args)).toThrow();
    expect(parseDiagnosticMode(["--pilot"])).toBe("pilot");
    const actual = Object.fromEntries(Object.keys(frozen006dHashes).map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]));
    expect(() => assertFrozenHashes(actual)).not.toThrow();
  });

  it("hashes and freezes the complete local source dependency closure", () => {
    const reachable = new Set<string>();
    const visit = (path: string): void => {
      if (reachable.has(path)) return;
      reachable.add(path);
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/\bfrom\s+["'](\.\/[^"']+)\.js["']/g)) {
        visit(join(dirname(path), `${match[1]}.ts`));
      }
    };
    visit("src/experiment-006d-cli.ts");
    const inputs = inspectDiagnosticInputs();
    expect(Object.keys(inputs.evaluationSourceHashes).sort()).toEqual([...reachable].sort());
    expect([...baseline006dSources, ...diagnostic006dSources].sort()).toEqual([...reachable].sort());
    for (const [path, hash] of Object.entries(inputs.evaluationSourceHashes)) {
      expect(hash).toBe(createHash("sha256").update(readFileSync(path)).digest("hex"));
    }
  });

  it("uses the real startup guard on synthetic published checkpoint files without generating worlds", async () => {
    const inputs = { ...inspectDiagnosticInputs(), head: "a".repeat(40), gitStatus: "" };
    const generator = vi.spyOn(mazeModule, "generateMazeWorld");
    let changedPath: string | null = null;
    const { execFileSync: execute } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    const commands = vi.mocked(execFileSync).mockImplementation((command, args) => {
      const words = args as readonly string[];
      if (command === "git" && words[0] === "show" && words[1]?.startsWith("HEAD:")) {
        const path = words[1].slice("HEAD:".length);
        return path === changedPath ? Buffer.from("different committed bytes") : readFileSync(path);
      }
      if (command === "git" && words[0] === "rev-parse") return Buffer.from(inputs.head);
      if (command === "git" && words[0] === "merge-base") return Buffer.alloc(0);
      return execute(command, words);
    });
    try {
      expect(() => assertPublishedDiagnosticCheckpoint(inputs, inputs.head)).not.toThrow();
      for (const path of [...baseline006dSources, ...diagnostic006dSources, "tsconfig.json", "docs/experiment-006d-protocol.md"]) {
        changedPath = path;
        expect(() => assertPublishedDiagnosticCheckpoint(inputs, inputs.head), path).toThrow("committed checkpoint");
      }
      expect(generator).not.toHaveBeenCalled();
    } finally {
      commands.mockImplementation(execute);
      generator.mockRestore();
    }
  });

  it("rejects a changed transitive production dependency against the M4 baseline", async () => {
    const { execFileSync: execute } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    const commands = vi.mocked(execFileSync).mockImplementation((command, args) => {
      const words = args as readonly string[];
      if (command === "git" && words[0] === "show" && words[1] === `${config.productionCommit}:src/statistics.ts`) {
        return Buffer.from("different baseline bytes");
      }
      return execute(command, words);
    });
    try {
      expect(() => inspectDiagnosticInputs()).toThrow("Production dependency changed: src/statistics.ts");
    } finally {
      commands.mockImplementation(execute);
    }
  });
});
