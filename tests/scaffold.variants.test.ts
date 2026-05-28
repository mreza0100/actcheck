import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DECLARATION_PATH,
  scaffoldWorkspace,
} from "../src/scaffold.js";
import { validate } from "../src/validator.js";

const tempDirs: string[] = [];

function makeCwd(): string {
  const d = mkdtempSync(join(tmpdir(), "actcheck-variant-"));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  tempDirs.length = 0;
});

describe("scaffoldWorkspace — risk-class variants", () => {
  it("prepends a risk_classification block when riskClass is 'high'", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd, { riskClass: "high" });
    const decl = readFileSync(join(cwd, DEFAULT_DECLARATION_PATH), "utf-8");
    expect(decl.startsWith("risk_classification:")).toBe(true);
    expect(decl).toContain("risk_level: high");
    expect(decl).toContain("use_case_tags:");
  });

  it("prepends a risk_level: minimal block when riskClass is 'minimal'", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd, { riskClass: "minimal" });
    const decl = readFileSync(join(cwd, DEFAULT_DECLARATION_PATH), "utf-8");
    expect(decl).toContain("risk_level: minimal");
    expect(decl).not.toContain("use_case_tags:");
  });

  it("adds a GPAI header note when gpai is true", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd, { gpai: true });
    const decl = readFileSync(join(cwd, DEFAULT_DECLARATION_PATH), "utf-8");
    expect(decl).toContain("GPAI provider note");
    expect(decl).toContain("Annex XI");
  });

  it("combines riskClass and gpai when both are passed", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd, { riskClass: "limited", gpai: true });
    const decl = readFileSync(join(cwd, DEFAULT_DECLARATION_PATH), "utf-8");
    expect(decl).toContain("GPAI provider note");
    expect(decl).toContain("risk_level: limited");
  });

  it("a 'limited' or 'minimal' scaffold validates out of the box", () => {
    for (const riskClass of ["limited", "minimal"] as const) {
      const cwd = makeCwd();
      scaffoldWorkspace(cwd, { riskClass });
      const result = validate(join(cwd, DEFAULT_DECLARATION_PATH));
      expect(result.valid).toBe(true);
    }
  });

  it("default scaffold (no flags) still produces a byte-equal copy of the template", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);
    const scaffolded = readFileSync(
      join(cwd, DEFAULT_DECLARATION_PATH),
      "utf-8",
    );
    const canonical = readFileSync(
      "schemas/annex-iv/v1/template.yaml",
      "utf-8",
    );
    expect(scaffolded).toBe(canonical);
  });

  it("the bundled .actcheck/ workspace is created even with variants", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd, { riskClass: "high", gpai: true });
    expect(existsSync(join(cwd, ".actcheck/schema.yaml"))).toBe(true);
    expect(existsSync(join(cwd, ".actcheck/traceability.yaml"))).toBe(true);
    expect(existsSync(join(cwd, ".actcheck/README.md"))).toBe(true);
  });
});
