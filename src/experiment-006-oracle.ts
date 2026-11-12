import type { World } from "./world.js";

/** Independent numeric-grid reference. Does not use generation or planning helpers. */
export function referenceGraph(world: World) {
  const { width, height } = world;
  const blocked = new Set(world.obstacles.map((p) => p.y * width + p.x));
  const neighbors = (cell: number): number[] => {
    const x = cell % width;
    const y = Math.floor(cell / width);
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => nx! >= 0 && nx! < width && ny! >= 0 && ny! < height)
      .map(([nx, ny]) => ny! * width + nx!).filter((next) => !blocked.has(next));
  };
  return { blocked, neighbors };
}

export function referenceDistance(world: World): number | null {
  const { neighbors } = referenceGraph(world);
  const start = world.robot.y * world.width + world.robot.x;
  const target = world.deliveryTarget.y * world.width + world.deliveryTarget.x;
  const distance = new Map([[start, 0]]);
  let wave = [start];
  while (wave.length > 0) {
    const nextWave: number[] = [];
    for (const cell of wave) {
      if (cell === target) return distance.get(cell)!;
      for (const next of neighbors(cell)) {
        if (!distance.has(next)) {
          distance.set(next, distance.get(cell)! + 1);
          nextWave.push(next);
        }
      }
    }
    wave = nextWave;
  }
  return null;
}

/** DFS tree paths cross-check maze distance independently of BFS. */
export function referenceTreeDistance(world: World): number {
  const { blocked, neighbors } = referenceGraph(world);
  const start = world.robot.y * world.width + world.robot.x;
  const target = world.deliveryTarget.y * world.width + world.deliveryTarget.x;
  const stack = [{ cell: start, distance: 0 }];
  const visited = new Set<number>();
  let targetDistance: number | undefined;
  let degreeSum = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.cell)) continue;
    visited.add(current.cell);
    if (current.cell === target) targetDistance = current.distance;
    const adjacent = neighbors(current.cell);
    degreeSum += adjacent.length;
    for (const next of adjacent) {
      if (!visited.has(next)) stack.push({ cell: next, distance: current.distance + 1 });
    }
  }
  if (visited.size !== world.width * world.height - blocked.size
    || degreeSum / 2 !== visited.size - 1 || targetDistance === undefined) {
    throw new Error("Independent maze connectivity/acyclicity check failed.");
  }
  return targetDistance;
}
