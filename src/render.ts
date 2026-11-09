import type { Position, World } from "./world.js";

const EMPTY = ".";
const ROBOT = "R";
const OBSTACLE = "#";
const TARGET = "T";

function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

/** Renders a world top-to-bottom using R (robot), # (obstacle), T (target), and . (empty). */
export function renderWorld(world: World): string {
  const rows: string[] = [];

  for (let y = 0; y < world.height; y += 1) {
    let row = "";
    for (let x = 0; x < world.width; x += 1) {
      const position = { x, y };
      if (positionsMatch(position, world.robot)) {
        row += ROBOT;
      } else if (world.obstacles.some((obstacle) => positionsMatch(position, obstacle))) {
        row += OBSTACLE;
      } else if (positionsMatch(position, world.deliveryTarget)) {
        row += TARGET;
      } else {
        row += EMPTY;
      }
    }
    rows.push(row);
  }

  return rows.join("\n");
}
