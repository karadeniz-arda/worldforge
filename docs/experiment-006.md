# Experiment 006 — Evaluation across navigation structures

## Scope and frozen method

Experiment 006 compares coordinate, information-gain, and seeded-random
PlanningAgent frontier selection with OptimisticBFSAgent. The research questions
concern route efficiency, the effect of frontier ties, structure-dependent
performance, and correct unreachable detection.

The [protocol](experiment-006-protocol.md) and
[configuration](../src/experiment-006-config.ts) were frozen before held-out
world generation or outcome inspection. The agent and generator source version
is commit `38bd1b31b9081ab732666d2308d070581933d0b8`. No policies or generators
changed during this experiment. This is a local prospective protocol with
recorded content hashes, without an external preregistration registry or a new
evaluation commit. The canonical artifact records these frozen hashes:

- Configuration SHA-256 `1a36b45ab581e634cf7cb89bf17502f69b1c12af365b6ff51b8842e90732529d`
- Protocol SHA-256 `baa6b9c74fe2cf4c78b4cdb2acdcdeabf8279aa23ed570cc85640183063d0ef0`

Evaluation infrastructure source hashes are also retained. The CLI checks
agent/generator dependencies against the stated commit before execution.

All agents receive the same public start, target, width, height, and complete
four-neighbour observations. Agent state persists within an episode and resets
between trials. Oracle BFS sees the full environment only for evaluation.
MemoryRandomAgent is excluded from this equivalent-information comparison.

### Cases and generation bias

| Stratum | Requested / generated cases | Distinct layouts | Mean / median oracle actions |
|---|---|---|---|
| Random obstacles 20×20, density 0.25 | 100 / 100 | 100 | 20.37 / 20 |
| Random obstacles 50×50, density 0.25 | 100 / 100 | 100 | 47.25 / 47 |
| Maze 15×15 | 100 / 100 | 100 | 74.32 / 76 |
| Maze 21×21 | 100 / 100 | 100 | 135.58 / 136 |
| Trap 15×15 | 100 / 100 | 97 | 26.28 / 28 |
| Trap 21×21 | 100 / 100 | 100 | 35.78 / 37 |
| Doorway 9×15 | 15 / 15 | 15 | 22 / 22 |
| Doorway 9×21 | 21 / 21 | 21 | 28 / 28 |
| Sealed 9×15 | 1 / 1 | 1 | N/A |
| Sealed 9×21 | 1 / 1 | 1 | N/A |

The six generated strata use world seeds 110000–110099. Random obstacle fields
are conditioned on reachability and minimum path distance 13 or 33, with at
most 1000 generation attempts. Mazes retain iterative DFS and farthest-target
selection. Traps retain seeded orientation, dimensions, placement, and the
near-back-wall endpoint rule. These are different task distributions.

Doorway rows are exhaustively enumerated, and each sealed geometry occurs once.
Their metadata seed is zero. They are finite geometry controls, including
previously inspected doorway rows and sealed layouts. The held-out designation
applies to generated-world seeds, while map-family design and these controls
were already informed by development work.

All 638 case configurations generated successfully and reproduced exactly on
regeneration. There are 635 distinct layouts. Three duplicate pairs occurred
within trap 15×15: seeds 110014/110065, 110038/110097, and 110049/110052.
As pre-specified, all case slots were retained, with no replacement. Confidence
intervals resample signature clusters. The unique-layout mean SPL sensitivity
check for this stratum gives coordinate 0.674, information gain 0.902, random
0.542, and optimistic 0.967, compared with slot-weighted 0.681, 0.905, 0.547,
and 0.967.

### Trials, budgets, and seed policy

Each case has one coordinate, one information-gain, five random, and one
optimistic trajectory. The full run contains **5104 maximum-budget simulations**
and **15312 derived budget outcomes**. The maximum budget is 1000 movement
attempts, with outcomes at 100, 500, and 1000 actions. Maximum-budget results
retain action/position steps temporarily; canonical JSON contains compact
outcomes, with no complete observation, replay, or diagnostic traces.

