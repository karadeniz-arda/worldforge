import { mkdir, writeFile } from "node:fs/promises";

import { MemoryRandomAgent, RandomAgent, RuleBasedAgent, ValidRandomAgent, type Agent } from "./agent.js";
import { createAgentMission } from "./mission.js";
import { PlanningAgent, type FrontierTieBreakPolicy } from "./planning.js";
import { createSeededRandom } from "./random.js";
import { createReplayHtml } from "./replay.js";
import { createScenario, scenarioRows, type ScenarioName } from "./scenarios.js";
import { runSimulationWithTrace } from "./simulation.js";

type ReplayAgentName = "random" | "valid-random" | "memory" | "rule" | "planning";

interface ReplayOptions {
  readonly scenario: ScenarioName;
  readonly agent: ReplayAgentName;
  readonly seed: number;
  readonly steps: number;
  readonly tieBreakPolicy: FrontierTieBreakPolicy;
}

const options = parseOptions(process.argv.slice(2));
const world = createScenario(options.scenario);
const mission = createAgentMission(world);
const agent = createAgent(options.agent, mission, options.seed, options.tieBreakPolicy);
const publicMission = options.agent === "rule" || options.agent === "planning" ? { target: mission.target } : null;
const replay = runSimulationWithTrace(world, agent, options.steps, publicMission);
const policySegment = options.agent === "planning" ? `-${options.tieBreakPolicy}` : "";
const filename = `${options.scenario}-${options.agent}${policySegment}-${options.seed}.html`;
const outputPath = `replays/${filename}`;

await mkdir("replays", { recursive: true });
await writeFile(outputPath, createReplayHtml(replay.trace, `WorldForge: ${options.scenario} / ${options.agent}`));

console.log(`Wrote ${outputPath}`);
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
      return new PlanningAgent(mission, { recordDiagnostics: true, tieBreakPolicy });
  }
}

function parseOptions(argumentsList: readonly string[]): ReplayOptions {
  let scenario: ScenarioName = "easy";
  let agent: ReplayAgentName = "random";
  let seed = 42;
  let steps = 100;
  let tieBreakPolicy: FrontierTieBreakPolicy = "coordinate";

  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const value = argumentsList[index + 1];
    if (option === "--scenario" && value !== undefined) {
      if (!(value in scenarioRows)) {
        throw new Error(`Unknown scenario "${value}". Choose one of: ${Object.keys(scenarioRows).join(", ")}.`);
      }
      scenario = value as ScenarioName;
      index += 1;
    } else if (option === "--agent" && value !== undefined) {
      if (!isReplayAgentName(value)) {
        throw new Error('Unknown agent. Choose one of: random, valid-random, memory, rule, planning.');
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
        throw new Error('Unknown tie-break policy. Choose "coordinate" or "information-gain".');
      }
      tieBreakPolicy = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option "${option}". Use --scenario, --agent, --seed, --steps, and --tie-break.`);
    }
  }

  return { scenario, agent, seed, steps, tieBreakPolicy };
}

function isReplayAgentName(value: string): value is ReplayAgentName {
  return value === "random" || value === "valid-random" || value === "memory" || value === "rule" || value === "planning";
}

function isTieBreakPolicy(value: string): value is FrontierTieBreakPolicy {
  return value === "coordinate" || value === "information-gain";
}

function parseIntegerOption(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}
