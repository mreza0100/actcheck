#!/usr/bin/env node

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  computeRetentionInfo,
  coverage,
  findPlaceholders,
  loadDeclaration,
  validate,
  type Profile,
  type ValidationResult,
} from "./validator.js";
import {
  type CiProvider,
  type FailOn,
  emitCiOutput,
  exitCodeFor,
} from "./ci.js";
import { buildSarif } from "./sarif.js";
import { classifyFile } from "./classify.js";
import { buildBundle, verifyManifest } from "./bundle.js";
import { renderToFile, type RenderFormat } from "./render/index.js";
import {
  DEFAULT_DECLARATION_PATH,
  WORKSPACE_DIR,
  type RiskClass,
  scaffoldWorkspace,
} from "./scaffold.js";

const VERSION = "1.0.0";

interface ValidateOptions {
  schemaVersion?: string;
  verbose?: boolean;
  strict?: boolean;
  sarif?: string;
  ci?: CiProvider;
  failOn?: FailOn;
  profile?: Profile;
}

/** Render a validate result for `validate` and `check`. Exits the process. */
function reportValidation(
  filePath: string,
  label: string,
  opts: ValidateOptions,
): never {
  const result = validate(filePath, opts.schemaVersion, opts.profile);

  // Side-channel outputs first, so we always emit them regardless of exit path.
  writeSarifIfRequested(filePath, result, opts.sarif);
  emitCiOutput(filePath, result, opts.ci ?? "off");

  if (result.valid) {
    const cov = coverage(filePath, opts.profile);
    console.log(`${pc.bold(pc.green("Schema-valid"))} — ${label}`);
    console.log(
      `  Structural coverage: ${cov.covered} of ${cov.total} ${cov.profile === "annex-xi" ? "Annex XI" : "Annex IV"} sections present (${cov.percentage}%)`,
    );
    console.log(
      pc.dim(
        "  Note: structural completeness only; content adequacy and legal conformity are not assessed by actcheck.",
      ),
    );

    if (result.retention) {
      const mismatch = result.retention.mismatch
        ? pc.yellow(
            ` ⚠ declared retention_until=${result.retention.declaredRetentionUntil} disagrees`,
          )
        : "";
      console.log(
        `  ${pc.bold("Article 18(1) retention:")} ${result.retention.placedOnMarket} → ${pc.bold(result.retention.retentionUntil)}${mismatch}`,
      );
    }

    const placeholders = findPlaceholders(filePath);
    if (placeholders.length > 0) {
      const shown = placeholders.slice(0, 10);
      console.log();
      console.log(
        `${pc.bold(pc.yellow(`⚠ ${placeholders.length} unreplaced FILL: placeholder(s)`))} — structurally valid, but NOT yet filled in.`,
      );
      for (const p of shown) {
        console.log(`  ${pc.yellow("·")} ${p}`);
      }
      if (placeholders.length > shown.length) {
        console.log(pc.dim(`  …and ${placeholders.length - shown.length} more.`));
      }
      console.log(
        pc.dim(
          "  Replace every FILL: marker with real content. This is NOT a compliant declaration yet.",
        ),
      );
      if (opts.strict) {
        process.exit(1);
      }
    }

    process.exit(exitCodeFor(result, opts.failOn ?? "error"));
  }

  console.log(
    `${pc.bold(pc.red("INVALID"))} — ${label} (${result.errorCount} error(s))\n`,
  );

  for (const error of result.errors) {
    const ref = error.annexIvRef
      ? pc.dim(` [Annex IV(${error.annexIvRef})]`)
      : "";
    const marker = error.severity === "warning" ? pc.yellow("⚠") : pc.red("✗");
    console.log(`  ${marker} ${error.path}${ref}`);
    console.log(`    ${error.message}`);
    if (opts.verbose && error.requirement) {
      console.log(pc.dim(`    requirement: ${error.requirement}`));
    }
    console.log();
  }

  process.exit(1);
}

function writeSarifIfRequested(
  filePath: string,
  result: ValidationResult,
  sarifPath?: string,
): void {
  if (!sarifPath) return;
  const log = buildSarif(filePath, result, VERSION);
  writeFileSync(resolve(sarifPath), `${JSON.stringify(log, null, 2)}\n`, "utf-8");
}

const program = new Command();

program
  .name("actcheck")
  .description("EU AI Act Annex IV compliance CLI")
  .version(VERSION);

