import { resolve } from "node:path";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { validate, coverage, loadSchema } from "../src/validator.js";

const EXAMPLES_DIR = resolve("schemas/annex-iv/v1/examples");
const tempFiles: string[] = [];

function writeTempYaml(content: string): string {
  const path = resolve(tmpdir(), `actcheck-test-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(path, content, "utf-8");
  tempFiles.push(path);
  return path;
}

afterEach(() => {
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  tempFiles.length = 0;
});

describe("loadSchema", () => {
  it("loads v1 schema successfully", () => {
    const schema = loadSchema("v1");
    expect(schema).toBeDefined();
    expect(schema["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema["title"]).toContain("Annex IV");
  });
});

describe("validate", () => {
  it("validates minimal example successfully", () => {
    const result = validate(resolve(EXAMPLES_DIR, "minimal.yaml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("validates freudche example successfully", () => {
    const result = validate(resolve(EXAMPLES_DIR, "freudche.yaml"));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("rejects empty document", () => {
    const path = writeTempYaml("actcheck:\n  schema_version: '1.0.0'\n");
    const result = validate(path);
    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
    const missingFields = result.errors
      .filter(e => e.message.includes("required property"))
      .map(e => e.message);
    expect(missingFields.length).toBeGreaterThanOrEqual(8);
  });

  it("catches minLength violation with Annex IV reference", () => {
    const path = writeTempYaml(`
actcheck:
  schema_version: "1.0.0"
general_description:
  intended_purpose: "short"
  provider:
    name: "Test"
  system_version: "1.0"
  software_versions:
    components:
      - name: "x"
        version: "1.0"
  distribution_forms:
    - form: api
      description: "test"
  target_hardware: "some hardware description for testing"
  deployer_interface: "a dashboard for the deployer here"
  product_integration:
    is_component_of_product: false
development:
  methods:
    development_steps: "Built with supervised learning on labeled data."
  design_specifications:
    general_logic: "Input goes through a classifier pipeline."
    algorithms: "BERT-base fine-tuned for classification."
    key_design_choices:
      - choice: "Use BERT"
        rationale: "Good performance"
    target_persons_groups: "Internal employees submitting documents."
    optimization_targets: "Accuracy and low latency for users."
    expected_output: "Category label with confidence score."
    output_quality: "92% accuracy on test set."
  architecture:
    description: "FastAPI wrapping HuggingFace transformers."
  human_oversight:
    assessment: "Deployers review low-confidence results."
    interpretability_measures: "Confidence scores shown to users."
  validation_and_testing:
    procedures: "80/10/10 train/val/test split was used."
    test_data:
      description: "1200 labeled documents"
    metrics:
      accuracy: "92% overall"
      robustness: "85% with degraded input"
  cybersecurity_measures: "API keys, TLS 1.3, input validation."
monitoring:
  capabilities_and_limitations: "Classifies text into 12 categories only."
  accuracy_per_group:
    - group: "English"
      accuracy: "94%"
  overall_expected_accuracy: "92% across all documents in scope."
  foreseeable_unintended_outcomes: "Misclassification could cause routing delays."
  risk_sources:
    health_and_safety: "None"
    fundamental_rights: "Minimal"
    discrimination: "Accuracy gap between languages"
  human_oversight_measures: "Low-confidence flagged for review."
  output_interpretation_measures: "Confidence scores and top predictions."
performance_metrics:
  appropriateness_description: "F1 macro because classes are imbalanced."
risk_management:
  system_description: "Lightweight risk management process."
  risk_identification: "Threat modelling and user interviews."
  risk_evaluation: "Ranked by likelihood and impact."
  risk_mitigation_measures: "Low-confidence flagging and human review."
lifecycle_changes:
  changes: []
standards:
  alternative_solutions: "No harmonised standards published yet."
declaration_of_conformity:
  provider_name: "Test"
  system_name: "Test System"
  declaration_date: "2026-05-17"
post_market_monitoring:
  evaluation_system: "Monthly sampling audit of 100 classifications."
  monitoring_plan: "Monthly audit, quarterly review, incident reporting."
`);
    const result = validate(path);
    expect(result.valid).toBe(false);
    const purposeError = result.errors.find(
      e => e.path.includes("intended_purpose")
    );
    expect(purposeError).toBeDefined();
    expect(purposeError!.annexIvRef).toBe("1(a)");
  });

  it("rejects unknown top-level properties", () => {
    const path = writeTempYaml(`
actcheck:
  schema_version: "1.0.0"
general_description:
  intended_purpose: "A valid purpose description here."
  provider:
    name: "Test"
  system_version: "1.0"
  software_versions:
    components:
      - name: "x"
        version: "1.0"
  distribution_forms:
    - form: api
      description: "test"
  target_hardware: "some hardware description for testing"
  deployer_interface: "a dashboard for the deployer here"
  product_integration:
    is_component_of_product: false
development:
  methods:
    development_steps: "Built with supervised learning approach."
  design_specifications:
    general_logic: "Pipeline-based classification system."
    algorithms: "BERT-base for text classification."
    key_design_choices:
      - choice: "BERT"
        rationale: "Accuracy"
    target_persons_groups: "Document processing team members."
    optimization_targets: "Classification accuracy and speed."
    expected_output: "Category labels for documents."
    output_quality: "92% accuracy on test data."
  architecture:
    description: "Microservice with transformer model."
  human_oversight:
    assessment: "Manual review of low confidence."
    interpretability_measures: "Confidence scores displayed."
  validation_and_testing:
    procedures: "Standard train/val/test methodology."
    test_data:
      description: "Labeled document corpus"
    metrics:
      accuracy: "92%"
      robustness: "85% degraded"
  cybersecurity_measures: "Standard security measures applied."
monitoring:
  capabilities_and_limitations: "Text classification only, 12 categories."
  accuracy_per_group:
    - group: "All users"
      accuracy: "92%"
  overall_expected_accuracy: "92% accuracy in intended use scope."
  foreseeable_unintended_outcomes: "Routing delays from misclassification."
  risk_sources:
    health_and_safety: "None"
    fundamental_rights: "Minimal"
    discrimination: "Language accuracy gap"
  human_oversight_measures: "Human review of flagged items."
  output_interpretation_measures: "Confidence and top-3 predictions."
performance_metrics:
  appropriateness_description: "F1 macro chosen for imbalanced classes."
risk_management:
  system_description: "Risk management system in place."
  risk_identification: "Threat modelling conducted."
  risk_evaluation: "Risks ranked by severity."
  risk_mitigation_measures: "Flagging and human oversight."
lifecycle_changes:
  changes: []
standards:
  alternative_solutions: "No harmonised standards yet available."
declaration_of_conformity:
  provider_name: "Test"
  system_name: "Test"
  declaration_date: "2026-05-17"
post_market_monitoring:
  evaluation_system: "Monthly accuracy sampling audit."
  monitoring_plan: "Monthly audit with quarterly review."
bogus_field: "should not be here"
`);
    const result = validate(path);
    expect(result.valid).toBe(false);
    const bogusError = result.errors.find(
      e => e.message.includes("bogus_field") || e.message.includes("additional")
    );
    expect(bogusError).toBeDefined();
  });
});

describe("coverage", () => {
  it("reports 100% for complete declaration", () => {
    const cov = coverage(resolve(EXAMPLES_DIR, "minimal.yaml"));
    expect(cov.covered).toBe(9);
    expect(cov.total).toBe(9);
    expect(cov.percentage).toBe(100);
  });

  it("reports missing sections", () => {
    const path = writeTempYaml(`
actcheck:
  schema_version: "1.0.0"
general_description:
  intended_purpose: "test"
`);
    const cov = coverage(path);
    expect(cov.covered).toBe(1);
    expect(cov.total).toBe(9);
    expect(cov.details["Section 1 (general_description)"]).toBe(true);
    expect(cov.details["Section 2 (development)"]).toBe(false);
  });
});
