import { describe, expect, it } from "vitest";

import { hasObstacle } from "../src/grid.js";

describe("hasObstacle", () => {
  it("keeps cached indexes isolated by obstacle-array identity", () => {
    const firstWorldObstacles = [{ x: 1, y: 1 }];
    const secondWorldObstacles = [{ x: 2, y: 2 }];

    expect(hasObstacle(firstWorldObstacles, { x: 1, y: 1 })).toBe(true);
    expect(hasObstacle(secondWorldObstacles, { x: 1, y: 1 })).toBe(false);
    expect(hasObstacle(secondWorldObstacles, { x: 2, y: 2 })).toBe(true);
  });
});
