import { createHash } from "node:crypto";
import { experiment006dConfiguration as config, type DiagnosticMazeCase, type MazeCondition } from "./experiment-006d-config.js";
import { referenceGraph } from "./experiment-006-oracle.js";
import { stableSeed } from "./experiment-006.js";
import { calculateShortestPathLength } from "./generation.js";
import { cloneWorld } from "./procedural-benchmark.js";
import { createSeededRandom } from "./random.js";
import type { Position, World } from "./world.js";

export interface TreeIndex {
  readonly width: number;
  readonly height: number;
  readonly root: Position;
  readonly vertices: readonly number[];
  readonly adjacency: ReadonlyMap<number, readonly number[]>;
  readonly parent: ReadonlyMap<number, number | null>;
  readonly depth: ReadonlyMap<number, number>;
  readonly edgeCount: number;
}
export const cellIndex = (width: number, p: Position): number => p.y * width + p.x;
export const cellPosition = (width: number, cell: number): Position => ({ x: cell % width, y: Math.floor(cell / width) });

/** Endpoint-independent signature for the shared terrain across conditions. */
export function mazeTerrainSignature(world: World): string {
  return createHash("sha256").update(JSON.stringify([world.width, world.height,
    world.obstacles.map((p) => cellIndex(world.width, p)).sort((a, b) => a - b)])).digest("hex");
}

/** Independent evaluation DFS, including connectivity and V-1 edge validation. */
export function buildTreeIndex(world: World, root: Position): TreeIndex {
  const valid = (p: Position): boolean => Number.isInteger(p.x) && Number.isInteger(p.y)
    && p.x >= 0 && p.x < world.width && p.y >= 0 && p.y < world.height;
  if (!world.obstacles.every(valid) || !valid(root) || !valid(world.robot) || !valid(world.deliveryTarget)) throw new Error("Invalid tree coordinates.");
  const { blocked, neighbors } = referenceGraph(world);
  if (blocked.size !== world.obstacles.length) throw new Error("Duplicate tree obstacles.");
  for (const p of [root, world.robot, world.deliveryTarget]) {
    if (blocked.has(cellIndex(world.width, p))) throw new Error("Tree root/start/target is blocked.");
  }
  const adjacency = new Map<number, readonly number[]>();
  for (let cell = 0; cell < world.width * world.height; cell += 1) {
    if (!blocked.has(cell)) adjacency.set(cell, neighbors(cell));
  }
  const rootCell = cellIndex(world.width, root);
  const parent = new Map<number, number | null>([[rootCell, null]]);
  const depth = new Map([[rootCell, 0]]);
  const stack = [rootCell];
  while (stack.length > 0) {
    const cell = stack.pop()!;
    for (const next of adjacency.get(cell)!) {
      if (parent.has(next)) continue;
      parent.set(next, cell);
      depth.set(next, depth.get(cell)! + 1);
      stack.push(next);
    }
  }
  const edgeCount = [...adjacency.values()].reduce((sum, list) => sum + list.length, 0) / 2;
  if (parent.size !== adjacency.size) throw new Error("Disconnected traversable graph.");
  if (edgeCount !== adjacency.size - 1) throw new Error("Cyclic traversable graph; unique tree path is undefined.");
  return { width: world.width, height: world.height, root: { ...root }, vertices: [...adjacency.keys()], adjacency, parent, depth, edgeCount };
}

/** Parent/depth path reconstruction is independent of the generator BFS. */
export function uniqueTreePath(tree: TreeIndex, start: Position, target: Position): Position[] {
  let a = cellIndex(tree.width, start);
  let b = cellIndex(tree.width, target);
  if (!tree.parent.has(a) || !tree.parent.has(b)) throw new Error("Path endpoint is not traversable.");
  const left = [a];
  const right = [b];
  while (a !== b) {
    if (tree.depth.get(a)! >= tree.depth.get(b)!) {
      a = tree.parent.get(a)!;
      left.push(a);
    } else {
      b = tree.parent.get(b)!;
      right.push(b);
    }
  }
  return [...left, ...right.slice(0, -1).reverse()].map((cell) => cellPosition(tree.width, cell));
}

/** Evaluation-side BFS used only for endpoint selection. */
export function treeDistances(tree: TreeIndex, start: Position): ReadonlyMap<number, number> {
  const startCell = cellIndex(tree.width, start);
  if (!tree.adjacency.has(startCell)) throw new Error("Selection start is blocked.");
  const distances = new Map([[startCell, 0]]);
  const queue = [startCell];
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of tree.adjacency.get(queue[i]!)!) {
      if (distances.has(next)) continue;
      distances.set(next, distances.get(queue[i]!)! + 1);
      queue.push(next);
    }
  }
  return distances;
}

