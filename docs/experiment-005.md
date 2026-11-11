# Experiment 005 — Planning Under Partial Information

## Research questions

1. How does target-aware local-map planning compare with `MemoryRandomAgent` on the reachable procedural worlds from Experiment 004?
2. When the primary frontier score and known-safe distance tie, does the conservative `information-gain` tie-break improve on stable coordinate ordering?

## Method

Experiment 005 regenerated the exact six Experiment 004 map configurations: 10×10, 20×20, and 50×50 at obstacle densities 0.15 and 0.25; 100 seeds (`30000`–`30099`) per configuration; and budgets of 100, 500, and 1,000 actions. The canonical configuration is shared in `src/experiment-004-config.ts`.

Generation metadata—map configuration, seed, generation attempt count, and BFS shortest-path length—was compared with `results/experiment-004.json`. All 600 regenerated maps matched, with zero generation failures.

`MemoryRandomAgent` uses the same 10 deterministic seeds per world as Experiment 004. One 1,000-action trajectory was run for each seed and lower-budget values were derived from its prefixes, rather than rerunning independent 100- and 500-action trajectories. Its success counts were validated against Experiment 004. The additional revealed-cell, SPL, and median metrics require these traces, which are absent from the Experiment 004 aggregate artifact.

Each deterministic PlanningAgent policy ran once per world to 1,000 actions, for 1,200 planning simulations total. First goal-reach time supplied the 100-, 500-, and 1,000-action outcomes. In total, this experiment ran 7,200 actual maximum-budget simulations—6,000 MemoryRandom and 1,200 planning—and derived 21,600 budget-level outcomes.

Planning received only `AgentMission` (start, target, dimensions) and local observations. The generator's BFS distance is an analysis-only oracle reference, not agent input.

The policies were:

- `coordinate`: combined frontier score, known-safe distance, then stable coordinates.
- `information-gain`: combined frontier score, known-safe distance, unknown-neighbor count, then stable coordinates.

Thus information gain cannot select a farther frontier when the score already ties but safe travel distance differs.

SPL is the mean of `shortestPathLength / max(shortestPathLength, stepsTaken)` for successful runs and zero for failures. Path efficiency is the inverse ratio, `stepsTaken / shortestPathLength`, reported only for successes. Revealed-cell count is the number of distinct in-bounds cells exposed by local observations (plus the known start).

## Results

The table shows the 1,000-action budget. Memory counts are out of 1,000 seeded trials; planning counts are out of 100 generated worlds.

| Map | Density | Memory success / SPL | Coordinate success / SPL | Information-gain success / SPL |
|---|---:|---:|---:|---:|
| 10×10 | 0.15 | 993/1000 / 0.209 | 100/100 / 0.860 | 100/100 / 0.903 |
| 10×10 | 0.25 | 992/1000 / 0.222 | 100/100 / 0.810 | 100/100 / 0.837 |
| 20×20 | 0.15 | 852/1000 / 0.101 | 100/100 / 0.846 | 100/100 / 0.888 |
| 20×20 | 0.25 | 762/1000 / 0.098 | 100/100 / 0.739 | 100/100 / 0.782 |
| 50×50 | 0.15 | 248/1000 / 0.028 | 100/100 / 0.818 | 100/100 / 0.873 |
| 50×50 | 0.25 | 173/1000 / 0.018 | 100/100 / 0.624 | 100/100 / 0.714 |

Planning reached every generated world by 1,000 actions. In contrast, MemoryRandom success fell sharply with size: 24.8% and 17.3% at the two 50×50 densities. Planning also used far fewer revealed cells: at 50×50 density 0.15, mean revealed cells were 889.8 for MemoryRandom, 157.3 for coordinate planning, and 154.7 for information-gain planning. These are descriptive comparisons: the policies terminate at different times, so more revealed cells are not automatically better exploration.

Information gain had its clearest benefit on large maps. At 50×50 density 0.25 and 1,000 actions, coordinate planning averaged 89.5 successful steps and SPL 0.624; information gain averaged 73.4 steps and SPL 0.714. The paired mean step difference (information-gain minus coordinate) was -16.08 actions, with seeded paired-bootstrap interval [-22.68, -9.92].

At 1,000 actions, information-gain / coordinate / tie counts over 100 paired worlds for successful-step comparisons were 18 / 8 / 74 (10×10, 0.15), 25 / 10 / 65 (10×10, 0.25), 35 / 17 / 48 (20×20, 0.15), 38 / 26 / 36 (20×20, 0.25), 52 / 25 / 23 (50×50, 0.15), and 61 / 34 / 5 (50×50, 0.25). At 1,000 actions both planning policies had the same success outcome on every world; their difference was route efficiency, not completion.

At the 100-action budget, information gain improved planning success by 3 worlds on 20×20 density 0.25, 4 worlds on 50×50 density 0.15, and 15 worlds on 50×50 density 0.25. The corresponding paired bootstrap intervals for success-rate differences were [-0.01, 0.08], [0.01, 0.08], and [0.07, 0.24].

Mean generated shortest paths were unchanged from Experiment 004: 8.6/9.5 for 10×10, 18.3/19.4 for 20×20, and 48.2/48.9 for 50×50 at densities 0.15/0.25.

## Pilot seeds

The earlier five-world exploratory sample used 10×10, density 0.20, reachable maps with minimum path 10, a 200-action budget, and seeds 4101–4105. It is retained as a pilot, not evidence for broad claims.

| Seed | Coordinate actions | Information-gain actions | BFS shortest |
|---:|---:|---:|---:|
| 4101 | 31 | 13 | 13 |
| 4102 | 19 | 13 | 11 |
| 4103 | 11 | 29 | 11 |
| 4104 | 11 | 13 | 11 |
| 4105 | 31 | 29 | 11 |

The pilot deliberately illustrates both directions: information gain helps on 4101 and 4102, but harms on 4103. The larger paired experiment is the appropriate basis for the limited conclusions above.

## Statistical interpretation and limitations

MemoryRandom Wilson intervals are trial-level intervals over 1,000 seeded runs, but those runs are clustered as 10 runs within each of 100 worlds. They quantify conditional trial uncertainty for this fixed world collection and seed schedule, not independent-world generalization.

Planning policies are deterministic given a generated world, so their paired comparisons use 100 generated worlds as analysis units. The displayed 95% paired bootstrap intervals resample those worlds with a fixed seed. They describe variation across this particular generator-conditioned sample; they do not prove universal superiority on arbitrary environments.

Other limitations:

- Reachability and minimum-distance conditioning mean these are not arbitrary random obstacle fields.
- The full target coordinate and dimensions are public planning information; MemoryRandom does not use this information.
- Oracle BFS is used only for generation and evaluation, never by PlanningAgent.
- Revealed-cell differences can arise from different route duration and termination time, so they are not direct evidence of better information gathering.
- This experiment evaluates only the two fixed tie-break policies; it does not justify changing the primary score or adding optimistic planning.

## Reproduction

```sh
npm run experiment:005
```

The command writes [experiment-005.json](../results/experiment-005.json), including regenerated metadata, all aggregate metrics, first reach times for 1,200 planning runs, 1,800 paired per-world budget outcomes, and paired comparisons.
