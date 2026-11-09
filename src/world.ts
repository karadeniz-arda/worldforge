/** A zero-based coordinate within the grid world. */
export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface World {
  readonly width: number;
  readonly height: number;
  readonly robot: Position;
  readonly obstacles: readonly Position[];
  readonly deliveryTarget: Position;
}

/**
 * Builds today's deliberately static simulation. Future behavior should create
 * new world values rather than mutating this initial state.
 */
export function createInitialWorld(): World {
  return {
    width: 5,
    height: 5,
    robot: { x: 0, y: 0 },
    obstacles: [
      { x: 2, y: 1 },
      { x: 1, y: 3 },
    ],
    deliveryTarget: { x: 4, y: 4 },
  };
}
