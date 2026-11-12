# WorldForge

## U-shaped trap replays

`generateTrapWorld` in `src/trap-generation.ts` accepts integer `width` and
`height` of at least 6, a safe integer `worldSeed`, and optional `opening`
(`up`, `right`, `down`, `left`), `depth`, `span`, and `origin` overrides.
The seed selects omitted geometry. Depth includes the back wall and entrance
row and must be at least 4. Span includes both arms and must be at least 3.
Origin is the top-left of the rotated barrier rectangle. Validation requires
a free exterior margin of at least one cell on every side.

The barrier consists of a back wall and two arms. Its entrance between the
arm tips stays open. Start is one cell behind the middle of the closed wall,
and target is one cell inside it, giving Manhattan distance 2. All remaining
cells are free. Environment-side BFS validates reachability and supplies the
shortest-path length and detour ratio. Agents receive the existing public
mission and local observations. Fixed endpoint placement makes these
controlled detour tests with deliberately limited layout diversity.

```sh
npm run replay -- --structural trap --width 15 --height 15 --world-seed 6001 --agent planning --tie-break coordinate --steps 2000
npm run replay -- --structural trap --width 15 --height 15 --world-seed 6001 --agent planning --tie-break information-gain --steps 2000
npm run replay -- --structural trap --width 21 --height 21 --world-seed 6002 --agent planning --tie-break coordinate --steps 2000
npm run replay -- --structural trap --width 21 --height 21 --world-seed 6002 --agent planning --tie-break information-gain --steps 2000
```

| Size / seed | Opening | Depth / span | Origin | Manhattan | Oracle | Detour ratio | Coordinate actions | Information-gain actions |
|---|---|---|---|---|---|---|---|---|
| 15×15 / 6001 | down | 4 / 7 | (5,1) | 2 | 16 | 8 | 40 | 16 |
| 21×21 / 6002 | right | 17 / 13 | (1,7) | 2 | 48 | 24 | 146 | 48 |

All four runs reach the goal with zero rejected movements. Open their replays
on macOS with these commands.

```sh
open replays/trap-15x15-world-6001-planning-coordinate-42.html
open replays/trap-15x15-world-6001-planning-information-gain-42.html
open replays/trap-21x21-world-6002-planning-coordinate-42.html
open replays/trap-21x21-world-6002-planning-information-gain-42.html
```

## Perfect maze replays

`generateMazeWorld` in `src/maze-generation.ts` accepts odd integer dimensions
of at least 5 and an integer `worldSeed`. Iterative randomized DFS starts at
`(1,1)` and carves through intervening walls to unvisited odd-coordinate cells.
Each new cell joins the existing maze by one corridor, producing a connected
tree of traversable cells with a solid boundary wall. The existing seeded PRNG
makes every configuration reproducible.

The robot starts at `(1,1)`. Environment-side BFS chooses the farthest
traversable target, breaking distance ties by smallest row then smallest column.
The returned metadata includes the oracle shortest-path length. The replay
supplies agents with the existing public mission and local observations.
These DFS mazes favour long winding corridors and reflect that generator's
layout bias. Dimensions must be odd, and generation allocates memory
proportional to the grid area.

```sh
npm run replay -- --structural maze --width 15 --height 15 --world-seed 5001 --agent planning --tie-break information-gain --steps 2000
npm run replay -- --structural maze --width 21 --height 21 --world-seed 5002 --agent planning --tie-break information-gain --steps 2000
open replays/maze-15x15-world-5001-planning-information-gain-42.html
open replays/maze-21x21-world-5002-planning-information-gain-42.html
```

The 15×15 example has oracle distance 78 and completes in 84 PlanningAgent
actions. The 21×21 example has oracle distance 146 and completes in 200 actions.
Both information-gain runs reach the goal with zero rejected moves.

## Structural barrier replays

`generateBarrierWorld` in `src/structural-generation.ts` accepts `width` (at
least 3), `height` (at least 2), an integer `worldSeed`, a `doorway` or `sealed`
variant, and an optional zero-based `doorRow` for doorway worlds. The wall is
at `floor(width / 2)` and spans the full height. Start is `(0,0)` and target is
`(width - 1,0)`. Every cell away from the wall is traversable. An omitted door
row is selected by the existing seeded PRNG. The sealed variant rejects an
explicit door row.

Generation validates reachability using the environment-side BFS oracle and
returns shortest-path length, Manhattan distance, and their detour ratio.
Unreachable maps have null shortest-path length and detour ratio. Agents
receive the existing public mission and local observations. This structural
family is generated separately from the random-obstacle experiment maps.

Generate the long-detour and sealed demonstrations with these commands.

