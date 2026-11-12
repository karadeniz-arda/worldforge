# Doorway frontier selection

The verified information-gain replay uses width 9, height 15, world seed 42,
door row 14, start (0,0), and target (8,0). It reaches the goal in 64 successful
moves with zero rejected moves. The oracle shortest path is 36.

Before action 17, at (3,13), the agent knows that (3,14) is free. The doorway
at (4,14) is still unknown because observations cover four cardinal neighbours.
Frontiers (2,13) and (3,14) both have safe BFS distance 1, Manhattan distance 19,
combined score 20, and two unknown neighbours. Stable coordinate ordering
selects (2,13), producing a left action.

Before action 18, at (2,13), frontier (2,12) has score 19 (1 + 18), while
(3,14) has score 21 (2 + 19). Replanning therefore sustains upward exploration.
Information gain ties at the initial left turn. The primary score drives the
subsequent upward excursion.

Once competing left-region frontiers are exhausted, actions 43 and 44 move
right toward (3,14), and action 45 moves down into (3,14). The next observation
first reveals the doorway as free. Action 46 enters (4,14), and action 47
continues right into (5,14). The verified trace agrees with the implemented
comparator and local-observation model.

```sh
npm run replay -- --structural doorway --width 9 --height 15 --world-seed 42 --door-row 14 --agent planning --tie-break information-gain --steps 2000
```
