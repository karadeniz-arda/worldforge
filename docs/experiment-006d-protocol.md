# Experiment 006-D — proposed frozen diagnostic protocol, version 2

This protocol is prepared for human review and a checkpoint commit/push before
the first full evaluation. No prior registration timestamp is claimed. The
production source baseline is commit `0ff7872625cc51594654d05c40a48df620a3dbbb`.
The executable design is `src/experiment-006d-config.ts`. Full-mode hashes are
recorded separately in `src/experiment-006d-freeze.ts` after implementation.
The full run requires later explicit human authorization.
Version 2 supersedes the uncommitted version-1 development design and pilot.
Its design identity is `matched-root-targets-v2`. The revision precedes all
generation of the new held-out mazes.

## Question and hypotheses

Why did optimistic BFS achieve oracle-optimal paths on all 200 DFS mazes in
Experiment 006? H1 predicts root-start optimality across eligible target
choices. H2 predicts a special advantage from farthest targets. H3 predicts
more wrong decisions/backtracking from non-root starts. H4 predicts that the
correct path neighbour has strictly smaller optimistic distance at root-path
choices. H5 asks whether hidden information could explain the observation.
These hypotheses, especially H1/H4, remain empirical claims/conjectures.
True tree distances and optimistic distances are different quantities.

## Mazes and conditions

The future full design uses the unchanged DFS generator at sizes 15×15 and
21×21, seeds 120000–120099, for 200 requested mazes and 800 primary missions.
The pilot uses only seeds 5001 and 5002 at both sizes, for four mazes and 16
missions. Tests use these development seeds and hand-authored fixtures only.
Enumerating future case IDs is permitted; generating their terrain is deferred.

Each maze retains identical obstacles across four matched conditions.

| Condition | Start | Target |
|---|---|---|
| A | R, DFS root (1,1) | F, farthest from R by independent BFS |
| B | R | Q, shared eligible random room |
| C | S, eligible non-root room | Same F as A, the matched root-farthest target |
| D | Same S as C | Same Q as B |

Selection order is F, S, then Q. F considers all traversable cells and resolves
maximum root-distance ties by smallest y then x. It must agree with the
unchanged generator's target. C never recomputes a farthest target from S.
Rooms have both coordinates odd. Eligible S rooms exclude R and F and require
true root distance >=4. Eligible Q rooms exclude R, S, and F and require true
distance >=6 from BOTH R and S. Excluding Q=F is a strict pre-specified rule.
If that exclusion leaves no candidates, selection fails without relaxation.
All candidate lists use increasing y then x and uniform seeded index sampling.
Each nonempty selection consumes exactly one fresh PRNG draw. Empty selections
retain their seed, zero candidate count, null index/position and explicit reason.
When S selection fails, B/C/D fail because shared Q cannot be defined. When
only Q fails, A/C remain evaluable and B/D fail. No terrain is regenerated to
resolve a selection failure.

Selection seeds use the existing PRNG initialized with
`(410000 + SHA256(JSON.stringify([410000, size, worldSeed, role])).readUInt32BE(0)) >>> 0`.
Roles are `non-root-start` and `matched-random-target`, with independent streams.
C/D share S and B/D share Q. Role seeds, candidate counts and
chosen indices/coordinates are stored. No RNG state crosses roles or mazes.
The primary budget is 1000 movement attempts, with no additional budgets.

## Independent validation and information boundary

The generator remains unchanged. A terrain-only signature hashes dimensions
and sorted row-major obstacle indices, excluding mission endpoints. Each
transformed mission copies endpoints/obstacles and must retain that signature.
The independent evaluation graph validates bounds, endpoint traversal,
connectivity, edge count V-1, acyclicity and root metadata. A root DFS provides
tree depths/parents, and a separate evaluation-side BFS provides selection
distances. Unique tree paths cross-check the existing generation BFS length.
Distinct endpoints must have positive oracle distance.

