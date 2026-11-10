# Experiment 003 — MemoryRandomAgent Validation

## Research question

Does `MemoryRandomAgent` consistently outperform `ValidRandomAgent`, or did the earlier 50-trial results depend on a small sample of maps and seeds?

## Hypotheses

1. Filtering observed-invalid moves improves task success over unrestricted random actions.
2. Preferring locally unvisited positions improves task success and reduces revisits/backtracks over valid-only random walking.
3. Neither policy can solve an intentionally unreachable target.

## Methodology

`npm run benchmark:validate` ran seven ASCII scenarios with a 100-action budget. `RandomAgent`, `ValidRandomAgent`, and `MemoryRandomAgent` each received 1,000 fresh-world, fresh-agent trials per scenario. Each stochastic agent used the same deterministic seed sequence (`10,000` through `10,999`) for a controlled comparison. `RuleBasedAgent` ran one deterministic trial per scenario.

Success intervals are two-sided 95% Wilson score intervals. Mean successful-task steps excludes failed trials; movement metrics include all trials. Normalized repeat/backtrack rates are `N/A` when there are no successful moves.

The original scenarios remain unchanged. Added adversarial scenarios are all reachable:

- `deadEnd`: a long tempting branch; tests recovery after extensive backtracking.
- `loops`: multiple corridors and cycles; tests whether visit avoidance prevents local oscillation.
- `returnRoute`: a tempting top branch with the target reachable via the lower route; tests recovery after an exploratory wrong turn. In this undirected grid model, a reachable target always has a simple path, so it does not mathematically require revisiting a cell; the required revisit is contingent on taking the deceptive branch first.

## Results

Validation results for stochastic agents (successes / 1,000, 95% Wilson interval):

| Scenario | RandomAgent | ValidRandomAgent | MemoryRandomAgent |
|---|---:|---:|---:|
| easy | 577 (54.6%–60.7%) | 733 (70.5%–75.9%) | 992 (98.4%–99.6%) |
| corridor | 409 (37.9%–44.0%) | 795 (76.9%–81.9%) | 1,000 (99.6%–100.0%) |
| detour | 297 (26.9%–32.6%) | 466 (43.5%–49.7%) | 924 (90.6%–93.9%) |
| unreachable | 0 (0.0%–0.4%) | 0 (0.0%–0.4%) | 0 (0.0%–0.4%) |
| deadEnd | 125 (10.6%–14.7%) | 289 (26.2%–31.8%) | 916 (89.7%–93.2%) |
| loops | 274 (24.7%–30.2%) | 525 (49.4%–55.6%) | 1,000 (99.6%–100.0%) |
| returnRoute | 207 (18.3%–23.3%) | 430 (40.0%–46.1%) | 989 (98.0%–99.4%) |

The memory policy also reduced movement waste. Examples: on `loops`, ValidRandomAgent averaged 62.9 repeated visits and 37.1 immediate backtracks per trial, versus 0.0 and 0.0 for MemoryRandomAgent. On `deadEnd`, the corresponding values were 76.4 and 44.8 versus 22.1 and 12.9. MemoryRandomAgent’s successful-task mean steps were 21.5 (`easy`), 11.1 (`corridor`), 29.4 (`detour`), 30.3 (`deadEnd`), 12.1 (`loops`), and 22.6 (`returnRoute`).

### Ablation summary

For reachable scenarios, the transition from unrestricted random movement to valid-only movement increased success by 15.6 to 38.6 percentage points, while often increasing repeated visits because the agent repeatedly chose among legal exits. Adding visit memory then increased success by a further 20.5 to 62.7 points and sharply reduced repeat/backtrack behavior. The largest memory gain was on `deadEnd` (+62.7 points over ValidRandomAgent); `returnRoute` gained +55.9 points.

Mean unique-cell counts do not alone explain the result: for example, on `loops` ValidRandomAgent visited 13.2 unique cells and MemoryRandomAgent 13.1, while success rose from 52.5% to 100%. The important descriptive difference is how often explored space is revisited, not only how much space is touched. Episode lengths also differ because successful runs terminate early, so these comparisons do not attribute every metric change solely to memory.

RuleBasedAgent solved `easy`, `corridor`, and `loops` in its single deterministic run but failed `detour`, `deadEnd`, and `returnRoute` through repeated greedy backtracking. Its one-run outcomes have no stochastic confidence interval.

## Limitations

These are small hand-authored static, fully observable-neighbor grids with a fixed 100-action budget. Seeds are controlled but not a random sample of all environments. The agents have no target-aware exploration, global map, loop detection, or statistical hypothesis test. Wilson intervals describe sampling uncertainty for each measured success rate; they do not prove a causal generalization to other maps, budgets, or policies.

## Conclusion

Within these scenarios and this budget, the validation supports the hypothesis: `MemoryRandomAgent` consistently outperformed `ValidRandomAgent` on every reachable scenario, with non-overlapping Wilson intervals in this experiment and substantially fewer revisits/backtracks. It did not overcome true unreachability.

## Suggested next experiment

Test a bounded-memory ablation (for example, forgetting positions after a fixed number of steps) across a larger curated scenario suite, while keeping the same controlled seed lists and adding paired per-seed outcome analysis.
