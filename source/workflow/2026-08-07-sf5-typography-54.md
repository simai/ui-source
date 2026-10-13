# SF5 5.4 typography contract

Date: 2026-08-07
Status: typography_54_ready_for_independent_owner_audit
Target: unpublished `5.4.0-rc.1` owner candidate

Product candidate: `41cc7e01a3616bf245bf054917033397684d2093`

## Exact entry baseline

- source: `simai/ui-loader@36123543027d6b363c2242c747bf1fd8ec7d6c88`
- builder: `simai/ui-builder@367b3423f9707b850c6bef9476ab8d1ed44039e1`
- distribution reference: `simai/ui@d1daa951dd08b94a9f209fd9f31a78d2b3779563`
- Core CSS SHA-256: `dbfb4113d9af088ced47d2e2a4adfee41fd0681a7a8761ac5e7ae56a7f9a395a`
- Utility Full CSS SHA-256: `3b6d62084415bf3a6409d9959a4b987c1e718b3dfc1ba0f682c5e9fe964910e8`
- adaptive sizing contract SHA-256: `333d78f0f3abe6f47c9caa1fc3c53c4d2894e122a922a400804383266cbd72f5`

## Current Goal

Make the approved 5.4 typography vocabulary executable from one generated
contract: canonical double-delimiter base tokens, 5.x compatibility aliases,
semantic Label/Body/Heading/Display roles, corrected title heights and real
heading flow spacing. Core and Utility must agree when loaded together.

## Track Linkage

Standalone SF5 owner track: unpublished Typography 5.4 contract and immutable
owner packet. The track stops before `ui/distr`, Docara repin or release.

## Stages

- [x] Freeze exact source, builder and distribution-reference baseline.
- [x] Implement generated adaptive and semantic typography contract.
- [x] Verify compatibility, cascade and computed browser behavior.
- [x] Reproduce Core, Utility and immutable packet in two clean waves.
- [x] Prepare independent owner-audit handoff.

## Batches

- [x] Freeze RED contract/cascade evidence and add permanent regressions.
- [x] Extend the adaptive sizing contract and generated projections.
- [x] Route semantic selectors and utilities through the generated roles.
- [x] Build Core and Utility twice with the exact builder and freeze hashes.
- [x] Prepare an immutable owner packet and stop for independent read-only audit.

## Evidence Plan

- Contract and compatibility tests plus generated-projection freshness.
- Exact baseline-to-candidate product diff and first-party `13px` scan.
- Two clean source/builder waves with diagnostics and path-sorted ledgers.
- Byte-identical normalized candidate packets and full per-file manifest.
- Core-only/Core+Utility computed browser matrix including 200% page scale.
- Rollback parent, nonclaims and independent owner-audit entrypoint.

## Exact candidate result

- adaptive contract SHA-256:
  `9180a5fe78a01890a8492b240d676b212ad73bccd6f7e9c8853984e4c590a7b3`;
- Core ledger: 57 files,
  `27d05026ac94dd3b79ca2a40eb9aa580c0b575b5e3dd5eb4fa3e5ca55e49698d`;
- Utility ledger: 3,842 files,
  `c6040fd80bb7dce811d480f28b21d6fd05163f6fd4fddd9cbdeef07ed0218a31`;
- immutable packet ZIP SHA-256:
  `d20a0ce7d97bbb3e9502236fa3cb73acd7ca3d74b2559a3120ea3496a4c98dad`;
- packet manifest SHA-256:
  `af1aca18f945c32750ae125a7f763a5a763a15a8b8b667667e925f99e1ab5939`.

Both clean-clone waves used `ui-builder@367b3423...` and the verified official
Node `20.19.5` Darwin arm64 archive. Core/Utility diagnostics were empty and
both output trees, ledgers and normalized packet ZIPs were byte-identical.
The complete evidence and reproduction commands are indexed in
`source/workflow/evidence/2026-08-07-sf5-typography-54/INDEX.md`.

## Safety and compatibility

- `ui-loader` is source; `ui-builder` is the builder; generated `ui/distr` is
  not edited manually.
- Canonical 5.4 variables use `--sf-text--size-*`,
  `--sf-text--height-*` and `--sf-title--height-*`.
- Existing single-delimiter variables remain compatibility aliases throughout
  the 5.x line.
- Bundled Inter Variable remains the default. No remote font dependency is
  introduced.
- First-party 13px declarations are forbidden; vendored Fancybox and Monaco
  are explicit nonclaims.
- No Docara lock, live/test site, tag, release or deployment changes are
  authorized before independent owner acceptance.

## Done when

- generated contract and projections are fresh and fail closed;
- Core-only and Core+Utility H1-H6/Display results match the approved mobile
  and desktop matrices;
- semantic and legacy token overrides both remain effective in their declared
  compatibility surfaces;
- heading flow spacing uses the public top/bottom tokens;
- two isolated exact-builder product waves are byte-identical;
- the exact source revision, builder revision, artifact hashes, rollback and
  reproduction commands are recorded for an independent auditor;
- tracked worktree is clean and status is
  `typography_54_ready_for_independent_owner_audit`.

## Rollback

The source rollback point is
`36123543027d6b363c2242c747bf1fd8ec7d6c88`. Generated artifacts are disposable
until an independent PASS; Docara remains pinned to its previously accepted
Framework distribution.
