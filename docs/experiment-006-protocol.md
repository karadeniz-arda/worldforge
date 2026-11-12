# Experiment 006 frozen protocol

Protocol version 1 was written before generating or examining held-out worlds
or agent outcomes. The executable configuration is `src/experiment-006-config.ts`.
Agent and generator version is Git commit
`38bd1b31b9081ab732666d2308d070581933d0b8`. The CLI verifies those inputs against
that commit and records SHA-256 hashes of this protocol and configuration.
No tuning follows evaluation. Corrections after data inspection require an
explicitly documented version and disclosure.

## Questions and hypotheses

H1. Optimistic BFS improves route efficiency over coordinate frontier planning
on doorway barriers.

H2. Information gain improves average performance over coordinate ordering on
the defined random-obstacle distributions.

H3. Information gain improves performance beyond the seeded random tie control.

H4. Relative optimistic BFS and frontier performance depends on map structure.

H5. Optimistic BFS reports sealed barriers unreachable using fewer movement
attempts than the original frontier policies.

The exploratory questions concern maze/trap performance and the frequency of
oracle-optimal successful routes. All interval interpretation remains
exploratory given multiple comparisons. No universal superiority claim follows.

## Cases and distributions

| Family | Configurations | Cases per configuration |
|---|---|---|
| Random obstacles | 20×20 and 50×50, density 0.25 | Seeds 110000–110099 |
| DFS perfect mazes | 15×15 and 21×21 | Seeds 110000–110099 |
| U traps | 15×15 and 21×21 | Seeds 110000–110099 |
| Doorways | 9×15 and 9×21 | Every door row, 0–14 and 0–20 |
| Sealed barriers | 9×15 and 9×21 | One each |

There are 638 case identities, including 636 reachable requests and two sealed
cases. Doorway/sealed metadata uses worldSeed 0 because layout is fully fixed
by dimensions and row. This metadata value adds no sampled examples.
Random fields require reachability, minimum distance
`max(5, floor((width + height) / 3))`, and at most 1000 generation attempts.
Maze DFS/farthest-target and trap geometry/endpoint rules stay fixed.
These families and their endpoint rules define different task distributions.
No pooled cross-family headline score will be calculated.

Development seeds 42, 4101–4105, 5001, 5002, 6001, 6002, and 30000–30099 are
excluded from the generated held-out seeds. Named ASCII fixtures and the
4×4 optimistic counterexample remain development data. The pilot uses only
development seeds and never contributes to full results. Its random-field
configuration is the fixed 10×10 density-0.25 configuration at seed 4101.

Map signatures hash a canonical JSON array containing width, height, start,
target, and sorted row-major obstacle indices. Duplicates within a stratum are
retained with their original case identities and seeds, reported explicitly,
and never replaced. Primary means weight seed slots equally. Bootstrap units
are signature clusters, retaining all cases in a sampled cluster, with the
mean recalculated over sampled cases. This protects against duplicate layouts
being treated as independent terrain samples. A descriptive unique-layout
mean SPL is also reported by averaging within signature first. Independent
layout counts accompany all seed-slot counts.

## Agents, randomness, and execution

Coordinate, information-gain, random frontier, and optimistic BFS receive
identical public mission fields (start, target, width, height) and observations.
Only the evaluator and generators access terrain or oracle distances.
No MemoryRandomAgent comparison enters this equivalent-information experiment.
Each trial clones the world, constructs a fresh mission and agent, and creates
a fresh RNG. Diagnostics and HTML/observation traces are disabled.

Coordinate, information gain, and optimistic BFS run once per case. Random
frontier runs five times, for 5104 maximum-budget trajectories if all cases
generate. Every trajectory uses 1000 actions. Budgets 100, 500, and 1000 are
derived from its ordinary position/action result, producing 15312 outcomes.
Only compact per-budget outcomes are retained in the artifact.

Random trial seeds use SHA-256 of UTF-8 `JSON.stringify([210000, stratumID,
worldSeedOrDoorRow, replicationIndex])`, then
`(210000 + digest.readUInt32BE(0)) >>> 0`. Replications are 0–4. Record all seeds
and detect collisions across random trials. A collision is a protocol-integrity
failure with a diagnostic artifact, never a reason to silently change seeds.
The existing seeded PRNG and random frontier's tie-only draw rules are fixed.

