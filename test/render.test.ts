import { describe, expect, it } from "vitest";

import { renderWorld } from "../src/render.js";
import { createInitialWorld } from "../src/world.js";

describe("renderWorld", () => {
  it("renders the initial world as a five-row ASCII grid", () => {
    expect(renderWorld(createInitialWorld())).toBe([
      "R....",
      "..#..",
      ".....",
      ".#...",
      "....T",
    ].join("\n"));
  });
});
