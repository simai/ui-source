# SF5 semantic content spacing owner-audit handoff

Read in order:

1. `source/workflow/2026-08-07-sf5-content-spacing-contract.md`;
2. `source/workflow/evidence/2026-08-08-sf5-content-spacing/INDEX.md`;
3. `source/workflow/evidence/2026-08-08-sf5-content-spacing/packet.json`;
4. `docs/developer/public-contract-documentation-gate.md`.

Audit frozen product candidate
`0c3c2bda649a5466aa95ea239005bb8df680baf7`, mandatory Framework CI correction
`22a4b64b12f26b0a9f88055f96d4fff701d8ca3e` and public documentation correction
`c5c269fdf9c177685cc9e44efc1e148d146123ed`. Rebuild Core and Utility twice
with exact `ui-builder@367b3423f9707b850c6bef9476ab8d1ed44039e1`
and Node 20.19.5. Verify the generated owner projection against the exact
`ui-doc` checkout and repeat the computed browser matrix.

The target label `5.4.0-rc.1-content-spacing` is unpublished and untagged.
Do not write `ui/distr`, repin Docara, merge, push, release or deploy during the
read-only audit.

Repeat the adversarial missing/stale/swapped/misbound tuple cases and the clean
production documentation build. The pinned validation script must checkout the
exact ui-doc revision and run all 63 tests with zero skipped tests. Hosted
GitHub Actions is not yet evidence: both exact commits remain unpublished and
the cloud state is `cloud_ci_pending_authorized_publication`.

The machine-readable simplicity pre-audit is
`source/workflow/evidence/2026-08-08-sf5-content-spacing/human-centered-simplicity-pre-audit.json`.
It binds both git ranges and every changed file to a necessity surface. Its
external tester boundary is deliberately pending and must not be interpreted as
an acceptance verdict.

Expected pre-verdict state:
`content_spacing_github_correction_ready_for_independent_owner_audit`.
