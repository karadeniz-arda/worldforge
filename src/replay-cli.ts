import { mkdir, writeFile } from "node:fs/promises";

import { MemoryRandomAgent, RandomAgent, RuleBasedAgent, ValidRandomAgent, type Agent } from "./agent.js";
import { createAgentMission } from "./mission.js";
import { PlanningAgent, type FrontierTieBreakPolicy } from "./planning.js";
import { createSeededRandom } from "./random.js";
import { createReplayHtml } from "./replay.js";
import { createScenario, scenarioRows, type ScenarioName } from "./scenarios.js";
import { runSimulationWithTrace } from "./simulation.js";
import { generateBarrierWorld } from "./structural-generation.js";
import { generateMazeWorld } from "./maze-generation.js";
import { generateTrapWorld } from "./trap-generation.js";
import { OptimisticBFSAgent } from "./optimistic-bfs.js";

type ReplayAgentName = "random" | "valid-random" | "memory" | "rule" | "planning" | "optimistic";

interface ReplayOptions {
  readonly scenario: ScenarioName;
  readonly agent: ReplayAgentName;
  readonly seed: number;
  readonly steps: number;
  readonly tieBreakPolicy: FrontierTieBreakPolicy;
  readonly structural?: "doorway" | "sealed" | "maze" | "trap";
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
  readonly doorRow?: number;
}

const options = parseOptions(process.argv.slice(2));
const maze = options.structural === "maze" ? generateMazeWorld(options) : null;
const trap = options.structural === "trap" ? generateTrapWorld(options) : null;
const generated = options.structural === "doorway" || options.structural === "sealed" ? generateBarrierWorld({
  width: options.width, height: options.height, worldSeed: options.worldSeed,
  variant: options.structural,
  ...(options.doorRow === undefined ? {} : { doorRow: options.doorRow }),
}) : null;
const world = trap?.world ?? maze?.world ?? generated?.world ?? createScenario(options.scenario);
const layoutName = trap !== null ? `trap-${options.width}x${options.height}-world-${options.worldSeed}` : maze !== null ? `maze-${options.width}x${options.height}-world-${options.worldSeed}` : generated === null ? options.scenario
  : `barrier-${options.structural}-${options.width}x${options.height}-world-${options.worldSeed}-door-${generated.doorRow ?? "none"}`;
const mission = createAgentMission(world);
const agent = createAgent(options.agent, mission, options.seed, options.tieBreakPolicy);
const publicMission = options.agent === "rule" || options.agent === "planning" || options.agent === "optimistic" ? { target: mission.target } : null;
const replay = runSimulationWithTrace(world, agent, options.steps, publicMission);
const policySegment = options.agent === "planning" ? `-${options.tieBreakPolicy}` : "";
const filename = `${layoutName}-${options.agent}${policySegment}-${options.seed}.html`;
const outputPath = `replays/${filename}`;

await mkdir("replays", { recursive: true });
await writeFile(outputPath, createReplayHtml(replay.trace, `WorldForge: ${layoutName} / ${options.agent}`));

console.log(`Wrote ${outputPath}`);
if (maze !== null) console.log(`Oracle shortest path: ${maze.shortestPathLength}`);
if (trap !== null) {
  console.log(`Geometry: ${JSON.stringify(trap.geometry)}`);
  console.log(`Oracle shortest path: ${trap.shortestPathLength}; Manhattan: ${trap.manhattanDistance}; detour ratio: ${trap.detourRatio}`);
}
if (generated !== null) {
  console.log(`Oracle shortest path: ${generated.shortestPathLength ?? "unreachable"}; Manhattan: ${generated.manhattanDistance}; detour ratio: ${generated.detourRatio ?? "N/A"}`);
}
console.log(`Termination: ${replay.result.termination}; steps: ${replay.result.stepsTaken}; successful: ${replay.result.successfulMoves}; rejected: ${replay.result.rejectedMoves}`);
console.log(`Open on macOS: open ${outputPath}`);

