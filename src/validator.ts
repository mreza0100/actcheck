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
  /**
   * Severity tier. 'error' breaks validity; 'warning' is informational and does
   * not flip `valid` to false on its own. Defaults to 'error' when omitted.
   */
  severity?: "error" | "warning";
}

export interface RetentionInfo {
  placedOnMarket: string;
  retentionUntil: string;
  /** True when the declaration explicitly carries a retention_until that disagrees with placed_on_market + 10y. */
  mismatch: boolean;
  declaredRetentionUntil?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  errorCount: number;
  /** Derived information surfaced by the validator (computed, not declared). */
  retention?: RetentionInfo;
}

export interface CoverageResult {
  covered: number;
  total: number;
  percentage: number;
  details: Record<string, boolean>;
  /** Per-section weighted score (0..1). Present when weights are available. */
  weightedScore?: number;
  /** Detailed weighted breakdown keyed by the same labels as `details`. */
  weights?: Record<string, number>;
  profile: Profile;
}

// Per-section weights for Annex IV. Sum to 1.0. Rough proxy for how much of
// the regulator-facing dossier each section accounts for in volume + scrutiny.
const ANNEX_IV_WEIGHTS: Record<string, number> = {
  "Section 1 (general_description)": 0.10,
  "Section 2 (development)": 0.25,
  "Section 3 (monitoring)": 0.12,
  "Section 4 (performance_metrics)": 0.05,
  "Section 5 (risk_management)": 0.15,
  "Section 6 (lifecycle_changes)": 0.05,
  "Section 7 (standards)": 0.08,
  "Section 8 (declaration_of_conformity)": 0.05,
  "Section 9 (post_market_monitoring)": 0.15,
};

const ANNEX_XI_WEIGHTS: Record<string, number> = {
  "Section 1.1 (general_description)": 0.40,
  "Section 1.2 (detailed_description)": 0.50,
  "Section 2 (systemic_risk_block, if applicable)": 0.10,
};

export type Profile = "annex-iv" | "annex-xi";

