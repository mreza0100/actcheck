#!/usr/bin/env node

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { coverage, validate } from "./validator.js";

const VERSION = "0.1.0";

const program = new Command();

program
  .name("actcheck")
  .description("EU AI Act Annex IV compliance CLI")
  .version(VERSION);

program
  .command("validate")
  .description("Validate an Annex IV declaration against the schema")
  .argument("<declaration>", "Path to YAML declaration file")
  .option("--schema-version <version>", "Schema version to validate against (e.g. v1)")
  .option("-v, --verbose", "Show detailed error information")
  .action(
    (
      declaration: string,
      opts: { schemaVersion?: string; verbose?: boolean },
    ) => {
      const filePath = resolve(declaration);
      if (!existsSync(filePath)) {
        console.error(pc.red(`File not found: ${declaration}`));
        process.exit(1);
      }

      const result = validate(filePath, opts.schemaVersion);

      if (result.valid) {
        const cov = coverage(filePath);
        console.log(
          `${pc.bold(pc.green("Schema-valid"))} — ${declaration}`,
        );
        console.log(
          `  Structural coverage: ${cov.covered} of ${cov.total} Annex IV sections present (${cov.percentage}%)`,
        );
        console.log(
          pc.dim(
            "  Note: structural completeness only; content adequacy and legal conformity are not assessed by actcheck.",
          ),
        );
        process.exit(0);
      }

      console.log(
        `${pc.bold(pc.red("INVALID"))} — ${declaration} (${result.errorCount} error(s))\n`,
      );

      for (const error of result.errors) {
        const ref = error.annexIvRef
          ? pc.dim(` [Annex IV(${error.annexIvRef})]`)
          : "";
        console.log(`  ${pc.red("✗")} ${error.path}${ref}`);
        console.log(`    ${error.message}`);
        if (opts.verbose && error.requirement) {
          console.log(pc.dim(`    requirement: ${error.requirement}`));
        }
        console.log();
      }

      process.exit(1);
    },
  );

program
  .command("coverage")
  .description("Show Annex IV coverage for a declaration")
  .argument("<declaration>", "Path to YAML declaration file")
  .action((declaration: string) => {
    const filePath = resolve(declaration);
    if (!existsSync(filePath)) {
      console.error(pc.red(`File not found: ${declaration}`));
      process.exit(1);
    }

    const cov = coverage(filePath);

    console.log(`\n  Annex IV Coverage — ${declaration}\n`);
    console.log("  ┌─────────────────────────────────────────┬─────────┐");
    console.log("  │ Section                                 │ Status  │");
    console.log("  ├─────────────────────────────────────────┼─────────┤");

    for (const [section, present] of Object.entries(cov.details)) {
      const status = present
        ? pc.green("covered")
        : pc.red("missing");
      const padded = section.padEnd(39);
      console.log(`  │ ${padded} │ ${status} │`);
    }

    console.log("  └─────────────────────────────────────────┴─────────┘");
    console.log(
      `\n  Structural coverage: ${pc.bold(`${cov.covered} of ${cov.total}`)} Annex IV sections present (${cov.percentage}%)`,
    );
    console.log(
      pc.dim(
        "  Note: structural completeness only; content adequacy and legal conformity are not assessed by actcheck.\n",
      ),
    );
  });

program
  .command("init")
  .description("Generate a starter Annex IV declaration")
  .argument("[output]", "Output file path", "annex-iv.yaml")
  .action((output: string) => {
    const filePath = resolve(output);
    if (existsSync(filePath)) {
      console.error(pc.yellow(`File already exists: ${output}`));
      process.exit(1);
    }

    const today = new Date().toISOString().slice(0, 10);
    const starter = `# actcheck — Annex IV Declaration
# Fill in the fields below. Run \`actcheck validate ${output}\` to check.

actcheck:
  schema_version: "1.0.0"
  declaration_date: "${today}"

general_description:
  intended_purpose: ""  # What does your AI system do?
  provider:
    name: ""  # Your organization's legal name
  system_version: ""  # e.g. "1.0.0"
  software_versions:
    components:
      - name: ""
        version: ""
  distribution_forms:
    - form: api  # api | saas | download | software_package | embedded_hardware | other
      description: ""
  target_hardware: ""  # What hardware does it run on?
  product_integration:
    is_component_of_product: false
  deployer_interface: ""  # Describe the UI for deployers

development:
  methods:
    development_steps: ""  # How was the system built?
  design_specifications:
    general_logic: ""  # How does the system work?
    algorithms: ""  # What algorithms are used?
    key_design_choices:
      - choice: ""
        rationale: ""
    target_persons_groups: ""  # Who is the system used on/for?
    optimization_targets: ""  # What is it optimized for?
    expected_output: ""  # What does it produce?
    output_quality: ""  # How good is the output?
  architecture:
    description: ""  # System architecture overview
  human_oversight:
    assessment: ""  # How can humans oversee/override the system?
    interpretability_measures: ""  # How can deployers interpret outputs?
  validation_and_testing:
    procedures: ""  # How was the system tested?
    test_data:
      description: ""
    metrics:
      accuracy: ""
      robustness: ""
  cybersecurity_measures: ""  # Security measures in place

monitoring:
  capabilities_and_limitations: ""
  accuracy_per_group:
    - group: ""
      accuracy: ""
  overall_expected_accuracy: ""
  foreseeable_unintended_outcomes: ""
  risk_sources:
    health_and_safety: ""
    fundamental_rights: ""
    discrimination: ""
  human_oversight_measures: ""
  output_interpretation_measures: ""

performance_metrics:
  appropriateness_description: ""  # Why are your metrics appropriate?

risk_management:
  system_description: ""
  risk_identification: ""
  risk_evaluation: ""
  risk_mitigation_measures: ""

lifecycle_changes:
  changes: []  # Empty for new systems

standards:
  alternative_solutions: ""  # How do you meet Chapter III Section 2?

declaration_of_conformity:
  provider_name: ""
  system_name: ""
  declaration_date: "${today}"

post_market_monitoring:
  evaluation_system: ""  # How do you monitor post-deployment?
  monitoring_plan: ""  # What's the monitoring plan?
`;

    writeFileSync(filePath, starter, "utf-8");
    console.log(`${pc.green("Created:")} ${output}`);
    console.log(
      `  Fill in the fields, then run ${pc.bold(`actcheck validate ${output}`)}`,
    );
  });

program.parse();
