# WorldForge

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a first autonomous mission

The current milestone provides a deterministic 5×5 world, movement rules, and a first autonomous loop:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`
- one-cell `up`, `down`, `left`, and `right` movement, rejecting obstacle and boundary collisions
- a `RandomAgent` that chooses an action from its local observation
- a `RuleBasedAgent` that greedily heads toward a public target coordinate using only its four observed neighbors
- a simulation that observes, decides, acts, and records outcomes until the target is reached or its step limit is exhausted
- mission completion when the robot reaches `deliveryTarget`, including immediate completion when it starts there

“Autonomous” currently means the CLI does not hardcode individual moves: the agent chooses each action itself. `RandomAgent` is intentionally not intelligent; seeded randomness makes its demo repeatable. `RuleBasedAgent` knows the public target coordinate and uses Manhattan distance, with the deterministic priority `right`, `down`, `left`, `up`. It avoids observed obstacles and boundaries, but has no map, memory, or pathfinding, so it is not guaranteed to find a path and can get stuck or loop.

Run the terminal renderer with:

```sh
npm run dev
```

It runs both agents from fresh identical worlds with the same 12-step limit, then prints each mission outcome, step count, move summary, final position, and the rule-based agent's final world.

```text
R....
..#..
.....
.#...
....T
```

## Development

```sh
npm install
npm run typecheck
npm test
```

`src/world.ts` owns the typed world model and initial scenario. `src/goal.ts` is a small pure predicate for the current mission objective. `src/observation.ts` exposes only the robot position and four adjacent cell contents. `src/agent.ts` contains the shared agent contract plus random and local greedy policies. `src/simulation.ts` coordinates observation, decision, movement, and termination; it does not duplicate movement validation or expose the full world to the agent. `src/render.ts` converts a world value to ASCII. Focused unit tests cover each boundary between these modules.

This version intentionally has no package pickup or delivery, planning, LLM integration, paid APIs, frontend, pathfinding, memory, goal-directed behavior, or external services.
