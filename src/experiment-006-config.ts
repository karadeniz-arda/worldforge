/** Frozen before any held-out generation or evaluation. */
export const agentVersionCommit = "38bd1b31b9081ab732666d2308d070581933d0b8";
export type EnvironmentFamily = "random-obstacles" | "maze" | "trap" | "doorway" | "sealed";
export interface EvaluationCase {
  readonly id: string;
  readonly stratum: string;
  readonly family: EnvironmentFamily;
  readonly width: number;
  readonly height: number;
  readonly worldSeed: number;
  readonly doorRow?: number;
}

export const experiment006Configuration = {
  schemaVersion: 1,
  agentVersionCommit,
  worldSeeds: Array.from({ length: 100 }, (_, index) => 110_000 + index),
  actionBudgets: [100, 500, 1000],
  agents: ["coordinate", "information-gain", "random", "optimistic"],
  randomReplications: 5,
  agentSeedBase: 210_000,
  bootstrapSeedBase: 310_000,
  bootstrapIterations: 2000,
  obstacleDensity: 0.25,
  maxGenerationAttempts: 1000,
  developmentSeeds: [42, 4101, 4102, 4103, 4104, 4105, 5001, 5002, 6001, 6002,
    ...Array.from({ length: 100 }, (_, index) => 30_000 + index)],
} as const;

export function fullEvaluationCases(): EvaluationCase[] {
  const cases: EvaluationCase[] = [];
  for (const family of ["random-obstacles", "maze", "trap"] as const) {
    for (const size of family === "random-obstacles" ? [20, 50] : [15, 21]) {
      const stratum = `${family}-${size}x${size}`;
      for (const worldSeed of experiment006Configuration.worldSeeds) {
        cases.push({ id: `${stratum}/${worldSeed}`, stratum, family, width: size, height: size, worldSeed });
      }
    }
  }
  for (const height of [15, 21]) {
    const stratum = `doorway-9x${height}`;
    for (let doorRow = 0; doorRow < height; doorRow += 1) {
      cases.push({ id: `${stratum}/row-${doorRow}`, stratum, family: "doorway", width: 9, height, worldSeed: 0, doorRow });
    }
    cases.push({ id: `sealed-9x${height}/only`, stratum: `sealed-9x${height}`, family: "sealed", width: 9, height, worldSeed: 0 });
  }
  return cases;
}

/** Previously examined development cases only. */
export function pilotEvaluationCases(): EvaluationCase[] {
  return [
    { id: "pilot-random/4101", stratum: "pilot-random", family: "random-obstacles", width: 10, height: 10, worldSeed: 4101 },
    { id: "pilot-maze/5001", stratum: "pilot-maze", family: "maze", width: 15, height: 15, worldSeed: 5001 },
    { id: "pilot-trap/6001", stratum: "pilot-trap", family: "trap", width: 15, height: 15, worldSeed: 6001 },
    { id: "pilot-door/14", stratum: "pilot-door", family: "doorway", width: 9, height: 15, worldSeed: 42, doorRow: 14 },
    { id: "pilot-sealed/42", stratum: "pilot-sealed", family: "sealed", width: 9, height: 15, worldSeed: 42 },
  ];
}

/** SHA-256 tuple encoding is implemented by the runner, without shared RNG state. */
export function trialSeedTuple(record: EvaluationCase, replication: number): readonly (string | number)[] {
  return [experiment006Configuration.agentSeedBase, record.stratum,
    record.family === "doorway" ? record.doorRow! : record.worldSeed, replication];
}
