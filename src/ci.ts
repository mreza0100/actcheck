import { appendFileSync } from "node:fs";
import {
  LineCounter,
  parseDocument,
  type Document,
} from "yaml";
import { readFileSync } from "node:fs";
import { pathToPosition } from "./sarif.js";
import type { ValidationError, ValidationResult } from "./validator.js";

export type CiProvider = "off" | "github";
export type FailOn = "error" | "warning";

/**
 * Emit GitHub Actions workflow commands (one per error) and append a markdown
 * step summary if `$GITHUB_STEP_SUMMARY` is set. No-op when provider is 'off'
 * or when we're not actually running inside a GitHub workflow.
 */
export function emitCiOutput(
  declarationPath: string,
  result: ValidationResult,
  provider: CiProvider,
): void {
  if (provider !== "github") return;

  const source = (() => {
    try {
      return readFileSync(declarationPath, "utf-8");
    } catch {
      return "";
    }
  })();
  const lineCounter = new LineCounter();
  const doc = source
    ? parseDocument(source, { lineCounter })
    : undefined;

  for (const err of result.errors) {
    writeAnnotation(declarationPath, err, doc, lineCounter);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, renderSummary(declarationPath, result));
    } catch {
      // Best-effort — summary is a nicety, not a contract.
    }
  }
}

function writeAnnotation(
  filePath: string,
  err: ValidationError,
  doc: Document.Parsed | undefined,
  lineCounter: LineCounter,
): void {
  let line = 1;
  let col = 1;
  if (doc) {
    const pos = pathToPosition(doc, lineCounter, err.path);
    line = pos.startLine;
    col = pos.startColumn;
  }
  const level = err.severity === "warning" ? "warning" : "error";
  const annex = err.annexIvRef ? ` [Annex IV(${err.annexIvRef})]` : "";
  const title = err.annexIvRef ? `Annex IV ${err.annexIvRef}` : "actcheck";
  // GitHub workflow command: any literal newlines/CR in `message=` break the
  // parser, so we escape them per the documented %0A / %0D encoding.
  const message = `${err.path}: ${err.message}${annex}`
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
  process.stdout.write(
    `::${level} file=${filePath},line=${line},col=${col},title=${title}::${message}\n`,
  );
}

export function renderSummary(
  declarationPath: string,
  result: ValidationResult,
): string {
  const lines: string[] = [];
  lines.push(`## actcheck — \`${declarationPath}\``);
  lines.push("");
  if (result.valid && result.errors.length === 0) {
    lines.push("✅ Schema-valid, no findings.");
  } else if (result.valid) {
    lines.push(
      `⚠ Schema-valid with ${result.errors.length} warning(s).`,
    );
  } else {
    lines.push(`❌ INVALID — ${result.errorCount} error(s).`);
  }
  lines.push("");
  if (result.errors.length > 0) {
    lines.push("| Severity | Path | Message | Annex IV |");
    lines.push("| --- | --- | --- | --- |");
    for (const err of result.errors) {
      const sev = err.severity === "warning" ? "warning" : "error";
      lines.push(
        `| ${sev} | \`${err.path}\` | ${escapeMd(err.message)} | ${err.annexIvRef || "—"} |`,
      );
    }
    lines.push("");
  }
  if (result.retention) {
    lines.push(
      `**Article 18(1) retention:** \`${result.retention.placedOnMarket}\` → \`${result.retention.retentionUntil}\`${result.retention.mismatch ? " ⚠ declared value mismatch" : ""}`,
    );
    lines.push("");
  }
  return lines.join("\n");
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Decide the process exit code given the fail-on policy.
 */
export function exitCodeFor(result: ValidationResult, failOn: FailOn): number {
  if (!result.valid) return 1;
  if (failOn === "warning" && result.errors.length > 0) return 1;
  return 0;
}
