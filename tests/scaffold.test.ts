import { resolve, join } from "node:path";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  DECLARATION_FILE,
  DEFAULT_DECLARATION_PATH,
  WORKSPACE_DIR,
  resolveSkillInstallDir,
  scaffoldWorkspace,
} from "../src/scaffold.js";
import { validate } from "../src/validator.js";

const tempDirs: string[] = [];

function makeCwd(): string {
  const dir = mkdtempSync(join(tmpdir(), "actcheck-scaffold-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  tempDirs.length = 0;
});

describe("scaffoldWorkspace", () => {
  it("creates the .actcheck workspace with all expected files", () => {
    const cwd = makeCwd();
    const result = scaffoldWorkspace(cwd);

    expect(result.workspacePath).toBe(resolve(cwd, WORKSPACE_DIR));
    for (const name of [
      DECLARATION_FILE,
      "schema.yaml",
      "traceability.yaml",
      "README.md",
    ]) {
      expect(existsSync(join(result.workspacePath, name))).toBe(true);
    }
  });

  it("copies the canonical template verbatim into the declaration file", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);

    const scaffolded = readFileSync(
      join(cwd, DEFAULT_DECLARATION_PATH),
      "utf-8",
    );
    const canonical = readFileSync(
      resolve("schemas/annex-iv/v1/template.yaml"),
      "utf-8",
    );
    expect(scaffolded).toBe(canonical);
  });

  it("produces a declaration that is schema-valid out of the box", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);

    const result = validate(join(cwd, DEFAULT_DECLARATION_PATH));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("refuses to overwrite an existing workspace without force", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);
    expect(() => scaffoldWorkspace(cwd)).toThrow(/already exists/);
  });

  it("overwrites an existing workspace when force is set", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);
    expect(() => scaffoldWorkspace(cwd, true)).not.toThrow();
  });
});

describe("skill install", () => {
  it("installs the skill (with its law resource) into .actcheck when no agent dir exists", () => {
    const cwd = makeCwd();
    scaffoldWorkspace(cwd);
    const base = join(cwd, WORKSPACE_DIR, "skills", "actcheck");
    expect(existsSync(join(base, "SKILL.md"))).toBe(true);
    expect(existsSync(join(base, "resources", "reg-2024-1689-full.txt"))).toBe(true);
  });

  it("installs into an existing .claude/skills dir instead of .actcheck", () => {
    const cwd = makeCwd();
    mkdirSync(join(cwd, ".claude"));
    scaffoldWorkspace(cwd);
    expect(existsSync(join(cwd, ".claude", "skills", "actcheck", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, WORKSPACE_DIR, "skills", "actcheck"))).toBe(false);
  });

  it("resolveSkillInstallDir prefers .claude, then .codex, then .actcheck", () => {
    const both = makeCwd();
    mkdirSync(join(both, ".claude"));
    mkdirSync(join(both, ".codex"));
    expect(resolveSkillInstallDir(both)).toBe(join(".claude", "skills", "actcheck"));

    const codexOnly = makeCwd();
    mkdirSync(join(codexOnly, ".codex"));
    expect(resolveSkillInstallDir(codexOnly)).toBe(join(".codex", "skills", "actcheck"));

    const neither = makeCwd();
    expect(resolveSkillInstallDir(neither)).toBe(join(WORKSPACE_DIR, "skills", "actcheck"));
  });
});
