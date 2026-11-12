import { calculateShortestPathLength } from "./generation.js";
import { createSeededRandom } from "./random.js";
import type { Position, World } from "./world.js";

export type TrapOpening = "up" | "right" | "down" | "left";

export interface TrapConfig {
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
  readonly opening?: TrapOpening;
  /** Includes the closed wall and the open entrance row. */
  readonly depth?: number;
  /** Outside-to-outside distance across the arms, in cells. */
  readonly span?: number;
  /** Top-left of the rotated barrier's bounding rectangle. */
  readonly origin?: Position;
}

/** Builds three wall segments with a free entrance and one-cell exterior margin. */
export function generateTrapWorld(config: TrapConfig) {
  const { width, height } = config;
  if (![width, height].every((size) => Number.isSafeInteger(size) && size >= 6)) {
    throw new Error("Trap width and height must be integers >= 6.");
  }
  if (!Number.isSafeInteger(config.worldSeed)) throw new Error("World seed must be a safe integer.");
  const random = createSeededRandom(config.worldSeed);
  const choose = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
  const openings: readonly TrapOpening[] = ["up", "right", "down", "left"];
  const opening = config.opening ?? openings[choose(0, 3)]!;
  if (!openings.includes(opening)) throw new Error("Invalid trap opening direction.");
  const vertical = opening === "up" || opening === "down";
  const maxDepth = (vertical ? height : width) - 2;
  const maxSpan = (vertical ? width : height) - 2;
  const depth = config.depth ?? choose(4, maxDepth);
  const span = config.span ?? choose(3, maxSpan);
  if (!Number.isInteger(depth) || depth < 4 || depth > maxDepth
    || !Number.isInteger(span) || span < 3 || span > maxSpan) {
    throw new Error("Trap depth >= 4 and span >= 3 must fit with a one-cell exterior margin.");
  }
  const boxWidth = vertical ? span : depth;
  const boxHeight = vertical ? depth : span;
  const origin = config.origin ?? { x: choose(1, width - boxWidth - 1), y: choose(1, height - boxHeight - 1) };
  if (!Number.isInteger(origin.x) || !Number.isInteger(origin.y) || origin.x < 1 || origin.y < 1
    || origin.x + boxWidth >= width || origin.y + boxHeight >= height) {
    throw new Error("Trap origin must leave a one-cell exterior margin around the barrier.");
  }
  // u crosses the arms, v runs from the closed wall toward the opening.
  const position = (u: number, v: number): Position => {
    switch (opening) {
      case "down": return { x: origin.x + u, y: origin.y + v };
      case "up": return { x: origin.x + u, y: origin.y + depth - 1 - v };
      case "right": return { x: origin.x + v, y: origin.y + u };
      case "left": return { x: origin.x + depth - 1 - v, y: origin.y + u };
    }
  };
  const obstacles: Position[] = [];
  for (let u = 0; u < span; u += 1) obstacles.push(position(u, 0));
  for (let v = 1; v < depth; v += 1) {
    obstacles.push(position(0, v), position(span - 1, v));
  }
  const middle = Math.floor((span - 1) / 2);
  const world: World = {
    width, height, obstacles,
    robot: position(middle, -1), deliveryTarget: position(middle, 1),
  };
  const shortestPathLength = calculateShortestPathLength(world);
  if (shortestPathLength === null) throw new Error("Trap failed oracle reachability validation.");
  const manhattanDistance = Math.abs(world.robot.x - world.deliveryTarget.x) + Math.abs(world.robot.y - world.deliveryTarget.y);
  return {
    world, geometry: { opening, depth, span, origin: { ...origin } },
    shortestPathLength, manhattanDistance, detourRatio: shortestPathLength / manhattanDistance,
  };
}
