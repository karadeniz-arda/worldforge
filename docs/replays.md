# Visual replay guide

Run commands from the repository root after `npm ci`. The CLI writes a
standalone HTML file into `replays/` and prints its filename, outcome, action
count, successful moves, and rejected moves. Open the HTML directly in a local
browser. The `open` commands below use macOS.

## CLI options

| Option | Accepted values and defaults |
|---|---|
| `--scenario` | A named scenario, default `easy`. |
| `--structural` | `doorway`, `sealed`, `maze`, or `trap`, used instead of `--scenario`. |
| `--agent` | `random` (default), `valid-random`, `memory`, `rule`, `planning`, or `optimistic`. |
| `--seed` | Integer agent-randomness seed, default 42. |
| `--steps` | Non-negative action limit, default 100. |
| `--tie-break` | Planning policy, `coordinate` (default), `information-gain`, or `random`. |
| `--width`, `--height` | Structural dimensions, each defaulting to 9. |
| `--world-seed` | Structural world seed, default 42. |
| `--door-row` | Optional zero-based doorway row, valid for `doorway` only. |

World and agent randomness have separate seed options. The `random` frontier
policy uses `--seed` (default 42). It samples only among candidates tied on
combined score and known-safe distance, in row-major candidate order. Each
genuine tie consumes one draw. Unique winners, target routes, stop decisions,
and diagnostic rendering consume zero draws. Each replay constructs a fresh
seeded RNG. PlanningAgent's random policy is reproducible for a fixed world,
policy, and agent seed. Its coordinate and information-gain policies are
deterministic for a fixed world. The filename retains the agent seed
for a consistent naming convention. Rerunning identical options overwrites the
same replay filename. Structural metadata is printed before the outcome.

## Reading the viewer

Play/pause, forward/backward stepping, a timeline, speed control, and visited
cell highlighting support trajectory inspection. Each action includes its
pre-action observation, before/after positions, and movement outcome. A stop
decision is a terminal event with its own diagnostics and consumes zero actions.

The true-world panel displays the static map. The observation-only panel
reconstructs terrain from recorded observations through the selected point.
RuleBasedAgent, PlanningAgent, and OptimisticBFSAgent receive the public target coordinate, which
the viewer may display before discovery. Other agents reveal the target
through observation.

PlanningAgent's diagnostics panel shows its actual historical internal map,
frontier candidates and scores, selected frontier, known-safe planned route,
policy, and decision reason. Stepping backward uses stored snapshots. This
panel is specific to PlanningAgent. Replay recording is opt-in, while normal
benchmark runs avoid these diagnostic allocations.

Browser playback and controls still need a manual verification pass. No
verified screenshot is included in the repository documentation.

## Movement metrics

Simulation traces also support benchmark movement analytics.

- `uniqueCellsVisited` includes the starting cell and every distinct occupied cell.
- `repeatedVisits` counts successful moves into previously occupied cells.
- `immediateBacktracks` counts successful moves returning to the position occupied
  immediately before the previous successful move. Rejected actions preserve
  that comparison.
- `repeatedVisitsPerSuccessfulMove` and `immediateBacktracksPerSuccessfulMove`
  normalize the corresponding counts. Zero successful moves produce `N/A`.

Repeated visits measure local movement patterns. Persistent cycles require
detecting a repeating sequence over time, which these counters do not establish.
Compare episode duration alongside raw exploration and revisit counts.

## Named scenarios

```sh
npm run replay -- --scenario detour --agent memory --seed 42 --steps 100
open replays/detour-memory-42.html

npm run replay -- --scenario detour --agent planning --tie-break coordinate --steps 100
npm run replay -- --scenario detour --agent planning --tie-break information-gain --steps 100
open replays/detour-planning-coordinate-42.html
open replays/detour-planning-information-gain-42.html

npm run replay -- --scenario unreachableMaze --agent planning --steps 100
open replays/unreachableMaze-planning-coordinate-42.html
```

## Doorway and sealed barrier

For the random control, specify an agent seed independently of the world seed.

```sh
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent planning --tie-break random --seed 42 --steps 2000
open replays/barrier-doorway-9x15-world-42-door-14-planning-random-42.html
```

```sh
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent planning --steps 2000
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent planning --tie-break information-gain --steps 2000
npm run replay -- --structural sealed --width 9 --height 15 --world-seed 42 --agent planning --steps 2000
open replays/barrier-doorway-9x15-world-42-door-14-planning-coordinate-42.html
open replays/barrier-doorway-9x15-world-42-door-14-planning-information-gain-42.html
open replays/barrier-sealed-9x15-world-42-door-none-planning-coordinate-42.html
```

## Perfect mazes

```sh
npm run replay -- --structural maze --width 15 --height 15 --world-seed 5001 --agent planning --tie-break information-gain --steps 2000
npm run replay -- --structural maze --width 21 --height 21 --world-seed 5002 --agent planning --tie-break information-gain --steps 2000
open replays/maze-15x15-world-5001-planning-information-gain-42.html
open replays/maze-21x21-world-5002-planning-information-gain-42.html
```

## U-shaped traps

```sh
npm run replay -- --structural trap --width 15 --height 15 --world-seed 6001 --agent planning --tie-break coordinate --steps 2000
npm run replay -- --structural trap --width 15 --height 15 --world-seed 6001 --agent planning --tie-break information-gain --steps 2000
npm run replay -- --structural trap --width 21 --height 21 --world-seed 6002 --agent planning --tie-break coordinate --steps 2000
npm run replay -- --structural trap --width 21 --height 21 --world-seed 6002 --agent planning --tie-break information-gain --steps 2000
open replays/trap-15x15-world-6001-planning-coordinate-42.html
open replays/trap-15x15-world-6001-planning-information-gain-42.html
open replays/trap-21x21-world-6002-planning-coordinate-42.html
open replays/trap-21x21-world-6002-planning-information-gain-42.html
```

Measured geometry and action counts for these seeds appear in the
[environment guide](environments.md).