Random seeds derive from the tuple `(210000, stratum, worldSeedOrDoorRow,
replication)` using the frozen SHA-256/uint32 rule. All 3190 random trial seeds
are distinct. Every trial constructs fresh world copies, missions, agents, and
RNGs. Five random trials are summarized within each world before paired analysis.

A stop after k movements requires a decision opportunity beyond those k
movements. At budget k it remains `step-limit`; at budget k+1 it can become
`target-unreachable`. Goal arrival at action k is visible at budget k. Tests
compare derived prefixes against fresh simulations, including these boundaries.

## Metrics and statistical interpretation

- `actions` counts attempted movements. Successful movements plus rejected
  movements equal actions. Stops consume zero actions.
- `decisionOpportunities` counts movements plus stop decisions. No decision is
  requested for a world initially at its goal.
- Goal success is reaching the target. Outcomes also distinguish step limits,
  oracle-confirmed unreachable reports, and oracle-contradicted reports.
- SPL is `L / max(L, actions)` on a successful reachable episode, and zero
  for a failed reachable episode. Unreachable episodes have null SPL.
- Successful actions and steps/oracle ratio are conditional on reaching the
  goal. Missing successful routes produce null values, including medians.
- World-level route summaries first average successful random replications
  within each world. Their mean, median, p90, and maximum then describe those
  world values. Separate trial-level descriptive statistics preserve extreme
  individual random routes. Ratio means average individual ratios, rather than
  dividing mean actions by mean oracle length.
- Oracle-optimal counts count successful trajectories whose actions equal L.
- Repeated visits count successful moves into previously occupied cells.
  Immediate backtracks return to the position before the previous successful
  move; rejected actions preserve that comparison. Counts depend on episode
  duration and cannot alone establish a persistent cycle or better exploration.

Primary comparisons are paired world-level SPL differences. Random is each
world's five-run mean. Generated-stratum 95% intervals use 2000 seeded paired
signature-cluster bootstrap samples and linearly interpolated percentile
endpoints. The original seed-slot means remain the estimands when duplicates
occur. Doorways and sealed cases have no ordinary sampling CIs. Multiple
comparisons are unadjusted, so interpretation remains exploratory. There is no
pooled cross-family score.

## Primary results across budgets

Each cell gives mean world SPL followed by goal successes / trajectories.
Random counts are five trials per case; its inference still uses worlds.
All unresolved reachable episodes are step limits. Every policy succeeds on
every reachable case/replication by 500 actions.

