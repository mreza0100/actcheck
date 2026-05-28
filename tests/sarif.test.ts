import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { buildSarif } from "../src/sarif.js";
import { validate } from "../src/validator.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempFiles: string[] = [];

function writeTempYaml(content: string): string {
  const path = resolve(
    tmpdir(),
    `actcheck-sarif-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
  );
  writeFileSync(path, content, "utf-8");
  tempFiles.push(path);
  return path;
}

function minimalDoc(): Record<string, any> {
  return yaml.load(
    readFileSync(resolve(EXAMPLES_DIR, "minimal.yaml"), "utf-8"),
  ) as Record<string, any>;
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

describe("SARIF emitter", () => {
  it("produces a SARIF 2.1.0 document with one run and the actcheck driver", () => {
    const path = resolve(EXAMPLES_DIR, "minimal.yaml");
    const result = validate(path);
    const log = buildSarif(path, result, "0.0.0-test") as any;
    expect(log.version).toBe("2.1.0");
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0].tool.driver.name).toBe("actcheck");
    expect(log.runs[0].tool.driver.version).toBe("0.0.0-test");
  });

  it("emits one SARIF result per validation error with a physical location", () => {
    const doc = minimalDoc();
    doc.risk_classification = {
      risk_level: "high",
      prohibited_practices_claimed: ["social_scoring"],
    };
    const path = writeTempYaml(yaml.dump(doc));
    const result = validate(path);
    const log = buildSarif(path, result, "test") as any;
    expect(log.runs[0].results.length).toBeGreaterThan(0);
    const art5 = log.runs[0].results.find(
      (r: any) => r.ruleId === "annex-iv/art-5",
    );
    expect(art5).toBeDefined();
    expect(art5.level).toBe("error");
    expect(art5.locations[0].physicalLocation.artifactLocation.uri).toBe(path);
    expect(art5.locations[0].physicalLocation.region.startLine).toBeGreaterThan(
      0,
    );
  });

  it("points at the actual line/column of the offending field", () => {
    // Build a small declaration where we know risk_classification sits on a
    // specific line; SARIF region.startLine must match.
    const content = [
      "actcheck:",
      "  schema_version: '1.0.0'",
      "risk_classification:",
      "  risk_level: limited",
      "  use_case_tags: [employment_workers_management]",
      "  prohibited_practices_claimed: []",
      "general_description:",
      "  intended_purpose: 'too short'",
    ].join("\n");
    const path = writeTempYaml(content);
    const result = validate(path);
    const log = buildSarif(path, result, "test") as any;
    const annexIii = log.runs[0].results.find((r: any) =>
      r.message.text.includes("Annex III"),
    );
    expect(annexIii).toBeDefined();
    // 'risk_level: limited' is on line 4 in the synthetic doc above.
    expect(annexIii.locations[0].physicalLocation.region.startLine).toBe(4);
  });
});