The actual `OptimisticBFSAgent` receives only `createAgentMission(world)` and
the simulator's unchanged local observations. A separate observer reconstructs
KnownMap, calls the existing optimistic distance function, and records the
action returned by the production agent. Oracle path annotations occur only
after the ordinary simulation has finished. No optional agent debug API is
introduced. Trace-equivalence tests cover a small tree, a development root
maze, a non-root mission, and the known cyclic 4×4 counterexample. The latter
tests observation-only instrumentation; tree annotation rejects cyclic graphs.

## Per-decision evidence

The artifact stores position, target, prior movement attempts, copied local
observation, newly free/blocked positions, unknown counts before/after sensing,
and the exact post-observation KnownMap before the action. Distinct map states
are stored once as row-major `?`, `.`, `#` strings. Each decision references
its historical state index. The public target does not mark terrain free.

Recorded safe-neighbour distances and robot distance are optimistic. A null
distance denotes an unreachable vertex, avoiding non-JSON Infinity values.
True distance, unique correct next neighbour, original mission-path membership,
true degree, chosen-edge correctness, and revisits are evaluation-only fields.

At a decision, `margin = min(incorrect safe neighbour optimistic distances)
- correct neighbour optimistic distance`. Missing alternatives produce null.
Positive/zero/negative classifications are reported for all defined margins
and separately for genuine forward choices. A correct neighbour is recomputed
from the current position even after deviation. A minimum-distance tie means
at least two safe neighbours attain the minimum, independently of oracle truth.
Every optimistic graph is a subgraph of the four-neighbour rectangular grid,
so it is bipartite. Neighbours of the current cell share parity, and their
finite target-distance differences are even. Their connection through the
current cell bounds that difference in absolute value by two. Defined margins
therefore belong to {-2,0,+2}; larger or odd margins are consistency anomalies.
The root hypothesis concerns the absence of ties and negative ordering at
forward choices. The value +2 follows generically once strict preference holds.

Choice categories are overlapping flags, rather than a partition:

- A discovery parent is the position from which a cell was first entered.
  The mission start has no discovery parent.
- Non-parent alternatives are observed-safe neighbours excluding that parent.
  At least two define a genuine forward choice, including initial choices.
- A true branching vertex has actual tree degree >=3.
- A forced corridor move has true degree 2, exactly one non-parent alternative,
  and selects that alternative. A previous-cell alternative can still exist.
- Returning to the discovery parent and moving into any previously visited
  cell are recorded separately.
- A choice involving the previous cell has >=2 safe neighbours including the
  position occupied immediately before the last successful movement.
- A wrong-branch choice is any selected edge that increases true distance to
  the current target. This includes wrong returns as well as fresh branches.

For each wrong edge, record its first later reverse crossing if observed.
Absence of a return at a step limit is censored. A goal reached in a tree after
a wrong edge without its reverse crossing is a diagnostic consistency anomaly.

Distance progression compares the current optimistic field at the current
position with the preceding field at that same position. With no new blocked
cells the optimistic graph is unchanged and a successful action must decrease
robot distance by one. With newly blocked cells, compare the old and new
fields at the new position and report distance increases without assuming
one-step decrease. Newly free cells change knowledge but do not change the
optimistic traversability graph. Violations are explicit consistency anomalies.

## Outcomes, summaries and paired analysis

Per-condition summaries include requested/selected/evaluated counts, successes,
optimal/non-optimal successful episodes, wrong edges and observed/censored
returns, optimistic ties, signed/null margin counts, margin distributions,
mean SPL, conditional mean/median/max actions/oracle, repeated visits,
backtracks and critical anomalies. Rejections and false-unreachable reports
are separate critical categories. Step limits are never relabelled unreachable.
Failed reachable episodes contribute zero SPL, and conditional ratios are null.
Selection/generation/validation/trajectory errors have explicit records and
are excluded from evaluable denominators with no replacement.

