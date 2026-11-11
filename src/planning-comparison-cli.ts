import { calculateShortestPathLength, generateWorldWithMetadata } from "./generation.js";
import { createAgentMission } from "./mission.js";
import { PlanningAgent, type FrontierTieBreakPolicy } from "./planning.js";
import { createScenario, type ScenarioName } from "./scenarios.js";
import { runSimulation } from "./simulation.js";
import type { World } from "./world.js";

const policies: readonly FrontierTieBreakPolicy[] = ["coordinate", "information-gain"];
const namedScenarios: readonly ScenarioName[] = ["easy", "corridor", "detour", "deadEnd", "loops", "returnRoute"];
const namedBudget = 100;
const proceduralBudget = 200;
const proceduralSeeds = [4_101, 4_102, 4_103, 4_104, 4_105];

interface ComparisonRow {
  readonly label: string;
  readonly policy: FrontierTieBreakPolicy;
  readonly succeeded: boolean;
  readonly steps: number;
  readonly rejectedMoves: number;
  readonly shortestPathLength: number | null;
}

const namedRows = namedScenarios.flatMap((scenario) => {
  const world = createScenario(scenario);
  return policies.map((policy) => compareWorld(scenario, world, policy, namedBudget));
});

const proceduralRows: ComparisonRow[] = [];
for (const worldSeed of proceduralSeeds) {
  const generated = generateWorldWithMetadata({
    width: 10,
    height: 10,
    obstacleDensity: 0.2,
    reachability: "reachable",
    minimumPathDistance: 10,
    worldSeed,
    maxAttempts: 1_000,
  });
  for (const policy of policies) {
    proceduralRows.push(compareWorld(`seed-${worldSeed}`, generated.world, policy, proceduralBudget));
  }
}

console.log(`WorldForge PlanningAgent tie-break comparison: named budget ${namedBudget}, procedural budget ${proceduralBudget}`);
printRows("Named scenarios", namedRows);
printRows("Procedural sample: 10x10 density 0.20, reachable, minimum path 10, seeds 4101–4105", proceduralRows);

function compareWorld(
  label: string,
  world: World,
  policy: FrontierTieBreakPolicy,
  actionBudget: number,
): ComparisonRow {
  const result = runSimulation(
    world,
    new PlanningAgent(createAgentMission(world), { tieBreakPolicy: policy }),
    actionBudget,
  );
  return {
    label,
    policy,
    succeeded: result.termination === "goal-reached",
    steps: result.stepsTaken,
    rejectedMoves: result.rejectedMoves,
    shortestPathLength: calculateShortestPathLength(world),
  };
}

function printRows(title: string, rows: readonly ComparisonRow[]): void {
  console.log(`\n${title}`);
  console.log("World          Policy             Success  Actions  Rejected  BFS shortest");
  console.log("-------------------------------------------------------------------------");
  for (const row of rows) {
    console.log([
      row.label.padEnd(14),
      row.policy.padEnd(18),
      (row.succeeded ? "yes" : "no").padEnd(8),
      String(row.steps).padEnd(9),
      String(row.rejectedMoves).padEnd(10),
      row.shortestPathLength === null ? "unreachable" : String(row.shortestPathLength),
    ].join(" "));
  }
}
