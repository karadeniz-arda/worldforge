import { RandomAgent, RuleBasedAgent } from "./agent.js";
import { createSeededRandom } from "./random.js";
import { renderWorld } from "./render.js";
import { runSimulation } from "./simulation.js";
import { createInitialWorld } from "./world.js";

const stepLimit = 12;
const initialWorld = createInitialWorld();
const randomSimulation = runSimulation(
  createInitialWorld(),
  new RandomAgent(createSeededRandom(2026)),
  stepLimit,
);
const ruleBasedSimulation = runSimulation(
  createInitialWorld(),
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

console.log("Initial world:");
console.log(renderWorld(initialWorld));
printSummary("RandomAgent", randomSimulation);
printSummary("RuleBasedAgent", ruleBasedSimulation);
console.log("\nRuleBasedAgent final world:");
console.log(renderWorld(ruleBasedSimulation.world));
