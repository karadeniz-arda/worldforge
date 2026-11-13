import type { AgentDecision } from "./agent.js";
import { cellIndex, uniqueTreePath, type TreeIndex } from "./experiment-006d-worlds.js";
import { adjacentPosition, cardinalDirections, createUnknownMap, updateKnownMap, type KnownMap } from "./known-map.js";
import { createAgentMission } from "./mission.js";
import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import { calculateOptimisticDistances, OptimisticBFSAgent } from "./optimistic-bfs.js";
import { runSimulation } from "./simulation.js";
import type { Position, World } from "./world.js";

const finite = (distance: number): number | null => Number.isFinite(distance) ? distance : null;
export const encodeKnownMap = (map: KnownMap): string => map.cells.map((cell) => cell === "unknown" ? "?" : cell === "free" ? "." : "#").join("");
export interface SafeNeighbor {
  readonly direction: MovementDirection;
  readonly position: Position;
  readonly optimisticDistance: number | null;
}

/** Uses agent-visible inputs only; target coordinates leave unknown terrain untouched. */
export function observedDecisionEvidence(previous: KnownMap, observation: Observation, target: Position) {
  const map = updateKnownMap(previous, observation);
  const newlyFree: Position[] = [];
  const newlyBlocked: Position[] = [];
  previous.cells.forEach((cell, index) => {
    if (cell !== "unknown" || map.cells[index] === "unknown") return;
    const position = { x: index % map.width, y: Math.floor(index / map.width) };
    (map.cells[index] === "blocked" ? newlyBlocked : newlyFree).push(position);
  });
  const distances = calculateOptimisticDistances(map, target);
  const safeNeighbors: SafeNeighbor[] = cardinalDirections.flatMap((direction) => {
    const content = observation.neighbors[direction];
    if (content !== "empty" && content !== "target") return [];
    const position = adjacentPosition(observation.robot, direction);
    return [{ direction, position, optimisticDistance: finite(distances[cellIndex(map.width, position)]!) }];
  });
  return { map, distances, newlyFree, newlyBlocked, safeNeighbors,
    unknownBeforeObservation: previous.cells.filter((cell) => cell === "unknown").length,
    unknownBeforeDecision: map.cells.filter((cell) => cell === "unknown").length,
  };
}

/** Runs the original simulator with the original agent. No oracle is accepted here. */
export function recordOptimisticTrajectory(world: World, budget: number) {
  const mission = createAgentMission(world);
  const actualAgent = new OptimisticBFSAgent(mission);
  let knowledge = createUnknownMap(mission.width, mission.height);
  let attempts = 0;
  let previousDistances: readonly number[] | null = null;
  let previousRobotDistance: number | null = null;
  const knownMapStates: string[] = [];
  const stateIndices = new Map<string, number>();
  const decisions: KnowledgeDecision[] = [];
  const result = runSimulation(world, {
    decide(observation) {
      const evidence = observedDecisionEvidence(knowledge, observation, mission.target);
      knowledge = evidence.map;
      const encoded = encodeKnownMap(knowledge);
      let knownMapStateIndex = stateIndices.get(encoded);
      if (knownMapStateIndex === undefined) {
        knownMapStateIndex = knownMapStates.length;
        stateIndices.set(encoded, knownMapStateIndex);
        knownMapStates.push(encoded);
      }
      const index = cellIndex(world.width, observation.robot);
      const distance = finite(evidence.distances[index]!);
      const oldAtCurrent = previousDistances === null ? null : finite(previousDistances[index]!);
      const graphChanged = evidence.newlyBlocked.length > 0;
      const decision = actualAgent.decide(observation);
      decisions.push({
        decisionNumber: decisions.length + 1, movementAttemptsSoFar: attempts,
        robot: { ...observation.robot }, target: { ...mission.target },
        observation: { robot: { ...observation.robot }, neighbors: { ...observation.neighbors } },
        knownMapStateIndex, newlyObservedFree: evidence.newlyFree, newlyObservedBlocked: evidence.newlyBlocked,
        unknownBeforeObservation: evidence.unknownBeforeObservation, unknownBeforeDecision: evidence.unknownBeforeDecision,
        optimisticDistance: distance, safeNeighbors: evidence.safeNeighbors,
        action: typeof decision === "string" ? decision : { ...decision },
        progression: previousDistances === null ? null : {
          graphChanged, previousDecisionDistance: previousRobotDistance, previousFieldAtCurrent: oldAtCurrent,
          distanceChangeFromPreviousDecision: distance === null || previousRobotDistance === null ? null : distance - previousRobotDistance,
          discoveryIncreaseAtCurrent: distance === null || oldAtCurrent === null ? null : distance - oldAtCurrent,
          unchangedGraphOneStepDecrease: graphChanged ? null
            : distance !== null && previousRobotDistance !== null && distance === previousRobotDistance - 1,
        },
      });
      previousDistances = evidence.distances;
      previousRobotDistance = distance;
      if (typeof decision === "string") attempts += 1;
      return decision;
    },
  }, budget);
  return { result, knownMapStates, decisions };
}

export interface KnowledgeDecision {
  readonly decisionNumber: number;
  readonly movementAttemptsSoFar: number;
  readonly robot: Position;
  readonly target: Position;
  readonly observation: Observation;
  readonly knownMapStateIndex: number;
  readonly newlyObservedFree: readonly Position[];
  readonly newlyObservedBlocked: readonly Position[];
  readonly unknownBeforeObservation: number;
  readonly unknownBeforeDecision: number;
  readonly optimisticDistance: number | null;
  readonly safeNeighbors: readonly SafeNeighbor[];
  readonly action: AgentDecision;
  readonly progression: null | {
    readonly graphChanged: boolean;
    readonly previousDecisionDistance: number | null;
    readonly previousFieldAtCurrent: number | null;
    readonly distanceChangeFromPreviousDecision: number | null;
    readonly discoveryIncreaseAtCurrent: number | null;
    readonly unchangedGraphOneStepDecrease: boolean | null;
  };
}

