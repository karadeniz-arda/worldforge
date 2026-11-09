import { describe, expect, it } from "vitest";

import { renderWorld } from "../src/render.js";
import { createScenario, scenarioRows } from "../src/scenarios.js";

describe("scenario library", () => {
  it("provides the expected named ASCII maps", () => {
    expect(scenarioRows).toEqual({
      easy: ["R....", "..#..", ".....", ".#...", "....T"],
      corridor: ["R####", "....#", "###.#", "#....", "####T"],
      detour: ["R.#.T", "..#..", "..#..", ".....", "....."],
      unreachable: ["R#T", "###", "..."],
    });
  });

  it("creates fresh worlds with layouts matching their named maps", () => {
    expect(createScenario("corridor")).toEqual({
      width: 5,
      height: 5,
      robot: { x: 0, y: 0 },
      obstacles: [
        { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
      ],
      deliveryTarget: { x: 4, y: 4 },
    });
  });

  it("renders parsed worlds at their own dimensions", () => {
    expect(renderWorld(createScenario("unreachable"))).toBe("R#T\n###\n...");
  });
});