| Stratum | Budget | Coordinate | Information gain | Random | Optimistic BFS |
|---|---|---|---|---|---|
| Random 20×20 | 100 | 0.697; 95/100 | 0.721; 98/100 | 0.687; 476/500 | 0.769; 100/100 |
| Random 20×20 | 500 | 0.708; 100/100 | 0.725; 100/100 | 0.697; 500/500 | 0.769; 100/100 |
| Random 20×20 | 1000 | 0.708; 100/100 | 0.725; 100/100 | 0.697; 500/500 | 0.769; 100/100 |
| Random 50×50 | 100 | 0.523; 75/100 | 0.642; 85/100 | 0.557; 398/500 | 0.651; 89/100 |
| Random 50×50 | 500 | 0.621; 100/100 | 0.707; 100/100 | 0.649; 500/500 | 0.714; 100/100 |
| Random 50×50 | 1000 | 0.621; 100/100 | 0.707; 100/100 | 0.649; 500/500 | 0.714; 100/100 |
| Maze 15×15 | 100 | 0.756; 84/100 | 0.758; 84/100 | 0.790; 433/500 | 1.000; 100/100 |
| Maze 15×15 | 500 | 0.860; 100/100 | 0.861; 100/100 | 0.875; 500/500 | 1.000; 100/100 |
| Maze 15×15 | 1000 | 0.860; 100/100 | 0.861; 100/100 | 0.875; 500/500 | 1.000; 100/100 |
| Maze 21×21 | 100 | 0.010; 1/100 | 0.010; 1/100 | 0.010; 5/500 | 0.010; 1/100 |
| Maze 21×21 | 500 | 0.861; 100/100 | 0.854; 100/100 | 0.859; 500/500 | 1.000; 100/100 |
| Maze 21×21 | 1000 | 0.861; 100/100 | 0.854; 100/100 | 0.859; 500/500 | 1.000; 100/100 |
| Trap 15×15 | 100 | 0.666; 91/100 | 0.900; 98/100 | 0.529; 457/500 | 0.967; 100/100 |
| Trap 15×15 | 500 | 0.681; 100/100 | 0.905; 100/100 | 0.547; 500/500 | 0.967; 100/100 |
| Trap 15×15 | 1000 | 0.681; 100/100 | 0.905; 100/100 | 0.547; 500/500 | 0.967; 100/100 |
| Trap 21×21 | 100 | 0.523; 65/100 | 0.862; 92/100 | 0.335; 277/500 | 0.970; 100/100 |
| Trap 21×21 | 500 | 0.603; 100/100 | 0.885; 100/100 | 0.453; 500/500 | 0.970; 100/100 |
| Trap 21×21 | 1000 | 0.603; 100/100 | 0.885; 100/100 | 0.453; 500/500 | 0.970; 100/100 |
| Doorway 9×15 | 100 | 0.602; 15/15 | 0.971; 15/15 | 0.733; 75/75 | 1.000; 15/15 |
| Doorway 9×15 | 500 | 0.602; 15/15 | 0.971; 15/15 | 0.733; 75/75 | 1.000; 15/15 |
| Doorway 9×15 | 1000 | 0.602; 15/15 | 0.971; 15/15 | 0.733; 75/75 | 1.000; 15/15 |
| Doorway 9×21 | 100 | 0.540; 20/21 | 0.978; 21/21 | 0.676; 105/105 | 1.000; 21/21 |
| Doorway 9×21 | 500 | 0.561; 21/21 | 0.978; 21/21 | 0.676; 105/105 | 1.000; 21/21 |
| Doorway 9×21 | 1000 | 0.561; 21/21 | 0.978; 21/21 | 0.676; 105/105 | 1.000; 21/21 |

### Paired SPL differences at 1000 actions

Positive values favour the first-named policy. Generated strata have 100 paired
case slots, with 97 signature clusters for trap 15×15 and 100 elsewhere.

| Stratum | Information gain − coordinate [95% CI] | Information gain − random [95% CI] | Optimistic − coordinate [95% CI] | Optimistic − information gain [95% CI] |
|---|---|---|---|---|
| Random 20×20 | 0.017 [-0.022, 0.056] | 0.028 [-0.014, 0.074] | 0.061 [0.008, 0.113] | 0.044 [-0.004, 0.095] |
| Random 50×50 | 0.085 [0.044, 0.129] | 0.058 [0.023, 0.091] | 0.093 [0.040, 0.143] | 0.007 [-0.026, 0.043] |
| Maze 15×15 | 0.002 [-0.001, 0.004] | -0.014 [-0.024, -0.004] | 0.140 [0.115, 0.167] | 0.139 [0.113, 0.165] |
| Maze 21×21 | -0.007 [-0.014, -0.001] | -0.005 [-0.012, 0.002] | 0.139 [0.117, 0.163] | 0.146 [0.124, 0.170] |
| Trap 15×15 | 0.224 [0.171, 0.277] | 0.357 [0.308, 0.408] | 0.286 [0.222, 0.351] | 0.062 [0.023, 0.105] |
| Trap 21×21 | 0.282 [0.222, 0.341] | 0.433 [0.377, 0.490] | 0.366 [0.301, 0.432] | 0.084 [0.042, 0.127] |
| Doorway 9×15 | 0.368 | 0.238 | 0.398 | 0.029 |
| Doorway 9×21 | 0.417 | 0.302 | 0.439 | 0.022 |