export function loadSchema(
  version = "v1",
  profile: Profile = "annex-iv",
): Record<string, unknown> {
  const schemaPath = resolve(
    __dirname,
    "..",
    "schemas",
    profile,
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
  profile?: Profile,
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

  // Profile precedence: explicit arg > declaration's actcheck.profile > default.
  const declaredProfile = (
    declaration["actcheck"] as Record<string, unknown> | undefined
  )?.["profile"];
  const effectiveProfile: Profile =
    profile ??
    (declaredProfile === "annex-xi" ? "annex-xi" : "annex-iv");

  const schema = loadSchema(schemaVersion, effectiveProfile);

  const ajv = new AjvConstructor({ allErrors: true, strict: false });
  addFormatsToAjv(ajv);

  const compiledValidate = ajv.compile(schema);
  const ajvValid = compiledValidate(declaration);

  const errors: ValidationError[] = [];

  if (!ajvValid) {
    for (const err of compiledValidate.errors ?? []) {
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

      errors.push({ path, message, annexIvRef, requirement, severity: "error" });
    }
  }

  // Semantic rules layered on top of structural validation. Run even when ajv
  // passed — Art 5 and Annex III cross-checks are independent regulatory gates.
  const semanticErrors = runSemanticChecks(declaration);
  errors.push(...semanticErrors);

  const retention = computeRetentionInfo(declaration);

  const hasBlockingError = errors.some((e) => e.severity !== "warning");

  return {
    valid: !hasBlockingError,
    errors,
    errorCount: errors.filter((e) => e.severity !== "warning").length,
    ...(retention ? { retention } : {}),
  };
}

const PROHIBITED_PRACTICE_LABELS: Record<string, string> = {
  subliminal_manipulation: "Art. 5(1)(a) — subliminal/manipulative techniques",
  exploitation_of_vulnerabilities: "Art. 5(1)(b) — exploitation of vulnerabilities",
  social_scoring: "Art. 5(1)(c) — social scoring",
  predictive_policing_individual: "Art. 5(1)(d) — individual predictive policing",
  untargeted_facial_scraping: "Art. 5(1)(e) — untargeted scraping of facial images",
  emotion_recognition_workplace_education:
    "Art. 5(1)(f) — emotion recognition in workplace/education",
  biometric_categorisation_sensitive:
    "Art. 5(1)(g) — biometric categorisation by sensitive attributes",
  real_time_remote_biometric_identification_public_spaces:
    "Art. 5(1)(h) — real-time remote biometric identification in public spaces",
};

/**
 * Cross-cutting regulatory checks that can't be expressed cleanly in JSON Schema:
 *   - Article 5: any prohibited practice claimed is a hard fail.
 *   - Annex III: any high-risk tag used must imply risk_level=high (the schema
 *     enforces this structurally; we layer a clearer error message on top).
 */
export function runSemanticChecks(
  declaration: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const rc = declaration["risk_classification"] as
    | Record<string, unknown>
    | undefined;
  if (!rc) return errors;

  const claimed = rc["prohibited_practices_claimed"];
  if (Array.isArray(claimed) && claimed.length > 0) {
    for (const practice of claimed) {
      const label =
        PROHIBITED_PRACTICE_LABELS[practice as string] ?? String(practice);
      errors.push({
        path: "risk_classification.prohibited_practices_claimed",
        message: `Article 5 prohibited practice claimed: ${label}. Article 5 systems may not be placed on the EU market.`,
        annexIvRef: "art-5",
        requirement: "prohibition",
        severity: "error",
      });
    }
  }

  const tags = rc["use_case_tags"];
  const riskLevel = rc["risk_level"];
  if (Array.isArray(tags) && tags.length > 0 && riskLevel !== "high") {
    errors.push({
      path: "risk_classification.risk_level",
      message: `Annex III tag(s) declared (${tags.join(", ")}) — Article 6(2) classifies this as high-risk; risk_level must be 'high', got '${String(riskLevel ?? "unset")}'.`,
      annexIvRef: "art-6(2)",
      requirement: "required",
      severity: "error",
    });
  }

  return errors;
}

/**
 * Add `yearsAdded` to the date (y, m, d). When the corresponding day does not
 * exist in the target month (Feb 29 → non-leap year), the period ends on the
 * last day of that month per Council Regulation (EEC, Euratom) No 1182/71
 * Article 4(2). Returns an ISO YYYY-MM-DD string.
 */
function addYearsClampingToMonthEnd(
  y: number,
  m: number,
  d: number,
  yearsAdded: number,
): string {
  const targetYear = y + yearsAdded;
  // Day 0 of month (n+1) === last day of month n (JS Date is 0-indexed months).
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, m, 0),
  ).getUTCDate();
  const targetDay = Math.min(d, lastDayOfTargetMonth);
  return `${targetYear}-${String(m).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/**
 * Article 18(1) — providers must keep technical documentation for 10 years
 * after placing the system on the market. If `placed_on_market` is declared,
 * compute the obligation end and flag any mismatch with a declared value.
 */
export function computeRetentionInfo(
  declaration: Record<string, unknown>,
): RetentionInfo | undefined {
  const rc = declaration["risk_classification"] as
    | Record<string, unknown>
    | undefined;
  const placed = rc?.["placed_on_market"];
  if (typeof placed !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(placed)) {
    return undefined;
  }
  const [y, m, d] = placed.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return undefined;
  const retentionUntil = addYearsClampingToMonthEnd(y, m, d, 10);
  const declaredRetention = rc?.["retention_until"];
  const declared =
    typeof declaredRetention === "string" ? declaredRetention : undefined;
  return {
    placedOnMarket: placed,
    retentionUntil,
    mismatch: declared !== undefined && declared !== retentionUntil,
    ...(declared !== undefined ? { declaredRetentionUntil: declared } : {}),
  };
}

/**
 * The marker the template uses for fields a human must replace (`FILL: ...`).
 * A declaration whose values still contain this is structurally valid but not
 * yet authored — the false-confidence case `coverage` and `validate` can't see.
 */
export const PLACEHOLDER_MARKER = "FILL:";

/**
 * Find every string value still containing the `FILL:` placeholder marker.
 * Returns dot-separated paths (array elements as indices) matching the style
 * of validation error paths. Empty array means nothing left to fill.
 */
export function findPlaceholders(declarationPath: string): string[] {
  const declaration = loadDeclaration(declarationPath);
  const hits: string[] = [];

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (node.includes(PLACEHOLDER_MARKER)) hits.push(path);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(declaration, "");
  return hits;
}

export function coverage(
  declarationPath: string,
  profile?: Profile,
): CoverageResult {
  const declaration = loadDeclaration(declarationPath);

  const declaredProfile = (
    declaration["actcheck"] as Record<string, unknown> | undefined
  )?.["profile"];
  const effectiveProfile: Profile =
    profile ??
    (declaredProfile === "annex-xi" ? "annex-xi" : "annex-iv");

  const sectionMap: Record<string, Record<string, string>> = {
    "annex-iv": {
      "1": "general_description",
      "2": "development",
      "3": "monitoring",
      "4": "performance_metrics",
      "5": "risk_management",
      "6": "lifecycle_changes",
      "7": "standards",
      "8": "declaration_of_conformity",
      "9": "post_market_monitoring",
    },
    "annex-xi": {
      "1.1": "general_description",
      "1.2": "detailed_description",
      "2": "systemic_risk_block",
    },
  };
  const labelMap: Record<string, (n: string, k: string) => string> = {
    "annex-iv": (n, k) => `Section ${n} (${k})`,
    "annex-xi": (n, k) =>
      n === "2" ? `Section 2 (${k}, if applicable)` : `Section ${n} (${k})`,
  };
  const weightsByProfile: Record<Profile, Record<string, number>> = {
    "annex-iv": ANNEX_IV_WEIGHTS,
    "annex-xi": ANNEX_XI_WEIGHTS,
  };

  const sections = sectionMap[effectiveProfile];
  const formatLabel = labelMap[effectiveProfile];
  const weights = weightsByProfile[effectiveProfile];

  let covered = 0;
  let weightedScore = 0;
  const total = Object.keys(sections).length;
  const details: Record<string, boolean> = {};
  const perSectionWeights: Record<string, number> = {};

  for (const [num, key] of Object.entries(sections)) {
    const label = formatLabel(num, key);
    const present = key in declaration && declaration[key] != null;
    details[label] = present;
    perSectionWeights[label] = weights[label] ?? 0;
    if (present) {
      covered++;
      weightedScore += perSectionWeights[label];
    }
  }

  return {
    covered,
    total,
    percentage: Math.round((covered / total) * 1000) / 10,
    details,
    weightedScore: Math.round(weightedScore * 1000) / 1000,
    weights: perSectionWeights,
    profile: effectiveProfile,
  };
}
