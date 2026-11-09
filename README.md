# WorldForge

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a minimal grid world

The current milestone provides a deterministic 5×5 world and a first, manual movement rule:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`
- one-cell `up`, `down`, `left`, and `right` movement, rejecting obstacle and boundary collisions

Run the terminal renderer with:

```sh
npm run dev
```

It prints:

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

`src/world.ts` owns the typed world model and initial scenario. `src/movement.ts` applies one strictly typed action as a pure transition, returning either a new world or a rejection reason. `src/render.ts` converts any world value to ASCII, keeping display logic separate from simulation state. Focused unit tests specify the initial state, rendering, valid moves, rejected moves, and immutability.

This version intentionally has no planning, LLM integration, paid APIs, frontend, agent framework, pathfinding, memory, or automatic decision-making.
