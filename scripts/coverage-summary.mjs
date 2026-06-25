import { readFileSync, appendFileSync } from "node:fs";
import istanbulCoverage from "istanbul-lib-coverage";
const { createCoverageMap } = istanbulCoverage;

const base = Number(process.env.COVERAGE_THRESHOLD ?? 80);
const pick = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const THRESHOLDS = {
  statements: pick(process.env.COVERAGE_THRESHOLD_STATEMENTS, base),
  branches: pick(process.env.COVERAGE_THRESHOLD_BRANCHES, base),
  functions: pick(process.env.COVERAGE_THRESHOLD_FUNCTIONS, base),
  lines: pick(process.env.COVERAGE_THRESHOLD_LINES, base),
};

function main() {
  const jsonPath = "coverage/coverage-final.json";
  let data;
  try {
    data = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch {
    console.log("No coverage report found.");
    process.exit(0);
  }

  const coverageMap = createCoverageMap(data);
  const coverageSummary = coverageMap.getCoverageSummary();

  const total = {
    statements: { pct: coverageSummary.statements.pct },
    branches: { pct: coverageSummary.branches.pct },
    functions: { pct: coverageSummary.functions.pct },
    lines: { pct: coverageSummary.lines.pct },
  };

  let failed = false;

  const fmt = (key) => {
    const pct = total[key]?.pct ?? "N/A";
    const threshold = THRESHOLDS[key];
    const ok = typeof pct === "number" && pct >= threshold;
    if (!ok) failed = true;
    const status = ok ? "✅" : "❌";
    return `| ${key} | ${pct}% | ${threshold}% | ${status} |`;
  };

  const summary = [
    "## Coverage Summary",
    "",
    "| Metric | Coverage | Threshold | Status |",
    "|--------|----------|-----------|--------|",
    fmt("statements"),
    fmt("branches"),
    fmt("functions"),
    fmt("lines"),
    "",
  ].join("\n");

  console.log(summary);

  // Write to GITHUB_STEP_SUMMARY if available (GitHub Actions)
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n", "utf8");
    } catch {
      // ignore
    }
  }

  if (failed) {
    const failedMetrics = ["statements", "branches", "functions", "lines"]
      .filter((key) => {
        const pct = total[key]?.pct ?? "N/A";
        return typeof pct !== "number" || pct < THRESHOLDS[key];
      })
      .map((key) => {
        const pct = total[key].pct;
        return `${key}: ${pct}% (threshold: ${THRESHOLDS[key]}%)`;
      });

    console.error(
      "\n❌ Coverage thresholds not met:\n\n  - " + failedMetrics.join("\n  - ") + "\n",
    );
    process.exit(1);
  }
}

main();
