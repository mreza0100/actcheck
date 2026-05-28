import { readFileSync } from "node:fs";
import {
  LineCounter,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document,
  type Node,
} from "yaml";
import type { ValidationError, ValidationResult } from "./validator.js";

const TOOL_INFORMATION_URI = "https://github.com/mreza0100/actcheck";

export interface SarifPosition {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Build a SARIF 2.1.0 log for a validation result. The YAML is re-parsed with
 * source positions so each error can point at the offending line/column.
 */
export function buildSarif(
  declarationPath: string,
  result: ValidationResult,
  toolVersion: string,
): Record<string, unknown> {
  const source = readFileSync(declarationPath, "utf-8");
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter, keepSourceTokens: false });

  const results = result.errors.map((err) =>
    errorToSarifResult(err, doc, lineCounter, declarationPath),
  );

  const ruleSet = new Map<string, Record<string, unknown>>();
  for (const err of result.errors) {
    const ruleId = ruleIdFor(err);
    if (ruleSet.has(ruleId)) continue;
    ruleSet.set(ruleId, {
      id: ruleId,
      name: ruleId,
      shortDescription: {
        text: err.annexIvRef
          ? `EU AI Act ${annexLabel(err.annexIvRef)}`
          : "actcheck validation rule",
      },
      helpUri: TOOL_INFORMATION_URI,
    });
  }

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "actcheck",
            version: toolVersion,
            informationUri: TOOL_INFORMATION_URI,
            rules: Array.from(ruleSet.values()),
          },
        },
        results,
      },
    ],
  };
}

function errorToSarifResult(
  err: ValidationError,
  doc: Document.Parsed,
  lineCounter: LineCounter,
  declarationPath: string,
): Record<string, unknown> {
  const position = pathToPosition(doc, lineCounter, err.path);
  const ruleId = ruleIdFor(err);
  const annexBit = err.annexIvRef
    ? ` [Annex IV(${err.annexIvRef})]`
    : "";

  return {
    ruleId,
    level: err.severity === "warning" ? "warning" : "error",
    message: { text: `${err.message}${annexBit}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: declarationPath },
          region: position,
        },
      },
    ],
  };
}

function ruleIdFor(err: ValidationError): string {
  if (err.annexIvRef) return `annex-iv/${err.annexIvRef}`;
  return "actcheck/structural";
}

function annexLabel(ref: string): string {
  if (ref.startsWith("art-")) return `Article ${ref.slice(4)}`;
  return `Annex IV(${ref})`;
}

/**
 * Walk the YAML AST along a dot-separated path (matching validator error paths)
 * and return the source line/column range of the destination node. Falls back
 * to (1,1) when the path can't be resolved.
 */
export function pathToPosition(
  doc: Document.Parsed,
  lineCounter: LineCounter,
  dottedPath: string,
): SarifPosition {
  const parts = dottedPath
    .split(".")
    .filter((p) => p.length > 0 && p !== "(root)");
  let node: Node | null | undefined = doc.contents as Node;

  for (const part of parts) {
    if (!node) break;
    if (isMap(node)) {
      const pair = node.items.find(
        (p) => isScalar(p.key) && String(p.key.value) === part,
      );
      node = (pair?.value ?? undefined) as Node | undefined;
    } else if (isSeq(node)) {
      const idx = Number.parseInt(part, 10);
      if (Number.isNaN(idx)) {
        node = undefined;
        break;
      }
      node = (node.items[idx] ?? undefined) as Node | undefined;
    } else {
      node = undefined;
    }
  }

  if (!node || !("range" in node) || !node.range) {
    return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  }

  const [start, , end] = node.range;
  const startPos = lineCounter.linePos(start);
  const endPos = lineCounter.linePos(end);
  return {
    startLine: startPos.line,
    startColumn: startPos.col,
    endLine: endPos.line,
    endColumn: Math.max(endPos.col, startPos.col + 1),
  };
}
