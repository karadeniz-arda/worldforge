import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { agentVersionCommit, fullEvaluationCases, pilotEvaluationCases } from "./experiment-006-config.js";
import { runExperiment006 } from "./experiment-006.js";

const argumentsList = process.argv.slice(2);
if (argumentsList.length !== 1 || !["--pilot", "--full"].includes(argumentsList[0]!)) {
  throw new Error("Use npm run experiment:006 -- --pilot or --full explicitly.");
}
const mode = argumentsList[0] === "--full" ? "full" : "pilot";
const frozenFiles = {
  "src/experiment-006-config.ts": "1a36b45ab581e634cf7cb89bf17502f69b1c12af365b6ff51b8842e90732529d",
  "docs/experiment-006-protocol.md": "baa6b9c74fe2cf4c78b4cdb2acdcdeabf8279aa23ed570cc85640183063d0ef0",
};
const preservedSources = ["agent", "planning", "optimistic-bfs", "known-map", "simulation", "mission", "observation", "generation", "maze-generation", "trap-generation", "structural-generation", "random", "movement", "world", "grid", "goal", "analytics", "procedural-benchmark", "statistics"];
const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
for (const source of preservedSources) {
  const path = `src/${source}.ts`;
  const committed = execFileSync("git", ["show", `${agentVersionCommit}:${path}`]);
  if (!committed.equals(await readFile(path))) throw new Error(`Agent/generator dependency differs from frozen version: ${path}`);
}
for (const [path, expected] of Object.entries(frozenFiles)) {
  if (sha256(await readFile(path)) !== expected) throw new Error(`Frozen protocol/config hash mismatch: ${path}`);
}
const evaluationSources = ["experiment-006", "experiment-006-cli", "experiment-006-oracle", "experiment-006-statistics"];
const evaluationSourceHashes = Object.fromEntries(await Promise.all(evaluationSources.map(async (source) => [source, sha256(await readFile(`src/${source}.ts`))])));
const provenance = { agentVersionCommit, frozenFiles, evaluationSourceHashes };
const started = performance.now();
const outputPath = mode === "full" ? "results/experiment-006.json" : "results/experiment-006-pilot.json";
await mkdir("results", { recursive: true });
try {
  const run = runExperiment006(mode === "full" ? fullEvaluationCases() : pilotEvaluationCases(), console.log);
  const artifact = { mode, provenance, ...run };
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`);
  console.log(`Wrote ${outputPath}`);
  console.log(`Cases ${run.worlds.length}/${run.cases.length}; simulations ${run.actualSimulationCount}; budget outcomes ${run.derivedOutcomeCount}`);
  console.log(`Generation failures ${run.generationFailures.length}; duplicate groups ${run.duplicateLayouts.length}; false unreachable ${run.criticalFalseUnreachable.length}; anomalies ${run.anomalies.length}`);
  for (const group of run.groups) {
    console.log(`${group.stratum}: ${group.generatedWorldCount} cases, ${group.uniqueLayoutCount} layouts`);
    for (const aggregate of group.aggregates.filter((a) => a.budget === 1000)) {
      console.log(`  ${aggregate.agent}: goals ${aggregate.successCount}/${aggregate.trialCount}, SPL ${aggregate.meanSPL ?? "N/A"}, success actions ${aggregate.successfulWorldActions.mean ?? "N/A"}, stops ${aggregate.categories["correct-unreachable"]}`);
    }
  }
  console.log(`Elapsed seconds ${((performance.now() - started) / 1000).toFixed(3)}; peak RSS MiB ${(process.resourceUsage().maxRSS / 1024).toFixed(1)}`);
  if (run.anomalies.length > 0) process.exitCode = 1;
} catch (error) {
  const failurePath = `results/experiment-006-${mode}-failure.json`;
  await writeFile(failurePath, `${JSON.stringify({ mode, provenance, error: String(error) })}\n`);
  console.error(`Integrity failure recorded in ${failurePath}`);
  throw error;
}