Every underlying maze seed is one analysis unit with four paired missions.
Sizes are reported separately. Primary contrasts are A-C and B-D (root minus
non-root), matched on both terrain and target. Secondary contrasts B-A and D-C
compare shared random Q with root-farthest F at fixed R or S, respectively.
Pairing validates the shared endpoint before computing differences. Raw action
differences are excluded because oracle lengths from R and S generally differ.
Mean paired differences include SPL, optimality, conditional action/oracle
ratio, wrong edges, repeats, immediate backtracks, mean defined margin, mean
forward-choice margin, and negative-margin fraction among defined margins.
Margin means/fractions are null when no applicable margins exist. Ratio
contrasts require both missions to succeed. Full-mode 95%
paired bootstrap intervals resample maze seeds 2000 times, with replacement.
Use the existing quantile convention, linear interpolation at `(n-1)*p`.
Bootstrap seeds use the same hash-plus-base rule with base 510000 and tuple
`[510000, size, contrast, metric]`. Pilot intervals are omitted. Constant paired
differences have null intervals labelled degenerate empirical variation;
zero observed errors never establish a population bound or a theorem.

Duplicate terrain signatures within a size are retained and reported by case
ID. Seed slots receive equal primary weight, and distinct-layout counts are
reported. The bootstrap's unit remains the seed's complete four-condition
vector. No replacement or deduplication is performed after seeing outcomes.
Potentially repeated terrain limits independent structural diversity.

## Provenance and execution gate

Exactly one CLI mode is required. Pilot writes only
`results/experiment-006d-pilot.json`. The future full run writes only
`results/experiment-006d.json`. Canonical data contains no timestamps or runtime.
Record HEAD, Git status, protocol/configuration hashes, source hashes for the
complete local import closure, production identities, Node/npm versions, package/lock hashes, OS release
and architecture, exact case/selection seed schedules, and terrain signatures.

Full mode refuses changed protocol/configuration hashes or production files.
The source manifest covers all local imports, including statistics and the
structural generators imported by reused evaluation helpers. Tests check that
the manifest matches the import closure. Every production dependency is checked
against the M4 baseline, and every source file in the closure is hashed.
It requires a new checkpoint commit, committed source, protocol, documentation,
test, package/lock and TypeScript configuration files matching the working files,
and a local upstream tracking ref containing HEAD. That last
check uses local Git metadata; the human remains responsible for pushing and
explicitly authorizing the run. Environment variable
`WORLDFORGE_006D_APPROVED_COMMIT` must equal the approved HEAD. No network fetch
or push is performed by the tool.

The same read-only input and checkpoint validators can be called independently
of the CLI to audit full-startup requirements. These validators generate no
worlds and write no results. The approved SHA is supplied externally, avoiding
a reference to the checkpoint's own SHA inside its committed files.

Full startup requires a clean tree except the exact generated output path
`results/experiment-006d.json`, which may be untracked or modified on a repeat
run. Source/config/protocol modifications are never ignored. The pilot artifact
must be committed or otherwise resolved by the human before a full startup.
Writing the result subsequently dirties only the declared full output path.
Source provenance is captured before writing. Historical 005/006 artifacts and
protocol/configuration remain unchanged. The full mode is implemented now but
will not be run during M5.0 or by tests.

## Limits and checkpoint

This experiment tests the current generator, root, sensing model, endpoint
selection, and deterministic policy. The revised comparisons hold terrain and
target fixed, while start intervention still changes oracle length, local
geometry, initial observations, and target direction. Normalized metrics adjust
for path length without controlling all structural difficulty. S and Q follow
the declared conditional sampling procedure; they are not arbitrary cells.
Strictly excluding F from Q and requiring distances from both starts restricts
the target distribution. One S and Q per maze leave endpoint-selection
variability sparsely sampled. Pilot evidence is
development-only. Margin counts are correlated within trajectories and will
not be treated as independent statistical samples. Multiple contrasts remain
exploratory. An absent root counterexample cannot supply the missing structural
lemma of a proof. A negative or zero root margin challenges H4 separately from
whether tie-breaking still produces an optimal route.

After implementation, tests, historical integrity checks and two pilot runs,
STOP for human protocol/implementation review, commit, push, and authorization.
No 120000–120099 maze is generated before that checkpoint.
