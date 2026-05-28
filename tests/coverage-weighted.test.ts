import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { coverage } from "../src/validator.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempFiles: string[] = [];

function writeTempYaml(obj: any): string {
  const path = resolve(
    tmpdir(),
    `actcheck-cov-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
  );
  writeFileSync(path, yaml.dump(obj), "utf-8");
  tempFiles.push(path);
  return path;
}

afterEach(() => {
  for (const f of tempFiles) {
    try {
      unlinkSync(f);
    } catch {
      // ignore
    }
  }
  tempFiles.length = 0;
});

describe("coverage — weighted scoring", () => {
  it("reports weights summing to ~1.0 for a 100%-covered Annex IV declaration", () => {
    const cov = coverage(resolve(EXAMPLES_DIR, "minimal.yaml"));
    expect(cov.profile).toBe("annex-iv");
    expect(cov.weightedScore).toBeCloseTo(1.0, 2);
    const sum = Object.values(cov.weights ?? {}).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("returns a weighted score below 1.0 when sections are missing", () => {
    const doc = yaml.load(
      readFileSync(resolve(EXAMPLES_DIR, "minimal.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    delete doc.risk_management;
    delete doc.post_market_monitoring;
    const path = writeTempYaml(doc);
    const cov = coverage(path);
    expect(cov.weightedScore).toBeLessThan(1.0);
    expect(cov.covered).toBe(7);
    expect(cov.total).toBe(9);
  });

  it("exposes per-section weights keyed by the display label", () => {
    const cov = coverage(resolve(EXAMPLES_DIR, "minimal.yaml"));
    expect(cov.weights).toBeDefined();
    expect(cov.weights!["Section 2 (development)"]).toBeGreaterThan(0);
  });
});
