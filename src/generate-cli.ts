import { calculateShortestPathLength, generateWorld, type WorldGenerationConfig } from "./generation.js";
import { renderWorld } from "./render.js";

const samples: readonly WorldGenerationConfig[] = [
  { width: 8, height: 5, worldSeed: 101, obstacleDensity: 0.2, reachability: "reachable", minimumPathDistance: 8 },
  { width: 10, height: 6, worldSeed: 202, obstacleDensity: 0.35, reachability: "reachable", minimumPathDistance: 10 },
  { width: 8, height: 6, worldSeed: 303, obstacleDensity: 0.55, reachability: "unreachable" },
];

for (const config of samples) {
  const world = generateWorld(config);
  const shortestPathLength = calculateShortestPathLength(world);
  const actualDensity = world.obstacles.length / (world.width * world.height);

  console.log(`\nSeed: ${config.worldSeed}`);
  console.log(`Dimensions: ${world.width}x${world.height}`);
  console.log(`Requested obstacle density: ${config.obstacleDensity.toFixed(2)}`);
  console.log(`Actual obstacle density: ${actualDensity.toFixed(2)} (${world.obstacles.length} obstacles)`);
  console.log(`Reachability: ${shortestPathLength === null ? "unreachable" : "reachable"}`);
  console.log(`Shortest path length: ${shortestPathLength ?? "N/A"}`);
  console.log(renderWorld(world));
}
