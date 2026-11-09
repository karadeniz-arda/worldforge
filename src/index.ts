import { RandomAgent } from "./agent.js";
import { createSeededRandom } from "./random.js";
import { renderWorld } from "./render.js";
import { runSimulation } from "./simulation.js";
import { createInitialWorld } from "./world.js";

const initialWorld = createInitialWorld();
const agent = new RandomAgent(createSeededRandom(2026));
const simulation = runSimulation(initialWorld, agent, 12);

console.log("Initial world:");
console.log(renderWorld(initialWorld));
console.log(`\nAutonomous actions: ${simulation.steps.map((step) => step.action).join(", ")}`);
console.log(`Successful moves: ${simulation.successfulMoves}`);
console.log(`Rejected moves: ${simulation.rejectedMoves}`);
console.log(`Final position: (${simulation.world.robot.x}, ${simulation.world.robot.y})`);
console.log("\nFinal world:");
console.log(renderWorld(simulation.world));