Doorway differences describe complete sets of 15 and 21 rows. Full paired
metrics, including random-minus-coordinate, success differences, conditional
action differences, stop differences, and all budgets are in the JSON.

Win/loss/tie counts below compare each first policy's world SPL with the second.

| Stratum | Information gain vs coordinate | Information gain vs random | Optimistic vs information gain |
|---|---|---|---|
| Random 20×20 | 39 / 29 / 32 | 55 / 43 / 2 | 44 / 38 / 18 |
| Random 50×50 | 60 / 30 / 10 | 70 / 30 / 0 | 53 / 43 / 4 |
| Maze 15×15 | 7 / 1 / 92 | 27 / 27 / 46 | 75 / 0 / 25 |
| Maze 21×21 | 10 / 10 / 80 | 26 / 34 / 40 | 88 / 0 / 12 |
| Trap 15×15 | 53 / 6 / 41 | 88 / 8 / 4 | 21 / 33 / 46 |
| Trap 21×21 | 63 / 4 / 33 | 87 / 9 / 4 | 25 / 35 / 40 |
| Doorway 9×15 | 13 / 0 / 2 | 12 / 1 / 2 | 1 / 0 / 14 |
| Doorway 9×21 | 19 / 0 / 2 | 19 / 0 / 2 | 1 / 0 / 20 |

## Conditional route and movement statistics

At 1000 actions every reachable trial succeeds. In the table, action statistics
and ratio statistics describe world-level values, with five-run means for
random. The optimal column counts trajectories, so its random denominator is
five times the world count. Repeat/backtrack columns are mean counts per world,
averaged over random replications first. Values are rounded for presentation.

