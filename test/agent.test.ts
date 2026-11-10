import { describe, expect, it } from "vitest";

import { MemoryRandomAgent, RandomAgent, RuleBasedAgent, ValidRandomAgent } from "../src/agent.js";
import { createSeededRandom } from "../src/random.js";
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

describe("ValidRandomAgent", () => {
  it("filters observed boundaries and obstacles before choosing", () => {
    const values = [0, 0.99];
    const agent = new ValidRandomAgent(() => values.shift() ?? 0);
    const limitedObservation: Observation = {
      robot: { x: 1, y: 1 },
      neighbors: { up: "boundary", down: "obstacle", left: "empty", right: "target" },
    };

    expect(agent.decide(limitedObservation)).toBe("left");
    expect(agent.decide(limitedObservation)).toBe("right");
  });

  it("uses injected random values for uniform deterministic selection", () => {
    const values = [0, 0.25, 0.5, 0.99];
    const agent = new ValidRandomAgent(() => values.shift() ?? 0);

    expect([agent.decide(observation), agent.decide(observation), agent.decide(observation), agent.decide(observation)])
      .toEqual(["up", "down", "left", "right"]);
  });

  it("uses the documented up fallback when completely enclosed", () => {
    let randomCalls = 0;
    const agent = new ValidRandomAgent(() => {
      randomCalls += 1;
      return 0;
    });

    expect(agent.decide({
      robot: { x: 0, y: 0 },
      neighbors: { up: "boundary", down: "obstacle", left: "boundary", right: "obstacle" },
    })).toBe("up");
    expect(randomCalls).toBe(0);
  });
});

describe("MemoryRandomAgent", () => {
  it("records observed positions and prefers a newly discovered neighbor", () => {
    const agent = new MemoryRandomAgent(() => 0);
    const middle: Observation = {
      robot: { x: 1, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "empty", right: "empty" },
    };

    expect(agent.decide(middle)).toBe("left");
    expect(agent.decide({
      robot: { x: 0, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "boundary", right: "empty" },
    })).toBe("right");
    expect(agent.decide(middle)).toBe("right");
  });

  it("allows a revisit when every observed-safe neighbor was visited", () => {
    const agent = new MemoryRandomAgent(() => 0);

    agent.decide({
      robot: { x: 1, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "empty", right: "boundary" },
    });
    expect(agent.decide({
      robot: { x: 0, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "boundary", right: "empty" },
    })).toBe("right");
  });

  it("is reproducible with a seeded random generator", () => {
    const observations: readonly Observation[] = [
      observation,
      { robot: { x: 1, y: 0 }, neighbors: { up: "boundary", down: "empty", left: "empty", right: "empty" } },
      observation,
    ];
    const first = new MemoryRandomAgent(createSeededRandom(77));
    const second = new MemoryRandomAgent(createSeededRandom(77));

    expect(observations.map((current) => first.decide(current)))
      .toEqual(observations.map((current) => second.decide(current)));
  });

  it("keeps visited-position memory isolated to each agent instance", () => {
    const first = new MemoryRandomAgent(() => 0);
    const second = new MemoryRandomAgent(() => 0);
    const middle: Observation = {
      robot: { x: 1, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "empty", right: "empty" },
    };

    first.decide(middle);
    first.decide({
      robot: { x: 0, y: 0 },
      neighbors: { up: "boundary", down: "boundary", left: "boundary", right: "empty" },
    });

    expect(first.decide(middle)).toBe("right");
    expect(second.decide(middle)).toBe("left");
  });

  it("uses the valid-random fallback without drawing randomness when enclosed", () => {
    let randomCalls = 0;
    const agent = new MemoryRandomAgent(() => {
      randomCalls += 1;
      return 0;
    });

    expect(agent.decide({
      robot: { x: 0, y: 0 },
      neighbors: { up: "boundary", down: "obstacle", left: "boundary", right: "obstacle" },
    })).toBe("up");
    expect(randomCalls).toBe(0);
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
