# Publication scan (2026-10-13)

## Secrets

- Tool: gitleaks 8.30.1, default rule set.
- Command: `gitleaks git --log-opts="--all" --redact --report-format json --report-path <report> .`
- Scope: every commit on every ref, 1590 commits, ~40.8 MB, at HEAD c0e9ab1e4dbb.
- Result: one finding, a false positive. Rule generic-api-key matched the words
  "localization keys" in `source/workflow/2026-09-18-composition-editor-advanced-v1.md`
  (commit 824c2d05b2), which is prose and holds no key.
- File names in the history: one `webpack/.env` (2020-06, commits e17265275 to
  c4b07a072). It holds build paths only (DIR_ENTRY, DIR_OUTPUT, EXT) and no secret.
  No key, certificate, credential, cookie or database files.

## Third-party files in the history (blocks publishing the history as it is)

The current tree is clean: THIRD_PARTY_NOTICES.md lists every bundled package
and font with its licence. The history is not:

- **Font Awesome Pro 5.15.3**: webfonts and styles under `src/component/icon/`
  (for example `src/component/icon/webfonts/fa-duotone-900.*`), removed on
  2026-10-02. Its licence is commercial and forbids redistribution, so a public
  repository must not carry these objects.
- **`src/core/scss/md-form/pro/`** (checkbox, file input, first added in
  963a0982a): it looks like the commercial MDB Pro forms. Check its origin
  before publishing.
- Older vendored code under `src/bootstrap`, `src/component/jquery`,
  `src/component/swiper` (MIT) and `src/component/fancybox` (GPL-3.0 or
  commercial) carries its own licences.

Publishing this repository therefore needs one of the following:

1. A new public history that starts from a snapshot of the current tree, with
   the private history kept as the record. Released revisions stay valid in the
   private repository.
2. A rewrite of the existing history that drops those paths. This changes every
   commit id that the release locks and Larena's framework.lock pin.

The owner chooses which.
