# actcheck

> An open, machine-readable spec for EU AI Act **Annex IV** technical documentation — and a deterministic CLI that validates declarations against it.

[![CI](https://github.com/mreza0100/actcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/mreza0100/actcheck/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#)
[![Status: prototype](https://img.shields.io/badge/status-prototype-orange)](#status)

**actcheck** is the open, faithful, standalone specification for the technical documentation required by **Annex IV of the EU AI Act** (Regulation (EU) 2024/1689), plus a deterministic command-line validator that checks declarations against it.

The spec *is* the product — like OpenAPI for REST. Other tools can adopt and consume it.

> ⚠️ **Honest boundary.** actcheck validates **completeness and internal consistency** against an open schema. It does **not** assert legal conformity, replace legal review, or substitute for a notified body. You remain responsible for the truth of what you declare — exactly as you are for the code you write.

---

## Why this exists

The EU AI Act requires a technical-documentation dossier (Article 11 → Annex IV) for providers of high-risk AI systems. Today that requirement lives only as legal prose. There is no open, machine-readable definition of what a complete dossier contains, and no free tool that lets developers check declarations the way a linter checks code.

Existing FOSS tools in the space fall short in characteristic ways:

- They scan source code or generate PDFs, but their internal "Annex IV" is a partial, collapsed scaffold disclaimed as "not legal advice."
- They accept opaque free-text blobs that pass validation even when filled with placeholder content.
- They paywall the output behind a licence.

**actcheck takes a different shape:** the schema is the standalone, auditable artifact — faithful to **all nine Annex IV points**, every field tied to its regulatory clause, fully Apache-2.0, no proprietary dependency, offline-first.

## 30-second quickstart

Run it without installing — straight from the [npm registry](https://www.npmjs.com/package/actcheck):

```bash
npx actcheck validate <your-declaration.yaml>
```

Or install globally:

```bash
npm install -g actcheck
actcheck validate <your-declaration.yaml>
```

Try it on this repo's canonical artifacts:

```bash
git clone https://github.com/mreza0100/actcheck && cd actcheck
npx actcheck validate schemas/annex-iv/v1/examples/minimal.yaml
# → Schema-valid — Structural coverage: 9 of 9 Annex IV sections present (100%)

npx actcheck validate schemas/annex-iv/v1/template.yaml
# → Schema-valid — Structural coverage: 9 of 9 Annex IV sections present (100%)
```

Copy `schemas/annex-iv/v1/template.yaml` into your project, replace every `FILL:` placeholder with real content, and run `actcheck validate <your-file.yaml>` in CI.

### From source (for contributors)

```bash
git clone https://github.com/mreza0100/actcheck && cd actcheck
npm install && npm run build && npm test
node dist/cli.js validate schemas/annex-iv/v1/examples/minimal.yaml
```

## What's in this repo

| Artifact | What it is |
| --- | --- |
| `schemas/annex-iv/v1/schema.yaml` | The machine-readable Annex IV spec. All 9 sections + sub-points, with requirement levels and `if/then` conditionals. |
| `schemas/annex-iv/v1/traceability.yaml` | Every schema field mapped to its literal Annex IV clause and the EUR-Lex anchor. |
| `schemas/annex-iv/v1/template.yaml` | The fillable, richly-commented declaration template with per-field guidance and citations. |
| `schemas/annex-iv/v1/examples/` | Worked examples — a minimal one and a fully-filled high-risk case. |
| `src/` | Deterministic, offline TypeScript validator + CLI (`commander`, `ajv`). |
| `tests/` | Vitest suite. |

## Annex IV coverage

The schema and traceability cover every numbered point of Annex IV referenced from Article 11(1):

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

The validator reports `Structural coverage: 9 of 9 Annex IV sections present` when a declaration is structurally complete against the schema.

> *Coverage measures schema-level structural presence — required fields are filled and conditional triggers handled. It does **not** measure substantive content adequacy or legal conformity; those remain the declarer's responsibility (see disclaimer below).*

## The linter philosophy

actcheck is built on the same idea as `terraform validate` or a TypeScript type-checker:

- It checks **structure and completeness** against the regulation.
- It does **not** certify that the content is true — that responsibility stays with you, exactly as it does for the code you ship.
- An LLM can help you *draft* the declaration. The schema is what *validates* it. Never the other way around.

## Design choices

- **Deterministic.** Same input → same output. No LLM in the validation path. Safe for CI.
- **Offline-first.** No network call required to validate. No vendor lock-in.
- **Anchored to EUR-Lex.** The traceability matrix cites the regulation directly, not third-party mirrors.
- **Faithful to the regulation's structure** — nine points, English, with sub-points typed and cited.
- **Apache-2.0, fully free.** No paywalled output.

## Status

Prototype, but real. The schema, traceability matrix, fillable template, validator, examples, and tests are all in this repository today. The validator runs and reports coverage. The next milestone is a deterministic dossier generator that renders a validated declaration into a structured Markdown/PDF Annex IV document.

Scope is deliberately tight: **Article 11 + Annex IV, done well**, before expanding to adjacent articles (9, 12, 13, 14, 15) via follow-on work and community contributions.

## Contributing

This project is meant to be a commons. Schema fidelity is sacred ground — every field claim must be auditable against the EUR-Lex regulation text. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes.

## Acknowledgements

The EU AI Act text is published by the European Union: <https://eur-lex.europa.eu/eli/reg/2024/1689/oj>.

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

> **Legal disclaimer.** actcheck provides technical assistance only. It does not constitute legal advice, does not assert compliance with EU law, and does not replace a conformity assessment by a notified body or qualified legal review. Compliance decisions remain the responsibility of the system provider.
