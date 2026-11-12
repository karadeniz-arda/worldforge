# Adversarial navigation and random tie-break control

## Bounded development search

The search considered a deterministic prefix of 4×4 obstacle masks, with start
(0,0) and target (3,3). The 14 other coordinates are enumerated in row-major
order. Bit i of the mask places an obstacle at the ith coordinate. The search
bound was masks 0 through 4095, with a 200-action budget per reachable map,
stopping at the first goal-reaching optimistic run longer than oracle BFS.
This prefix varies the first 12 obstacle bits. No held-out experiment seeds
were used.

Mask 18 was the first counterexample after 19 maps, of which 15 were reachable.

```text
R.#.
.#..
....
...T
```

Start is (0,0), target is (3,3), and obstacles are (2,0) and (1,1). Oracle
distance is 6. Optimistic BFS reaches the goal in 8 successful moves with zero
rejections, using right, left, down, down, right, right, right, down.

Before action 1 the discovered map is:

```text
R.??
.???
????
????
```

Both right (1,0) and down (0,1) have optimistic distance 5. The fixed direction
priority selects right. In the true world, remaining distances are 7 from
(1,0) and 5 from (0,1). Thus action 1 is the first unnecessary travel: one move
has been spent and the actual remaining distance increases from 6 to 7.
Obstacles (2,0) and (1,1) were both unknown when that decision was made.

At (1,0), action 2's observation reveals both obstacles. Its optimistic
distance rises from 5 to 7, and the only safe exit is left. The outward move
and forced return add two actions. An oracle route goes down, down, right,
right, right, down. The optimistic agent follows its specified policy with
correct observations and safe movements throughout.

The bounded search and exact fixture are reproducible through:

```sh
npm test -- test/navigation-controls.test.ts
```

The locally generated replay is `replays/optimistic-counterexample-mask-18.html`.
It can be opened on macOS with:

```sh
open replays/optimistic-counterexample-mask-18.html
```

The test fixture remains development-only. It was not added as a named scenario.

## Random frontier control

`PlanningAgent` accepts `tieBreakPolicy: "random"` together with an injected
`random` function returning values in [0,1). The CLI injects a fresh PRNG using
`--seed`, independently of structural `--world-seed`. API callers must supply
their own RNG for the random policy. Missing RNGs and invalid draws throw.

Selection first finds the minimum combined BFS-plus-Manhattan score and then
the minimum known-safe distance among candidates with that score. It enumerates
the tied-best set in row-major order and, if it contains k > 1 candidates,
selects index `floor(random() * k)`. Uniform RNG draws yield uniform selection.
No random comparator is used for sorting. The coordinate and information-gain
policies retain their existing selection and diagnostic behavior.

Exactly one RNG draw is consumed per multi-candidate tie. Unique winners,
empty frontier sets, known target routes, stops, and diagnostic snapshots
consume zero draws. A new agent and RNG must be constructed per independent
trial. Reproducibility depends on the world, policy, agent seed, PRNG, and
candidate ordering. Sharing an RNG between trials would couple their outcomes.

## Small development comparison

Each run uses a fresh world and agent, with a 2,000-action budget. Random
columns use the indicated agent seed. All runs reach the goal with zero
rejected moves. Values count successful actions.

| World | Coordinate | Information-gain | Random 42 | Random 43 | Random 44 |
|---|---|---|---|---|---|
| Named detour | 12 | 10 | 12 | 12 | 12 |
| Doorway 9×15, world seed 42, door row 14 | 78 | 64 | 66 | 60 | 62 |
| Trap 15×15, world seed 6001 | 40 | 16 | 18 | 24 | 22 |

These cases illustrate seed sensitivity. Three selected seeds and three
development maps provide no broad estimate of random-policy performance.
Experiment 006 remains pending.

```sh
npm run replay -- --scenario detour --agent planning --tie-break random --seed 42 --steps 2000
open replays/detour-planning-random-42.html
```

Tests verify tied-set membership, both score priorities, RNG validation,
diagnostics independence, fresh seeded determinism, and the existing policy
baselines. The counterexample replay was generated from the exact test fixture.
Manual browser playback verification remains pending.
