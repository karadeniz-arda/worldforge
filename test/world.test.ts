import { describe, expect, it } from "vitest";

import { createInitialWorld } from "../src/world.js";

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
