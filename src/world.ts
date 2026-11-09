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

const WORLD_SYMBOLS = new Set(["R", "T", "#", "."]);

/**
 * Parses an ASCII map into a world. Rows are ordered top-to-bottom and
 * coordinates are zero-based, with x increasing rightward and y downward.
 */
export function parseWorld(rows: readonly string[]): World {
  if (rows.length === 0) {
    throw new Error("World map must contain at least one row.");
  }

  const width = rows[0]?.length ?? 0;
  if (width === 0) {
    throw new Error("World map rows must contain at least one cell.");
  }

  let robot: Position | undefined;
  let deliveryTarget: Position | undefined;
  const obstacles: Position[] = [];

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y]!;
    if (row.length !== width) {
      throw new Error(`World map must be rectangular: row ${y} has width ${row.length}, expected ${width}.`);
    }

    for (let x = 0; x < row.length; x += 1) {
      const symbol = row[x]!;
      if (!WORLD_SYMBOLS.has(symbol)) {
        throw new Error(`Unsupported world symbol "${symbol}" at (${x}, ${y}).`);
      }

      if (symbol === "R") {
        if (robot !== undefined) {
          throw new Error("World map must contain exactly one robot (R).");
        }
        robot = { x, y };
      } else if (symbol === "T") {
        if (deliveryTarget !== undefined) {
          throw new Error("World map must contain exactly one target (T).");
        }
        deliveryTarget = { x, y };
      } else if (symbol === "#") {
        obstacles.push({ x, y });
      }
    }
  }

  if (robot === undefined) {
    throw new Error("World map must contain exactly one robot (R).");
  }
  if (deliveryTarget === undefined) {
    throw new Error("World map must contain exactly one target (T).");
  }

  return {
    width,
    height: rows.length,
    robot,
    obstacles,
    deliveryTarget,
  };
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
