# Contributing to actcheck

Thanks for your interest. actcheck is meant to be a **commons** — the canonical, faithful, machine-readable spec for EU AI Act Annex IV technical documentation. Contributions that strengthen that thesis are very welcome.

## Ground rules

1. **Schema fidelity is sacred ground.** Every field in the schema must be auditable against the regulation. If you propose a new field, removal, or constraint, include the literal Annex IV text it maps to in `schemas/annex-iv/v1/traceability.yaml`, anchored to the EUR-Lex consolidated text:
   <https://eur-lex.europa.eu/eli/reg/2024/1689/oj#anx_IV>
2. **Deterministic, offline.** The validation path stays free of network calls and LLM dependencies. Helpers for *authoring* a declaration (e.g. LLM drafting) are fine as separate, flag-gated tools — never in the validation path.
3. **No overclaiming.** actcheck checks structural completeness against the schema. It does not certify legal conformity. Documentation, error messages, and PR descriptions should preserve that boundary.
4. **Small, focused changes.** Every changed line should trace to the issue or task at hand.

## Getting set up

```bash
git clone https://github.com/mreza0100/actcheck.git
cd actcheck
npm install
npm run build
npm test
```

Validate the canonical template and worked example to confirm the toolchain works:

```bash
node dist/cli.js validate schemas/annex-iv/v1/template.yaml
node dist/cli.js validate schemas/annex-iv/v1/examples/minimal.yaml
```

## Pull requests

- Open an issue first for non-trivial schema changes so we can discuss the regulation mapping.
- Include or update tests for any change in behaviour.
- Run `npm run lint` (`tsc --noEmit`) and `npm test` before submitting.
- Keep PRs scoped — separate refactors from feature/schema changes.

## Reporting issues

Please file issues for:

- Schema fields that look wrong against Annex IV.
- Validator behaviour that diverges from the spec.
- Documentation that overstates what actcheck verifies.
- Anything that could mislead a user into thinking actcheck asserts legal compliance.

## Licence

By contributing, you agree your contributions are licensed under the Apache License, Version 2.0 — see [LICENSE](LICENSE).