At budget b, a goal after k actions is visible when k <= b. A non-movement stop
after k actions is visible only when k < b. Otherwise the outcome is step-limit.
Decision opportunities equal attempted movements plus stop decisions. Success
and rejection counts partition attempted movements. An initial goal consumes
zero decisions. Prefix equivalence will be tested against fresh simulations.

## Metrics and analysis

The primary metric is each world's SPL, `L / max(L, A)` on successful reachable
episodes and zero on failed reachable episodes, where L is oracle length and
A is attempted movement actions. Unreachable cases have null SPL and null
steps/oracle ratio. Reachable L must be positive and finite.

Secondary metrics include goal success, movement/decision/stop counts,
conditional successful action count, median actions, conditional steps/oracle
mean/median/p90/maximum, number of oracle-optimal successful trajectories,
rejections, repeated visits, and immediate backtracks using existing analytics.
Missing successful-only values are null. Empty summaries are null, including
rates. A reachable false-unreachable result contributes zero SPL and is also
an explicitly labelled critical failure.

For the random policy, five runs are summarized within each world before any
world averaging or bootstrap. World-level means are the units for SPL, success,
actions, and repeat/backtrack comparisons. Conditional route summaries first
form each world's successful-run mean; median/p90/worst then describe these
world values. Separate trial-route descriptive statistics and exact optimal
trajectory counts preserve within-world variation. Worlds with no successes
are excluded only from conditional route summaries, with their count reported.

Each stratum/budget/policy is reported separately. Paired differences are
information gain minus coordinate, random minus coordinate, optimistic minus
coordinate, information gain minus random, and optimistic minus information
gain. SPL and success differences include all matching worlds; conditional
action differences include worlds where both policies have a success.
Pairing requires exactly matching case IDs, signatures, stratum and budget.
Win/loss/tie counts accompany differences.

Generated-stratum 95% paired intervals use 2000 signature-cluster bootstrap
resamples, with replacement, percentile endpoints at 0.025 and 0.975 using
linear interpolation at `(n - 1) * p`. Seeds derive from SHA-256 of
`JSON.stringify([310000, stratumID, budget, comparisonID, metricName])`, using
the same uint32-plus-base scheme. Doorway rows are exhaustive finite sets and
sealed geometries are single cases, so both have null sampling CIs.

## Validation and failure handling

All layouts are regenerated twice before running agents and signatures compared.
Independent numeric-grid traversal cross-checks random-field oracle distances.
Doorway distances are analytically `(width - 1) + 2 * doorRow`; sealed barriers
are analytically unreachable. Trap lengths are
`2 * depth + 2 * min(middle + 1, span - middle)`, where
`middle = floor((span - 1) / 2)`; the free exterior margin makes this formula
applicable to every current orientation. Maze connectivity, edge count V-1,
and unique tree paths are checked with independent DFS. Hand-calculated ASCII
tests cross-check the reference traversal and metric arithmetic.

Generation failures are recorded with case IDs and excluded consistently across
all policies, reducing the stated denominators. No seed replacement occurs.
Oracle mismatch, invalid geometry, seed collision, or trial exception halts the
run and writes a separate diagnostic failure file. False unreachable reports
and rejected movements remain visible in canonical per-trial outcomes and
critical/anomaly lists, with no suppression inside failure aggregates.
Discovery of a correctness defect pauses interpretation for review rather than
triggering algorithm changes. Partial/integrity-failed runs do not overwrite a
successful canonical artifact.

## Artifacts and feasibility

`--pilot` writes only a pilot artifact. Repeat it for byte-level determinism and
inspect elapsed time and peak process RSS printed outside canonical JSON. The
full design is retained only if that assessment supports execution.
`--full` explicitly invokes the frozen 638-case evaluation and writes
`results/experiment-006.json`. Artifact fields include protocol/config hashes,
agent commit, generator identities, exact cases, seed schedule, map signatures,
duplicate groups, per-trial budget outcomes, world means, aggregates, paired
comparisons, and anomalies. No timestamps, durations, observation traces,
diagnostic maps, or HTML enter canonical JSON. No full run is invoked by tests.
