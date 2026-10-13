# SF5 content spacing GitHub-only correction

Date: 2026-08-08
Status: content_spacing_github_correction_independently_accepted_for_main_convergence

## Goal

Replace the obsolete Bitbucket/Atlassian automation contour with one validation-only
GitHub Actions contour, bind its public-documentation gate to an exact immutable
`ui-doc` revision, and prove that the `ui-doc` project survives its ordinary clean
init/install lifecycle without losing project-owned configuration or sources.

The runtime/product commit remains frozen at
`0c3c2bda649a5466aa95ea239005bb8df680baf7`; spacing values and aliases are out of
scope. This batch does not publish either repository and therefore cannot claim a
hosted GitHub Actions result until the final `ui-doc` commit is separately pushed.

## Entry baseline

- Framework governance HEAD: `8b1260be6f16778776b5c578252664f407cd8747`;
- `ui-doc` HEAD: `510d43e11c48eae12d3d3b33a3a38779801efc2d`;
- Node: `20.19.5`;
- contract SHA-256: `b70d02d6902345e17954eafb44f24052b7478439184286bed5a8df6c69c1fe45`;
- projection SHA-256: `7a0643db8aa5ea7dd7babde83cb689c91030d09980c65a7c2e11b332bf23ef2a`.

## Batches

| Batch | Outcome | Status |
| --- | --- | --- |
| C2.0 | Reproduce CI and clean lifecycle defects | complete |
| C2.1 | GitHub-only Framework validation and exact cross-repo gate | complete |
| C2.2 | Canonical `ui-doc` validation plus lifecycle preservation | complete |
| C2.3 | Full local retest, ledgers and deterministic packet | complete |
| C2.4 | Evidence, simplicity review and audit handoff | complete |

## Stop conditions

- preserving project sources requires a Docara owner/runtime change;
- the exact local cross-repository gate, lifecycle or production render stays red;
- a final input is dirty or a packet is not reproducible;
- any runtime, published distribution, consumer, site or external-owner write is
  required.

## Terminal state

The frozen runtime remains
`0c3c2bda649a5466aa95ea239005bb8df680baf7`. The exact Framework validation
revision is `22a4b64b12f26b0a9f88055f96d4fff701d8ca3e` and it pins
`ui-doc@c5c269fdf9c177685cc9e44efc1e148d146123ed`.

The correction was independently accepted for inclusion in the Framework main
convergence candidate. Its exact `ui-doc@c5c269f…` input is now available on the
temporary GitHub branch `codex/sf5-content-spacing-docs`; the branch is a pin,
not a release or deployment claim. Final hosted validation is tracked by
`2026-08-08-framework-main-convergence.md`.
