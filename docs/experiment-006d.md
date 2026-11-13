# Experiment 006-D — matched-target development pilot, version 2

This report supersedes the uncommitted version-1 protocol and development
pilot. Version 2 has identity `matched-root-targets-v2` and removes the previous
target mismatch from the starting-position comparisons. Historical Experiment
005/006 results retain their original bytes. Seeds 120000–120099 have not been
generated or evaluated. The [revised protocol](experiment-006d-protocol.md)
defines the pre-evaluation checkpoint. Full evaluation requires separate
authorization naming its published commit.

## Design and endpoint selection

Each maze supplies R, the DFS root (1,1), and F, the farthest traversable target
from R using independent evaluation BFS and row/column tie-breaking. Next,
seeded selection chooses a non-root room S distinct from F at root distance
>=4. A separate `matched-random-target` RNG namespace selects Q from rooms
distinct from R, S and F at true distance >=6 from both R and S. Exclusion of
Q=F is strict. Empty candidate sets produce explicit failures, without
relaxation or terrain regeneration. Candidate lists are row-major.

| Condition | Start | Target | Primary matched comparison |
|---|---|---|---|
| A | R | F, farthest from R | A−C holds terrain and F fixed |
| B | R | Q, shared random target | B−D holds terrain and Q fixed |
| C | S | Same F as A | Non-root / matched root-farthest target |
| D | Same S as C | Same Q as B | Non-root / matched random target |

F is never recomputed from S. D never resamples Q. Secondary comparisons B−A
and D−C hold start fixed and change between Q and F. Each pair is one matched
observation within a maze seed. The primary normalized metrics are SPL,
oracle-optimality and action/oracle ratio. Oracle lengths generally differ
between R and S, even with a fixed target.

The production OptimisticBFSAgent and simulator continue to choose and apply
all actions. A separate observer reconstructs map knowledge from the same
observations. Oracle paths and correctness annotations are computed afterward.
Neither terrain nor oracle directions enter the agent's public mission.

## Exact development endpoints

The pilot uses the four existing development mazes only. All four conditions
retain the same obstacle signature within each maze.

| Maze | R | S | F shared by A/C | Q shared by B/D |
|---|---|---|---|---|
| 15×15 seed 5001 | (1,1) | (3,13) | (3,1) | (9,3) |
| 15×15 seed 5002 | (1,1) | (9,11) | (13,7) | (7,13) |
| 21×21 seed 5001 | (1,1) | (5,13) | (7,11) | (1,17) |
| 21×21 seed 5002 | (1,1) | (5,15) | (17,15) | (11,13) |

There are four mazes and 16 trajectories, with two maze seeds per size.
This is development-only evidence. All 16 missions reached the goal within
1000 movements. There were zero selection/trajectory failures, rejected moves,
false-unreachable reports, diagnostic anomalies, duplicate terrains or
root-hypothesis challenges. No pilot confidence intervals are reported.

## Revised pilot results

Each route entry gives true oracle length / actual movements.

| Maze | A | B | C | D |
|---|---|---|---|---|
| 15×15 seed 5001 | 78 / 78 | 66 / 66 | 48 / 52 | 36 / 36 |
| 15×15 seed 5002 | 74 / 74 | 54 / 54 | 12 / 12 | 8 / 20 |
| 21×21 seed 5001 | 132 / 132 | 32 / 32 | 92 / 116 | 8 / 8 |
| 21×21 seed 5002 | 146 / 146 | 78 / 78 | 40 / 64 | 28 / 156 |

| Size / condition | Successful / evaluated | Oracle-optimal / evaluated | Wrong edges | Mean SPL | Mean action/oracle ratio | Repeats / backtracks |
|---|---|---|---|---|---|---|
| 15 A | 2/2 | 2/2 | 0 | 1.000000 | 1.000000 | 0 / 0 |
| 15 B | 2/2 | 2/2 | 0 | 1.000000 | 1.000000 | 0 / 0 |
| 15 C | 2/2 | 1/2 | 2 | 0.961538 | 1.041667 | 2 / 1 |
| 15 D | 2/2 | 1/2 | 6 | 0.700000 | 1.750000 | 6 / 1 |
| 21 A | 2/2 | 2/2 | 0 | 1.000000 | 1.000000 | 0 / 0 |
| 21 B | 2/2 | 2/2 | 0 | 1.000000 | 1.000000 | 0 / 0 |
| 21 C | 2/2 | 0/2 | 24 | 0.709052 | 1.430435 | 24 / 4 |
| 21 D | 2/2 | 1/2 | 64 | 0.589744 | 3.285714 | 66 / 4 |

