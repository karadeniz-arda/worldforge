import { calculateShortestPathLength } from "./generation.js";
import { createSeededRandom } from "./random.js";
import type { World } from "./world.js";

export interface BarrierConfig {
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
  readonly variant: "doorway" | "sealed";
  /** Zero-based row. Omit to choose a row with the seeded PRNG. */
  readonly doorRow?: number;
}

export interface GeneratedBarrier {
  readonly world: World;
  readonly wallColumn: number;
  readonly doorRow: number | null;
  readonly shortestPathLength: number | null;
  readonly manhattanDistance: number;
  readonly detourRatio: number | null;
}

/** Static barrier family. Oracle metadata stays outside the agent mission. */
export function generateBarrierWorld(config: BarrierConfig): GeneratedBarrier {
  if (!Number.isSafeInteger(config.width) || config.width < 3
    || !Number.isSafeInteger(config.height) || config.height < 2) {
    throw new Error("Barrier dimensions require integer width >= 3 and height >= 2.");
  }
  if (!Number.isSafeInteger(config.worldSeed)) {
    throw new Error("World seed must be a safe integer.");
  }
  if (config.variant !== "doorway" && config.variant !== "sealed") {
    throw new Error('Barrier variant must be "doorway" or "sealed".');
  }
  if (config.doorRow !== undefined && (!Number.isInteger(config.doorRow)
    || config.doorRow < 0 || config.doorRow >= config.height)) {
    throw new Error("Door row must be an integer within the map height.");
  }
  if (config.variant === "sealed" && config.doorRow !== undefined) {
    throw new Error("A sealed barrier cannot have a door row.");
  }
  const wallColumn = Math.floor(config.width / 2);
  const doorRow = config.variant === "sealed" ? null
    : config.doorRow ?? Math.floor(createSeededRandom(config.worldSeed)() * config.height);
  const world: World = {
    width: config.width,
    height: config.height,
    robot: { x: 0, y: 0 },
    deliveryTarget: { x: config.width - 1, y: 0 },
    obstacles: Array.from({ length: config.height }, (_, y) => ({ x: wallColumn, y }))
      .filter((position) => position.y !== doorRow),
  };
  const shortestPathLength = calculateShortestPathLength(world);
  if ((shortestPathLength !== null) !== (config.variant === "doorway")) {
    throw new Error("Barrier failed oracle reachability validation.");
  }
  const manhattanDistance = config.width - 1;
  return {
    world, wallColumn, doorRow, shortestPathLength, manhattanDistance,
    detourRatio: shortestPathLength === null ? null : shortestPathLength / manhattanDistance,
  };
}
