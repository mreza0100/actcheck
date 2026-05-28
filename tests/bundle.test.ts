import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle, sha256, verifyManifest } from "../src/bundle.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempDirs: string[] = [];

function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "actcheck-bundle-"));
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

function fixtureDecl(): { path: string; cwd: string } {
  const cwd = makeTmp();
  const path = join(cwd, "decl.yaml");
  const doc = yaml.load(
    readFileSync(resolve(EXAMPLES_DIR, "minimal.yaml"), "utf-8"),
  ) as any;
  writeFileSync(path, yaml.dump(doc), "utf-8");
  return { path, cwd };
}

describe("buildBundle", () => {
  it("produces a manifest.json with sha256 for the declaration", () => {
    const { path, cwd } = fixtureDecl();
    const result = buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      toolVersion: "test",
    });
    expect(result.manifestPath).toBe(join(cwd, "manifest.json"));
    expect(result.manifest.files.length).toBe(1);
    expect(result.manifest.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.manifest.tool.name).toBe("actcheck");
  });

  it("includes additional --include files in the manifest", () => {
    const { path, cwd } = fixtureDecl();
    const extra = join(cwd, "evidence.txt");
    writeFileSync(extra, "training-log\n", "utf-8");
    const result = buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      include: [extra],
      toolVersion: "test",
    });
    expect(result.manifest.files.length).toBe(2);
    expect(result.manifest.files.some((f) => f.path.endsWith("evidence.txt"))).toBe(
      true,
    );
  });

  it("creates a bundle.zip when --zip is set", () => {
    const { path, cwd } = fixtureDecl();
    const result = buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      zip: true,
      toolVersion: "test",
    });
    expect(result.zipPath).toBe(join(cwd, "bundle.zip"));
    const zipBuf = readFileSync(result.zipPath!);
    // ZIP signature is 0x50 0x4B 0x03 0x04 (PK..)
    expect(zipBuf[0]).toBe(0x50);
    expect(zipBuf[1]).toBe(0x4b);
  });
});

describe("verifyManifest", () => {
  it("reports 'ok' for an unmodified bundle", () => {
    const { path, cwd } = fixtureDecl();
    buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      toolVersion: "test",
    });
    const result = verifyManifest(join(cwd, "manifest.json"));
    expect(result.ok).toBe(true);
    expect(result.entries.every((e) => e.status === "ok")).toBe(true);
  });

  it("reports 'tampered' when the declaration is modified after bundling", () => {
    const { path, cwd } = fixtureDecl();
    buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      toolVersion: "test",
    });
    // Tamper with the declaration.
    writeFileSync(path, readFileSync(path, "utf-8") + "\n# tampered\n", "utf-8");
    const result = verifyManifest(join(cwd, "manifest.json"));
    expect(result.ok).toBe(false);
    expect(result.entries.some((e) => e.status === "tampered")).toBe(true);
  });

  it("reports 'missing' when a file referenced by the manifest is removed", () => {
    const { path, cwd } = fixtureDecl();
    buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      toolVersion: "test",
    });
    rmSync(path);
    const result = verifyManifest(join(cwd, "manifest.json"));
    expect(result.ok).toBe(false);
    expect(result.entries.some((e) => e.status === "missing")).toBe(true);
  });

  it("verifies a bundle.zip without needing the original files on disk", () => {
    const { path, cwd } = fixtureDecl();
    const result = buildBundle({
      declarationPath: path,
      workspaceRoot: cwd,
      outputDir: cwd,
      zip: true,
      toolVersion: "test",
    });
    // Remove originals; the zip should still verify itself.
    rmSync(path);
    rmSync(join(cwd, "manifest.json"));
    const verify = verifyManifest(result.zipPath!);
    expect(verify.ok).toBe(true);
  });
});

describe("sha256", () => {
  it("is stable for a given input", () => {
    const a = sha256(Buffer.from("hello"));
    const b = sha256(Buffer.from("hello"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
