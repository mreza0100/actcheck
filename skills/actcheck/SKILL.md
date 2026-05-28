---
name: actcheck
description: "EU AI Act Annex IV drafting and explanation for this repo. `actcheck fill` drafts the project's .actcheck/annex-iv.yaml declaration from codebase evidence, asking the user to close gaps rather than inventing facts. `actcheck explain` explains any Annex IV field, section, or article, grounded in the verbatim Regulation (EU) 2024/1689. Triggered by 'actcheck fill', 'actcheck explain', 'fill the annex iv form', 'explain annex iv <field>', 'what does Article 11 require'."
---

# actcheck — Annex IV drafting & explanation

Draft and explain EU AI Act Annex IV technical documentation, grounded in the verbatim regulation. The CLI (`actcheck check`) validates a declaration; this skill *drafts* one and *teaches* the requirements. Both stay evidence-bound — a confident fabrication in a regulatory dossier is worse than an honest blank, because a provider can be fined for what it falsely declares.

## When to load

- `actcheck fill` — draft or continue the project's Annex IV declaration
- `actcheck explain <field | section | article>` — explain what a requirement means
- Natural phrasings: "fill the annex iv form", "explain annex iv §2(b)", "what does Article 11 require"

Route on the first argument: `fill` runs the Fill protocol below; `explain` runs the Explain protocol. With no argument, ask which the user wants.

## Shared grounding

- **The form** — `.actcheck/annex-iv.yaml`, created by `actcheck init`. Its field list, requirement levels (`[REQUIRED]` / `[CONDITIONAL]` / `[RECOMMENDED]`), and per-field clause annotations come from `schemas/annex-iv/v1/template.yaml`, `schema.yaml`, and `traceability.yaml`.
- **The law** — `resources/reg-2024-1689/`, the verbatim Regulation (EU) 2024/1689 split into one file per provision, with `INDEX.md` as the router. Quote it; never paraphrase a requirement into existence.
- **The map** — nine Annex IV points to nine top-level form sections: `general_description` §1, `development` §2, `monitoring` §3, `performance_metrics` §4, `risk_management` §5, `lifecycle_changes` §6, `standards` §7, `declaration_of_conformity` §8, `post_market_monitoring` §9.

## Finding a clause in the law

The law lives in `resources/reg-2024-1689/` as per-provision files. To answer from it:

1. Open `resources/reg-2024-1689/INDEX.md` first. It routes an address (Annex IV point, Article number, or a schema field via `traceability.yaml`) to exactly one file, and lists each provision's `see_also` cross-references.
2. Open that one file and quote the clause verbatim. The file is small and self-identifying (it starts with its heading), so reading it whole is cheap and exact.
3. If the clause cites another provision (e.g. Annex IV §8 → Article 47), open that file too — never restate a cross-referenced requirement from memory.
4. Read every Annex IV point together with the annex preamble ("…as applicable to the relevant AI system") at the top of `annex-iv-technical-documentation.md` — points are conditional on the system, not unconditional.
5. Use `full.txt` only for a provision the index doesn't list. Never grep the flat text to locate a clause — bare article numbers and point letters like `(d)` recur as cross-references throughout and return noise.

## The actcheck CLI

Drive these commands (prefix with `npx ` when actcheck isn't installed globally). Read each command's output and act on it — never claim a declaration passed without running `check`.

- `actcheck init` — scaffold the `.actcheck/` workspace. Run it when `.actcheck/annex-iv.yaml` is missing.
- `actcheck check [file]` — validate the declaration (defaults to `.actcheck/annex-iv.yaml`); `--strict` fails on any unreplaced `FILL:`. Close every `fill` session here, then fix the fields it cites.
- `actcheck validate <file>` — validate a declaration at an explicit path, outside `.actcheck/`.
- `actcheck coverage <file>` — show which of the nine Annex IV sections are present.

## `fill` — draft the declaration from evidence

Produce a first draft of `.actcheck/annex-iv.yaml` from what the repository actually proves, then ask the user to close the rest. You draft; the human verifies and signs off.

When invoked:
1. Confirm `.actcheck/annex-iv.yaml` exists. If not, tell the user to run `actcheck init` first.
2. Scan the repo for evidence — source, README, docs, config, model cards, datasets, package manifests, CI, infra.
3. Fill each field whose value traces to evidence, with an inline `# evidence: <path / section>` comment on every filled field.
4. For any field with no evidence, keep its `FILL:` marker and ask the user a targeted question to close it. Batch the questions by section; don't interrogate one field at a time.
5. Resolve `[CONDITIONAL]` blocks by their stated trigger — keep when it applies, delete when it doesn't — and report which you kept or dropped and why.
6. Map only to the nine sections the schema defines. Leave a field at `FILL:` rather than inventing one the schema lacks.
7. Close by telling the user to run `actcheck check` (`--strict` fails on any remaining `FILL:`).

Hold the line:
- Evidence only. A value with no basis in the repo or the user's answers does not get written.
- English, specific, concrete. "AI tool" is not an intended purpose — give the function, the context of use, and the decision the system informs.

## `explain` — explain a requirement

Explain what an Annex IV field, section, or article requires, grounded in the verbatim law.

When invoked:
1. Identify the target — a schema field path, an Annex IV point (e.g. §2(b)), or an article (e.g. Article 11).
2. Route it to its provision file via the "Finding a clause in the law" steps above (INDEX.md, plus `traceability.yaml` for a field's EUR-Lex anchor).
3. Quote the governing text verbatim from that file, then explain in plain language what it asks for and what a sufficient answer looks like.
4. Point to the matching field(s) in the form so the user knows where the answer belongs.

Quote the law; never present a paraphrase as the text. Where the regulation is silent or ambiguous, say so rather than filling the gap with invention.

<example>
User: actcheck explain §2(b)
Quote Annex IV(2)(b) from the resource, list the design-specification items it demands (general logic, key design choices and assumptions, what the system optimises for, parameter relevance, trade-offs under Chapter III Section 2), and map them to `development.design_specifications.*` in the form.
</example>

<example>
User: actcheck fill
Scan the repo; fill `intended_purpose`, `provider`, and `architecture` from evidence with `# evidence:` comments; then ask the user the open questions (e.g. "What hardware is this intended to run on?") for the remaining `FILL:` gaps; finish with "run actcheck check".
</example>
