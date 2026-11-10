import { createSeededRandom } from "./random.js";
import { positionKey, positionsMatch } from "./grid.js";
import type { Position, World } from "./world.js";

export type DesiredReachability = "reachable" | "unreachable";

export interface WorldGenerationConfig {
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
  /** Fraction of non-endpoint cells to fill with obstacles. */
  readonly obstacleDensity: number;
  readonly reachability: DesiredReachability;
  readonly minimumPathDistance?: number;
  readonly maxAttempts?: number;
}

export interface GeneratedWorld {
  readonly world: World;
  readonly attempts: number;
  readonly shortestPathLength: number | null;
}

const DEFAULT_MAX_ATTEMPTS = 1_000;
const neighborOffsets: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * Generates a fresh world satisfying the requested constraints. BFS is used
 * only here for map validation and difficulty measurement, never by agents.
 */
export function generateWorld(config: WorldGenerationConfig): World {
  return generateWorldWithMetadata(config).world;
}

/** Generates a world while retaining validation metadata for experiments. */
export function generateWorldWithMetadata(config: WorldGenerationConfig): GeneratedWorld {
  validateConfig(config);
  const random = createSeededRandom(config.worldSeed);
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const world = generateCandidate(config, random);
    const shortestPathDistance = calculateShortestPathLength(world);
    const isReachable = shortestPathDistance !== null;
    const hasRequiredReachability = config.reachability === "reachable" ? isReachable : !isReachable;
    const hasRequiredDistance = config.minimumPathDistance === undefined
      || (shortestPathDistance !== null && shortestPathDistance >= config.minimumPathDistance);

    if (hasRequiredReachability && hasRequiredDistance) {
      return { world, attempts: attempt + 1, shortestPathLength: shortestPathDistance };
    }
  }

  throw new Error(
    `Could not generate a ${config.reachability} ${config.width}x${config.height} world `
    + `with seed ${config.worldSeed} after ${maxAttempts} attempts.`,
  );
}

/** Returns route length in movement actions, or null when the target is unreachable. */
export function calculateShortestPathLength(world: World): number | null {
  const obstacles = new Set(world.obstacles.map(positionKey));
  const visited = new Set([positionKey(world.robot)]);
  const queue: Array<{ position: Position; distance: number }> = [{ position: world.robot, distance: 0 }];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    if (positionsMatch(current.position, world.deliveryTarget)) {
      return current.distance;
    }

    for (const offset of neighborOffsets) {
      const next = { x: current.position.x + offset.x, y: current.position.y + offset.y };
      const key = positionKey(next);
      if (!isWithinWorld(world, next) || obstacles.has(key) || visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({ position: next, distance: current.distance + 1 });
    }
  }

  return null;
}

function generateCandidate(config: WorldGenerationConfig, random: () => number): World {
  const positions = allPositions(config.width, config.height);
  shuffle(positions, random);
  const robot = positions[0]!;
  const deliveryTarget = positions[1]!;
  const availableObstaclePositions = positions.slice(2);
  const obstacleCount = Math.floor(config.obstacleDensity * availableObstaclePositions.length);

  return {
    width: config.width,
    height: config.height,
    robot: { ...robot },
    deliveryTarget: { ...deliveryTarget },
    obstacles: availableObstaclePositions.slice(0, obstacleCount).map((position) => ({ ...position })),
  };
}

function validateConfig(config: WorldGenerationConfig): void {
  if (!Number.isInteger(config.width) || config.width <= 0) {
    throw new Error("World width must be a positive integer.");
  }
  if (!Number.isInteger(config.height) || config.height <= 0) {
    throw new Error("World height must be a positive integer.");
  }
  if (config.width * config.height < 2) {
    throw new Error("World dimensions must provide at least two cells for robot and target.");
  }
  if (!Number.isInteger(config.worldSeed)) {
    throw new Error("World seed must be an integer.");
  }
  if (!Number.isFinite(config.obstacleDensity) || config.obstacleDensity < 0 || config.obstacleDensity > 1) {
    throw new Error("Obstacle density must be between 0 and 1.");
  }
  if (config.reachability !== "reachable" && config.reachability !== "unreachable") {
    throw new Error('Reachability must be "reachable" or "unreachable".');
  }
  if (
    config.minimumPathDistance !== undefined
    && (!Number.isInteger(config.minimumPathDistance) || config.minimumPathDistance < 0)
  ) {
    throw new Error("Minimum path distance must be a non-negative integer.");
  }
  if (config.reachability === "unreachable" && config.minimumPathDistance !== undefined) {
    throw new Error("Minimum path distance can only be requested for reachable worlds.");
  }
  if (
    config.maxAttempts !== undefined
    && (!Number.isInteger(config.maxAttempts) || config.maxAttempts <= 0)
  ) {
    throw new Error("Maximum generation attempts must be a positive integer.");
  }
}

function allPositions(width: number, height: number): Position[] {
  const positions: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      positions.push({ x, y });
    }
  }
  return positions;
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
}

function isWithinWorld(world: World, position: Position): boolean {
  return position.x >= 0
    && position.x < world.width
    && position.y >= 0
    && position.y < world.height;
}