const validateOptionDefs = (cmd: Command): Command =>
  cmd
    .option(
      "--schema-version <version>",
      "Schema version to validate against (e.g. v1)",
    )
    .option(
      "--profile <profile>",
      "Schema profile: 'annex-iv' (default) or 'annex-xi' (GPAI)",
    )
    .option("-v, --verbose", "Show detailed error information")
    .option(
      "--strict",
      "Treat unreplaced FILL: placeholders as errors (non-zero exit)",
    )
    .option(
      "--sarif <path>",
      "Write a SARIF 2.1.0 log of validation results to <path>",
    )
    .option(
      "--ci <provider>",
      "CI integration: 'github' emits workflow annotations + step summary",
      "off",
    )
    .option(
      "--fail-on <level>",
      "Exit non-zero on 'error' (default) or 'warning'",
      "error",
    );

validateOptionDefs(
  program
    .command("validate")
    .description("Validate an Annex IV declaration against the schema")
    .argument("<declaration>", "Path to YAML declaration file"),
).action((declaration: string, opts: ValidateOptions) => {
  const filePath = resolve(declaration);
  if (!existsSync(filePath)) {
    console.error(pc.red(`File not found: ${declaration}`));
    process.exit(1);
  }
  reportValidation(filePath, declaration, opts);
});

validateOptionDefs(
  program
    .command("check")
    .description(
      `Validate your declaration (defaults to ${DEFAULT_DECLARATION_PATH})`,
    )
    .argument(
      "[declaration]",
      "Path to YAML declaration",
      DEFAULT_DECLARATION_PATH,
    ),
).action((declaration: string, opts: ValidateOptions) => {
  const filePath = resolve(declaration);
  if (!existsSync(filePath)) {
    console.error(pc.red(`No declaration found at ${declaration}`));
    console.error(
      pc.dim(
        `  Run ${pc.bold("actcheck init")} first, then fill in ${DEFAULT_DECLARATION_PATH}.`,
      ),
    );
    process.exit(1);
  }
  reportValidation(filePath, declaration, opts);
});

interface CoverageOptions {
  json?: boolean;
  weighted?: boolean;
  threshold?: string;
  profile?: Profile;
}

program
  .command("coverage")
  .description("Show Annex IV / Annex XI coverage for a declaration")
  .argument("<declaration>", "Path to YAML declaration file")
  .option(
    "--profile <profile>",
    "Schema profile: 'annex-iv' (default) or 'annex-xi'",
  )
  .option("--json", "Emit a structured JSON report on stdout instead of a table")
  .option(
    "--weighted",
    "Report the per-section weighted score (0..100) instead of plain percentage",
  )
  .option(
    "--threshold <pct>",
    "Exit non-zero when the (weighted, if --weighted) coverage falls below <pct>",
  )
  .action((declaration: string, opts: CoverageOptions) => {
    const filePath = resolve(declaration);
    if (!existsSync(filePath)) {
      console.error(pc.red(`File not found: ${declaration}`));
      process.exit(1);
    }

    const cov = coverage(filePath, opts.profile);
    const weightedPct = Math.round((cov.weightedScore ?? 0) * 1000) / 10;
    const reportedPct = opts.weighted ? weightedPct : cov.percentage;

    if (opts.json) {
      const out = {
        profile: cov.profile,
        covered: cov.covered,
        total: cov.total,
        percentage: cov.percentage,
        weightedScore: cov.weightedScore,
        weightedPercentage: weightedPct,
        details: cov.details,
        weights: cov.weights,
      };
      console.log(JSON.stringify(out, null, 2));
    } else {
      const profileLabel =
        cov.profile === "annex-xi" ? "Annex XI" : "Annex IV";
      console.log(`\n  ${profileLabel} Coverage — ${declaration}\n`);
      console.log(
        "  ┌────────────────────────────────────────────────┬────────┬─────────┐",
      );
      console.log(
        "  │ Section                                        │ Weight │ Status  │",
      );
      console.log(
        "  ├────────────────────────────────────────────────┼────────┼─────────┤",
      );

      for (const [section, present] of Object.entries(cov.details)) {
        const status = present ? pc.green("covered") : pc.red("missing");
        const padded = section.padEnd(46);
        const w = ((cov.weights?.[section] ?? 0) * 100).toFixed(0).padStart(4);
        console.log(`  │ ${padded} │  ${w}% │ ${status} │`);
      }

      console.log(
        "  └────────────────────────────────────────────────┴────────┴─────────┘",
      );
      console.log(
        `\n  Structural coverage: ${pc.bold(`${cov.covered} of ${cov.total}`)} sections present (${cov.percentage}%)`,
      );
      if (cov.weightedScore !== undefined) {
        console.log(
          `  Weighted coverage:   ${pc.bold(`${weightedPct}%`)}`,
        );
      }
      console.log(
        pc.dim(
          "  Note: structural completeness only; content adequacy and legal conformity are not assessed by actcheck.\n",
        ),
      );
    }

    if (opts.threshold !== undefined) {
      const t = Number.parseFloat(opts.threshold);
      if (!Number.isFinite(t) || t < 0 || t > 100) {
        console.error(
          pc.red(`Invalid --threshold '${opts.threshold}' (must be 0..100).`),
        );
        process.exit(2);
      }
      if (reportedPct < t) {
        if (!opts.json) {
          console.log(
            pc.red(
              `Coverage ${reportedPct}% is below the --threshold ${t}%.`,
            ),
          );
        }
        process.exit(1);
      }
    }
  });