export function farthestTreeTarget(tree: TreeIndex, start: Position): Position {
  const distances = treeDistances(tree, start);
  let best = -1;
  let maximum = -1;
  for (const cell of tree.vertices) { // row-major vertices give coordinate tie priority
    if (distances.get(cell)! > maximum) {
      maximum = distances.get(cell)!;
      best = cell;
    }
  }
  return cellPosition(tree.width, best);
}

type SelectionRole = "non-root-start" | "matched-random-target";
export function selectionSeed(record: DiagnosticMazeCase, role: SelectionRole): number {
  return stableSeed([config.selectionSeedBase, record.size, record.worldSeed, role], config.selectionSeedBase);
}

function chooseRoom(tree: TreeIndex, candidates: readonly number[], record: DiagnosticMazeCase, role: SelectionRole, emptyReason: string) {
  const seed = selectionSeed(record, role);
  const selectedIndex = candidates.length === 0 ? null : Math.floor(createSeededRandom(seed)() * candidates.length);
  return { role, seed, candidateCount: candidates.length, selectedIndex,
    position: selectedIndex === null ? null : cellPosition(tree.width, candidates[selectedIndex]!),
    failureReason: selectedIndex === null ? emptyReason : null };
}
export type SelectedMission = {
  readonly condition: MazeCondition;
  readonly status: "selected";
  readonly world: World;
  readonly oracle: number;
  readonly truePath: readonly Position[];
} | { readonly condition: MazeCondition; readonly status: "selection-failure"; readonly reason: string };

export function selectDiagnosticMissions(base: World, record: DiagnosticMazeCase) {
  if (base.robot.x !== config.root.x || base.robot.y !== config.root.y) throw new Error("Generator DFS root metadata mismatch.");
  const tree = buildTreeIndex(base, config.root);
  const rootFarthest = farthestTreeTarget(tree, config.root);
  if (cellIndex(base.width, rootFarthest) !== cellIndex(base.width, base.deliveryTarget)) throw new Error("Generator farthest target mismatch.");
  const rootDistances = treeDistances(tree, config.root);
  const farthestIndex = cellIndex(tree.width, rootFarthest);
  const rooms = tree.vertices.filter((cell) => {
    const p = cellPosition(tree.width, cell);
    return p.x % 2 === 1 && p.y % 2 === 1;
  });
  const start = chooseRoom(tree, rooms.filter((cell) => cell !== farthestIndex
    && rootDistances.get(cell)! >= config.minimumNonRootStartDistance), record, "non-root-start",
  "No non-root room distinct from R and F at root distance >=4.");
  const startDistances = start.position === null ? null : treeDistances(tree, start.position);
  const sharedTarget = chooseRoom(tree, startDistances === null ? [] : rooms.filter((cell) =>
    (!config.excludeRandomTargetFarthest || cell !== farthestIndex)
    && rootDistances.get(cell)! >= config.minimumRandomTargetDistance
    && startDistances.get(cell)! >= config.minimumRandomTargetDistance), record, "matched-random-target",
  start.position === null ? "Q selection unavailable because S selection failed."
    : "No shared target room distinct from R, S and F at distance >=6 from both R and S.");
  const endpoints = [
    { condition: "A", start: config.root, target: rootFarthest },
    { condition: "B", start: config.root, target: sharedTarget.position },
    { condition: "C", start: start.position, target: rootFarthest },
    { condition: "D", start: start.position, target: sharedTarget.position },
  ] as const;
  const signature = mazeTerrainSignature(base);
  const missions: SelectedMission[] = endpoints.map(({ condition, start, target }) => {
    if (start === null || target === null) return { condition, status: "selection-failure",
      reason: condition === "C" ? "Shared S selection failed; see non-root-start selection diagnostics."
        : "Shared Q selection failed; see matched-random-target selection diagnostics." };
    const world = { ...cloneWorld(base), robot: { ...start }, deliveryTarget: { ...target } };
    const truePath = uniqueTreePath(tree, start, target);
    const oracle = truePath.length - 1;
    if (oracle <= 0 || calculateShortestPathLength(world) !== oracle || mazeTerrainSignature(world) !== signature) throw new Error("Transformed mission validation failed.");
    return { condition, status: "selected", world, oracle, truePath };
  });
  return { tree, signature, endpoints: { R: { ...config.root }, S: start.position, F: rootFarthest, Q: sharedTarget.position },
    selections: [start, sharedTarget], missions };
}
