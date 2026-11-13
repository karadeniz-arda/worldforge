import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { diagnosticCases, experiment006dConfiguration as config } from "./experiment-006d-config.js";
import { assertPublishedDiagnosticCheckpoint, inspectDiagnosticInputs, parseDiagnosticMode, statusWithoutOutput } from "./experiment-006d-freeze.js";
import { runExperiment006d } from "./experiment-006d.js";

const mode = parseDiagnosticMode(process.argv.slice(2));
const output = mode === "pilot" ? "results/experiment-006d-pilot.json" : "results/experiment-006d.json";
const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const inputs = inspectDiagnosticInputs();
const { head, gitStatus, frozenHashes, evaluationSourceHashes } = inputs;
if (mode === "full") {
  assertPublishedDiagnosticCheckpoint(inputs, process.env.WORLDFORGE_006D_APPROVED_COMMIT);
}
const provenance = {
  head, productionCommit: config.productionCommit,
  gitStatus: statusWithoutOutput(gitStatus, output), gitStatusScope: `Declared output ${output} excluded for pilot repeatability; all other changes retained`,
  ...(mode === "full" ? { rawGitStatusBeforeWrite: gitStatus } : {}),
  frozenHashes, evaluationSourceHashes,
  node: process.version, npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
  packageHash: hash(await readFile("package.json")), lockfileHash: hash(await readFile("package-lock.json")),
  os: { platform: platform(), release: release(), architecture: arch() },
};
const started = performance.now();
const run = runExperiment006d(diagnosticCases(mode), mode);
await mkdir("results", { recursive: true });
await writeFile(output, `${JSON.stringify({ provenance, ...run })}\n`);
console.log(`Wrote ${output}; mazes ${run.requestedMazes}; evaluated trajectories ${run.actualTrajectories}`);
for (const condition of run.conditions) {
  console.log(`${condition.size} ${condition.condition} (${config.conditionLabels[condition.condition]}): goals ${condition.successes}/${condition.evaluatedEpisodes}; optimal ${condition.oracleOptimal}/${condition.evaluatedEpisodes}; wrong ${condition.wrongBranchChoices}; margins ${JSON.stringify(condition.margins)}`);
}
console.log(`Failures ${run.failures.length}; critical anomalies ${run.criticalAnomalies.length}; hypothesis challenges ${run.hypothesisChallenges.length}`);
console.log(`Elapsed seconds ${((performance.now() - started) / 1000).toFixed(3)}; peak RSS MiB ${(process.resourceUsage().maxRSS / 1024).toFixed(1)}`);
if (run.failures.length > 0 || run.criticalAnomalies.length > 0) process.exitCode = 1;
