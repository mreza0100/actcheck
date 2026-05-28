import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { emitCiOutput, exitCodeFor, renderSummary } from "../src/ci.js";
import { validate, type ValidationResult } from "../src/validator.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempDirs: string[] = [];

function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "actcheck-ci-"));
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

function captureStdout(fn: () => void): string {
  const chunks: Buffer[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  // @ts-expect-error - test-only stdout monkey-patch
  process.stdout.write = (data: string | Buffer): boolean => {
    chunks.push(Buffer.from(typeof data === "string" ? data : data));
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return Buffer.concat(chunks).toString("utf-8");
}

describe("GitHub Actions CI gate", () => {
  it("emits one ::error workflow command per validation error", () => {
    const declPath = resolve(EXAMPLES_DIR, "minimal.yaml");
    const doc = yaml.load(readFileSync(declPath, "utf-8")) as any;
    doc.risk_classification = {
      risk_level: "high",
      prohibited_practices_claimed: ["social_scoring"],
    };
    const tmpFile = join(makeTmp(), "decl.yaml");
    writeFileSync(tmpFile, yaml.dump(doc), "utf-8");

    const result = validate(tmpFile);
    const out = captureStdout(() => emitCiOutput(tmpFile, result, "github"));
    expect(out).toContain("::error file=");
    expect(out).toContain("Art. 5");
    expect(out).toMatch(/line=\d+/);
  });

  it("is a no-op when provider is 'off'", () => {
    const declPath = resolve(EXAMPLES_DIR, "minimal.yaml");
    const result = validate(declPath);
    const out = captureStdout(() => emitCiOutput(declPath, result, "off"));
    expect(out).toBe("");
  });

  it("appends a markdown summary to $GITHUB_STEP_SUMMARY", () => {
    const declPath = resolve(EXAMPLES_DIR, "minimal.yaml");
    const result = validate(declPath);
    const summaryPath = join(makeTmp(), "summary.md");
    writeFileSync(summaryPath, "", "utf-8");
    const prevEnv = process.env.GITHUB_STEP_SUMMARY;
    process.env.GITHUB_STEP_SUMMARY = summaryPath;
    try {
      // Capture stdout to silence annotations during the test.
      captureStdout(() => emitCiOutput(declPath, result, "github"));
    } finally {
      if (prevEnv === undefined) delete process.env.GITHUB_STEP_SUMMARY;
      else process.env.GITHUB_STEP_SUMMARY = prevEnv;
    }
    const md = readFileSync(summaryPath, "utf-8");
    expect(md).toContain("actcheck");
    expect(md).toContain("Schema-valid");
  });
});

describe("exitCodeFor", () => {
  function ok(): ValidationResult {
    return { valid: true, errors: [], errorCount: 0 };
  }
  function withWarning(): ValidationResult {
    return {
      valid: true,
      errors: [
        {
          path: "x",
          message: "y",
          annexIvRef: "",
          requirement: "",
          severity: "warning",
        },
      ],
      errorCount: 0,
    };
  }
  function invalid(): ValidationResult {
    return {
      valid: false,
      errors: [
        {
          path: "x",
          message: "y",
          annexIvRef: "",
          requirement: "",
          severity: "error",
        },
      ],
      errorCount: 1,
    };
  }

  it("returns 0 for a clean valid result", () => {
    expect(exitCodeFor(ok(), "error")).toBe(0);
  });
  it("returns 1 for invalid regardless of fail-on", () => {
    expect(exitCodeFor(invalid(), "error")).toBe(1);
    expect(exitCodeFor(invalid(), "warning")).toBe(1);
  });
  it("returns 0 on warnings under fail-on=error", () => {
    expect(exitCodeFor(withWarning(), "error")).toBe(0);
  });
  it("returns 1 on warnings under fail-on=warning", () => {
    expect(exitCodeFor(withWarning(), "warning")).toBe(1);
  });
});

describe("renderSummary", () => {
  it("renders the valid headline when there are no findings", () => {
    expect(renderSummary("p.yaml", { valid: true, errors: [], errorCount: 0 }))
      .toContain("Schema-valid");
  });
  it("renders the invalid headline with the error count", () => {
    const md = renderSummary("p.yaml", {
      valid: false,
      errors: [
        {
          path: "x",
          message: "y",
          annexIvRef: "art-5",
          requirement: "",
          severity: "error",
        },
      ],
      errorCount: 1,
    });
    expect(md).toContain("INVALID");
    expect(md).toContain("art-5");
  });
});