interface BundleOptions {
  output?: string;
  zip?: boolean;
  include?: string[];
}

program
  .command("bundle")
  .description(
    "Emit a tamper-evident manifest binding the declaration and its companions (schema, traceability, extras)",
  )
  .argument("<declaration>", "Path to YAML declaration file")
  .option(
    "-o, --output <dir>",
    "Output directory for manifest.json (and bundle.zip when --zip is set)",
    ".",
  )
  .option("--zip", "Also pack everything into bundle.zip")
  .option(
    "--include <file>",
    "Additional file to bind into the manifest (repeatable)",
    (val: string, prev: string[] = []) => [...prev, val],
  )
  .action((declaration: string, opts: BundleOptions) => {
    const filePath = resolve(declaration);
    if (!existsSync(filePath)) {
      console.error(pc.red(`File not found: ${declaration}`));
      process.exit(1);
    }

    const outDir = resolve(opts.output ?? ".");
    let retention;
    try {
      retention = computeRetentionInfo(loadDeclaration(filePath));
    } catch {
      retention = undefined;
    }

    const result = buildBundle({
      declarationPath: filePath,
      workspaceRoot: process.cwd(),
      outputDir: outDir,
      include: opts.include,
      zip: opts.zip,
      toolVersion: VERSION,
      retention: retention
        ? {
            placedOnMarket: retention.placedOnMarket,
            retentionUntil: retention.retentionUntil,
          }
        : undefined,
    });

    console.log(`${pc.green("Bundled")} ${result.manifest.files.length} file(s)`);
    for (const f of result.manifest.files) {
      console.log(`  ${pc.dim("·")} ${f.path}  ${pc.dim(f.sha256.slice(0, 12))}`);
    }
    console.log();
    console.log(`  manifest: ${result.manifestPath}`);
    if (result.zipPath) {
      console.log(`  zip:      ${result.zipPath}`);
    }
  });

interface VerifyOptions {
  base?: string;
  json?: boolean;
}

program
  .command("verify")
  .description(
    "Verify a manifest (or bundle.zip) — re-hash every file and report tampering",
  )
  .argument("<manifest>", "Path to manifest.json or bundle.zip")
  .option(
    "--base <dir>",
    "Base directory for resolving relative file paths in the manifest (defaults to the manifest's directory)",
  )
  .option("--json", "Emit a structured JSON report instead of a table")
  .action((manifestPath: string, opts: VerifyOptions) => {
    const abs = resolve(manifestPath);
    if (!existsSync(abs)) {
      console.error(pc.red(`File not found: ${manifestPath}`));
      process.exit(1);
    }

    const result = verifyManifest(abs, opts.base);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }

    console.log(
      `\n  Manifest verification — ${manifestPath} (${result.manifest.tool.name} ${result.manifest.tool.version})\n`,
    );
    for (const e of result.entries) {
      const tag =
        e.status === "ok"
          ? pc.green("OK")
          : e.status === "tampered"
            ? pc.red("TAMPERED")
            : pc.yellow("MISSING");
      console.log(`  ${tag.padEnd(20)}  ${e.path}`);
    }
    console.log();
    console.log(
      result.ok
        ? `  ${pc.green("Bundle integrity verified.")}`
        : `  ${pc.red("Bundle integrity check FAILED.")}`,
    );
    process.exit(result.ok ? 0 : 1);
  });

interface RenderOptions {
  format?: string;
  output?: string;
  pdfa?: boolean;
}

const VALID_RENDER_FORMATS: ReadonlyArray<RenderFormat> = ["html", "docx", "pdf"];

program
  .command("render")
  .description("Render a declaration to HTML / DOCX / PDF for a regulator-facing dossier")
  .argument("<declaration>", "Path to YAML declaration file")
  .option("--format <fmt>", "Output format: html | docx | pdf", "html")
  .option("-o, --output <path>", "Output file path (defaults to <declaration>.<ext>)")
  .option(
    "--pdfa",
    "Request PDF/A-2b archival output (not yet conformant; will error)",
  )
  .action(async (declaration: string, opts: RenderOptions) => {
    const filePath = resolve(declaration);
    if (!existsSync(filePath)) {
      console.error(pc.red(`File not found: ${declaration}`));
      process.exit(1);
    }

    const fmt = (opts.format ?? "html") as RenderFormat;
    if (!VALID_RENDER_FORMATS.includes(fmt)) {
      console.error(
        pc.red(
          `Unknown --format '${opts.format}'. Choose one of: ${VALID_RENDER_FORMATS.join(", ")}.`,
        ),
      );
      process.exit(1);
    }

    const out =
      opts.output ??
      filePath.replace(/\.ya?ml$/i, "") + `.${fmt}`;

    try {
      await renderToFile({
        declarationPath: filePath,
        outputPath: out,
        format: fmt,
        toolVersion: VERSION,
        pdfa: opts.pdfa,
      });
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }

    console.log(`${pc.green("Rendered")} ${declaration} → ${out}`);
  });

