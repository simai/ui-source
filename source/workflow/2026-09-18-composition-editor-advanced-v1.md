# Composition Editor advanced field v1

Status: owner-candidate-complete

## Goal

Add one real `advanced` editable field to the accepted
`simai.composition.editor-manifest.v1` contract without adding a decorative
field, component, renderer, dependency, persistence format, or product policy.

## Done When

- the field maps to an already supported type property and changes actual
  Framework renderer output;
- manifest identity, Property type/version, constraints, localization keys,
  capability/permission hints and ownership are exact;
- positive/negative fixtures, two-instance and nested isolation, SSR/hydration
  digest invariance, keyboard/a11y, light/dark and wide/narrow browser checks
  pass;
- the standard two-wave builder produces byte-identical Core, Component,
  Utility and Smart outputs without changing `ui` or `ui-smart`;
- an immutable Larena handoff records revisions, trees, digests, commands,
  artifacts, rollback and limitations.

## Boundaries

- Base: `ui-source@647b3dc1f2308c80e8a1a8a996ac32464f78c249`.
- Accepted contract lineage: `7139f44f6fc3441b980ee86e41f746c6700ea70e`
  is patch-equivalent to rebased commit `963b977335e9a98eeadb138ef715e2579e9cfba5`.
- Allowed: Composition builtin editor registry, fixtures, tests, lab and docs.
- Forbidden: Larena source/database/site, `ui`, `ui-smart`, release/tag/deploy,
  new public schema identity, product ACL or persistence behavior.

## Reuse And Ideality Review

Primary user outcome: an operator can discover a meaningful advanced field
through the same portable manifest and registered Property control.

Verified existing resource: `content.heading@1.0.0` already declares
`data.level` as integer `1..6`; builtin `content.heading` renders it as the
semantic `<h1>` through `<h6>` tag. The existing integer Property identity is
`integer@1`, and the existing Smart Input projection provides the control.

Selected path: extend only `BUILTIN_EDITOR_MANIFESTS` with
`content.heading.level`. No new component, schema, renderer, dependency,
permission evaluator, storage or endpoint is needed.

Simplest rejected alternatives:

- label an existing basic field as advanced: rejected because it would change
  disclosure meaning without adding a real advanced capability;
- add a decorative section option: rejected because no supported renderer
  behavior exists;
- expose presentation modifiers: rejected because modifiers are arrays while
  the accepted editable-field contract intentionally supports scalar targets.

Protected complexity retained: range validation, exact Property version,
host-owned permission hints, per-instance projection, SSR/hydration invariance,
keyboard/a11y and deterministic generated delivery.

## Batch Plan

| Batch | Work | Verification | Status |
| --- | --- | --- | --- |
| 1 | Inventory renderer and accepted consumer boundary | Source and Larena readback | completed |
| 2 | Add heading level manifest and fixtures | Targeted contract tests and lint | completed |
| 3 | Browser and standard generated build | Playwright and two-wave builder | completed |
| 4 | Immutable control handoff | Digests, rollback and final readback | completed in control-plane companion commit |

## Evidence Frontier

- Action gate: `source/output/action-gates/action-gate-report-20260918030108.json`.
- Larena accepted baseline: Root `fe8fa089b4a9ea2150c2848cf74ad0f1d301f4d9`.
- No Larena or generated repository write is authorized.
- Targeted Composition suite: 33 passed, 0 failed.
- Full owner suite: 818 passed, 2 skipped, 1 external baseline failure. The
  failure is the pre-existing `ui-doc` pin mismatch: actual
  `fe5e7d98e8b9a8c66e2080fe003b57d7373fff00`, expected
  `f5a55d82c54c241f074d61fd369a743c9c4eb88d`.
- Browser candidate: PASS with no console, page or HTTP errors; keyboard opens
  the advanced disclosure, the Smart Input accepts numeric entry, all three
  heading instances stay isolated, semantic `h2`/`h4`/`h3` output is visible,
  and light/narrow plus dark/wide layouts have no horizontal overflow.
- Browser screenshots SHA-256:
  `1892f965908d9f355cfd5ed2a81da36644a28ef431a53298efe810fd0e3fe8c1`
  and `6667acf37ab414d0b96b8beadde71c57bb60720258733c71be6e375a50dbeac5`.
- Two-wave reproducibility: PASS with byte-identical products. Manifest
  SHA-256: Core `4e2c748f7c0e6ab8edf6e504e7dd91fcf6244ef3708def9ea639f3e602c7b7ed`,
  Component `0fd45de8141e9f6d9b3104b7620b14498f3fffc6325aa68905ae3c1651733757`,
  Utility `a0c405bbbd45686e82466970068d13629c44d65cc8aeda55fa360ba43173b0a0`,
  Smart `004b0c6024bfd658f002afc8e4a6fd4e46238a28adc39f3f2f98ea5d6d814fd4`.
- Generated editor registry SHA-256:
  `cf91e5f2eec0ff4e47dc7f34b384ffe1189a11facd4c945d797b2f119144e9ac`.

## Final Result

- Result: the Framework owner candidate closes the real `advanced` field gap
  without a new public dialect or runtime dependency.
- Verification: owner tests, deterministic build and real-browser acceptance
  are complete. No independent tester verdict or Larena adoption is claimed.
- Remaining: Larena may repin and run its own consumer acceptance against the
  immutable candidate; the unrelated `ui-doc` pin mismatch remains outside
  this batch.
