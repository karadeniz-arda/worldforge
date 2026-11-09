# WorldForge

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a first autonomous mission

The current milestone provides ASCII-defined scenarios, movement rules, and a first autonomous loop:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`
- one-cell `up`, `down`, `left`, and `right` movement, rejecting obstacle and boundary collisions
- a `RandomAgent` that chooses an action from its local observation
- a `RuleBasedAgent` that greedily heads toward a public target coordinate using only its four observed neighbors
- a simulation that observes, decides, acts, and records outcomes until the target is reached or its step limit is exhausted
- mission completion when the robot reaches `deliveryTarget`, including immediate completion when it starts there

## Scenarios

Worlds are parsed from rows of `R` (robot), `T` (target), `#` (obstacle), and `.` (empty). Maps must be nonempty, rectangular, and contain exactly one robot and one target. Valid maps do not need to have a reachable target.

The built-in scenarios are:

- `easy`: the original 5×5 map
- `corridor`: a narrow winding route
- `detour`: a wall requiring a non-direct route
- `unreachable`: a target separated by obstacles

The CLI selects `easy` in `src/index.ts`; change `scenarioName` to run another named scenario.

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

## Benchmarks

Run the reproducible scenario comparison with:

```sh
npm run benchmark
```

The benchmark gives each trial 100 actions. `RandomAgent` runs 50 trials per scenario with distinct deterministic seeds; `RuleBasedAgent` runs once because its policy is deterministic. Every trial receives a fresh world and agent instance.

The table reports task success rate, mean steps only among successful tasks, mean rejected moves, and counts for `goal-reached` and `step-limit`. A successful move is not the same as mission success: rejected moves measure invalid-action attempts, while success rate measures actually reaching `T`. `N/A` mean successful steps means no trial reached the target.

## Development

```sh
npm install
npm run typecheck
npm test
```

`src/world.ts` owns the typed world model and ASCII parsing; `createInitialWorld()` remains available for existing callers. `src/scenarios.ts` holds the named scenario rows and creates fresh parsed worlds. `src/goal.ts` is a small pure predicate for the current mission objective. `src/observation.ts` exposes only the robot position and four adjacent cell contents. `src/agent.ts` contains the shared agent contract plus random and local greedy policies. `src/simulation.ts` coordinates observation, decision, movement, and termination; it does not duplicate movement validation or expose the full world to the agent. `src/benchmark.ts` creates isolated trials and aggregates their results. `src/render.ts` converts a world value to ASCII. Focused unit tests cover each boundary between these modules.

This version intentionally has no package pickup or delivery, planning, LLM integration, paid APIs, frontend, pathfinding, memory, goal-directed behavior, or external services.