export function compareOracleNeighbor(safe: readonly SafeNeighbor[], correct: Position, width: number) {
  const correctDistance = safe.find((neighbor) => cellIndex(width, neighbor.position) === cellIndex(width, correct))?.optimisticDistance ?? null;
  const incorrect = safe.filter((neighbor) => cellIndex(width, neighbor.position) !== cellIndex(width, correct));
  const finiteIncorrect = incorrect.flatMap((neighbor) => neighbor.optimisticDistance === null ? [] : [neighbor.optimisticDistance]);
  const minIncorrect = finiteIncorrect.length === 0 ? null : Math.min(...finiteIncorrect);
  const margin = correctDistance === null || minIncorrect === null ? null : minIncorrect - correctDistance;
  return { correctOptimisticDistance: correctDistance, minimumIncorrectOptimisticDistance: minIncorrect,
    margin, marginClass: margin === null ? "no-alternative" : margin > 0 ? "positive" : margin < 0 ? "negative" : "zero" } as const;
}

/** Oracle enrichment occurs after action selection and simulation, on a validated tree. */
export function annotateTreeTrajectory(world: World, tree: TreeIndex, recorded: ReturnType<typeof recordOptimisticTrajectory>) {
  const initialPath = new Set(uniqueTreePath(tree, world.robot, world.deliveryTarget).map((p) => cellIndex(tree.width, p)));
  const discoveryParents = new Map<number, number | null>([[cellIndex(tree.width, world.robot), null]]);
  const visited = new Set([cellIndex(tree.width, world.robot)]);
  let previousCell: number | null = null;
  const annotated = recorded.decisions.map((decision) => {
    const current = cellIndex(tree.width, decision.robot);
    const path = uniqueTreePath(tree, decision.robot, world.deliveryTarget);
    const correct = path[1];
    if (correct === undefined) throw new Error("Unexpected decision at a completed tree mission.");
    const parent = discoveryParents.get(current) ?? null;
    const nonParent = decision.safeNeighbors.filter((neighbor) => cellIndex(tree.width, neighbor.position) !== parent);
    const chosen = typeof decision.action === "string" ? adjacentPosition(decision.robot, decision.action) : null;
    const chosenIndex = chosen === null ? null : cellIndex(tree.width, chosen);
    const trueDegree = tree.adjacency.get(current)!.length;
    const correctIndex = cellIndex(tree.width, correct);
    const minimum = Math.min(...decision.safeNeighbors.flatMap((n) => n.optimisticDistance === null ? [] : [n.optimisticDistance]));
    const oracle = {
      trueDistance: path.length - 1, correctNextCell: correct,
      chosenTrueDistance: chosen === null ? null : uniqueTreePath(tree, chosen, world.deliveryTarget).length - 1,
      chosenFollowsUniquePath: chosenIndex === null ? null : chosenIndex === correctIndex,
      wrongBranchChoice: chosenIndex !== null && chosenIndex !== correctIndex,
      chosenPreviouslyVisited: chosenIndex !== null && visited.has(chosenIndex),
      discoveryParent: parent === null ? null : { x: parent % tree.width, y: Math.floor(parent / tree.width) },
      observedSafeCount: decision.safeNeighbors.length, nonParentSafeCount: nonParent.length,
      onOriginalStartTargetPath: initialPath.has(current), trueDegree, trueBranchingVertex: trueDegree >= 3,
      genuineForwardChoice: nonParent.length >= 2,
      forcedCorridorMove: trueDegree === 2 && nonParent.length === 1 && chosenIndex !== parent && chosenIndex !== null,
      returnToDiscoveryParent: chosenIndex !== null && chosenIndex === parent,
      returnAlongVisitedEdge: chosenIndex !== null && visited.has(chosenIndex),
      choiceInvolvingPreviousCell: previousCell !== null && decision.safeNeighbors.length >= 2
        && decision.safeNeighbors.some((n) => cellIndex(tree.width, n.position) === previousCell),
      optimisticMinimumTie: Number.isFinite(minimum) && decision.safeNeighbors.filter((n) => n.optimisticDistance === minimum).length >= 2,
      ...compareOracleNeighbor(decision.safeNeighbors, correct, tree.width),
    };
    if (chosenIndex !== null) {
      if (!discoveryParents.has(chosenIndex)) discoveryParents.set(chosenIndex, current);
      visited.add(chosenIndex);
      previousCell = current;
    }
    return { ...decision, oracle };
  });
  const edgeReturns = new Map<string, number>();
  const reversed = [...annotated].reverse().map((decision) => {
    const chosen = typeof decision.action === "string" ? adjacentPosition(decision.robot, decision.action) : null;
    const before = cellIndex(tree.width, decision.robot);
    const after = chosen === null ? null : cellIndex(tree.width, chosen);
    const returnDecision = after === null ? null : edgeReturns.get(`${after}/${before}`) ?? null;
    if (after !== null) edgeReturns.set(`${before}/${after}`, decision.decisionNumber);
    return { ...decision, oracle: { ...decision.oracle,
      wrongEdgeReturnDecision: decision.oracle.wrongBranchChoice ? returnDecision : null,
      wrongEdgeReturnStatus: !decision.oracle.wrongBranchChoice ? null : returnDecision !== null ? "observed-return"
        : recorded.result.termination === "step-limit" ? "censored-at-limit" : "missing-return",
    } };
  });
  return reversed.reverse();
}
