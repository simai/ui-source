# Framework main convergence

Date: 2026-08-08
Status: framework_main_convergence_complete_on_main

## Goal

Converge the useful unpublished Framework work onto one descendant of GitHub
`origin/main`, prove it locally and in GitHub Actions, then fast-forward `main`.
This workflow performs no tag, release, deployment or external-site write.

## Exact baseline and candidate

- GitHub baseline: `b8abc16fa5f41c407e694dc2eb11dd29dc221fb7`;
- accepted spacing branch: `533024c1cf325b80474d5cfcdee697ededf5c14c`;
- integration candidate before this ledger: `4072c486ded7fd66f673926c08894319f1f5468e`;
- exact documentation input: `simai/ui-doc@c1550094c205515d705fa4e796c510ae6afe07a2`;
- documentation authority: final GitHub `ui-doc/main`, with no temporary branch
  dependency.

## Included work

- the complete accepted semantic content-spacing contract;
- Highlight presentation, copy action, scrollbar and explicit-padding fixes;
- max-container token and fluid desktop boundary fixes;
- shared Smart runtime style readiness;
- Smart Modal contract, accessible naming and deterministic completion state;
- deterministic repository source lint restored for the actual JavaScript tree.

## Deliberate exclusions

- `codex/docara-framework-source-current-20260727` is patch-equivalent to
  `origin/main` and adds no new result;
- the visual/modal tail of `codex/modal-visual-contract-integrated` is already
  patch-equivalent to `origin/main`;
- obsolete component-mini public-path commits were not revived: later accepted
  `main` history deliberately removed that path;
- Highlight line numbers remain explicit opt-in. The older unconditional default
  was corrected while preserving the useful presentation changes.

## Local verification

- `npm run lint`: PASS;
- `npm test`: PASS, 70 tests, exact disposable clone of
  `ui-doc@c155009…`, contract SHA-256 `b70d02d…`, projection SHA-256
  `7a0643d…`;
- Smart Modal validator: PASS, 12 events and 38 parameters;
- Highlight validator: PASS, 1,775 source files and 17 token mappings;
- scrollbar tests: PASS, 10/10;
- focused modal/core/drawer/conformance tests: PASS, 7/7;
- `git diff --check`: PASS.

The package reproduction and fresh-clone result are recorded in the evidence
index. Hosted GitHub Actions remains the final gate before `main` is advanced.

The first hosted run after the fast-forward exposed one CI-only checkout defect:
the simplicity pre-audit requires exact historical commits, while the default
Actions checkout is shallow. The validation-only workflow was corrected to use
`fetch-depth: 0`; product/runtime source is unchanged.

Hosted run `31259692301` at exact `main@f111c321…` completed successfully on
Node 20.19.5. Framework main convergence is accepted. The temporary candidate
branches remain rollback inputs only until Docara and ui-doc consume the final
main identities, after which they are deleted in the cleanup phase.

The final cross-repository repin removes the last temporary ui-doc branch
dependency. The validator now reads the canonical Docara v2 content page
directly, while the owner projection remains single-sourced in Framework.

## Rollback and stop conditions

Rollback is the verified bundle in
`/Users/rim/Git/.artifacts/docara-v2-branch-cleanup-20260808/ui-loader.bundle`
and GitHub baseline `b8abc16f…`. Stop before `main` if package reproduction,
fresh clone or hosted validation differs. Never force-push, rewrite history,
tag, release or deploy from this workflow.
