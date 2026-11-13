# DFS-root navigation conjecture and finite-world progress

## Definitions

Let the true traversable maze graph G have one vertex per free grid cell and
unit-length edges between cardinally adjacent free cells. A perfect maze makes
G a finite tree. The generator performs randomized recursive-backtracking DFS
on odd-coordinate room cells, carving intermediate corridor cells. Its DFS
root r is (1,1). Subdividing carved room edges yields the traversable-cell tree.
The robot's mission start s can equal r or be another free room. Its public
target T is distinct from s.

At decision i, known-free cells F_i and known-blocked cells B_i come from exact
local observations. Unknown cells U_i have not been observed. Public knowledge
of T does not assign its terrain to F_i. The optimistic graph O_i includes
F_i and U_i and all cardinal connections between them, excluding B_i and the
outside of the known rectangle. Let d_G and d_i denote true and optimistic
shortest-path distances. Infinity means no path in the respective graph.

For current position p != T, c is the unique neighbour on G's path from p to T.
An incorrect observed-safe neighbour w is strictly preferred by distance if
d_i(w,T) < d_i(c,T). An optimistic tie occurs when multiple safe neighbours
attain the minimum d_i. The diagnostic margin is
min_w d_i(w,T) - d_i(c,T), with null when there is no incorrect alternative.

A repeated visit is a successful move into a previously occupied cell.
An immediate backtrack returns to the position before the preceding successful
move. A wrong oracle edge increases distance to T, even if it revisits a cell.

## Established results under the stated graph model

A connected acyclic graph has exactly one simple path between any two vertices.
Existence follows from connectivity. Two distinct simple paths would contain
a cycle between their divergence and reunion, contradicting acyclicity.

In a tree, d_G(c,T) = d_G(p,T)-1, and any other neighbour w satisfies
d_G(w,T) = d_G(p,T)+1 = d_G(c,T)+2. An excursion through (p,w) must cross
the same edge in reverse before reaching T, since removing that edge separates
the tree. Completing such an excursion therefore adds at least two movements.

Unknown blocked cells remain vertices of O_i and can create fictitious routes.
True free cells remain in O_i under accurate static observations, so G is a
subgraph of O_i. Infinite optimistic distance implies actual unreachability.
These statements apply independently of how DFS constructed the tree.

The true-distance relation alone does not compare d_i(w,T) and d_i(c,T).
Either neighbour can receive a misleading optimistic estimate through unseen
walls. The recorded 4×4 counterexample demonstrates non-optimality of the
production policy on a general grid. A tree-only example also suffices:

```text
R.##
.###
....
###T
```

This free-cell graph is a tree. At the start, both right and down have optimistic
distance 5. Right-first priority enters a dead end, leading to 8 movements
against oracle distance 6. This tree lies outside the current odd-room DFS
generator's root/geometry scope. It disproves any argument based on the tree
property alone while leaving the narrower conjecture open.

## Optimistic grid parity and the size of margins

Colour grid cell (x,y) by `(x+y) mod 2`. Every cardinal edge flips colour.
Removing known-blocked vertices preserves this bipartition, including while
unknown terrain is optimistically traversable. Any finite path to a fixed
target has parity determined by its endpoint colours. Therefore two immediate
neighbours c and w of the same current cell have target distances of the same
parity, and `d_i(w,T)-d_i(c,T)` is an even integer.

There is also a distance bound independent of maze generation. Since c and w
are observed safe, O_i includes the two-edge walk w → p → c. Concatenating it
with a shortest c-to-T path gives `d_i(w,T) <= 2+d_i(c,T)`. Swapping c and w
gives the reverse bound. Their difference has absolute value at most two.
Combining parity and this bound leaves exactly {-2,0,+2} as possible finite
differences. If the correct neighbour is strictly preferred over every
incorrect alternative, its defined margin is automatically exactly +2.

Larger positive margins cannot occur between observed-safe immediate neighbours
in this unit-edge model. Zero and negative margins can occur, as the known
tree/cyclic counterexamples and non-root pilot decisions demonstrate. Arbitrary
same-colour vertices farther apart can have larger differences, so the
immediate-neighbour and shared-current-cell assumptions matter.

The real-tree difference of exactly two follows from the unique true path.
The optimistic difference of +2, when positive, follows from grid parity and
the shared-current-cell distance bound. Equal numerical values do not establish
that the two graphs produce the same ordering. The DFS-specific open question
is why ties and incorrectly preferred alternatives might be absent at root-path
forward choices. Merely observing +2 after strict preference has been established
adds no DFS-specific numerical restriction. H4's absence of ties is stronger
than H1's trajectory optimality, since a tie can still be resolved correctly.

## Conjecture

For a maze constructed by the current randomized recursive-backtracking
algorithm on the rectangular odd-coordinate room lattice, with static terrain,
exact position, known dimensions, complete four-neighbour observations, and
the robot starting at the generator's DFS root, OptimisticBFSAgent follows an
oracle-optimal route to any eligible room target at true distance at least six.
The agent includes unknown cells for optimistic BFS, executes only observed
safe neighbours, replans every decision, and uses right/down/left/up ties.