| Stratum / policy | Mean / median actions | Ratio mean / median / p90 / max world value | Oracle-optimal trajectories | Mean repeats / backtracks |
|---|---|---|---|---|
| Random 20×20 coordinate | 36.59 / 27 | 1.770 / 1.304 / 3.506 / 7.083 | 19/100 | 2.91 / 1.20 |
| Random 20×20 information gain | 34.23 / 26 | 1.682 / 1.270 / 2.611 / 7.000 | 19/100 | 2.36 / 1.00 |
| Random 20×20 random | 36.83 / 29.4 | 1.765 / 1.507 / 2.709 / 6.233 | 72/500 | 3.44 / 1.37 |
| Random 20×20 optimistic | 28.59 / 24 | 1.385 / 1.238 / 1.915 / 3.250 | 11/100 | 2.14 / 1.17 |
| Random 50×50 coordinate | 87.23 / 76 | 1.876 / 1.639 / 2.607 / 7.053 | 3/100 | 5.68 / 2.56 |
| Random 50×50 information gain | 72.51 / 64 | 1.534 / 1.366 / 2.202 / 3.700 | 2/100 | 3.86 / 1.81 |
| Random 50×50 random | 79.13 / 78.1 | 1.680 / 1.605 / 2.173 / 3.450 | 6/500 | 5.36 / 2.45 |
| Random 50×50 optimistic | 69.19 / 68 | 1.457 / 1.424 / 1.892 / 2.400 | 3/100 | 4.83 / 2.75 |
| Maze 15×15 coordinate | 88.14 / 88 | 1.198 / 1.131 / 1.460 / 2.172 | 23/100 | 6.91 / 1.38 |
| Maze 15×15 information gain | 88.02 / 88 | 1.197 / 1.123 / 1.472 / 2.172 | 25/100 | 6.85 / 1.32 |
| Maze 15×15 random | 86.568 / 88 | 1.176 / 1.103 / 1.347 / 2.172 | 130/500 | 6.12 / 1.27 |
| Maze 15×15 optimistic | 74.32 / 76 | 1.000 / 1.000 / 1.000 / 1.000 | 100/100 | 0 / 0 |
| Maze 21×21 coordinate | 160.88 / 160 | 1.190 / 1.135 / 1.390 / 2.143 | 14/100 | 12.65 / 2.54 |
| Maze 21×21 information gain | 162.08 / 163 | 1.199 / 1.162 / 1.388 / 2.143 | 12/100 | 13.25 / 2.58 |
| Maze 21×21 random | 161.392 / 159.8 | 1.193 / 1.132 / 1.431 / 2.071 | 72/500 | 12.91 / 2.53 |
| Maze 21×21 optimistic | 135.58 / 136 | 1.000 / 1.000 / 1.000 / 1.000 | 100/100 | 0 / 0 |
| Trap 15×15 coordinate | 51.56 / 41 | 2.152 / 1.366 / 4.861 / 11.571 | 40/100 | 0.74 / 0.12 |
| Trap 15×15 information gain | 32.72 / 29 | 1.263 / 1.000 / 1.894 / 7.000 | 79/100 | 0.54 / 0.02 |
| Trap 15×15 random | 57.784 / 54.2 | 2.319 / 2.125 / 3.429 / 5.180 | 46/500 | 2.11 / 0.36 |
| Trap 15×15 optimistic | 27.14 / 28 | 1.037 / 1.000 / 1.100 / 1.167 | 57/100 | 0 / 0 |
| Trap 21×21 coordinate | 92.62 / 72 | 3.033 / 1.685 / 7.575 / 22.429 | 33/100 | 1.17 / 0.16 |
| Trap 21×21 information gain | 47.76 / 40 | 1.382 / 1.000 / 1.871 / 9.714 | 75/100 | 0.71 / 0.19 |
| Trap 21×21 random | 100.884 / 96.6 | 2.994 / 2.881 / 4.711 / 7.262 | 29/500 | 3.57 / 0.66 |
| Trap 21×21 optimistic | 36.72 / 37 | 1.033 / 1.000 / 1.083 / 1.167 | 53/100 | 0 / 0 |
| Doorway 9×15 coordinate | 41.60 / 40 | 1.761 / 1.900 / 2.104 / 2.167 | 2/15 | 0.20 / 0.07 |
| Doorway 9×15 information gain | 23.867 / 22 | 1.052 / 1.000 / 1.000 / 1.778 | 14/15 | 0.13 / 0 |
| Doorway 9×15 random | 33.413 / 34.4 | 1.425 / 1.564 / 1.696 / 1.711 | 15/75 | 0.73 / 0.51 |
| Doorway 9×15 optimistic | 22 / 22 | 1.000 / 1.000 / 1.000 / 1.000 | 15/15 | 0 / 0 |
| Doorway 9×21 coordinate | 56.571 / 58 | 1.881 / 2.000 / 2.200 / 2.250 | 2/21 | 0.14 / 0.05 |
| Doorway 9×21 information gain | 29.905 / 28 | 1.040 / 1.000 / 1.000 / 1.833 | 20/21 | 0.10 / 0 |
| Doorway 9×21 random | 46.533 / 44 | 1.550 / 1.600 / 1.836 / 1.874 | 14/105 | 1.52 / 0.89 |
| Doorway 9×21 optimistic | 28 / 28 | 1.000 / 1.000 / 1.000 / 1.000 | 21/21 | 0 / 0 |

### Random-control variation and extreme individual routes

The next table reports mean within-world ranges over five random replications,
followed by trial-level ratio statistics. The trial-level statistics are
descriptive and are never used as independent-map bootstrap samples.

| Stratum | Mean within-world SPL range | Mean within-world action range | Trial ratio median / p90 / maximum |
|---|---|---|---|
| Random 20×20 | 0.340 | 25.98 | 1.333 / 2.916 / 9.143 |
| Random 50×50 | 0.267 | 38.16 | 1.519 / 2.431 / 5.400 |
| Maze 15×15 | 0.056 | 5.66 | 1.100 / 1.459 / 2.172 |
| Maze 21×21 | 0.038 | 7.60 | 1.132 / 1.436 / 2.143 |
| Trap 15×15 | 0.370 | 45.04 | 2.000 / 4.101 / 7.600 |
| Trap 21×21 | 0.314 | 76.40 | 2.647 / 5.127 / 9.625 |
| Doorway 9×15 | 0.156 | 7.87 | 1.500 / 1.774 / 1.944 |
| Doorway 9×21 | 0.132 | 8.48 | 1.619 / 1.875 / 2.000 |

