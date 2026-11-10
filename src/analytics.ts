import type { Position } from "./world.js";

/** The position trace needed to derive movement-exploration metrics. */
export interface PositionTrace {
  readonly succeeded: boolean;
  readonly positionBefore: Position;
  readonly positionAfter: Position;
}

export interface MovementAnalytics {
  /** Distinct positions occupied, including the starting position. */
  readonly uniqueCellsVisited: number;
  /** Successful moves whose destination was occupied earlier in the trial. */
  readonly repeatedVisits: number;
  /**
   * Successful moves returning to the position occupied immediately before
   * the previous successful move. Rejected actions do not reset this relation.
   */
  readonly immediateBacktracks: number;
  /** Repeated visits divided by successful moves, or null when there were none. */
  readonly repeatedVisitsPerSuccessfulMove: number | null;
  /** Immediate backtracks divided by successful moves, or null when there were none. */
  readonly immediateBacktracksPerSuccessfulMove: number | null;
}

function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/** Derives exploration metrics from a starting position and simulation trace. */
export function calculateMovementAnalytics(
  startingPosition: Position,
  traces: readonly PositionTrace[],
): MovementAnalytics {
  const visitedPositions = new Set([positionKey(startingPosition)]);
  let repeatedVisits = 0;
  let immediateBacktracks = 0;
  let successfulMoves = 0;
  let previousSuccessfulPositionBefore: Position | undefined;

  for (const trace of traces) {
    if (!trace.succeeded) {
      continue;
    }

    successfulMoves += 1;

    const afterKey = positionKey(trace.positionAfter);
    if (visitedPositions.has(afterKey)) {
      repeatedVisits += 1;
    }
    if (
      previousSuccessfulPositionBefore !== undefined
      && positionsMatch(trace.positionAfter, previousSuccessfulPositionBefore)
    ) {
      immediateBacktracks += 1;
    }

    visitedPositions.add(afterKey);
    previousSuccessfulPositionBefore = trace.positionBefore;
  }

  return {
    uniqueCellsVisited: visitedPositions.size,
    repeatedVisits,
    immediateBacktracks,
    repeatedVisitsPerSuccessfulMove: successfulMoves === 0 ? null : repeatedVisits / successfulMoves,
    immediateBacktracksPerSuccessfulMove: successfulMoves === 0 ? null : immediateBacktracks / successfulMoves,
  };
}
