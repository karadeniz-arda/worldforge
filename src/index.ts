import { moveRobot } from "./movement.js";
import { renderWorld } from "./render.js";
import { createInitialWorld } from "./world.js";

const initialWorld = createInitialWorld();
const move = moveRobot(initialWorld, "down");

console.log("Initial world:");
console.log(renderWorld(initialWorld));
console.log(`\nMove down: ${move.succeeded ? "succeeded" : `rejected (${move.reason})`}`);
console.log(renderWorld(move.world));
