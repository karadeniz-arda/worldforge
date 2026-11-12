import { calculateShortestPathLength } from "./generation.js";
import { createSeededRandom } from "./random.js";
import type { Position, World } from "./world.js";

export interface MazeConfig {
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
}

/** Iterative recursive-backtracking maze over odd-coordinate room cells. */
export function generateMazeWorld(config: MazeConfig): {
  readonly world: World;
  readonly shortestPathLength: number;
} {
  const { width, height } = config;
  if (![width, height].every((size) => Number.isSafeInteger(size) && size >= 5 && size % 2 === 1)) {
    throw new Error("Maze width and height must be odd integers >= 5.");
  }
  if (!Number.isSafeInteger(config.worldSeed)) throw new Error("World seed must be a safe integer.");
  const random = createSeededRandom(config.worldSeed);
  const free = new Set<number>();
  const indexOf = (position: Position): number => position.y * width + position.x;
  const start = { x: 1, y: 1 };
  free.add(indexOf(start));
  const stack: Position[] = [start];
  const offsets = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const candidates = offsets.map((offset) => ({ x: current.x + 2 * offset.x, y: current.y + 2 * offset.y }))
      .filter((next) => next.x > 0 && next.x < width - 1 && next.y > 0 && next.y < height - 1 && !free.has(indexOf(next)));
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(random() * candidates.length)]!;
    free.add(indexOf({ x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 }));
    free.add(indexOf(next));
    stack.push(next);
  }

  // Environment-side BFS selects the farthest endpoint. Equal distances use
  // smallest row, then smallest column, independently of BFS expansion order.
  const queue = [{ position: start, distance: 0 }];
  const visited = new Set([indexOf(start)]);
  let farthest = queue[0]!;
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const position = current.position;
    if (current.distance > farthest.distance || (current.distance === farthest.distance
      && (position.y < farthest.position.y || (position.y === farthest.position.y && position.x < farthest.position.x)))) {
      farthest = current;
    }
    for (const offset of offsets) {
      const next = { x: position.x + offset.x, y: position.y + offset.y };
      const key = indexOf(next);
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height || !free.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ position: next, distance: current.distance + 1 });
    }
  }
  const obstacles: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!free.has(y * width + x)) obstacles.push({ x, y });
    }
  }
  const world: World = { width, height, robot: { ...start }, deliveryTarget: { ...farthest.position }, obstacles };
  const shortestPathLength = calculateShortestPathLength(world);
  if (shortestPathLength === null || shortestPathLength !== farthest.distance) throw new Error("Maze failed oracle distance validation.");
  return { world, shortestPathLength };
}
