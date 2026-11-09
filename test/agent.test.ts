import { describe, expect, it } from "vitest";

import { RandomAgent } from "../src/agent.js";
import type { Observation } from "../src/observation.js";

const observation: Observation = {
  robot: { x: 1, y: 1 },
  neighbors: { up: "empty", down: "empty", left: "empty", right: "empty" },
};

describe("RandomAgent", () => {
  it("uses injected random values to choose deterministic directions", () => {
    const values = [0, 0.25, 0.5, 0.99];
    const agent = new RandomAgent(() => values.shift() ?? 0);

    expect([agent.decide(observation), agent.decide(observation), agent.decide(observation), agent.decide(observation)])
      .toEqual(["up", "down", "left", "right"]);
  });
});
