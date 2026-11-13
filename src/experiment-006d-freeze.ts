import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { experiment006dConfiguration } from "./experiment-006d-config.js";

export const frozen006dHashes: Readonly<Record<string, string>> = {
  "src/experiment-006d-config.ts": "2d3d3437c2d6225b86e1285ffd4e581c849321f926ca235d7d29a3f015fea262",
  "docs/experiment-006d-protocol.md": "1f118bdfec229f46b64d6be7ad9b511470bd3a8ede68ff02ba410871ff8678b1",
};

/** Complete local import closure, including dependencies of reused evaluation helpers. */
export const baseline006dSources = [
  "known-map", "optimistic-bfs", "planning", "mission", "observation", "simulation", "analytics", "agent",
  "maze-generation", "generation", "world", "random", "movement", "grid", "goal", "procedural-benchmark",
  "experiment-006", "experiment-006-config", "experiment-006-statistics", "experiment-006-oracle",
  "statistics", "structural-generation", "trap-generation",
].map((name) => `src/${name}.ts`);

export const diagnostic006dSources = [
  "experiment-006d-config", "experiment-006d-worlds", "experiment-006d-diagnostics",
  "experiment-006d", "experiment-006d-freeze", "experiment-006d-cli",
].map((name) => `src/${name}.ts`);

const checkpointFiles = [...baseline006dSources, ...diagnostic006dSources,
  "docs/experiment-006d-protocol.md", "test/experiment-006d.test.ts", "docs/experiment-006d.md",
  "docs/maze-dfs-root-conjecture.md", "package.json", "package-lock.json", "tsconfig.json"];

const git = (...args: string[]): Buffer => execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
const hashFile = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Validates and records inputs without generating a world or writing an artifact. */
export function inspectDiagnosticInputs() {
  const head = git("rev-parse", "HEAD").toString().trim();
  const gitStatus = git("status", "--porcelain=v1").toString();
  const frozenHashes = Object.fromEntries(Object.keys(frozen006dHashes).map((path) => [path, hashFile(path)]));
  assertFrozenHashes(frozenHashes);
  for (const path of baseline006dSources) {
    if (!git("show", `${experiment006dConfiguration.productionCommit}:${path}`).equals(readFileSync(path))) {
      throw new Error(`Production dependency changed: ${path}`);
    }
  }
  const evaluationSourceHashes = Object.fromEntries(
    [...baseline006dSources, ...diagnostic006dSources].map((path) => [path, hashFile(path)]),
  );
  return { head, gitStatus, frozenHashes, evaluationSourceHashes };
}

/** The CLI and read-only checkpoint audits use this same full-startup validation. */
export function assertPublishedDiagnosticCheckpoint(inputs: ReturnType<typeof inspectDiagnosticInputs>, approvedCommit: string | undefined): void {
  let committedSourcesMatch = true;
  for (const path of checkpointFiles) {
    try {
      if (!git("show", `HEAD:${path}`).equals(readFileSync(path))) committedSourcesMatch = false;
    } catch { committedSourcesMatch = false; }
  }
  let upstreamContainsHead = false;
  try {
    const upstream = git("rev-parse", "@{upstream}").toString().trim();
    git("merge-base", "--is-ancestor", inputs.head, upstream);
    upstreamContainsHead = true;
  } catch { /* The guard reports missing upstream ancestry. */ }
  assertFullCheckpoint({ ...inputs, upstreamContainsHead, committedSourcesMatch, approvedCommit });
}

export function parseDiagnosticMode(args: readonly string[]): "pilot" | "full" {
  if (args.length !== 1 || (args[0] !== "--pilot" && args[0] !== "--full")) throw new Error("Require exactly one mode: --pilot or --full.");
  return args[0] === "--pilot" ? "pilot" : "full";
}

export function assertFrozenHashes(actual: Readonly<Record<string, string>>): void {
  for (const [path, expected] of Object.entries(frozen006dHashes)) {
    if (actual[path] !== expected) throw new Error(`Frozen diagnostic hash mismatch: ${path}`);
  }
}

/** Only the generated artifact is exempted; source or protocol dirtiness is visible. */
export function statusWithoutOutput(status: string, output: string): string {
  return status.split("\n").filter((line) => line.length > 0 && line.slice(3) !== output).join("\n");
}

export function assertFullCheckpoint(state: {
  readonly head: string;
  readonly gitStatus: string;
  readonly upstreamContainsHead: boolean;
  readonly approvedCommit: string | undefined;
  readonly committedSourcesMatch: boolean;
}): void {
  if (state.head === experiment006dConfiguration.productionCommit) throw new Error("A new human-reviewed checkpoint commit is required for full evaluation.");
  if (state.approvedCommit !== state.head) throw new Error("Explicit approval must name HEAD in WORLDFORGE_006D_APPROVED_COMMIT.");
  if (!state.committedSourcesMatch) throw new Error("Diagnostic implementation and protocol must match the committed checkpoint.");
  if (statusWithoutOutput(state.gitStatus, "results/experiment-006d.json") !== "") throw new Error("Full evaluation requires a clean tree except its declared output.");
  if (!state.upstreamContainsHead) throw new Error("Local upstream tracking must contain the checkpoint; the human must push and verify authorization.");
}
