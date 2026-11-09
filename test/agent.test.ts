import { describe, expect, it } from "vitest";

import { RandomAgent, RuleBasedAgent } from "../src/agent.js";
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

describe("RuleBasedAgent", () => {
  it("chooses a safe action that reduces Manhattan distance to its target", () => {
    const agent = new RuleBasedAgent({ x: 4, y: 4 });

    expect(agent.decide({
      robot: { x: 1, y: 1 },
      neighbors: { up: "empty", down: "empty", left: "empty", right: "empty" },
    })).toBe("right");
  });

  it("avoids observed obstacles and boundaries even when they would reduce distance", () => {
    const agent = new RuleBasedAgent({ x: 2, y: 1 });

    expect(agent.decide({
      robot: { x: 1, y: 1 },
      neighbors: { up: "empty", down: "empty", left: "empty", right: "obstacle" },
    })).toBe("down");
  });

  it("uses right-before-down as its deterministic tie-break", () => {
    const agent = new RuleBasedAgent({ x: 2, y: 2 });

    expect(agent.decide(observation)).toBe("right");
  });

  it("uses the first observed-safe direction as a deterministic fallback", () => {
    const agent = new RuleBasedAgent({ x: 1, y: 1 });

    expect(agent.decide({
      robot: { x: 1, y: 1 },
      neighbors: { up: "empty", down: "empty", left: "empty", right: "empty" },
    })).toBe("right");
  });
});
