import { describe, it, expect } from "vitest";
import { resolveThresholds, branchDefault } from "./coverage-thresholds";

describe("branchDefault", () => {
  it("returns 80 for main", () => {
    expect(branchDefault("main")).toBe(80);
  });
  it("returns 75 for develop", () => {
    expect(branchDefault("develop")).toBe(75);
  });
  it("returns 70 for feature branches", () => {
    expect(branchDefault("feature/x")).toBe(70);
    expect(branchDefault(undefined)).toBe(70);
  });
});

describe("resolveThresholds — strict base with multiple relaxed metrics", () => {
  it("matches the README example: base=85, branches=70, functions=75", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "85",
      COVERAGE_THRESHOLD_BRANCHES: "70",
      COVERAGE_THRESHOLD_FUNCTIONS: "75",
    });
    expect(effective).toEqual({
      statements: 85,
      branches: 70,
      functions: 75,
      lines: 85,
    });
  });

  it("relaxes three metrics while statements inherits strict base", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "90",
      COVERAGE_THRESHOLD_BRANCHES: "60",
      COVERAGE_THRESHOLD_FUNCTIONS: "65",
      COVERAGE_THRESHOLD_LINES: "70",
    });
    expect(effective).toEqual({
      statements: 90,
      branches: 60,
      functions: 65,
      lines: 70,
    });
  });

  it("relaxes all four metrics individually (base is fully overridden)", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "85",
      COVERAGE_THRESHOLD_STATEMENTS: "60",
      COVERAGE_THRESHOLD_BRANCHES: "55",
      COVERAGE_THRESHOLD_FUNCTIONS: "50",
      COVERAGE_THRESHOLD_LINES: "65",
    });
    expect(effective).toEqual({
      statements: 60,
      branches: 55,
      functions: 50,
      lines: 65,
    });
  });

  it("treats empty per-metric inputs as 'inherit from base'", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "85",
      COVERAGE_THRESHOLD_STATEMENTS: "",
      COVERAGE_THRESHOLD_BRANCHES: "70",
      COVERAGE_THRESHOLD_FUNCTIONS: "",
      COVERAGE_THRESHOLD_LINES: "75",
    });
    expect(effective).toEqual({
      statements: 85,
      branches: 70,
      functions: 85,
      lines: 75,
    });
  });

  it("ignores invalid (non-numeric) per-metric inputs and inherits base", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "85",
      COVERAGE_THRESHOLD_BRANCHES: "not-a-number",
      COVERAGE_THRESHOLD_FUNCTIONS: "75",
    });
    expect(effective).toEqual({
      statements: 85,
      branches: 85,
      functions: 75,
      lines: 85,
    });
  });

  it("falls back to branch default when base is blank, then applies relaxed per-metric overrides", () => {
    const effective = resolveThresholds(
      {
        COVERAGE_THRESHOLD_BRANCHES: "60",
        COVERAGE_THRESHOLD_FUNCTIONS: "65",
      },
      "main",
    );
    expect(effective).toEqual({
      statements: 80, // main default
      branches: 60,
      functions: 65,
      lines: 80,
    });
  });

  it("allows relaxed overrides to exceed the base (per-metric always wins)", () => {
    const effective = resolveThresholds({
      COVERAGE_THRESHOLD: "85",
      COVERAGE_THRESHOLD_STATEMENTS: "95",
      COVERAGE_THRESHOLD_BRANCHES: "70",
    });
    expect(effective).toEqual({
      statements: 95,
      branches: 70,
      functions: 85,
      lines: 85,
    });
  });
});