This is a testable conjecture. Existing Experiment 006 supplies evidence only
for farthest targets. Revised condition B adds sampled room targets eligible
from both R and S, with Q distinct from F. A/C share F and B/D share Q. Neither
finite experiment establishes the universal statement. Corridor-midpoint
targets, alternative wall geometries, and alternative sensing models are
outside the random-target design here.

## Proof attempt and missing lemma

1. Initially the robot is at r, with observations around r.
2. Suppose it has followed the unique true r-to-T path so far, without detours.
3. At the next choice, c is the path continuation, while an alternative w may
   lead toward an ancestor or into another rooted subtree.
4. To complete an induction, show d_i(c,T) < d_i(w,T) for every safe w != c,
   or characterize every equality and show the actual tie priority selects c.
5. Undirected DFS ancestry constrains edges in the underlying room lattice:
   non-tree adjacency connects ancestors and descendants. Previously observed
   walls along the root path could block fictitious shortcuts from an incorrect
   subtree into the target's part of the optimistic graph.

The missing lemma is a geometric statement about ALL optimistic walks from
w to T. One must prove the sensed blocked cells force those walks through a
region that makes them longer than the best optimistic walk from c. DFS
ancestry in the actual carved tree alone does not supply this inequality.
Unknown even-even wall posts and unknown intermediate walls remain traversable
in O_i and must be handled explicitly. Knowing a true subtree is separated by
walls is insufficient while those walls remain unknown to the robot.

This note does not complete that lemma or the induction. Positive observed
margins would support the hypothesis empirically. A zero margin challenges the
strict-ordering version H4 even if tie priority still succeeds. A negative
margin or a non-optimal root run gives a more direct counterexample. The
diagnostics preserve exact historical maps so those cases can be inspected.

## Frontier planning progress

Consider decision states immediately after incorporating the observation. Let
u be the number of unknown cells. With static correct sensing, u never
increases, and any actual map change strictly decreases it. The unmodified
PlanningAgent uses a shortest known-free route to T whenever one exists.
Otherwise it chooses a reachable frontier minimizing
F(p) = min_f [d_known(p,f) + Manhattan(f,T)]. All three tie policies preserve
this minimum score and execute the first step of a shortest known-free path.

On a transition with unchanged map, reachable frontiers and their target
Manhattan terms remain the same. For the selected f, its remaining known-safe
distance decreases by one along the chosen shortest path. Hence the next
minimum frontier score is at most F(p)-1, even if the selected frontier changes.
No fairness assumption about repeatedly selecting one frontier is required for
this unchanged-map step.

The proposed pair (u, minimumFrontierScore) is incomplete as a global progress
measure. That score can be undefined when there are no frontiers, and the
agent may follow a goal route whose movements do not reduce frontier scores.
A corrected phase-aware second component is:

```text
q = known-free distance to T, if that route exists
q = minimum reachable frontier score, otherwise if a frontier exists
q = 0, at a terminal unreachable state
```

If the map changes, u strictly decreases and q may reset. If the map stays
fixed, target reachability through known-free cells cannot change within the
robot's connected component. In goal-route mode q decreases by one. In
frontier mode q decreases by at least one as above. Arrival at a frontier with
an unknown neighbour causes a subsequent observation change under complete
sensing. A robot at T terminates before another decision. If no known-safe
target path and no reachable frontier remain, the known component is closed
by observed walls/boundaries, so unreachable is sound.

Thus (u,q), lexicographically ordered over non-negative integers, strictly
decreases across nonterminal action/observation transitions under these
assumptions. With N grid cells, q <= 2(N-1) and u <= N, yielding a loose
O(N²) movement bound. This conditional argument concerns the exact primary
score and known-safe path execution in the inspected code. It does not prove
route optimality, cover contradictory/dynamic observations, or guarantee that
an arbitrary externally chosen action budget suffices. Earlier documentation's
unproved fairness concern is addressed by this more specific progress argument.

## Optimistic BFS termination

Collision avoidance follows because all in-bounds neighbours are observed
before choosing a movement, and the actual policy chooses only free/target
observations. If robot distance d_i(p,T) is finite and positive, a shortest
optimistic path starts with a neighbour at distance d_i(p,T)-1. Complete sensing
has already resolved every adjacent cell, so that neighbour is observed free.

Partition execution into epochs of fixed known-blocked set B_i. Unknown-to-free
updates leave optimistic traversability unchanged. Within an epoch, each action
strictly decreases optimistic robot distance by one, so at most N-1 actions
can occur before reaching the goal, discovering a new blocker, or ending the
externally supplied budget. A new blocked-cell discovery may increase distance
at the new position, so distances across epochs need not decrease.

At most N blocked cells can be newly discovered, giving at most N+1 epochs
and a loose bound (N+1)(N-1) movements for N>=2. An unreachable stop may need
one additional decision opportunity beyond the last movement. An initial goal
needs zero actions. This establishes finite-world eventual termination with
sufficient budget under accurate static sensing. It establishes neither
oracle-optimality nor root-specific distance ordering. Sound unreachable
detection and collision avoidance follow from separate arguments above.