Ratios are conditional on success and averaged per episode. With only two
episodes per cell, the median equals the mean for these pilot groups. Maximum
ratios are 1.083333, 2.5, 1.6 and 5.571429 for 15 C, 15 D, 21 C and 21 D,
respectively. Root groups have maximum ratio 1. All 96 wrong edges were later
crossed in reverse, with zero censored returns. Non-root runs have 98 repeated
visits and 10 immediate backtracks, which count different events.

Raw action comparisons can reverse the efficiency interpretation. For seed
5002 at 15×15, B takes 54 actions and D takes 20 to the same Q. Their oracle
lengths are 54 and 8. B is optimal while D's ratio is 2.5. The shorter raw
non-root trajectory supplies no evidence of better navigation efficiency.

### Optimistic-distance margins

Counts include the current target and map for each decision. The correct
neighbour is recomputed from the current position after any deviation.

| Size / condition | Positive / zero / negative / null margins | Minimum-distance ties | Forward-choice margins positive / zero / negative |
|---|---|---|---|
| 15 A | 150 / 0 / 0 / 2 | 0 | 11 / 0 / 0 |
| 15 B | 118 / 0 / 0 / 2 | 0 | 7 / 0 / 0 |
| 15 C | 54 / 8 / 1 / 1 | 8 | 5 / 3 / 0 |
| 15 D | 49 / 2 / 4 / 1 | 2 | 6 / 1 / 1 |
| 21 A | 276 / 0 / 0 / 2 | 0 | 14 / 0 / 0 |
| 21 B | 108 / 0 / 0 / 2 | 0 | 3 / 0 / 0 |
| 21 C | 148 / 5 / 24 / 3 | 7 | 12 / 0 / 7 |
| 21 D | 95 / 1 / 64 / 4 | 2 | 9 / 1 / 9 |

All 35 revised root-start genuine forward choices have positive margins. The
previous version's 43 choices came from different endpoint rules and its pilot
has been superseded. The revised non-root groups contain 93 negative and 16
zero margins. Their 19 minimum-distance ties also include ties between
incorrect alternatives when the correct neighbour has a larger distance.

## Mathematical audit of +2

The real traversable graph is a tree. A correct neighbour is one movement
closer to T, and a wrong neighbour is one farther away, giving a real-distance
difference of exactly two.

Every optimistic graph is a subgraph of a four-neighbour rectangular grid.
Checkerboard colouring is therefore a bipartition even while unknown cells
are traversable. All neighbours of the current vertex have the same colour,
so their finite target distances differ by an even integer. The two-edge walk
through the current free cell also bounds their distance difference by two.
Defined comparisons between safe immediate neighbours can therefore have only
-2, 0 or +2. A strictly preferred correct neighbour automatically has margin
+2. Larger positive margins would violate these assumptions and are flagged.

Thus the numerical value +2 adds no DFS-specific restriction once strict
preference is known. The empirical question is whether ties and wrong ordering
are absent at DFS-root forward choices. The
[theory note](maze-dfs-root-conjecture.md) records the proof and scope of the
parity/bound argument. It also preserves the missing DFS-specific lemma, which
must show that sensed walls prevent incorrect optimistic alternatives from
tying or beating the correct continuation. No proof of the root conjecture
has been completed.

## Matched paired outcomes

Each mean difference has two paired maze seeds per size. Positive SPL and
optimality differences favour the root. Negative ratio differences favour the
root. Margin means first summarize applicable decisions within each episode,
then form paired maze differences. No decision is treated as an independent
terrain observation. Complete per-maze values are retained in JSON.

| Size / pair | SPL difference | Optimality indicator difference | Ratio difference | Wrong-edge difference | Repeat difference | Backtrack difference |
|---|---|---|---|---|---|---|
| 15 A−C | +0.038462 | +0.5 | -0.041667 | -1 | -1 | -0.5 |
| 15 B−D | +0.300000 | +0.5 | -0.750000 | -3 | -3 | -0.5 |
| 21 A−C | +0.290948 | +1 | -0.430435 | -12 | -12 | -2 |
| 21 B−D | +0.410256 | +0.5 | -2.285714 | -32 | -33 | -2 |

| Size / pair | Mean-margin difference | Mean forward-choice margin difference | Negative-margin fraction difference |
|---|---|---|---|
| 15 A−C | +0.259804 | +0.733333 | -0.009804 |
| 15 B−D | +0.526316 | +0.600000 | -0.105263 |
| 21 A−C | +0.639271 | +1.466667 | -0.148948 |
| 21 B−D | +0.967105 | +2.000000 | -0.210526 |

The secondary B−A SPL differences are zero for both sizes. D−C differences
are -0.261538 and -0.119308 for 15×15 and 21×21. These compare Q with
root-farthest F at the same S, without asserting that F is farthest from S.

