import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { coverage, validate } from "../src/validator.js";

const tempFiles: string[] = [];

function writeTempYaml(obj: any): string {
  const path = resolve(
    tmpdir(),
    `actcheck-annex-xi-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`,
  );
  writeFileSync(path, yaml.dump(obj), "utf-8");
  tempFiles.push(path);
  return path;
}

function minimalAnnexXi(): Record<string, any> {
  return {
    actcheck: { schema_version: "1.0.0", profile: "annex-xi" },
    general_description: {
      intended_tasks: "A general-purpose language model for code generation and reasoning.",
      integration_types: "Embedded into developer tooling and chat assistants.",
      acceptable_use_policy: "No medical, legal, or safety-critical advice.",
      release_date: "2026-01-15",
      distribution_methods: "API endpoint and downloadable weights.",
      architecture: "Decoder-only transformer with 32 layers.",
      parameter_count: 7000000000,
      modalities: ["text", "code"],
      input_format: "UTF-8 tokens",
      output_format: "UTF-8 tokens",
      licence: "Apache-2.0",
    },
    detailed_description: {
      integration_means: "OpenAI-compatible REST API and a TypeScript SDK.",
      design_specifications: {
        training_methodology: "Supervised pre-training followed by RLHF on instruction data.",
        key_design_choices: "Rotary embeddings, grouped-query attention, sliding window.",
        optimization_targets: "Next-token cross-entropy and helpfulness reward.",
        parameter_relevance: "Attention head count drives reasoning; FF width drives recall.",
      },
      training_data: {
        provenance: "Common Crawl, public code repos, and licensed academic corpora.",
        scope: "English-heavy multilingual mix; 1.8T tokens deduplicated.",
        characteristics: "Source-balanced after quality filtering.",
      },
      computational_resources: {
        flops: "2.1e22 FLOPs",
        training_time: "31 days on 512 H100s",
      },
      energy_consumption: "Estimated 720 MWh based on H100 TDP and cluster PUE.",
    },
  };
}

afterEach(() => {
  for (const f of tempFiles) {
    try {
      unlinkSync(f);
    } catch {
      // ignore
    }
  }
  tempFiles.length = 0;
});

describe("Annex XI — GPAI profile", () => {
  it("validates a minimal Annex XI declaration", () => {
    const path = writeTempYaml(minimalAnnexXi());
    const result = validate(path);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("requires evaluation_strategies + adversarial_testing when systemic risk is declared", () => {
    const doc = minimalAnnexXi();
    doc.systemic_risk = { has_systemic_risk: true };
    const path = writeTempYaml(doc);
    const result = validate(path);
    expect(result.valid).toBe(false);
    const missingEval = result.errors.find((e) =>
      e.message.includes("evaluation_strategies"),
    );
    expect(missingEval).toBeDefined();
  });

  it("accepts a systemic_risk: false block with no additional fields", () => {
    const doc = minimalAnnexXi();
    doc.systemic_risk = { has_systemic_risk: false };
    const path = writeTempYaml(doc);
    const result = validate(path);
    expect(result.valid).toBe(true);
  });

  it("coverage uses the Annex XI section list when profile=annex-xi", () => {
    const path = writeTempYaml(minimalAnnexXi());
    const cov = coverage(path);
    expect(cov.profile).toBe("annex-xi");
    expect(cov.total).toBe(3);
    expect(cov.covered).toBe(2);
    expect(cov.percentage).toBeCloseTo(66.7, 0);
  });

  it("rejects an Annex XI declaration that omits parameter_count", () => {
    const doc = minimalAnnexXi();
    delete doc.general_description.parameter_count;
    const path = writeTempYaml(doc);
    const result = validate(path);
    expect(result.valid).toBe(false);
    expect(
      result.errors.find((e) => e.message.includes("parameter_count")),
    ).toBeDefined();
  });

  // Regression: the validate success banner was leaking the literal string
  // "Annex IV sections" when validating an Annex XI declaration. The coverage
  // result carries the profile; the CLI must honour it.
  it("coverage exposes the Annex XI profile so the CLI banner can be profile-correct", () => {
    const path = writeTempYaml(minimalAnnexXi());
    const cov = coverage(path);
    expect(cov.profile).toBe("annex-xi");
  });
});
