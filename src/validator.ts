import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import yaml from "js-yaml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvConstructor = (Ajv2020 as any).default ?? Ajv2020;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormatsToAjv = (addFormats as any).default ?? addFormats;

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ValidationError {
  path: string;
  message: string;
  annexIvRef: string;
  requirement: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  errorCount: number;
}

export interface CoverageResult {
  covered: number;
  total: number;
  percentage: number;
  details: Record<string, boolean>;
}

export function loadSchema(version = "v1"): Record<string, unknown> {
  const schemaPath = resolve(
    __dirname,
    "..",
    "schemas",
    "annex-iv",
    version,
    "schema.yaml",
  );
  const content = readFileSync(schemaPath, "utf-8");
  return yaml.load(content) as Record<string, unknown>;
}

export function loadDeclaration(path: string): Record<string, unknown> {
  const content = readFileSync(resolve(path), "utf-8");
  return yaml.load(content) as Record<string, unknown>;
}

function resolveAnnotation(
  schema: Record<string, unknown>,
  dataPath: string,
  annotation: string,
): string {
  const segments = dataPath
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);

  let current: Record<string, unknown> = schema;

  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      const items = current["items"] as Record<string, unknown> | undefined;
      if (items) current = items;
      continue;
    }

    // Follow $ref if present
    if (current["$ref"]) {
      const ref = current["$ref"] as string;
      const refPath = ref.replace("#/", "").split("/");
      let target: Record<string, unknown> = schema;
      for (const part of refPath) {
        target = (target[part] ?? {}) as Record<string, unknown>;
      }
      current = target;
    }

    const props = current["properties"] as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (props && props[segment]) {
      current = props[segment];
    } else {
      const defs = current["$defs"] as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (defs && defs[segment]) {
        current = defs[segment];
      } else {
        return "";
      }
    }
  }

  return (current[annotation] as string) ?? "";
}

export function validate(
  declarationPath: string,
  schemaVersion?: string,
): ValidationResult {
  const declaration = loadDeclaration(declarationPath);

  if (!schemaVersion) {
    const actcheckMeta = declaration["actcheck"] as
      | Record<string, unknown>
      | undefined;
    const sv = (actcheckMeta?.["schema_version"] as string) ?? "1.0.0";
    const major = sv.split(".")[0] ?? "1";
    schemaVersion = `v${major}`;
  }

  const schema = loadSchema(schemaVersion);

  const ajv = new AjvConstructor({ allErrors: true, strict: false });
  addFormatsToAjv(ajv);

  const compiledValidate = ajv.compile(schema);
  const valid = compiledValidate(declaration);

  if (valid) {
    return { valid: true, errors: [], errorCount: 0 };
  }

  const errors: ValidationError[] = (compiledValidate.errors ?? []).map(
    (err: ErrorObject) => {
      const path = err.instancePath
        ? err.instancePath.replace(/\//g, ".").slice(1)
        : "(root)";

      const annexIvRef = err.instancePath
        ? resolveAnnotation(schema, err.instancePath, "x-annex-iv")
        : "";

      const requirement = err.instancePath
        ? resolveAnnotation(schema, err.instancePath, "x-requirement")
        : "";

      let message = err.message ?? "validation error";
      if (err.keyword === "required" && err.params) {
        const missing = (err.params as { missingProperty?: string })
          .missingProperty;
        if (missing) {
          message = `'${missing}' is a required property`;
        }
      }

      return { path, message, annexIvRef, requirement };
    },
  );

  return { valid: false, errors, errorCount: errors.length };
}

export function coverage(declarationPath: string): CoverageResult {
  const declaration = loadDeclaration(declarationPath);

  const sections: Record<string, string> = {
    "1": "general_description",
    "2": "development",
    "3": "monitoring",
    "4": "performance_metrics",
    "5": "risk_management",
    "6": "lifecycle_changes",
    "7": "standards",
    "8": "declaration_of_conformity",
    "9": "post_market_monitoring",
  };

  let covered = 0;
  const total = Object.keys(sections).length;
  const details: Record<string, boolean> = {};

  for (const [num, key] of Object.entries(sections)) {
    const present = key in declaration && declaration[key] != null;
    details[`Section ${num} (${key})`] = present;
    if (present) covered++;
  }

  return {
    covered,
    total,
    percentage: Math.round((covered / total) * 1000) / 10,
    details,
  };
}