```sh
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent planning --steps 2000
npm run replay -- --structural sealed --width 9 --height 15 --world-seed 42 --agent planning --steps 2000
open replays/barrier-doorway-9x15-world-42-door-14-planning-coordinate-42.html
open replays/barrier-sealed-9x15-world-42-door-none-planning-coordinate-42.html
```

For these examples the doorway oracle distance is 36, Manhattan distance is 8,
and detour ratio is 4.5. PlanningAgent takes 78 actions to reach the goal. The
sealed run stops after 59 movements with `target-unreachable`. Both have zero
rejected moves. This first structural family varies only the doorway row for
fixed dimensions and endpoints. It provides a controlled detour experiment
with limited layout diversity.

WorldForge is a long-term TypeScript project for experimenting with autonomous agents in simulated environments. It will grow in small, observable steps: first a world and its rules, then behavior, evaluation, and only later more ambitious agent capabilities.

## Today: a first autonomous mission

The current milestone provides ASCII-defined scenarios, movement rules, and a first autonomous loop:

- one robot at `(0, 0)` (`R`)
- obstacles at `(2, 1)` and `(1, 3)` (`#`)
- one delivery target at `(4, 4)` (`T`)
- empty cells rendered as `.`
- one-cell `up`, `down`, `left`, and `right` movement, rejecting obstacle and boundary collisions
- a `RandomAgent` that chooses an action from its local observation
- a `ValidRandomAgent` that chooses randomly only among observed-safe neighbors
- a `MemoryRandomAgent` that prefers observed-safe neighbors it has not previously observed
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
- `deadEnd`: a reachable target with a long misleading branch
- `loops`: reachable multiple corridors and cycles
- `returnRoute`: a reachable lower route behind a tempting dead-end branch

The CLI selects `easy` in `src/index.ts`; change `scenarioName` to run another named scenario.

“Autonomous” currently means the CLI does not hardcode individual moves: the agent chooses each action itself. `RandomAgent` is intentionally not intelligent; seeded randomness makes its demo repeatable. `ValidRandomAgent` tests the narrow hypothesis that avoiding already-observed invalid moves reduces rejected actions and may improve random exploration. It has no target knowledge or memory; if completely enclosed, it deterministically chooses `up` and lets the movement engine reject it. `MemoryRandomAgent` tests whether storing only previously observed robot positions improves random exploration: it prefers observed-safe neighboring coordinates not yet in its per-instance set, then allows safe revisits when every valid choice was visited. It has no target knowledge, map, or pathfinding, and its memory resets for each benchmark trial. `RuleBasedAgent` knows the public target coordinate and uses Manhattan distance, with the deterministic priority `right`, `down`, `left`, `up`. It avoids observed obstacles and boundaries, but has no map, memory, or pathfinding, so it is not guaranteed to find a path and can get stuck or loop.

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

Run the larger Experiment 003 validation (1,000 trials per stochastic agent and scenario) with:

```sh
npm run benchmark:validate
```

The quick benchmark gives each trial 100 actions. `RandomAgent`, `ValidRandomAgent`, and `MemoryRandomAgent` each run 50 trials per scenario with the same distinct deterministic seed list; `RuleBasedAgent` runs once because its policy is deterministic. Validation mode increases only stochastic agents to 1,000 paired seeds. Every trial receives a fresh world and agent instance. Compare `ValidRandomAgent` with `RandomAgent` to distinguish fewer invalid moves from actual task-completion improvement, and compare `MemoryRandomAgent` with `ValidRandomAgent` to test whether local visit memory improves exploration.

The table reports successes/trials, a 95% Wilson confidence interval for stochastic success rates, mean steps only among successful tasks, mean rejected moves, movement analytics, and counts for `goal-reached` and `step-limit`. A successful move is not the same as mission success: rejected moves measure invalid-action attempts, while success rate measures actually reaching `T`. `N/A` mean successful steps means no trial reached the target. Read these as descriptive measurements; confidence intervals quantify per-rate sampling uncertainty, not universal conclusions.

See [Experiment 003](docs/experiment-003.md) for the 1,000-trial methodology, measurements, adversarial-scenario rationale, ablation discussion, limitations, and conclusion.

## Procedural worlds

Generate and render three reproducible sample worlds with:

```sh
npm run generate
```

`generateWorld(config)` accepts `width`, `height`, integer `worldSeed`, `obstacleDensity`, requested `reachability`, optional `minimumPathDistance`, and optional bounded `maxAttempts`. The same configuration and seed always produce the same world; each call returns fresh values. Density is applied to non-endpoint cells, guaranteeing one distinct robot and target with no overlapping obstacle.

