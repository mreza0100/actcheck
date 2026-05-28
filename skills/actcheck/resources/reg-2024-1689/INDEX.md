# Regulation (EU) 2024/1689 — clause index

Router for the EU AI Act reference. Resolve an address to ONE file, open only that
file, quote verbatim. Do not grep the flat text — `(d)` and bare article numbers
recur throughout and return cross-references, not the provision.

## Snapshot

- CELEX `32024R1689` · ELI `http://data.europa.eu/eli/reg/2024/1689/oj/eng` · snapshot **2024-07-12** (OJ original).
- English text is unaffected by all four 2025 corrigenda (they touch other languages only).
- **Stale-watch:** the Digital Omnibus (provisional agreement 2026-05-07, not yet in the OJ) amends Articles 4, 5, 50, 57 and Annexes I/III — **not Annex IV**. Re-check on its publication.
- Files are verbatim slices of `full.txt`; metadata lives here, never in the text files.

## Reading Annex IV

Annex IV opens with a scoping clause — its points are required **"as applicable to the relevant AI system"**, not unconditionally. Always read a point together with that preamble (it is at the top of `annex-iv-technical-documentation.md`).

## Annex IV points → form section → governing article

| Annex IV point | Form section | See also |
| --- | --- | --- |
| §1 General description | `general_description` | — |
| §2 Elements & development process | `development` | — |
| §3 Monitoring, functioning, control | `monitoring` | Art. 13, 14 |
| §4 Appropriateness of metrics | `performance_metrics` | Art. 15 |
| §5 Risk management system | `risk_management` | **Art. 9** |
| §6 Lifecycle changes | `lifecycle_changes` | — |
| §7 Standards applied | `standards` | — |
| §8 EU declaration of conformity | `declaration_of_conformity` | **Art. 47** |
| §9 Post-market monitoring | `post_market_monitoring` | **Art. 72** |

For a schema field, map field → Annex IV point via `schemas/annex-iv/v1/traceability.yaml`, then use the table above.

## Address → file

| Address | File | What it is | is_binding |
| --- | --- | --- | --- |
| Annex IV | `annex-iv-technical-documentation.md` | The technical-documentation contents (§§1–9) — the core | yes |
| Annex III | `annex-iii-high-risk-systems.md` | High-risk use-case list (the `use_case_tags`) | yes |
| Article 5 | `article-05-prohibited-ai-practices.md` | Prohibited practices (the `unacceptable` risk gate) | yes |
| Article 6 | `article-06-classification-rules.md` | High-risk classification rules | yes |
| Article 9 | `article-09-risk-management-system.md` | Risk management system | yes |
| Article 11 | `article-11-technical-documentation.md` | Requires the Annex IV dossier (the anchor) | yes |
| Article 12 | `article-12-record-keeping.md` | Record-keeping / logging | yes |
| Article 13 | `article-13-transparency-to-deployers.md` | Transparency & instructions for use | yes |
| Article 14 | `article-14-human-oversight.md` | Human oversight | yes |
| Article 15 | `article-15-accuracy-robustness-cybersecurity.md` | Accuracy, robustness, cybersecurity | yes |
| Article 18 | `article-18-documentation-keeping.md` | 10-year documentation retention | yes |
| Article 47 | `article-47-eu-declaration-of-conformity.md` | EU declaration of conformity | yes |
| Article 53 | `article-53-gpai-provider-obligations.md` | GPAI obligations (Annex XI, the `--gpai` flag) | yes |
| Article 72 | `article-72-post-market-monitoring.md` | Post-market monitoring plan | yes |
| Recitals (1)–(180) | `recitals.md` | Interpretive context — **non-binding** | no |
| Anything else | `full.txt` | Complete verbatim regulation (fallback) | yes |

When a point or article cites another provision (e.g. Annex IV §8 → Article 47), open that file too before answering — never paraphrase a cross-referenced requirement from memory.
