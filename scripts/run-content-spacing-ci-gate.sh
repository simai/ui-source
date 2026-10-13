#!/usr/bin/env bash
set -euo pipefail

readonly UI_DOC_REVISION="354364aedd3f5294206e79948372893b93fc085e"
readonly UI_DOC_REPOSITORY="${UI_DOC_REPOSITORY:-https://github.com/simai/ui-doc.git}"

gate_root="$(mktemp -d "${TMPDIR:-/tmp}/sf5-content-spacing-ci.XXXXXX")"
cleanup() {
    rm -rf -- "$gate_root"
}
trap cleanup EXIT

ui_doc_root="$gate_root/ui-doc"
git clone --quiet --no-checkout "$UI_DOC_REPOSITORY" "$ui_doc_root"
git -C "$ui_doc_root" checkout --quiet --detach "$UI_DOC_REVISION"

actual_revision="$(git -C "$ui_doc_root" rev-parse HEAD)"
if [[ "$actual_revision" != "$UI_DOC_REVISION" ]]; then
    printf '%s\n' "CONTENT_SPACING_UI_DOC_REVISION_MISMATCH expected=$UI_DOC_REVISION actual=$actual_revision" >&2
    exit 2
fi
if [[ -n "$(git -C "$ui_doc_root" status --short --untracked-files=all)" ]]; then
    printf '%s\n' "CONTENT_SPACING_UI_DOC_CHECKOUT_DIRTY revision=$actual_revision" >&2
    exit 2
fi

UI_DOC_ROOT="$ui_doc_root" npm run test:unit
UI_DOC_ROOT="$ui_doc_root" npm run test:public-docs

printf '%s\n' "CONTENT_SPACING_CI_GATE_PASS ui_doc_revision=$actual_revision"
