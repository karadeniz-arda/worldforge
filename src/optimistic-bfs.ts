import type { Agent, AgentDecision } from "./agent.js";
import {
  adjacentPosition, cardinalDirections, createUnknownMap, getKnownCell,
  isKnownMapPositionInBounds, updateKnownMap, type KnownMap,
} from "./known-map.js";
import type { AgentMission } from "./mission.js";
import type { MovementDirection } from "./movement.js";
import type { Observation } from "./observation.js";
import type { Position } from "./world.js";

/** Row-major target distances. Unknown cells are traversable, blocked cells are excluded. */
export function calculateOptimisticDistances(map: KnownMap, target: Position): readonly number[] {
  const distances = Array<number>(map.width * map.height).fill(Infinity);
  if (!isKnownMapPositionInBounds(map, target) || getKnownCell(map, target) === "blocked") return distances;
  const queue: Position[] = [{ ...target }];
  distances[target.y * map.width + target.x] = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const distance = distances[current.y * map.width + current.x]!;
    for (const direction of cardinalDirections) {
      const next = adjacentPosition(current, direction);
      if (!isKnownMapPositionInBounds(map, next) || getKnownCell(map, next) === "blocked") continue;
      const nextIndex = next.y * map.width + next.x;
      if (distances[nextIndex] !== Infinity) continue;
      distances[nextIndex] = distance + 1;
      queue.push(next);
    }
  }
  return distances;
}

/** Replans through unknown terrain, then executes only currently observed safe moves. */
export class OptimisticBFSAgent implements Agent {
  private map: KnownMap;
  private readonly target: Position;

  constructor(mission: AgentMission) {
    this.map = createUnknownMap(mission.width, mission.height);
    this.target = { ...mission.target };
  }

  decide(observation: Observation): AgentDecision {
    this.map = updateKnownMap(this.map, observation);
    const distances = calculateOptimisticDistances(this.map, this.target);
    if (!isKnownMapPositionInBounds(this.map, observation.robot)) {
      throw new Error("Optimistic BFS requires an in-bounds observed robot position.");
    }
    const currentDistance = distances[observation.robot.y * this.map.width + observation.robot.x]!;
    if (currentDistance === Infinity) return { kind: "stop", reason: "target-unreachable" };
    if (currentDistance === 0) {
      throw new Error("Optimistic BFS decide called at the target; the simulator must terminate before requesting an action.");
    }
    let selected: MovementDirection | null = null;
    let bestDistance = Infinity;
    for (const direction of cardinalDirections) {
      const contents = observation.neighbors[direction];
      if (contents !== "empty" && contents !== "target") continue;
      const next = adjacentPosition(observation.robot, direction);
      if (getKnownCell(this.map, next) !== "free") continue;
      const distance = distances[next.y * this.map.width + next.x]!;
      if (distance < bestDistance) {
        selected = direction;
        bestDistance = distance;
      }
    }
    if (selected === null || bestDistance !== currentDistance - 1) {
      throw new Error("Optimistic BFS invariant violated: finite robot distance requires an observed-safe neighbour with distance one less.");
    }
    return selected;
  }
}
