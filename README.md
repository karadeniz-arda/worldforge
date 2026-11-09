# WorldForge

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a minimal grid world

The current milestone provides a deliberately static 5×5 world:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`

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

`src/world.ts` owns the typed world model and initial scenario. `src/render.ts` converts any world value to ASCII, keeping display logic separate from simulation state. The focused unit tests specify both the initial state and rendered output.

This first version intentionally has no movement, planning, LLM integration, paid APIs, frontend, or agent framework.