interface ClassifyOptions {
  json?: boolean;
  explain?: boolean;
}

program
  .command("classify")
  .description(
    "Classify the declaration: risk level, Annex III tags, Article 5 screen, Article 43 conformity route",
  )
  .argument("<declaration>", "Path to YAML declaration file")
  .option("--json", "Emit a structured JSON report instead of a human-readable summary")
  .option("--explain", "Print the reasoning behind the Article 43 route selection")
  .action((declaration: string, opts: ClassifyOptions) => {
    const filePath = resolve(declaration);
    if (!existsSync(filePath)) {
      console.error(pc.red(`File not found: ${declaration}`));
      process.exit(1);
    }
    const result = classifyFile(filePath);
    // Exit-code semantics MUST be identical across human + machine paths so
    // CI integrators piping --json into jq still trip on `prohibited`.
    const exitCode = result.art43Route.id === "prohibited" ? 1 : 0;

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(exitCode);
    }

    console.log(`\n  ${pc.bold("Classification")} — ${declaration}\n`);
    console.log(`  Risk level: ${pc.bold(String(result.riskLevel))}`);
    if (result.annexIiiTags.length > 0) {
      console.log(`  Annex III tags: ${result.annexIiiTags.join(", ")}`);
    }
    if (result.prohibitedPractices.length > 0) {
      console.log(
        pc.red(
          `  ⚠ Article 5 prohibited practice(s) claimed: ${result.prohibitedPractices.join(", ")}`,
        ),
      );
    }
    console.log();
    console.log(`  ${pc.bold("Article 43 conformity assessment route")}`);
    console.log(`  • ${pc.bold(result.art43Route.headline)}`);
    console.log(`  • Citation: ${result.art43Route.citation}`);
    if (opts.explain) {
      console.log();
      console.log(`  ${pc.dim(result.art43Route.reasoning)}`);
    }
    console.log();
    process.exit(exitCode);
  });

interface InitOptions {
  force?: boolean;
  riskClass?: string;
  gpai?: boolean;
}

const VALID_RISK_CLASSES: ReadonlyArray<RiskClass> = [
  "high",
  "limited",
  "minimal",
  "unacceptable",
];

program
  .command("init")
  .description(
    `Scaffold a ${WORKSPACE_DIR}/ workspace with everything you need to declare`,
  )
  .option("-f, --force", "Overwrite files in an existing workspace")
  .option(
    "--risk-class <level>",
    "Pre-fill risk_classification block: high | limited | minimal | unacceptable",
  )
  .option(
    "--gpai",
    "Add a GPAI header note (Annex XI obligations under Article 53)",
  )
  .action((opts: InitOptions) => {
    let riskClass: RiskClass | undefined;
    if (opts.riskClass !== undefined) {
      if (!VALID_RISK_CLASSES.includes(opts.riskClass as RiskClass)) {
        console.error(
          pc.red(
            `Unknown --risk-class '${opts.riskClass}'. Choose one of: ${VALID_RISK_CLASSES.join(", ")}.`,
          ),
        );
        process.exit(1);
      }
      riskClass = opts.riskClass as RiskClass;
    }

    let result;
    try {
      result = scaffoldWorkspace(process.cwd(), {
        force: opts.force,
        riskClass,
        gpai: opts.gpai,
      });
    } catch (err) {
      console.error(pc.yellow((err as Error).message));
      process.exit(1);
    }

    console.log(`${pc.green("Created")} ${WORKSPACE_DIR}/`);
    for (const file of result.created) {
      console.log(`  ${pc.dim("·")} ${file}`);
    }
    if (riskClass) {
      console.log(
        pc.dim(
          `  · risk_classification block pre-filled (risk_level: ${riskClass})`,
        ),
      );
    }
    if (opts.gpai) {
      console.log(pc.dim("  · GPAI/Annex XI header note added"));
    }
    console.log();
    console.log("  Next steps:");
    console.log(
      `    1. ${pc.dim("(optional)")} run ${pc.bold("/actcheck fill")} in Claude Code to draft your declaration`,
    );
    console.log(
      `    2. fill in ${pc.bold(DEFAULT_DECLARATION_PATH)} — replace every ${pc.bold("FILL:")} marker`,
    );
    console.log(`    3. run ${pc.bold("actcheck check")} to validate`);
  });

program.parse();
