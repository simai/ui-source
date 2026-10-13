# SF5 semantic content spacing contract

Date: 2026-08-08
Status: content_spacing_correction_ready_for_independent_owner_audit

## Goal

Publish an unpublished, source-owned SF5 content-spacing contract and keep the
public `ui-doc` explanation machine-linked to that exact contract. The batch
stops before generated `ui/distr`, Docara repin, release, tag or deploy.

## Entry baseline

- `ui-loader`: `b8abc16fa5f41c407e694dc2eb11dd29dc221fb7`
- `ui-builder`: `367b3423f9707b850c6bef9476ab8d1ed44039e1`
- `ui-doc`: `6ebcd713432100e116771c972e371c1dff9f29c2`
- source worktree: `/Users/rim/Git/.worktrees/ui-loader-content-spacing-contract`
- documentation worktree: `/Users/rim/Git/.worktrees/ui-doc-content-spacing`

## Done When

- the adaptive sizing JSON owns `text`, `related`, `block` and `section`
  content-spacing roles;
- generated public tokens are
  `--sf-content--space-text|related|block|section`;
- existing text and heading flow tokens resolve through the new semantic roles
  without changing their computed values;
- a generated machine-readable documentation projection is bound to the exact
  adaptive contract SHA-256;
- `ui-doc` contains a Russian authoring guide, examples, migration guidance and
  a checked copy of that projection;
- an executable cross-repository check rejects stale/missing public docs;
- focused/full source tests and two exact-builder outputs are reproducible;
- one immutable owner packet, rollback and audit handoff are recorded;
- both tracked worktrees are clean and stop at
  `content_spacing_correction_ready_for_independent_owner_audit`.

## Boundaries

- Source changes: `ui-loader` contract, generator, tests and developer docs.
- Public docs: isolated `ui-doc` worktree only.
- Generated distribution: build output only; never edit `ui/distr` manually.
- Docara remains unchanged before an independent owner verdict.
- No merge, push, tag, release, publication or deploy.

## Batch Plan

| Batch | Work | Verification | Status |
| --- | --- | --- | --- |
| C1 | Contract, projection and regression tests | adaptive generation/check and focused tests | complete |
| C2 | Public `ui-doc` guide and docs-freshness gate | source integrity and cross-repo check | complete |
| C3 | Exact builder reproducibility and packet | two clean outputs, ledgers and hashes | complete |
| C4 | Handoff and governance | diff, rollback, clean status | complete |
| C5 | Tuple/CI/render correction | adversarial tuples, pinned clean CI, production render | complete |
| C6 | GitHub-only CI/lifecycle correction | one validation contour, exact ui-doc pin, clean lifecycle | complete |

## Simplicity Review

- Primary outcome: authors select spacing by semantic relationship instead of
  copying component-specific margins.
- Smallest complete surface: four tokens, one generated projection, one public
  guide and one sync check.
- Rejected expansion: no flow component, utility class family, component
  migration or Docara behavior change in this owner batch.
- Protected complexity: compatibility aliases, deterministic generation,
  documentation freshness and rollback remain explicit.

## Terminal state

The unpublished runtime/product candidate remains frozen at
`0c3c2bda649a5466aa95ea239005bb8df680baf7`. The mandatory Framework validation
gate is `22a4b64b12f26b0a9f88055f96d4fff701d8ca3e` and pins the final public
documentation correction `c5c269fdf9c177685cc9e44efc1e148d146123ed`.
The old Bitbucket automation is removed; the sole active CI contour is
validation-only GitHub Actions. Hosted execution is pending separately
authorized publication of those exact revisions.
The only next action is a repeated independent read-only owner audit. Docara
repin remains unauthorized.