## Unreachable decisions and accounting

At every evaluated budget, each sealed run reports correct unreachable, with
zero step limits, false unreachable reports, or rejected moves. Random counts
are replications on the one geometry for each dimension.

| Sealed dimension | Policy | Correct reports | Actions before stop | Decision opportunities |
|---|---|---|---|---|
| 9×15 | Coordinate | 1/1 | 59 | 60 |
| 9×15 | Information gain | 1/1 | 45 | 46 |
| 9×15 | Random | 5/5 | mean 47.8, range 45–51 | mean 48.8 |
| 9×15 | Optimistic | 1/1 | 17 | 18 |
| 9×21 | Coordinate | 1/1 | 83 | 84 |
| 9×21 | Information gain | 1/1 | 63 | 64 |
| 9×21 | Random | 5/5 | mean 68.2, range 65–71 | mean 69.2 |
| 9×21 | Optimistic | 1/1 | 23 | 24 |

Each trajectory has one stop decision. SPL and route/oracle ratios are null for
sealed cases. Across the entire evaluation there are zero false unreachable
reports and zero rejected moves. Those categories remain explicit in per-trial
outcomes, aggregate counts, and anomaly lists.

## Hypotheses and interpretation

H1 is supported for the complete defined doorway sets. Optimistic BFS follows
oracle-length routes on every row and improves mean SPL by 0.398 and 0.439
over coordinate planning. These are finite-set results.

H2 has clearer support on random 50×50 than 20×20. The 50×50 SPL difference
is 0.085 with interval [0.044, 0.129], while the 20×20 difference is 0.017
with an interval spanning zero. This narrows the earlier development finding.

H3 depends strongly on structure. Information gain improves on random control
in 50×50 obstacle fields and both trap sizes. Its 20×20 interval spans zero.
In mazes, random control is competitive and has higher mean SPL than
information gain at both sizes. Maze 15×15's mean difference is -0.014 with
interval [-0.024, -0.004]. Information gain therefore supplies no consistent
advantage across every family.

H4 is reflected in both averages and paired worlds. Optimistic BFS's mean SPL
advantage over information gain is large in mazes, modest in traps, and small
or uncertain on the random fields. Frontier planning is competitive on many
individual random/trap worlds. In traps, optimistic BFS loses to information
gain on 33 and 35 worlds but wins on only 21 and 25, respectively; its larger
mean benefit comes from avoiding severe frontier detours. Frequency of wins
and average effect answer different questions.

H5 holds for both tested sealed dimensions. Optimistic BFS needs 17 and 23
movements versus coordinate's 59 and 83 and information gain's 45 and 63.
These two geometries support a specific behavioral comparison without a
population-level inference about all unreachable environments.

The exploratory oracle-optimality observation generalized to all sampled mazes
and all doorway rows. It did not generalize to random fields: optimistic BFS
is oracle-optimal on 11/100 and 3/100 worlds. On traps the corresponding counts
are 57/100 and 53/100. Zero repeat/backtrack counts in optimistic trap routes
coexist with ratios above one, demonstrating that a route can be inefficient
without revisiting cells.

## Worst cases and examples for later inspection

These examples were selected after looking at outcomes and are exploratory.
No planner was tuned to them.

- Random 20×20 seed 110003 has oracle 24. Coordinate uses 170 actions
  (ratio 7.083), while optimistic uses 78 (ratio 3.25, its worst random ratio).
- Random 50×50 seed 110004 favours information gain over optimistic, 84 versus
  124 actions, against oracle 66. Random 20×20 seed 110048 favours optimistic,
  30 versus 160 actions, against oracle 26.
