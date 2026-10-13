#!/usr/bin/env bash
set -euo pipefail

# ui-doc's main holds the examples of the newest pinned release, which is what
# the source suite is measured against; a pinned commit went stale with every
# release and kept the gate red (owner's documentation session, 2026-10-13).
# UI_DOC_REF names another branch or commit for a run that needs one.
readonly UI_DOC_REF="${UI_DOC_REF:-main}"
readonly UI_DOC_REPOSITORY="${UI_DOC_REPOSITORY:-https://github.com/simai/ui-doc.git}"

gate_root="$(mktemp -d "${TMPDIR:-/tmp}/sf5-content-spacing-ci.XXXXXX")"
cleanup() {
    rm -rf -- "$gate_root"
}
trap cleanup EXIT

# The contracts that read the shipped sheets grade the published distribution
# beside this checkout (../ui), as on a developer's machine; a CI runner has
# none, so the public simai/ui is cloned there.
repository_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -d "$repository_root/../ui/distr" && -z "${UI_CORE_ROOT:-}" ]]; then
    git clone --quiet --depth 1 "${UI_REPOSITORY:-https://github.com/simai/ui.git}" "$repository_root/../ui"
fi

ui_doc_root="$gate_root/ui-doc"
git clone --quiet --no-checkout "$UI_DOC_REPOSITORY" "$ui_doc_root"
if git -C "$ui_doc_root" rev-parse --verify --quiet "origin/$UI_DOC_REF" >/dev/null; then
    git -C "$ui_doc_root" checkout --quiet --detach "origin/$UI_DOC_REF"
else
    git -C "$ui_doc_root" checkout --quiet --detach "$UI_DOC_REF"
fi

actual_revision="$(git -C "$ui_doc_root" rev-parse HEAD)"
if [[ -n "$(git -C "$ui_doc_root" status --short --untracked-files=all)" ]]; then
    printf '%s\n' "CONTENT_SPACING_UI_DOC_CHECKOUT_DIRTY revision=$actual_revision" >&2
    exit 2
fi

UI_DOC_ROOT="$ui_doc_root" npm run test:unit
UI_DOC_ROOT="$ui_doc_root" npm run test:public-docs

printf '%s\n' "CONTENT_SPACING_CI_GATE_PASS ui_doc_revision=$actual_revision"
