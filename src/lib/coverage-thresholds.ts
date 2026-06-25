/**
 * Pure helpers for resolving effective coverage thresholds from
 * workflow_dispatch inputs (mirrored as env vars in CI).
 *
 * Resolution rules (see README "How custom overrides interact with presets"):
 *   1. `COVERAGE_THRESHOLD` sets the base for all four metrics.
 *   2. Per-metric vars (`COVERAGE_THRESHOLD_STATEMENTS`, `_BRANCHES`,
 *      `_FUNCTIONS`, `_LINES`) override the base for that metric only.
 *   3. If `COVERAGE_THRESHOLD` is blank/invalid, fall back to the
 *      branch default (main=80, develop=75, others=70).
 */

export type Metric = "statements" | "branches" | "functions" | "lines";

export type Thresholds = Record<Metric, number>;

export type ThresholdEnv = {
  COVERAGE_THRESHOLD?: string;
  COVERAGE_THRESHOLD_STATEMENTS?: string;
  COVERAGE_THRESHOLD_BRANCHES?: string;
  COVERAGE_THRESHOLD_FUNCTIONS?: string;
  COVERAGE_THRESHOLD_LINES?: string;
};

export function branchDefault(branch: string | undefined): number {
  if (branch === "main") return 80;
  if (branch === "develop") return 75;
  return 70;
}

function parseNum(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function resolveThresholds(
  env: ThresholdEnv,
  branch?: string,
): Thresholds {
  const base = parseNum(env.COVERAGE_THRESHOLD) ?? branchDefault(branch);
  return {
    statements: parseNum(env.COVERAGE_THRESHOLD_STATEMENTS) ?? base,
    branches: parseNum(env.COVERAGE_THRESHOLD_BRANCHES) ?? base,
    functions: parseNum(env.COVERAGE_THRESHOLD_FUNCTIONS) ?? base,
    lines: parseNum(env.COVERAGE_THRESHOLD_LINES) ?? base,
  };
}
