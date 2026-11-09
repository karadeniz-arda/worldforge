import type { World } from "./world.js";

/** Returns whether the robot occupies the delivery target, the current mission objective. */
export function hasReachedTarget(world: World): boolean {
  return world.robot.x === world.deliveryTarget.x && world.robot.y === world.deliveryTarget.y;
}
