# Optimistic BFS v1

`OptimisticBFSAgent` receives public start, target, width, and height through
`AgentMission`. Terrain comes from local observations. It uses the shared
`KnownMap` and static observation consistency checks. Public target coordinates
leave target terrain unknown until an observation reveals it.

Each decision updates knowledge and computes one fresh BFS distance field from
the public target. Known-free and unknown cells are traversable in this graph.
Blocked cells and out-of-bounds positions are excluded. The agent chooses the
currently observed safe neighbour with minimum finite target distance, breaking
ties by right, down, left, up. Infinite robot distance produces the existing
`target-unreachable` stop decision. A finite distance without a safe neighbour
one step closer throws an invariant error. Calling `decide` at the target also
throws because goal termination belongs to the simulator.

## Reasoning under the static-world assumptions

Assume correct fixed dimensions and target, exact robot positions, static
obstacles, and complete accurate four-neighbour observations.

The optimistic graph contains every actually free cell and its connections.
Observed blocked cells correspond to actual obstacles, and unknown terrain is
temporarily included. Hence every actual route appears in the optimistic
graph. If the robot has infinite optimistic distance, an actual route cannot
exist, making the unreachable report sound.

For a finite positive distance d, a shortest optimistic path begins with a
neighbour at distance d - 1. After the current observation all in-bounds
neighbours have observed terrain. The path's first neighbour must therefore be
known free and currently observed safe. Selecting the minimum-distance safe
neighbour satisfies the distance-decrease invariant and avoids blind movement.

Newly observed obstacles remove vertices from the optimistic graph. Removing
vertices can increase distances or make them infinite. The next observation
therefore triggers a complete recomputation. Revealing free terrain confirms
vertices that were already included optimistically.

One BFS takes O(width × height) time and space on a four-neighbour grid.
Observation-map copying also takes O(width × height), while safe action
selection examines four neighbours. No path or distance cache is retained.

These arguments concern individual decisions and unreachable reports under the
stated assumptions. Partial terrain knowledge can send the robot along a route
that later proves blocked and requires backtracking. The complete physical
trajectory can exceed the oracle shortest path despite each decision following
the current optimistic distance field.

## Development comparison

The table records successful movements under a 2,000-action budget. Each
world/agent pair starts with a fresh generated world and agent instance. The
two frontier policies are the existing PlanningAgent policies. All runs have
zero rejected moves.

| World | Seed / doorway row | Oracle distance | Coordinate | Information-gain | Optimistic BFS | Termination for all three |
|---|---|---|---|---|---|---|
| Doorway 9×15 | 42 / 14 | 36 | 78 | 64 | 36 | goal-reached |
| Maze 15×15 | 5001 | 78 | 84 | 84 | 78 | goal-reached |
| Maze 21×21 | 5002 | 146 | 206 | 200 | 146 | goal-reached |
| Trap 15×15 | 6001 | 16 | 40 | 16 | 16 | goal-reached |
| Trap 21×21 | 6002 | 48 | 146 | 48 | 48 | goal-reached |
| Sealed barrier 9×15 | 42 | unreachable | 59 | 45 | 17 | target-unreachable |

This development sample contains five reachable cases on which optimistic BFS
matches oracle distance. Larger evaluation remains pending. These observations
provide empirical checks alongside the conditional reasoning above.
The subsequent [adversarial development search](navigation-controls.md) found
a 4×4 counterexample requiring eight optimistic actions versus six oracle
actions.

## Replay

```sh
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent optimistic --steps 2000
open replays/barrier-doorway-9x15-world-42-door-14-optimistic-42.html
```

`--agent optimistic` also works with named scenarios, mazes, traps, and sealed
barriers. It receives the public target display in the observation-only view.
Frontier diagnostics remain specific to PlanningAgent. Dedicated optimistic
distance-field diagnostics and browser playback verification are pending.