function createAgent(
  agentName: ReplayAgentName,
  mission: ReturnType<typeof createAgentMission>,
  seed: number,
  tieBreakPolicy: FrontierTieBreakPolicy,
): Agent {
  const random = createSeededRandom(seed);
  switch (agentName) {
    case "random":
      return new RandomAgent(random);
    case "valid-random":
      return new ValidRandomAgent(random);
    case "memory":
      return new MemoryRandomAgent(random);
    case "rule":
      return new RuleBasedAgent(mission.target);
    case "planning":
      return new PlanningAgent(mission, { recordDiagnostics: true, tieBreakPolicy, random });
    case "optimistic":
      return new OptimisticBFSAgent(mission);
  }
}

function parseOptions(argumentsList: readonly string[]): ReplayOptions {
  let scenario: ScenarioName = "easy";
  let agent: ReplayAgentName = "random";
  let seed = 42;
  let steps = 100;
  let tieBreakPolicy: FrontierTieBreakPolicy = "coordinate";
  let structural: "doorway" | "sealed" | "maze" | "trap" | undefined;
  let width = 9;
  let height = 9;
  let worldSeed = 42;
  let doorRow: number | undefined;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const value = argumentsList[index + 1];
    if (option === "--structural" && value !== undefined) {
      if (value !== "doorway" && value !== "sealed" && value !== "maze" && value !== "trap") throw new Error("Choose doorway, sealed, maze or trap for --structural.");
      structural = value;
      index += 1;
    } else if (["--width", "--height", "--world-seed", "--door-row"].includes(option ?? "") && value !== undefined) {
      const parsed = parseIntegerOption(option!, value);
      if (option === "--width") width = parsed;
      if (option === "--height") height = parsed;
      if (option === "--world-seed") worldSeed = parsed;
      if (option === "--door-row") doorRow = parsed;
      index += 1;
    } else if (option === "--scenario" && value !== undefined) {
      if (!(value in scenarioRows)) {
        throw new Error(`Unknown scenario "${value}". Choose one of: ${Object.keys(scenarioRows).join(", ")}.`);
      }
      scenario = value as ScenarioName;
      index += 1;
    } else if (option === "--agent" && value !== undefined) {
      if (!isReplayAgentName(value)) {
        throw new Error('Unknown agent. Choose one of: random, valid-random, memory, rule, planning, optimistic.');
      }
      agent = value;
      index += 1;
    } else if (option === "--seed" && value !== undefined) {
      seed = parseIntegerOption("seed", value);
      index += 1;
    } else if (option === "--steps" && value !== undefined) {
      steps = parseIntegerOption("steps", value);
      if (steps < 0) {
        throw new Error("Steps must be a non-negative integer.");
      }
      index += 1;
    } else if (option === "--tie-break" && value !== undefined) {
      if (!isTieBreakPolicy(value)) {
        throw new Error('Unknown tie-break policy. Choose "coordinate", "information-gain" or "random".');
      }
      tieBreakPolicy = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option "${option}". Use --scenario, --agent, --seed, --steps, and --tie-break.`);
    }
  }

  if (structural === undefined && (doorRow !== undefined || argumentsList.some((value) => ["--width", "--height", "--world-seed"].includes(value)))) {
    throw new Error("Structural dimensions, world seed and door row require --structural.");
  }
  if (structural !== undefined && argumentsList.includes("--scenario")) {
    throw new Error("Choose either --scenario or --structural.");
  }
  if ((structural === "maze" || structural === "trap") && doorRow !== undefined) throw new Error("Maze and trap generation do not accept --door-row.");
  return { scenario, agent, seed, steps, tieBreakPolicy, width, height, worldSeed,
    ...(structural === undefined ? {} : { structural }),
    ...(doorRow === undefined ? {} : { doorRow }),
  };
}

function isReplayAgentName(value: string): value is ReplayAgentName {
  return value === "random" || value === "valid-random" || value === "memory" || value === "rule" || value === "planning" || value === "optimistic";
}

function isTieBreakPolicy(value: string): value is FrontierTieBreakPolicy {
  return value === "coordinate" || value === "information-gain" || value === "random";
}

function parseIntegerOption(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}
