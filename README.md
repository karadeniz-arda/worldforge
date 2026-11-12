# WorldForge

WorldForge is a TypeScript simulation framework for reproducible autonomous
navigation experiments under partial observability. Agents navigate static
grid worlds using local observations, while the simulator enforces movement
rules and records outcomes for evaluation and visual replay.

[Overview](#overview) · [Quick start](#quick-start) · [Agents](#agents-and-information-available-to-each) · [Experiments](#experiments-and-observed-results) · [Replay](#visual-replay) · [Documentation](#documentation-links)

## Overview

The current task is to reach a target coordinate. Each observation contains
the robot's position and the contents of its four adjacent cells. Agents choose
one-cell cardinal movements, and the simulator rejects boundary and obstacle
collisions. Episodes terminate with `goal-reached`, `step-limit`, or an
agent-reported `target-unreachable`. A stop decision consumes zero movement
actions. The simulator confirms goal arrival and records unreachable reports
without consulting hidden terrain to validate them.

**PlanningAgent** maintains a discovered map and combines known-safe BFS routes
with goal-directed frontier exploration. Random, memory-based, and local greedy
agents provide comparison baselines.

## Key features

- Explicit public mission and local observation boundaries.
- Seeded worlds and stochastic policies, with fresh state for each trial.
- ASCII scenarios, random obstacle fields, barriers, perfect mazes, and U traps.
- Success, movement, exploration, and path-efficiency measurements.
- Paired planning-policy experiments with reproducible JSON artifacts.
- Standalone HTML replay with historical planning diagnostics.
- Strict TypeScript and focused Vitest coverage.

## Quick start

Use Node.js 24 and npm. From the repository root, install the locked dependencies
and run the checks and terminal demo.

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

The terminal demo compares seeded RandomAgent and RuleBasedAgent on `easy`
with a 12-action budget. To inspect PlanningAgent in the browser, generate a
replay and open the resulting file on macOS.

```sh
npm run replay -- --scenario detour --agent planning --tie-break information-gain --steps 100
open replays/detour-planning-information-gain-42.html
```

## Agents and information available to each

All agents receive the current position and four neighbouring cell contents
(`empty`, `obstacle`, `target`, or `boundary`) through `Observation`.

| Agent | Additional input | Retained state and decision rule |
|---|---|---|
| RandomAgent | Injectable random function | Ignores observation and samples all four directions. |
| ValidRandomAgent | Injectable random function | Samples only observed-safe directions. |
| MemoryRandomAgent | Injectable random function | Remembers observed robot positions, prefers unvisited safe neighbours, and permits revisits when necessary. |
| RuleBasedAgent | Public target coordinate | Greedily reduces Manhattan distance using local safe moves, with deterministic fallback. |
| PlanningAgent | Public start, target, width, and height | Maintains an unknown/free/blocked map and replans after each observation. |

`AgentMission` copies public coordinates and dimensions from `World` for agent
factories. Each policy receives the constructor inputs listed above. Hidden
obstacles remain in the environment and become available through observations.
The stochastic CLIs inject seeded random functions.

PlanningAgent first searches for a route to the target through known-free
cells. Otherwise it selects a reachable frontier, a known-free cell adjacent
to an in-bounds unknown cell, using this primary score.

```text
known-safe BFS distance to frontier + Manhattan distance from frontier to target
```

Both policies minimize score, then known-safe travel distance. The default
`coordinate` policy resolves remaining ties by row, then column. The
`information-gain` policy first prefers more unknown neighbours, then uses the
same coordinate order. Safe BFS traverses only known-free cells. When neither
a target route nor a reachable frontier remains, PlanningAgent reports
`target-unreachable`.

## Architecture

```text
World → observeWorld → Observation → Agent.decide → AgentDecision
  ↑                                                   │
  └──────── simulation applies moveRobot or stops ──────┘
```

| Modules | Responsibility |
|---|---|
| `world.ts`, `scenarios.ts`, generation modules | Typed world state, ASCII parsing, and seeded environments. |
| `mission.ts`, `observation.ts` | Public metadata and local sensing. |
| `agent.ts`, `planning.ts` | Agent contract, baseline policies, and PlanningAgent's private map and planning. |
| `movement.ts`, `goal.ts`, `simulation.ts` | Movement validation, goal checking, action accounting, termination, and optional replay traces. |
| `analytics.ts`, benchmark and experiment modules | Independent trials, aggregation, and comparisons. |
| `render.ts`, `replay.ts`, CLI entry points | ASCII presentation, standalone HTML replay, and local commands. |

Environment-side oracle BFS has full obstacle-map access for generation
validation and shortest-path evaluation. Agents receive their public inputs
and local observations. PlanningAgent's BFS operates on its own discovered map.
Detailed traces and diagnostics are opt-in during replay and Experiment 005.

## Experiments and observed results

| Command | Purpose | Record |
|---|---|---|
| `npm run benchmark` | Named scenarios, 100 actions, 50 trials per stochastic baseline and one RuleBasedAgent trial. | Terminal table |
| `npm run benchmark:validate` | Named-scenario validation with 1,000 stochastic trials. | [Experiment 003](docs/experiment-003.md) |
| `npm run benchmark:procedural` | Random, valid-random, and memory baselines across map sizes, densities, and budgets. | [Experiment 004](docs/experiment-004.md), [JSON](results/experiment-004.json) |
| `npm run experiment:005` | MemoryRandomAgent and paired PlanningAgent policies on the same 600 procedural worlds. | [Experiment 005](docs/experiment-005.md), [JSON](results/experiment-005.json) |

Experiment 005 uses 100 reachable world seeds for each size/density combination,
with budgets of 100, 500, and 1,000 actions. Each planning policy runs once per
world. MemoryRandomAgent runs ten seeded trials per world. Lower-budget
outcomes are derived from maximum-budget trajectories. The command validates
world metadata and MemoryRandom success counts against Experiment 004.

Selected results below use the 1,000-action budget on 50×50 maps. Mean actions
include successful runs only. SPL averages oracle distance divided by the
larger of oracle distance and actions taken, with failures contributing zero.

| Density | Agent / policy | Successes / runs | Mean successful actions | SPL |
|---|---|---|---|---|
| 0.15 | MemoryRandomAgent | 248/1000 | 538.0 | 0.028 |
| 0.15 | PlanningAgent coordinate | 100/100 | 61.8 | 0.818 |
| 0.15 | PlanningAgent information-gain | 100/100 | 56.3 | 0.873 |
| 0.25 | MemoryRandomAgent | 173/1000 | 579.6 | 0.018 |
| 0.25 | PlanningAgent coordinate | 100/100 | 89.5 | 0.624 |
| 0.25 | PlanningAgent information-gain | 100/100 | 73.4 | 0.714 |

Both planning policies reached all 600 sampled worlds within 1,000 actions.
Information gain improved mean route efficiency in these configurations,
while individual worlds favoured either policy. Planning receives a public
target coordinate and dimensions that MemoryRandomAgent does not use, so this
comparison includes an information advantage. Reachability and minimum-distance
conditioning restrict the sampled environments. MemoryRandom trial-level Wilson
intervals involve ten trials clustered within each world. Paired planning
bootstrap intervals use worlds as the analysis units. The report details these
limits and the scope of the observed results.

Task success measures reaching the goal. Valid-movement rate measures legal
actions. Repeat and backtrack counts describe movement patterns and depend on
episode duration. Metric definitions and paired outcomes are in the reports.

## Environment families

| Family | Structure and purpose |
|---|---|
| Named ASCII scenarios | Hand-authored corridors, detours, loops, dead ends, and unreachable targets. |
| Random obstacle fields | Seeded rectangular maps conditioned on reachability and optional minimum path distance. |
| Single-doorway barrier | Full-height dividing wall with one configurable or seeded gap, plus a sealed variant. |
| Perfect maze | Iterative randomized DFS produces a connected, acyclic corridor graph with a farthest-cell target. |
| U-shaped trap | Three-sided barrier places the goal close in Manhattan distance while requiring a detour through its entrance. |

ASCII maps use `R`, `T`, `#`, and `.`. Structural families use separate
generators from the historical random-obstacle experiments. Configuration,
guarantees, example measurements, and seeds are documented in the
[environment guide](docs/environments.md).

## Visual replay

The replay CLI writes a standalone HTML file into `replays/`. It supports
`random`, `valid-random`, `memory`, `rule`, and `planning` agents on named and
structural worlds.

The viewer provides play/pause, forward/backward stepping, a timeline, speed
control, visited cells, and move outcomes. The true-world view accompanies an
observation-only reconstruction. Planning replays additionally show historical
internal maps, frontier scores, selected frontiers, safe routes, and decision
explanations. Public target coordinates can appear before local discovery for
RuleBasedAgent and PlanningAgent. Stop events retain terminal diagnostics.

See the [replay guide](docs/replays.md) for CLI options, per-seed recipes, and
macOS open commands. A small exploratory policy comparison is available through
`npm run planning:compare`.

## Limitations

- Worlds contain one robot, static obstacles, and a single reach-position goal.
- Observations assume exact position and complete four-neighbour sensing.
- Frontier scoring can cause inefficient exploration and route switching.
  General completeness of the current greedy selector has no formal proof.
- Generated environment families have layout and endpoint-selection biases.
- Structural examples are demonstrations with limited seed coverage.
- Browser playback has pending manual verification, and this README has no
  verified screenshot.

## Roadmap

Planned work includes optimistic unknown-as-free BFS, Experiment 006 for
structural environment evaluation, warehouse tasks with pickup and delivery,
and dynamic environments. These capabilities are pending implementation.

## Documentation links

- [Environment configuration and examples](docs/environments.md)
- [Replay usage and reproducible commands](docs/replays.md)
- [Experiment 003 — memory validation](docs/experiment-003.md)
- [Experiment 004 — memory under scale](docs/experiment-004.md)
- [Experiment 005 — planning under partial information](docs/experiment-005.md)
- [Planning correctness and termination assumptions](docs/planning-correctness.md)
- [Doorway decision analysis](docs/doorway-failure-analysis.md)
- [Development conventions](AGENTS.md)
- [MIT license](LICENSE)
