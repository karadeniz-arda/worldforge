import { RandomAgent, RuleBasedAgent } from "./agent.js";
import { createSeededRandom } from "./random.js";
import { renderWorld } from "./render.js";
import { createScenario, type ScenarioName } from "./scenarios.js";
import { runSimulation } from "./simulation.js";

const stepLimit = 12;
const scenarioName: ScenarioName = "easy";
const initialWorld = createScenario(scenarioName);
const randomSimulation = runSimulation(
  createScenario(scenarioName),
  new RandomAgent(createSeededRandom(2026)),
  stepLimit,
);
const ruleBasedSimulation = runSimulation(
  createScenario(scenarioName),
  new RuleBasedAgent(initialWorld.deliveryTarget),
  stepLimit,
);

function printSummary(name: string, simulation: ReturnType<typeof runSimulation>): void {
  console.log(`\n${name}:`);
  console.log(`Mission outcome: ${simulation.termination}`);
  console.log(`Steps taken: ${simulation.stepsTaken}`);
  console.log(`Successful moves: ${simulation.successfulMoves}`);
  console.log(`Rejected moves: ${simulation.rejectedMoves}`);
  console.log(`Final position: (${simulation.world.robot.x}, ${simulation.world.robot.y})`);
  console.log(`Actions: ${simulation.steps.map((step) => step.action).join(", ")}`);
}

console.log(`Scenario: ${scenarioName}`);
console.log("Initial world:");
console.log(renderWorld(initialWorld));
printSummary("RandomAgent", randomSimulation);
printSummary("RuleBasedAgent", ruleBasedSimulation);
console.log("\nRuleBasedAgent final world:");
console.log(renderWorld(ruleBasedSimulation.world));