## Verification, provenance and limitations

Typecheck and all 321 tests across 29 files pass, including 31 diagnostic tests.
Tests assert matched endpoints, thresholds, separate seed streams, unchanged
terrain, safe production/diagnostic trace equivalence, parity bounds, prior
counterexamples and historical integrity. Tests generate only development
mazes and hand fixtures for this diagnostic experiment. Existing M4 tests use
their historical seed schedule. New 120000–120099 terrain is never generated.

The final-audit CLI pilot ran twice with identical SHA-256:

```text
24276a9f8bd9eef69fcaa5f1f54f8ee53348802bedcec77c92d3d23b6e57f2ac
```

The final artifact is 2,193,309 bytes. Both pipeline runs took 0.062 seconds,
with peak RSS approximately 106.9 and 92.9 MiB. Timings exclude provenance and
startup and remain outside canonical JSON. The revised pilot artifact replaces
the former uncommitted development artifact. Frozen configuration and protocol
hashes are refreshed in `experiment-006d-freeze.ts`. Production agent/generator
files and historical Experiment 005/006 artifacts pass byte checks.

The final audit confirmed the earlier pilot's SHA-256
`c63972fa044b6e9b96a8cd5ce547211fb46c632f3649e010ec5f2627686f3a08`
before making a targeted provenance correction. Previously only six diagnostic
source hashes were recorded, and the baseline list omitted `statistics.ts`,
`structural-generation.ts` and `trap-generation.ts`, imported transitively by
reused helpers. The manifest now covers all 29 local source files. All 23
production dependencies are compared with M4, and all 29 are checked against
the approved commit at full startup. TypeScript configuration is also checked
against that commit. Three added tests verify closure coverage, synthetic
published-checkpoint acceptance and rejection of altered dependencies.
The CLI shares its read-only input/checkpoint validation with independent
audits, allowing startup checks without generating worlds. Comparing JSON
before and after the correction confirms that only `frozenHashes` and
`evaluationSourceHashes` changed within provenance. Every experimental payload
field is identical, including endpoints, actions, margins and paired results.

The checkpoint gate passes tests for a clean approved committed implementation
and rejects changed hashes, dirty source, absent approval, and missing upstream
ancestry. Inspection found no issue making a future clean checkpoint impossible.
Full execution still requires separate human authorization after publication.
Local upstream metadata is the gate's evidence of a push, so the human must
verify the remote state. Pilot Git provenance excludes its own declared output
for reproducibility and records the remaining uncommitted M5 changes.

The design fixes target identity in the primary comparisons. Moving the start
still changes oracle length, local geometry, initial observations and heading
to the target. Oracle normalization addresses path length, with further
structural difficulty differences remaining. S and Q are conditionally sampled
under distance and exclusion rules. One S/Q sample per maze and two development
seeds per size limit inference. The original DFS-root optimality conjecture
remains unproved, and the paired full experiment remains unevaluated.

## Checkpoint review

The files revised in this refinement are:

| File | Revision |
|---|---|
| `src/experiment-006d-config.ts` | Version 2 identity, precise labels and contrasts, strict Q≠F rule |
| `src/experiment-006d-worlds.ts` | Ordered F/S/Q selection and shared endpoints with failure diagnostics |
| `src/experiment-006d.ts` | Endpoint validation, normalized pairs, backtracks, margin summaries and consistency checks |
| `src/experiment-006d-cli.ts` | Revised condition labels in console output |
| `src/experiment-006d-freeze.ts` | Updated configuration and protocol hashes |
| `test/experiment-006d.test.ts` | Matched conditions, independence, parity and checkpoint regression coverage |
| `docs/experiment-006d-protocol.md` | Revised prospective matched-target design |
| `docs/maze-dfs-root-conjecture.md` | Parity, two-edge bound and interpretation of strict ordering |
| `docs/experiment-006d.md` | This superseding development report |
| `results/experiment-006d-pilot.json` | Revised deterministic evidence |

The existing observer module and package script remain part of the complete M5
checkpoint. Review and commit/push all M5 implementation, protocol, freeze
hashes, tests, theory/report documents and the revised pilot artifact. The
future schedule is still 200 mazes and 800 missions at 1000 movements.

```sh
npm run experiment:006d -- --pilot
```

After a human-approved committed and pushed checkpoint, the future full command
will be the following, with the actual approved SHA substituted. It was not
executed during this refinement.

```sh
WORLDFORGE_006D_APPROVED_COMMIT='REPLACE_WITH_APPROVED_CHECKPOINT_SHA' npm run experiment:006d -- --full
```
