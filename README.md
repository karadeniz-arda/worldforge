# WorldForge

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a first autonomous loop

The current milestone provides a deterministic 5×5 world, movement rules, and a first autonomous loop:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`
- one-cell `up`, `down`, `left`, and `right` movement, rejecting obstacle and boundary collisions
- a `RandomAgent` that chooses an action from its local observation
- a fixed-step simulation that observes, decides, acts, and records outcomes

“Autonomous” currently means the CLI does not hardcode individual moves: the agent chooses each action itself. The baseline agent is intentionally not intelligent; seeded randomness makes the demo repeatable.

Run the terminal renderer with:

```sh
npm run dev
```

It prints the initial world, 12 agent-selected actions, a success/rejection summary, and the final world.

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

`src/world.ts` owns the typed world model and initial scenario. `src/observation.ts` exposes only the robot position and four adjacent cell contents. `src/agent.ts` contains the agent contract and random baseline policy. `src/simulation.ts` coordinates observation, decision, and the existing movement transition; it does not duplicate movement validation. `src/render.ts` converts a world value to ASCII. Focused unit tests cover each boundary between these modules.

This version intentionally has no planning, LLM integration, paid APIs, frontend, pathfinding, memory, goal-directed behavior, package delivery, or external services.
