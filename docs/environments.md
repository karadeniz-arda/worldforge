# Environment configuration

All generators return fresh `World` values. Dimensions and coordinates are
zero-based, with x increasing rightward and y downward. Oracle BFS runs on the
authoritative obstacle map for validation and evaluation. Public missions
contain start, target, width, and height. Agents obtain terrain through local
observations.

## Named scenarios

`parseWorld(rows)` accepts nonempty rectangular ASCII maps with exactly one
`R` (robot) and `T` (target), `#` obstacles, and `.` free cells. Unreachable
targets are valid. `createScenario(name)` builds a fresh parsed world.

| Name | Purpose |
|---|---|
| `easy` | Original 5×5 world. |
| `corridor` | Narrow winding route. |
| `detour` | Wall requiring an indirect route. |
| `unreachable` | Enclosed start and separated target. |
| `unreachableMaze` | Nontrivial reachable component with an inaccessible target. |
| `deadEnd` | Long misleading branch. |
| `loops` | Multiple corridors and cycles. |
| `returnRoute` | Route behind a tempting dead-end branch. |

Definitions live in [scenarios.ts](../src/scenarios.ts). Select a named map with
`--scenario` in the replay CLI. The terminal demo uses `easy`.

## Random obstacle fields

`generateWorld(config)` in [generation.ts](../src/generation.ts) accepts the
following configuration.

| Field | Meaning |
|---|---|
| `width`, `height` | Positive integer dimensions with at least two cells total. |
| `worldSeed` | Integer seed for world generation. |
| `obstacleDensity` | Value in [0,1], applied to non-endpoint cells. |
| `reachability` | `reachable` or `unreachable`. |
| `minimumPathDistance` | Optional non-negative BFS distance requirement for reachable maps. |
| `maxAttempts` | Positive integer attempt limit, default 1,000. |

Robot and target are distinct, with no overlapping obstacle. The generator
uses seeded sampling and accepts only maps meeting the requested constraints.
It throws when bounded attempts are exhausted. Dense reachable maps or high
minimum-distance constraints can therefore fail. `generateWorldWithMetadata`
also returns generation attempts and shortest-path length.

```sh
npm run generate
```

This command renders three sample configurations. Experiments 004 and 005 use
the shared [experiment configuration](../src/experiment-004-config.ts). Their
minimum path distance is `max(5, floor((width + height) / 3))`.

## Single-doorway barrier

`generateBarrierWorld` in [structural-generation.ts](../src/structural-generation.ts)
accepts integer `width >= 3`, `height >= 2`, a safe integer `worldSeed`,
`variant` (`doorway` or `sealed`), and optional `doorRow`.

The wall occupies column `floor(width / 2)` across the complete height. A
doorway variant leaves exactly one gap at the configured zero-based row or a
seed-derived row. The sealed variant rejects an explicit door row. Start is
`(0,0)` and target is `(width - 1,0)`. All cells away from the wall are free.

Returned metadata includes wall column, door row, oracle shortest-path length,
Manhattan distance, and detour ratio (`shortestPathLength / manhattanDistance`).
Sealed maps have null shortest-path length and detour ratio. Fixed dimensions
and endpoints restrict layout variation to the doorway row.

The 9×15 example with seed 42 and door row 14 has oracle distance 36,
Manhattan distance 8, and detour ratio 4.5. Coordinate PlanningAgent takes 78
actions and information-gain takes 64. The sealed coordinate run reports
`target-unreachable` after 59 moves. Each run has zero rejected moves. The
[doorway analysis](doorway-failure-analysis.md) explains the observed retreat.

## Perfect maze

`generateMazeWorld` in [maze-generation.ts](../src/maze-generation.ts) accepts
odd integer dimensions of at least 5 and a safe integer `worldSeed`. Iterative
randomized DFS starts at `(1,1)` and connects unvisited odd-coordinate cells by
carving intervening walls. The traversable graph is a connected tree, and the
boundary remains solid.

Robot start is `(1,1)`. Environment-side BFS chooses the farthest traversable
target, breaking distance ties by smallest row then smallest column. Returned
metadata contains the oracle shortest-path length. DFS favours winding
corridors and introduces generator bias. Memory use scales with grid area.

| Size | Seed | Oracle distance | Information-gain actions |
|---|---|---|---|
| 15×15 | 5001 | 78 | 84 |
| 21×21 | 5002 | 146 | 200 |

Both example runs reach the goal with zero rejected moves.

## U-shaped trap

`generateTrapWorld` in [trap-generation.ts](../src/trap-generation.ts) accepts
integer dimensions of at least 6, a safe integer `worldSeed`, and optional
geometry overrides.

| Field | Meaning |
|---|---|
| `opening` | `up`, `right`, `down`, or `left`. |
| `depth` | At least 4 cells, including the back wall and entrance row. |
| `span` | At least 3 cells, including both arms. |
| `origin` | Top-left coordinate of the rotated barrier rectangle. |

The seed selects omitted geometry. Validation requires a free exterior margin
of at least one cell on every side. The barrier consists of a back wall and
two arms with an open entrance between their tips. Start is one cell behind
the middle of the closed wall and target is one cell inside it, giving
Manhattan distance 2. Every other cell is free. Returned metadata contains
geometry, oracle shortest-path length, Manhattan distance, and detour ratio.
These are controlled detour tasks with fixed endpoint placement.

| Size / seed | Opening | Depth / span | Origin | Manhattan | Oracle | Detour ratio | Coordinate actions | Information-gain actions |
|---|---|---|---|---|---|---|---|---|
| 15×15 / 6001 | down | 4 / 7 | (5,1) | 2 | 16 | 8 | 40 | 16 |
| 21×21 / 6002 | right | 17 / 13 | (1,7) | 2 | 48 | 24 | 146 | 48 |

All four runs reach the goal with zero rejected moves. Geometry overrides are
available through the TypeScript API. The current replay CLI uses seed-derived
trap geometry.

The [replay guide](replays.md) preserves exact commands for these examples.
