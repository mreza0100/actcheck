import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderToFile } from "../src/render/index.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempDirs: string[] = [];

function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "actcheck-render-"));
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

describe("renderToFile — HTML", () => {
  it("produces a well-formed HTML document with title + cover + section headings", async () => {
    const decl = resolve(EXAMPLES_DIR, "minimal.yaml");
    const out = join(makeTmp(), "out.html");
    await renderToFile({
      declarationPath: decl,
      outputPath: out,
      format: "html",
      toolVersion: "test",
    });
    const html = readFileSync(out, "utf-8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("EU AI Act");
    expect(html).toContain("General description");
    expect(html).toContain('<footer>');
  });
});

describe("renderToFile — DOCX", () => {
  it("produces a non-empty DOCX file with the ZIP signature", async () => {
    const decl = resolve(EXAMPLES_DIR, "minimal.yaml");
    const out = join(makeTmp(), "out.docx");
    await renderToFile({
      declarationPath: decl,
      outputPath: out,
      format: "docx",
      toolVersion: "test",
    });
    expect(existsSync(out)).toBe(true);
    const buf = readFileSync(out);
    expect(buf.length).toBeGreaterThan(2000);
    // DOCX is a ZIP container.
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

describe("renderToFile — PDF", () => {
  it("produces a non-empty PDF file with the %PDF- header", async () => {
    const decl = resolve(EXAMPLES_DIR, "minimal.yaml");
    const out = join(makeTmp(), "out.pdf");
    await renderToFile({
      declarationPath: decl,
      outputPath: out,
      format: "pdf",
      toolVersion: "test",
    });
    expect(existsSync(out)).toBe(true);
    const buf = readFileSync(out);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});

describe("renderToFile — PDF/A flag", () => {
  it("errors with a clear deferred message when --pdfa is requested", async () => {
    const decl = resolve(EXAMPLES_DIR, "minimal.yaml");
    const out = join(makeTmp(), "out.pdf");
    await expect(
      renderToFile({
        declarationPath: decl,
        outputPath: out,
        format: "pdf",
        toolVersion: "test",
        pdfa: true,
      }),
    ).rejects.toThrow(/PDF\/A-2b/);
  });
});
