import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadDeclaration } from "../validator.js";
import { renderDocx } from "./docx.js";
import { renderHtml } from "./html.js";
import { renderPdf } from "./pdf.js";
import { buildIr } from "./ir.js";

export type RenderFormat = "html" | "docx" | "pdf";

export interface RenderOptions {
  declarationPath: string;
  outputPath: string;
  format: RenderFormat;
  toolVersion: string;
  /** PDF/A-2b conformance is not yet wired (font + ICC profile work). */
  pdfa?: boolean;
}

export async function renderToFile(opts: RenderOptions): Promise<void> {
  const declaration = loadDeclaration(opts.declarationPath);
  const doc = buildIr({
    declaration,
    toolVersion: opts.toolVersion,
  });

  if (opts.pdfa) {
    throw new Error(
      "PDF/A-2b output is not yet conformant — see https://github.com/mreza0100/actcheck/issues for the bundled-font + sRGB ICC roadmap. Drop --pdfa to render a non-archival PDF.",
    );
  }

  switch (opts.format) {
    case "html":
      writeFileSync(resolve(opts.outputPath), renderHtml(doc), "utf-8");
      return;
    case "docx": {
      const buf = await renderDocx(doc);
      writeFileSync(resolve(opts.outputPath), buf);
      return;
    }
    case "pdf": {
      const bytes = await renderPdf(doc);
      writeFileSync(resolve(opts.outputPath), Buffer.from(bytes));
      return;
    }
  }
}

export { buildIr } from "./ir.js";
