# PlanningAgent correctness and termination

This note describes the guarantees supported by the current implementation and
separates them from stronger claims that have not been proved.

## Model and terms

PlanningAgent receives a public mission (start, target, width, and height) and
a four-neighbour observation at its current position. It does not receive a
`World`, an obstacle set, or an oracle path. Its internal map marks each cell
as `unknown`, `free`, or `blocked`.

A **reachable frontier** is a known-free cell that is reachable from the
current robot position by a path consisting only of known-free cells and has
at least one in-bounds adjacent `unknown` cell. This is the precise set the
agent computes before choosing a frontier.

## Safety of known routes

Known-safe BFS expands only cells marked free. Consequently, a planned route
never deliberately includes a cell known to be an obstacle or one that is
still unknown. The simulator remains authoritative: every emitted movement is
also checked by `moveRobot`, so this planning property is not relied on as the
only movement safety check.

## Why reaching a frontier provides information

When the robot occupies a reachable frontier, the four-neighbour observation
reports every in-bounds neighbour. By definition the frontier has an unknown
in-bounds neighbour, so incorporating that observation changes at least one
map cell from `unknown` to `free` or `blocked` (a target observation is stored
as free). PlanningAgent updates the discovered map before every decision and
then replans.

## Stop condition: soundness under the model

PlanningAgent returns `target-unreachable` only after it has no known-free BFS
route to the target and no reachable frontier. Under the assumptions below,
the known-free component containing the robot then has no unobserved adjacent
cell. It is therefore closed by boundaries or observed blocked cells. Since
the target is not reachable through that component, no actual robot path to
the target exists. This is why the stop decision is a statement made from the
agent's map, while the simulation does not inspect hidden obstacles to
validate it.

`step-limit` has a different meaning: the simulation exhausted its externally
provided action budget before reaching a goal or receiving a stop decision. It
does **not** establish that a target is unreachable.

## Completeness and termination: an important limitation

For an exhaustive frontier-exploration procedure on a finite static grid,
each reached frontier supplies new finite map information. Eventually either a
known-safe target path is found or no reachable frontier remains, so that
procedure terminates with a goal or an unreachable report when given enough
movement budget.

The current implementation has the required finite map and replans after each
observation, but its greedy frontier selector has no explicit fairness proof,
frontier queue, or visited-frontier progress invariant. In particular, this
document does **not** claim a general mathematical proof that every possible
tie-breaking/replanning history will visit every reachable frontier. The
oracle-backed tests exercise representative finite worlds with deliberately
large test budgets; they are empirical regression coverage, not a proof of
global completeness. A future completeness claim would require either a proof
of progress for the existing selector or an explicit exploration-progress
mechanism.

## Essential assumptions checked against the implementation

The conditional arguments above require:

- a finite world with static obstacles;
- correct local observations of all four cardinal neighbours;
- an accurate robot position in each observation;
- correct, fixed public width and height; and
- no mutation of the authoritative world outside the simulator.

The current static `World`, `observeWorld`, mission construction, and
simulation loop satisfy these assumptions for normal runs. Dynamic obstacles,
noisy/sparse observations, incorrect dimensions, or externally moved robots
would invalidate the argument and require map invalidation or new semantics.