Generation uses the project’s seeded PRNG and an internal BFS only to validate requested reachability and measure shortest-path difficulty. This information is not provided to agents. Reachable requests require a route; unreachable requests require none; minimum distance applies only to reachable worlds. If bounded attempts cannot satisfy the constraints, generation throws a descriptive error. Dense reachable worlds or large distance constraints can therefore fail.

## Experiment 004: procedural scale

Run the procedural scale experiment with:

```sh
npm run benchmark:procedural
```

It generates 100 seeded reachable maps for each 10×10, 20×20, and 50×50 configuration at densities `0.15` and `0.25`. Each generated map is reused across 100, 500, and 1,000 action budgets; every agent receives 10 separately seeded trials per map. Minimum path distance is `max(5, floor((width + height) / 3))`. Results are written to `results/experiment-004.json`, including map seeds, generation attempts, shortest-path lengths, failures, and aggregated metrics. Generator seeds and agent seeds are separate. This is a conditioned sample of reachable generated maps—not a claim about arbitrary random environments. Its trial-level Wilson intervals do not establish generalization to unseen worlds because 10 runs are clustered within each generated map. See [Experiment 004](docs/experiment-004.md) for results and interpretation.

## Experiment 005: planning under partial information

Run the paired PlanningAgent experiment with:

```sh
npm run experiment:005
```

It regenerates and validates the same 600 Experiment 004 worlds, compares `MemoryRandomAgent` with one deterministic run per world for each PlanningAgent tie-break policy, and derives the three budget outcomes from maximum-budget trajectories. Results are written to `results/experiment-005.json`. See [Experiment 005](docs/experiment-005.md) for methods, paired comparisons, pilot seeds, and limitations.

Movement analytics are calculated from each action trace:

- `uniqueCellsVisited`: distinct cells occupied, including the starting cell.
- `repeatedVisits`: successful moves whose destination was occupied earlier in the same trial.
- `immediateBacktracks`: successful moves that return to the position occupied immediately before the previous successful move. Rejected actions do not reset this comparison.
- `repeatedVisitsPerSuccessfulMove` and `immediateBacktracksPerSuccessfulMove`: normalized versions of the corresponding counts. They are `N/A` when a trial made no successful moves.

A repeated visit is a local count, not proof of a persistent cycle. A persistent cycle means the agent keeps revisiting a repeating sequence of states over time; these metrics can suggest that behavior but do not detect or explain it. They also do not give agents memory or change their decisions.

## Development

```sh
npm install
npm run typecheck
npm test
```

## Visual replay

Create a deterministic, standalone browser replay for any named scenario:

```bash
npm run replay -- --scenario detour --agent memory --seed 42 --steps 100
open replays/detour-memory-42.html
```

Planning replays accept `--tie-break coordinate` (the default) or `--tie-break information-gain`. The latter uses unknown-neighbor count only after both the existing combined frontier score and known-safe travel distance tie. A small controlled comparison, not a full benchmark experiment, is available with `npm run planning:compare`.

Supported agents are `random`, `valid-random`, `memory`, `rule`, and `planning`. The viewer shows the true map for inspection alongside an observation-only reconstruction. The latter derives its terrain solely from observations recorded before each action; it does not show hidden distant obstacles. A target is shown there before observation only for `rule` and `planning`, because those agents receive its public coordinate.

Planning replays additionally include an optional diagnostics panel. It shows the recorded private discovered map, known-safe planned route, reachable frontier scores, selected frontier, and tie-break explanation for the selected historical step. Other agents produce no diagnostics panel, and normal simulations and benchmarks do not record this data.

`src/world.ts` owns the typed world model and ASCII parsing; `createInitialWorld()` remains available for existing callers. `src/scenarios.ts` holds the named scenario rows and creates fresh parsed worlds. `src/goal.ts` is a small pure predicate for the current mission objective. `src/mission.ts` derives the public start, target, and dimensions given to benchmark agent factories without exposing terrain. `src/observation.ts` exposes only the robot position and four adjacent cell contents. `src/agent.ts` contains the shared agent contract plus random, valid-random, memory-random, and local greedy policies. `src/planning.ts` adds PlanningAgent's private known-cell model, known-safe BFS, and goal-directed frontier selection. `src/simulation.ts` coordinates observation, decision, movement, termination, and position traces; it does not duplicate movement validation or expose the full world to the agent. `src/analytics.ts` derives visit and backtrack metrics from those traces. `src/benchmark.ts` creates isolated trials and aggregates their results. `src/render.ts` converts a world value to ASCII. Focused unit tests cover each boundary between these modules.

This version intentionally has no package pickup or delivery, LLM integration, paid APIs, frontend, A* or other global-map pathfinding, reinforcement learning, or external services.
