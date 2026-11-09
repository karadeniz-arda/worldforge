import { describe, expect, it } from "vitest";

import { createInitialWorld, parseWorld } from "../src/world.js";

describe("createInitialWorld", () => {
  it("creates the specified 5x5 layout", () => {
    expect(createInitialWorld()).toEqual({
      width: 5,
      height: 5,
      robot: { x: 0, y: 0 },
      obstacles: [
        { x: 2, y: 1 },
        { x: 1, y: 3 },
      ],
      deliveryTarget: { x: 4, y: 4 },
    });
  });
});

describe("parseWorld", () => {
  it("derives dimensions and positions from an ASCII map", () => {
    expect(parseWorld(["R.T", "#.."])).toEqual({
      width: 3,
      height: 2,
      robot: { x: 0, y: 0 },
      obstacles: [{ x: 0, y: 1 }],
      deliveryTarget: { x: 2, y: 0 },
    });
  });

  it.each([
    [[], "at least one row"],
    [[""], "at least one cell"],
    [["R.T", ".."], "rectangular"],
    [["RXT"], "Unsupported world symbol \"X\" at (1, 0)"],
    [["RRT"], "exactly one robot"],
    [["R.."], "exactly one target"],
    [[".T."], "exactly one robot"],
    [["RTT"], "exactly one target"],
  ])("rejects invalid maps: %s", (rows, message) => {
    expect(() => parseWorld(rows)).toThrow(message);
  });
});