- Trap 21×21 seed 110009 has oracle 14. Coordinate uses 314 actions (22.429×)
  and information gain uses 136 (9.714×). These are their largest observed
  trap ratios.
- Trap 15×15 seed 110002 favours information gain, 26 actions versus
  optimistic's 28, against oracle 26. Trap 21×21 seed 110064 reverses that
  comparison, 226 versus 26 actions, against oracle 26.
- Random 20×20 seed 110089, random replication 4 with agent seed 2595861483,
  uses 128 actions against oracle 14, ratio 9.143.

Short-budget failures are budget exhaustion rather than unreachable reports.
Maze 21×21 is especially budget-constrained at 100 actions: only one generated
world is completed by each deterministic policy. All policies complete every
reachable trial at 500 actions, so the 1000-action table isolates route
efficiency after success rates have saturated.

Replay commands for selected structural examples can be run after evaluation.
They remain post-selection diagnostics.

```sh
npm run replay -- --structural trap --width 15 --height 15 --world-seed 110002 --agent optimistic --steps 1000
npm run replay -- --structural trap --width 15 --height 15 --world-seed 110002 --agent planning --tie-break information-gain --steps 1000
npm run replay -- --structural trap --width 21 --height 21 --world-seed 110064 --agent planning --tie-break information-gain --steps 1000
```

The current replay CLI does not accept the random-obstacle configurations
directly. Their exact configurations, seeds, and signatures are in the result
artifact for programmatic regeneration.

## Validation, runtime, and limitations

Independent numeric-grid traversal validates random fields, analytical formulas
validate doorways and traps, sealed barriers are analytically unreachable, and
DFS connectivity/acyclicity plus unique tree paths validate mazes. Hand-calculated
ASCII cases validate reference calculations. These checks reduce common-mode
risk but cannot establish universal correctness of all software.

The development pilot ran twice with identical JSON SHA-256
`03ba18c4187d40a7d049ed2a9fd1e0ce3424fc7c794a4264425dda848e4630c3`.
It used five development cases and 40 trajectories, took about 0.04 seconds
inside the pipeline, and peaked below 91 MiB RSS. The full pipeline took
32.223 seconds and peaked at approximately 300.8 MiB RSS locally. These timings
exclude startup/version checks and are printed outside canonical JSON.
The full artifact is 8,480,553 bytes of compact JSON.

The sample covers fixed seeds from particular conditioned generators and
endpoint rules. Family selection was motivated by earlier observations, which
limits generalization beyond these structures. Maze target selection can
strongly shape which paths are exercised. Trap duplicates reduce independent
terrain diversity and are handled as clusters. Five random replications leave
uncertainty in each world's stochastic-policy estimate; the paired bootstrap
resamples worlds/signature clusters while keeping those five-run means fixed.
It does not fully model within-world RNG uncertainty. Multiple comparisons,
finite doorway sets, and the two sealed geometries further restrict inference.
The study assumes static accurate sensing and a single public reach-position
goal. It establishes neither algorithmic novelty nor universal optimality.

## Reproduction and verification

```sh
npm ci
npm run typecheck
npm test
npm run experiment:005
git diff --exit-code HEAD -- results/experiment-005.json
npm run experiment:006 -- --pilot
npm run experiment:006 -- --full
```

The mode must be explicit. Pilot output goes to
`results/experiment-006-pilot.json`; full output goes to
[experiment-006.json](../results/experiment-006.json). Canonical JSON includes
configurations, seed schedule, signatures, generation attempts, per-trial
budget outcomes, world means, aggregates, paired intervals, and anomaly lists.
It contains no nondeterministic timestamps or timings. Integrity failures write
a separate failure artifact. The frozen protocol remains unchanged.

Verification includes 290 passing tests across 28 files, typecheck, and
byte-identical regeneration of the committed Experiment 005 artifact. Tests
cover all 638 layout reproductions, independent oracle checks, budget boundaries,
information isolation, fresh seeded agents, random-control constraints,
world-level aggregation, pairing, empty groups, and pilot determinism.
