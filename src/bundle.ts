import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { unzipSync, zipSync } from "fflate";

const MANIFEST_VERSION = "1.0.0";

export interface ManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface Manifest {
  manifest_version: string;
  tool: { name: string; version: string };
  generated_at: string;
  declaration: string;
  files: ManifestFile[];
  retention?: {
    placed_on_market: string;
    retention_until: string;
  };
}

export interface BundleOptions {
  declarationPath: string;
  workspaceRoot: string;
  outputDir: string;
  include?: string[];
  zip?: boolean;
  toolVersion: string;
  retention?: { placedOnMarket: string; retentionUntil: string };
}

export interface BundleResult {
  manifestPath: string;
  manifest: Manifest;
  zipPath?: string;
}

export function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function hashFile(absPath: string): ManifestFile {
  const content = readFileSync(absPath);
  return {
    path: absPath,
    size: statSync(absPath).size,
    sha256: sha256(content),
  };
}

/**
 * Build a tamper-evident manifest binding the declaration and its supporting
 * artefacts. Paths in the manifest are stored RELATIVE to the workspaceRoot
 * so the bundle remains portable.
 */
export function buildBundle(opts: BundleOptions): BundleResult {
  const decl = resolve(opts.declarationPath);
  if (!existsSync(decl)) {
    throw new Error(`Declaration not found: ${opts.declarationPath}`);
  }
  const workspaceRoot = resolve(opts.workspaceRoot);
  const include = (opts.include ?? []).map((p) => resolve(p));

  const candidatePaths = [decl, ...include];
  // Auto-include schema.yaml and traceability.yaml from the declaration's
  // workspace when present; they're the standard companions of a dossier.
  const workspaceDir = dirname(decl);
  for (const sibling of ["schema.yaml", "traceability.yaml"]) {
    const candidate = resolve(workspaceDir, sibling);
    if (existsSync(candidate) && !candidatePaths.includes(candidate)) {
      candidatePaths.push(candidate);
    }
  }

  const files: ManifestFile[] = candidatePaths.map((abs) => {
    const file = hashFile(abs);
    return { ...file, path: relative(workspaceRoot, abs) || basename(abs) };
  });

  const manifest: Manifest = {
    manifest_version: MANIFEST_VERSION,
    tool: { name: "actcheck", version: opts.toolVersion },
    generated_at: new Date().toISOString(),
    declaration: relative(workspaceRoot, decl) || basename(decl),
    files,
    ...(opts.retention
      ? {
          retention: {
            placed_on_market: opts.retention.placedOnMarket,
            retention_until: opts.retention.retentionUntil,
          },
        }
      : {}),
  };

  const outputDir = resolve(opts.outputDir);
  const manifestPath = resolve(outputDir, "manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );

  let zipPath: string | undefined;
  if (opts.zip) {
    zipPath = resolve(outputDir, "bundle.zip");
    const entries: Record<string, Uint8Array> = {};
    entries["manifest.json"] = new TextEncoder().encode(
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    for (let i = 0; i < candidatePaths.length; i++) {
      const abs = candidatePaths[i];
      const relPath = files[i].path;
      entries[relPath] = new Uint8Array(readFileSync(abs));
    }
    writeFileSync(zipPath, Buffer.from(zipSync(entries)));
  }

  return { manifestPath, manifest, zipPath };
}

export type VerifyStatus = "ok" | "tampered" | "missing";

export interface VerifyEntry {
  path: string;
  expected: string;
  actual?: string;
  status: VerifyStatus;
}

export interface VerifyResult {
  ok: boolean;
  entries: VerifyEntry[];
  manifest: Manifest;
}

export function verifyManifest(
  manifestPath: string,
  baseDir?: string,
): VerifyResult {
  const isZip = manifestPath.endsWith(".zip");
  const manifest = isZip
    ? readManifestFromZip(manifestPath)
    : (JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest);
  const base = baseDir
    ? resolve(baseDir)
    : isZip
      ? "" // checked from the zip itself
      : dirname(resolve(manifestPath));

  const zipEntries = isZip ? readAllFromZip(manifestPath) : null;

  const entries: VerifyEntry[] = manifest.files.map((file) => {
    let actualBuf: Buffer | undefined;
    if (zipEntries) {
      const buf = zipEntries[file.path];
      if (buf) actualBuf = Buffer.from(buf);
    } else {
      const abs = resolve(base, file.path);
      if (existsSync(abs)) actualBuf = readFileSync(abs);
    }

    if (!actualBuf) {
      return {
        path: file.path,
        expected: file.sha256,
        status: "missing",
      };
    }
    const actual = sha256(actualBuf);
    return {
      path: file.path,
      expected: file.sha256,
      actual,
      status: actual === file.sha256 ? "ok" : "tampered",
    };
  });

  return {
    ok: entries.every((e) => e.status === "ok"),
    entries,
    manifest,
  };
}

function readManifestFromZip(zipPath: string): Manifest {
  const buf = readFileSync(zipPath);
  const entries = unzipSync(new Uint8Array(buf));
  const manifestEntry = entries["manifest.json"];
  if (!manifestEntry) {
    throw new Error("bundle.zip does not contain manifest.json");
  }
  return JSON.parse(
    new TextDecoder().decode(manifestEntry),
  ) as Manifest;
}

function readAllFromZip(zipPath: string): Record<string, Uint8Array> {
  const buf = readFileSync(zipPath);
  return unzipSync(new Uint8Array(buf));
}
