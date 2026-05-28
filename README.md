# actcheck

> An open, machine-readable spec for EU AI Act technical documentation — **Annex IV** (high-risk AI systems) and **Annex XI** (general-purpose AI models) — and a deterministic CLI that validates declarations, classifies risk, renders dossiers, and bundles tamper-evident evidence.

[![CI](https://github.com/mreza0100/actcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/mreza0100/actcheck/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#)
[![Status: prototype](https://img.shields.io/badge/status-prototype-orange)](#status)

**actcheck** is the open, faithful, standalone specification for the technical documentation required by the **EU AI Act** (Regulation (EU) 2024/1689) — covering **Annex IV** for high-risk AI systems and **Annex XI** for general-purpose AI model providers — plus a deterministic command-line toolkit: validator, risk classifier, dossier renderer, and tamper-evident bundler.

The spec *is* the product — like OpenAPI for REST. Other tools can adopt and consume it.

> ⚠️ **Honest boundary.** actcheck validates **completeness and internal consistency** against an open schema. It does **not** assert legal conformity, replace legal review, or substitute for a notified body. You remain responsible for the truth of what you declare — exactly as you are for the code you write.

---

## Why this exists

The EU AI Act requires a technical-documentation dossier (Article 11 → Annex IV) for providers of high-risk AI systems, and a separate dossier (Article 53 → Annex XI) for providers of general-purpose AI models. Today those requirements live only as legal prose. There is no open, machine-readable definition of what a complete dossier contains, and no free tool that lets developers check declarations the way a linter checks code.

Existing FOSS tools in the space fall short in characteristic ways:

- They scan source code or generate PDFs, but their internal "Annex IV" is a partial, collapsed scaffold disclaimed as "not legal advice."
- They accept opaque free-text blobs that pass validation even when filled with placeholder content.
- They paywall the output behind a licence.

**actcheck takes a different shape:** the schema is the standalone, auditable artifact — faithful to **all nine Annex IV points** and **both Annex XI sections**, every field tied to its regulatory clause, fully Apache-2.0, no proprietary dependency, offline-first.

## 30-second quickstart

Two commands, no install required — straight from the [npm registry](https://www.npmjs.com/package/actcheck):

```bash
npx actcheck init     # scaffold a .actcheck/ workspace with everything you need
npx actcheck check    # validate .actcheck/annex-iv.yaml once you've filled it in
```

`init` drops a `.actcheck/` folder in your project — your versioned Annex IV workspace:

| File | What it is |
| --- | --- |
| `.actcheck/annex-iv.yaml` | **The form.** Fill this in — replace every `FILL:` marker. |
| `.actcheck/schema.yaml`, `traceability.yaml` | The machine-readable spec and its clause-by-clause map to the regulation. |

To draft it fast, run the bundled [`actcheck` skill](skills/actcheck/SKILL.md): `/actcheck fill` in Claude Code.

Commit `.actcheck/` — it's the documentation a regulator would ask for.

Or install globally, and validate an arbitrary file (handy in CI):

```bash
npm install -g actcheck
actcheck validate <your-declaration.yaml>
```

### Work with the `actcheck` skill

actcheck ships a [Claude Code skill](skills/actcheck/SKILL.md) that fills and explains your declaration. `actcheck init` installs it automatically into whichever agent directory your project uses — `.claude/`, `.codex/`, or `.actcheck/` as a fallback — so it's ready the moment the workspace exists. Two subcommands:

| Command | What it does |
| --- | --- |
| `/actcheck fill` | Drafts `.actcheck/annex-iv.yaml` from your actual codebase: scans for evidence, fills each field with an inline `# evidence:` note, and **asks you** to close anything it can't prove. Finishes by telling you to run `actcheck check`. |
| `/actcheck explain <field \| §point \| Article N>` | Explains what a requirement means, quoting the **verbatim regulation** bundled with the skill, then points you to the form field where the answer belongs. |

**How it stays accurate.** The skill carries the full text of Regulation (EU) 2024/1689, split one file per provision and routed through an index, so `explain` quotes the exact clause rather than paraphrasing from memory. And it is written to **flag what it can't find rather than invent it** — a confident fabrication in a compliance dossier is worse than an honest blank.

The skill drafts and teaches; `actcheck` validates; **you** verify the truth before relying on it. Never the other way around.

### From source (for contributors)

```bash
git clone https://github.com/mreza0100/actcheck && cd actcheck
npm install && npm run build && npm test
node dist/cli.js validate schemas/annex-iv/v1/examples/minimal.yaml
```

## Commands

Eight commands. All offline, all deterministic.

| Command | Purpose |
| --- | --- |
| `actcheck init [--risk-class <level>] [--gpai]` | Scaffold the `.actcheck/` workspace. Optional flags pre-fill the `risk_classification` block (`high` / `limited` / `minimal` / `unacceptable`) or prepend a GPAI/Annex XI header note. |
| `actcheck check` | Validate `.actcheck/annex-iv.yaml`. |
| `actcheck validate <decl>` | Validate any declaration at an explicit path. |
| `actcheck coverage <decl> [--weighted] [--json] [--threshold <pct>]` | Per-section coverage table (or structured JSON). `--weighted` reports a regulator-weighted score; `--threshold N` exits non-zero below N%. |
| `actcheck classify <decl> [--json] [--explain]` | Resolve the Article 43 conformity-assessment route from the risk classification + product-harmonisation framing. |
| `actcheck render <decl> --format html\|docx\|pdf -o <out>` | Render a regulator-facing dossier with cover page, document-control block, EU drafting-style alphabetic lists, and the Article 18(1) retention footer. |
| `actcheck bundle <decl> [-o <dir>] [--zip] [--include <file>]` | Emit a tamper-evident `manifest.json` with SHA-256 of every artefact; optional `bundle.zip` packages everything. |
| `actcheck verify <manifest\|bundle.zip>` | Re-hash every file and report OK / TAMPERED / MISSING. Exits non-zero on any integrity break. |

Flags shared by `validate` and `check`:

| Flag | Purpose |
| --- | --- |
| `--profile <annex-iv\|annex-xi>` | Pick the schema profile. Auto-detected from `actcheck.profile` when present. |
| `--strict` | Treat unreplaced `FILL:` placeholders as errors. |
| `--sarif <path>` | Write a SARIF 2.1.0 log with line/column coordinates (consumed by GitHub Code Scanning). |
| `--ci github` | Emit `::error file=…,line=…,col=…,title=…::` workflow annotations and append a markdown step summary to `$GITHUB_STEP_SUMMARY`. |
| `--fail-on <error\|warning>` | Gate the exit code. Default `error`. |

## Regulation coverage

### Annex IV (high-risk AI systems, Article 11)

| § | Annex IV point | Covered |
| --- | --- | --- |
| 1 | General description of the AI system (a–h) | ✅ all 8 sub-points |
| 2 | Elements & development process (a–h) | ✅ all 8 sub-points |
| 3 | Monitoring, functioning and control | ✅ |
| 4 | Appropriateness of performance metrics | ✅ |
| 5 | Risk management system (Art. 9) | ✅ |
| 6 | Relevant lifecycle changes | ✅ |
| 7 | Harmonised standards / alternative solutions | ✅ |
| 8 | EU declaration of conformity (Art. 47) | ✅ |
| 9 | Post-market monitoring (Art. 72) | ✅ |
| 11(1) | SME simplified-documentation route | ✅ optional |
| 11(2) | Product-bundle harmonisation framing | ✅ optional |

The validator reports `Structural coverage: 9 of 9 Annex IV sections present` when a declaration is structurally complete against the schema.

### Annex XI (GPAI providers, Article 53)

For providers of general-purpose AI models, declare under `--profile annex-xi`:

| § (actcheck) | Annex XI provision | Covered |
| --- | --- | --- |
| 1.1 | Section 1, point 1 — general description: tasks, integration, AUP, release, distribution, architecture, parameter count, modalities, I/O format, licence | ✅ all 11 fields |
| 1.2 | Section 1, point 2 — detailed description: integration means, design specs, training data, computational resources, energy consumption | ✅ all 5 sub-blocks |
| 2 | Section 2 — additional documentation for systemic-risk models: evaluation strategies, adversarial testing, system-architecture integration | ✅ conditional on `systemic_risk.has_systemic_risk: true` |

> *§ 1.1 / 1.2 / 2 are actcheck's structural shorthand for the schema; the regulation itself numbers them Annex XI Section 1 (points 1 and 2) and Section 2.*

> *Coverage measures schema-level structural presence — required fields are filled and conditional triggers handled. It does **not** measure substantive content adequacy or legal conformity; those remain the declarer's responsibility.*

## Regulatory screens

actcheck applies three cross-cutting regulatory checks beyond pure schema structure — they screen the declaration; they do not constitute regulatory enforcement, which remains with national competent authorities and notified bodies:

- **Article 5 — prohibited practices.** Any value in `risk_classification.prohibited_practices_claimed` is a hard validation failure with a citation-grounded error message. The eight Article 5 categories (subliminal manipulation, exploitation of vulnerabilities, social scoring, individual predictive policing, untargeted facial scraping, workplace/education emotion recognition, sensitive biometric categorisation, real-time remote biometric identification in public spaces) are enumerated and labelled.
- **Article 6(2) — Annex III auto-classification.** Declaring any Annex III `use_case_tags` (biometrics, critical infrastructure, education, employment, essential services, law enforcement, migration, justice/democracy) forces `risk_level: high` per Article 6(2). A mismatch is a validation failure citing Art 6(2). **Known gap:** actcheck does not yet model the **Article 6(3) derogation** (an Annex III system that does not pose a significant risk of harm, with a documented self-assessment kept under Article 6(4)). Providers invoking the carve-out should suppress `use_case_tags` and keep the derogation assessment separately until the schema models it in a future release.
- **Article 18(1) — retention math.** If `placed_on_market` is declared, the validator computes the 10-year retention obligation. Calendar arithmetic follows Council Regulation (EEC, Euratom) No 1182/71 Article 4(2) — the default rule for periods in EU acts — under which the period ends on the last valid day of the target month when the corresponding day does not exist (e.g. 2024-02-29 + 10y → 2034-02-28).

`actcheck classify` then routes the declaration to the right Article 43 conformity assessment path:

| Route | When it applies |
| --- | --- |
| **Prohibited** | Any Article 5 practice claimed, or `risk_level: unacceptable`. System may not be placed on the EU market. |
| **Sectoral product harmonisation** (Art 43(3)) | High-risk system also covered by Annex I Section A legislation; conformity assessment under the sectoral act. |
| **Annex VII — Notified Body** (Art 43(1)) | High-risk biometric systems where harmonised standards don't fully cover Chapter III §2 requirements. |
| **Annex VI — internal control** (Art 43(2)) | Default for non-biometric Annex III high-risk systems. |
| **Transparency only** (Art 50) | Limited-risk systems — disclosure obligations apply, no conformity assessment. |
| **Voluntary** (Art 95) | Minimal-risk systems — voluntary codes of conduct. |

## Dossier rendering

Render a validated declaration as a regulator-facing document:

```bash
actcheck render .actcheck/annex-iv.yaml --format html -o dossier.html
actcheck render .actcheck/annex-iv.yaml --format docx -o dossier.docx
actcheck render .actcheck/annex-iv.yaml --format pdf  -o dossier.pdf
```

Each format produces a cover page (provider, system version, risk level, Article 18(1) retention), full Annex IV section headings, EU drafting-style alphabetic lists (`(a) …; (b) …; (c) ….`), and a generation-traceability footer.

PDF/A-2b archival output is on the roadmap — `--pdfa` errors today with a clear deferred-roadmap message, pending embeddable-font bundling + sRGB ICC profile + XMP metadata injection.

## Tamper-evident bundles

Bundle the declaration + sibling schema + traceability + any evidence files into a SHA-256-signed manifest. Round-trips through verification, even after the originals are deleted:

```bash
actcheck bundle .actcheck/annex-iv.yaml --include training-log.txt --zip
# → manifest.json + bundle.zip with SHA-256 of every file, plus the
#   computed Article 18(1) retention window

actcheck verify bundle.zip
# → OK / TAMPERED / MISSING per file; exits 1 on any integrity break
```

The manifest is plain JSON — auditable, diffable, signable with whatever your supply-chain tooling already uses.

## CI integration

```yaml
# .github/workflows/ai-act.yml
- run: npx actcheck check --ci github --sarif actcheck.sarif --fail-on error
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: actcheck.sarif
```

`--ci github` emits one `::error file=…,line=…,col=…,title=…::` workflow annotation per validation finding and appends a markdown summary to `$GITHUB_STEP_SUMMARY`. `--sarif` writes a SARIF 2.1.0 log with precise YAML line/column coordinates that GitHub Code Scanning ingests directly.

## What's in this repo

| Artifact | What it is |
| --- | --- |
| `schemas/annex-iv/v1/schema.yaml` | The machine-readable Annex IV spec. All 9 sections + sub-points, Article 11(1)/(2) framing blocks, `risk_classification` block (Art 5/6/18), with requirement levels and `if/then` conditionals. |
| `schemas/annex-iv/v1/traceability.yaml` | Every schema field mapped to its literal Annex IV clause and the EUR-Lex anchor. |
| `schemas/annex-iv/v1/template.yaml` | The fillable, richly-commented declaration template with per-field guidance and citations. |
| `schemas/annex-iv/v1/examples/` | Worked examples — a minimal one and a fully-filled high-risk case. |
| `schemas/annex-xi/v1/schema.yaml` | The machine-readable Annex XI spec for GPAI providers — Section 1.1 (general), 1.2 (detailed), Section 2 (systemic-risk conditional). |
| `src/` | Deterministic, offline TypeScript validator + CLI (commander, ajv, yaml, pdf-lib, docx, fflate). |
| `tests/` | Vitest suite — 99 tests, end-to-end coverage of every command and regulatory screen. |
| `skills/actcheck/` | Optional Claude Code skill that drafts a declaration from your codebase (`/actcheck fill`) and explains regulatory fields (`/actcheck explain`). |

## The linter philosophy

actcheck is built on the same idea as `terraform validate` or a TypeScript type-checker:

- It checks **structure and completeness** against the regulation.
- It does **not** certify that the content is true — that responsibility stays with you, exactly as it does for the code you ship.
- An LLM can help you *draft* the declaration. The schema is what *validates* it. Never the other way around.

## Design choices

- **Deterministic.** Same input → same output. No LLM in the validation path. Safe for CI.
- **Offline-first.** No network call required to validate, classify, render, bundle, or verify. No vendor lock-in.
- **Anchored to EUR-Lex.** The traceability matrix cites the regulation directly, not third-party mirrors.
- **Faithful to the regulation's structure** — Annex IV's nine points + Article 11 framing, Annex XI's two sections + systemic-risk addendum, with sub-points typed and cited.
- **Tamper-evident.** Bundles are signable; verification is offline and re-runnable.
- **Apache-2.0, fully free.** No paywalled output, no Pro-tier features.

## Status

Prototype, but real. Shipping today in this repository:

- Annex IV + Annex XI schemas with traceability and worked examples
- Eight CLI commands — `init`, `check`, `validate`, `coverage`, `classify`, `render`, `bundle`, `verify`
- Regulatory screens for Articles 5, 6(2), 18(1), 43
- SARIF 2.1.0 + GitHub Actions CI gate
- HTML / DOCX / PDF dossier rendering
- Tamper-evident SHA-256 bundles + ZIP packaging
- 99 deterministic, offline tests

Scope continues to be deliberately tight: **Article 11 + Annex IV + Annex XI, done well**, with thoughtful expansion into adjacent articles (9, 12, 13, 14, 15) via follow-on work and community contributions. PDF/A-2b conformant archival output is the next render milestone.

## Contributing

This project is meant to be a commons. Schema fidelity is sacred ground — every field claim must be auditable against the EUR-Lex regulation text. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes.

## Acknowledgements

The EU AI Act text is published by the European Union: <https://eur-lex.europa.eu/eli/reg/2024/1689/oj>.

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

> **Legal disclaimer.** actcheck provides technical assistance only. It does not constitute legal advice, does not assert compliance with EU law, and does not replace a conformity assessment by a notified body or qualified legal review. Compliance decisions remain the responsibility of the system provider.
