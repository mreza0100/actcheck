import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { classifyDeclaration } from "../src/classify.js";

const CLI = resolve("dist/cli.js");
const tempFiles: string[] = [];

function writeTempYaml(obj: any): string {
  const path = join(
    tmpdir(),
    `actcheck-classify-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
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

describe("classifyDeclaration — Article 43 routing", () => {
  it("returns 'prohibited' when an Article 5 practice is claimed, regardless of risk_level", () => {
    const r = classifyDeclaration({
      risk_classification: {
        risk_level: "high",
        prohibited_practices_claimed: ["social_scoring"],
      },
    });
    expect(r.art43Route.id).toBe("prohibited");
    expect(r.art43Route.citation).toBe("Article 5");
  });

  it("returns 'prohibited' when risk_level is 'unacceptable'", () => {
    const r = classifyDeclaration({
      risk_classification: { risk_level: "unacceptable" },
    });
    expect(r.art43Route.id).toBe("prohibited");
  });

  it("returns the sectoral route when product_harmonisation Annex I Section A applies", () => {
    const r = classifyDeclaration({
      risk_classification: {
        risk_level: "high",
        use_case_tags: ["employment_workers_management"],
      },
      product_harmonisation: { under_annex_i_section_a: true },
    });
    expect(r.art43Route.id).toBe("sectoral-product-harmonisation");
    expect(r.art43Route.citation).toBe("Article 43(3)");
  });

  it("returns the Annex VII (Notified Body) route for Annex III(1) biometrics", () => {
    const r = classifyDeclaration({
      risk_classification: {
        risk_level: "high",
        use_case_tags: ["biometrics"],
      },
    });
    expect(r.art43Route.id).toBe("annex-vii-notified-body");
    expect(r.art43Route.citation).toBe("Article 43(1)");
  });

  it("returns the Annex VI (internal control) route for other high-risk systems", () => {
    const r = classifyDeclaration({
      risk_classification: {
        risk_level: "high",
        use_case_tags: ["education_vocational_training"],
      },
    });
    expect(r.art43Route.id).toBe("annex-vi-internal-control");
    expect(r.art43Route.citation).toBe("Article 43(2)");
  });

  it("returns the transparency-only route for limited risk", () => {
    const r = classifyDeclaration({
      risk_classification: { risk_level: "limited" },
    });
    expect(r.art43Route.id).toBe("transparency-only");
    expect(r.art43Route.citation).toBe("Article 50");
  });

  it("returns the voluntary route for minimal risk", () => {
    const r = classifyDeclaration({
      risk_classification: { risk_level: "minimal" },
    });
    expect(r.art43Route.id).toBe("voluntary");
  });

  it("returns the 'unknown' route when no risk_classification block exists", () => {
    const r = classifyDeclaration({});
    expect(r.art43Route.id).toBe("unknown");
    expect(r.riskLevel).toBe("unset");
  });
});

// Regression: --json was unconditionally exiting 0, masking 'prohibited' routes
// from CI integrators piping classify output into jq. Both human and machine
// output paths must surface the same exit code.
describe("classify CLI — exit-code parity between --json and human output", () => {
  it("exits 1 for a prohibited route in human-readable mode", () => {
    const fixture = writeTempYaml({
      risk_classification: {
        risk_level: "high",
        prohibited_practices_claimed: ["social_scoring"],
      },
    });
    const r = spawnSync("node", [CLI, "classify", fixture], {
      encoding: "utf-8",
    });
    expect(r.status).toBe(1);
  });

  it("exits 1 for a prohibited route in --json mode (regression)", () => {
    const fixture = writeTempYaml({
      risk_classification: {
        risk_level: "high",
        prohibited_practices_claimed: ["social_scoring"],
      },
    });
    const r = spawnSync("node", [CLI, "classify", fixture, "--json"], {
      encoding: "utf-8",
    });
    expect(r.status).toBe(1);
    // The JSON must still be parseable on stdout despite the non-zero exit.
    expect(() => JSON.parse(r.stdout)).not.toThrow();
  });

  it("exits 0 for a non-prohibited route in --json mode", () => {
    const fixture = writeTempYaml({
      risk_classification: { risk_level: "limited" },
    });
    const r = spawnSync("node", [CLI, "classify", fixture, "--json"], {
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
  });
});
