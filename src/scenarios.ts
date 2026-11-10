import { parseWorld, type World } from "./world.js";

/** Named ASCII maps for repeatable experiments. */
export const scenarioRows = {
  easy: ["R....", "..#..", ".....", ".#...", "....T"],
  corridor: ["R####", "....#", "###.#", "#....", "####T"],
  detour: ["R.#.T", "..#..", "..#..", ".....", "....."],
  unreachable: ["R#T", "###", "..."],
  deadEnd: ["###########", "#R.......##", "#.#######.#", "#.........#", "#########T#"],
  loops: ["#########", "#R......#", "#.#####.#", "#.#...#T#", "#.#.#.#.#", "#...#...#", "#########"],
  returnRoute: ["#########", "#R.....##", "#.#####T#", "#.......#", "#########"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type ScenarioName = keyof typeof scenarioRows;

/** Builds a fresh world for a named scenario. */
export function createScenario(name: ScenarioName): World {
  return parseWorld(scenarioRows[name]);
}
