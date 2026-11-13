export const experiment006dConfiguration = {
  version: 2,
  design: "matched-root-targets-v2",
  productionCommit: "0ff7872625cc51594654d05c40a48df620a3dbbb",
  sizes: [15, 21],
  pilotSeeds: [5001, 5002],
  heldOutSeeds: Array.from({ length: 100 }, (_, index) => 120000 + index),
  conditions: ["A", "B", "C", "D"],
  conditionLabels: {
    A: "root / root-farthest target F",
    B: "root / shared random target Q",
    C: "non-root / matched root-farthest target F",
    D: "non-root / matched random target Q",
  },
  primaryContrasts: [["A", "C"], ["B", "D"]],
  secondaryContrasts: [["B", "A"], ["D", "C"]],
  excludeRandomTargetFarthest: true,
  root: { x: 1, y: 1 },
  minimumRandomTargetDistance: 6,
  minimumNonRootStartDistance: 4,
  selectionSeedBase: 410000,
  bootstrapSeedBase: 510000,
  bootstrapIterations: 2000,
  movementBudget: 1000,
} as const;

export type MazeCondition = typeof experiment006dConfiguration.conditions[number];
export interface DiagnosticMazeCase {
  readonly id: string;
  readonly size: number;
  readonly worldSeed: number;
}

/** Enumerates metadata only; never calls a generator. */
export function diagnosticCases(mode: "pilot" | "full"): DiagnosticMazeCase[] {
  const seeds = mode === "pilot" ? experiment006dConfiguration.pilotSeeds : experiment006dConfiguration.heldOutSeeds;
  return experiment006dConfiguration.sizes.flatMap((size) => seeds.map((worldSeed) => ({ id: `${size}x${size}/${worldSeed}`, size, worldSeed })));
}
