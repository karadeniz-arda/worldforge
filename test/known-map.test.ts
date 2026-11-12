import { describe, expect, it } from "vitest";
import {
  adjacentPosition, cardinalDirections, copyKnownMap, countUnknownNeighbors,
  createUnknownMap, getKnownCell, isKnownMapPositionInBounds, updateKnownMap,
} from "../src/known-map.js";
import { observeWorld } from "../src/observation.js";
import { parseWorld } from "../src/world.js";

describe("shared map knowledge", () => {
  it("starts entirely unknown with independent cells and copies", () => {
    const map = createUnknownMap(4, 3);
    expect(map).toEqual({ width: 4, height: 3, cells: Array(12).fill("unknown") });
    expect(createUnknownMap(4, 3).cells).not.toBe(map.cells);
    expect(copyKnownMap(map)).toEqual(map);
    expect(copyKnownMap(map).cells).not.toBe(map.cells);
  });

  it("updates only the observed cross, including target as free", () => {
    const world = parseWorld(["....", ".RT.", ".#.."]);
    const initial = createUnknownMap(4, 3);
    const observation = observeWorld(world);
    const before = structuredClone(observation);
    const map = updateKnownMap(initial, observation);
    expect(map.cells).toEqual([
      "unknown", "free", "unknown", "unknown",
      "free", "free", "free", "unknown",
      "unknown", "blocked", "unknown", "unknown",
    ]);
    expect(initial.cells.every((cell) => cell === "unknown")).toBe(true);
    expect(observation).toEqual(before);
    expect(updateKnownMap(map, observation)).toEqual(map);
  });

  it("handles boundaries without treating outside cells as unknown neighbours", () => {
    const map = updateKnownMap(createUnknownMap(3, 2), observeWorld(parseWorld(["R.T", "..."])));
    expect(getKnownCell(map, { x: -1, y: 0 })).toBeUndefined();
    expect(getKnownCell(map, { x: 3, y: 0 })).toBeUndefined();
    expect(isKnownMapPositionInBounds(map, { x: 0, y: 2 })).toBe(false);
    expect(countUnknownNeighbors(map, { x: 0, y: 0 })).toBe(0);
    expect(countUnknownNeighbors(map, { x: 1, y: 0 })).toBe(2);
    expect(cardinalDirections.map((direction) => adjacentPosition({ x: 1, y: 1 }, direction)))
      .toEqual([{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 0 }]);
  });

  it.each(["free", "blocked"] as const)("rejects contradictory %s terrain atomically", (previous) => {
    const observation = observeWorld(parseWorld(["R#T", "..."]));
    const map = updateKnownMap(createUnknownMap(3, 2), {
      ...observation, neighbors: { ...observation.neighbors, right: previous === "free" ? "empty" : "obstacle" },
    });
    const before = structuredClone(map);
    expect(() => updateKnownMap(map, {
      ...observation, neighbors: { ...observation.neighbors, right: previous === "free" ? "obstacle" : "empty" },
    })).toThrow(`Conflicting static terrain observation at (1, 0): ${previous}`);
    expect(map).toEqual(before);
  });

  it("accumulates consistent observations without forgetting terrain", () => {
    const first = parseWorld(["R.T", ".#."]);
    const initial = updateKnownMap(createUnknownMap(3, 2), observeWorld(first));
    const updated = updateKnownMap(initial, observeWorld({ ...first, robot: { x: 1, y: 0 } }));
    initial.cells.forEach((cell, index) => {
      if (cell !== "unknown") expect(updated.cells[index]).toBe(cell);
    });
    expect(getKnownCell(updated, { x: 1, y: 1 })).toBe("blocked");
    expect(getKnownCell(updated, { x: 2, y: 0 })).toBe("free");
  });
});
