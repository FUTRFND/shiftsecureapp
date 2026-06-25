import { defineConfig } from "vitest/config";

// Allow overriding coverage thresholds via env vars (e.g. from CI inputs).
// COVERAGE_THRESHOLD sets all four metrics at once; per-metric vars take precedence.
const base = Number(process.env.COVERAGE_THRESHOLD ?? 80);
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: num(process.env.COVERAGE_THRESHOLD_STATEMENTS, base),
        branches: num(process.env.COVERAGE_THRESHOLD_BRANCHES, base),
        functions: num(process.env.COVERAGE_THRESHOLD_FUNCTIONS, base),
        lines: num(process.env.COVERAGE_THRESHOLD_LINES, base),
      },
    },
  },
});
