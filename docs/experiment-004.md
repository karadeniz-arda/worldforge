# Experiment 004 — Memory Under Scale

## Research question

How do map size, obstacle density, and action budget affect `MemoryRandomAgent` performance on previously unseen procedural environments?

## Methodology

The experiment generated 100 deterministic reachable worlds for each of six configurations: square sizes 10×10, 20×20, and 50×50 at obstacle densities 0.15 and 0.25. Each configuration used world seeds 30,000 through 30,099, a bounded 1,000 generation attempts per seed, and a minimum BFS shortest-path distance of `max(5, floor((width + height) / 3))`: 6, 13, and 33 actions for the three square sizes. This is one third of the sum of dimensions, not one third of the perimeter.

For each accepted world, `RandomAgent`, `ValidRandomAgent`, and `MemoryRandomAgent` each received 10 independently seeded trials at budgets of 100, 500, and 1,000 actions. Agent seed derivation uses the world seed and trial index, separate from world generation. The same generated worlds are reused across budgets and agents. Agents receive normal local observations only; BFS is used only during generation and analysis.

This run created all 600 requested worlds with zero generation failures. It completed in approximately 13 seconds in the local environment. The machine-readable [results record](../results/experiment-004.json) contains the configuration, map seeds, generation attempts, shortest-path lengths, failures, and aggregates.

## Results

Success counts are out of 1,000 trials per agent/configuration/budget. Each count has a Wilson 95% confidence interval in the CLI and JSON record.

| Map | Density | 100 actions: Random / Valid / Memory | 500 actions: Random / Valid / Memory | 1,000 actions: Random / Valid / Memory |
|---|---:|---:|---:|---:|
| 10×10 | 0.15 | 190 / 260 / 687 | 712 / 798 / 976 | 901 / 944 / 993 |
| 10×10 | 0.25 | 151 / 258 / 635 | 619 / 756 / 962 | 815 / 906 / 992 |
| 20×20 | 0.15 | 9 / 22 / 153 | 157 / 223 / 681 | 334 / 432 / 852 |
| 20×20 | 0.25 | 2 / 11 / 157 | 122 / 203 / 579 | 257 / 391 / 762 |
| 50×50 | 0.15 | 0 / 0 / 1 | 3 / 5 / 118 | 11 / 32 / 248 |
| 50×50 | 0.25 | 0 / 0 / 1 | 0 / 1 / 73 | 7 / 16 / 173 |

Mean generated shortest-path lengths were 8.6 and 9.5 for 10×10 maps, 18.3 and 19.4 for 20×20 maps, and 48.2 and 48.9 for 50×50 maps at densities 0.15 and 0.25 respectively.

MemoryRandomAgent had lower revisit/backtrack behavior than ValidRandomAgent at every configuration. For example, on 20×20 density 0.25 at 1,000 actions, ValidRandomAgent averaged 692.6 repeated visits and 280.8 immediate backtracks, while MemoryRandomAgent averaged 339.1 and 130.3. On 50×50 density 0.25 at 1,000 actions, the corresponding values were 815.3 / 336.1 versus 478.2 / 186.0.

## Interpretation

Increasing budget improves all agents, but map scale changes the problem sharply. On 10×10 maps, MemoryRandomAgent reached at least 96.2% success at 500 actions and at least 99.2% at 1,000. On 20×20 maps it reached 57.9%–68.1% at 500 and 76.2%–85.2% at 1,000. On 50×50 maps, even 1,000 actions reached only 17.3%–24.8%.

The shortest paths are much smaller than successful random-walk trajectories. For instance, on 50×50 density 0.15, MemoryRandomAgent needed a mean 538.0 successful-task steps at the 1,000-action budget versus a mean shortest path of 48.2. Their ratio is 11.16. The reported efficiency metric is instead 11.83 because it is calculated as the mean of each successful trial's individual `stepsTaken / shortestPathLength` ratio; these quantities need not be equal when path lengths and outcomes vary. Memory helps exploration but does not make behavior path-efficient.

This is descriptive evidence within these generator-conditioned, reachable maps. It does not establish that the generator represents arbitrary random environments, nor does it isolate all effects of early termination and changing episode length. The 95% Wilson intervals treat the 1,000 trials as Bernoulli observations, but those trials are clustered as 10 agent runs within each of 100 generated maps. They quantify conditional agent-run uncertainty for this fixed map collection and seed schedule; they do not quantify variation across unseen generated worlds or provide an independent-world generalization claim.

## Limitations

- Worlds are conditioned to be reachable and to meet a minimum path distance; they are not an unbiased draw from every possible obstacle field.
- The fixed budget increasingly disadvantages large maps.
- Trial-level Wilson intervals do not account for within-map clustering; a future per-world or hierarchical analysis is needed for uncertainty about new worlds.
- Only local random policies are compared; no agent has a map, target-aware search, loop detection, or pathfinding.
- The reported shortest path is a generation/analysis metric and is never exposed to agents.

## Suggested next experiment

Repeat the design with controlled difficulty strata based on shortest-path length and corridor structure, then compare budget-scaled success curves while retaining identical generated worlds and per-world agent seeds.
