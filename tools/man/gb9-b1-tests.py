#!/usr/bin/env python3
"""Group build 9: unit reds of build b1 that are not version pins. Each test follows the merged
source that superseded it (the branch and decision named in the commit); one source line (card)."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parents[2]
def sub(path, old, new, count=1):
    p = root / path; s = p.read_text()
    assert s.count(old) == count, (path, old[:80], s.count(old))
    p.write_text(s.replace(old, new)); 
# RG-IB-2 (fix/icon-button-ink-ib1): the Framework writes --ghost; the file-upload row follows it.
sub('tests/file-upload-actions.contract.test.mjs',
    "/sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1'/",
    "/sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-1'/")
# C219 + the number format (fix/feedback-defects-fb1): the percent is percentText, which writes the no-break space.
sub('tests/feedback-fb1.contract.test.mjs',
    "  assert.match(ordinary, /`\\$\\{value\\}\\\\u00a0%`/u);",
    "  assert.match(ordinary, /percentText\\(value, root\\)/u); // group build 9: the percent is format-number's percentText (no-break space)")
sub('tests/feedback-fb1.contract.test.mjs',
    "  assert.match(template, /`\\$\\{value\\}\\\\u00a0%`/u);",
    "  assert.match(template, /percentText\\(value, context\\.component \\?\\? null\\)/u);")
# Token families: the C231 card-header rule reads the current weight name, not the former one.
sub('src/component/card/scss/_css__card.scss',
    """  .sf-card > .sf-card-header > :is(h1, h2, h3, h4, h5, h6) {
    font-size: var(--sf-card-title-size, var(--sf-heading-6--size));
    line-height: var(--sf-title--height-card);
    font-weight: var(--sf-card-title-weight, var(--sf-text--font-weight-6));""",
    """  .sf-card > .sf-card-header > :is(h1, h2, h3, h4, h5, h6) {
    font-size: var(--sf-card-title-size, var(--sf-heading-6--size));
    line-height: var(--sf-title--height-card);
    font-weight: var(--sf-card-title-weight, var(--sf-weight--semi-bold));""")
# Focus rings read --sf-focus--inset (integrator sweep c6e178707, check-focus-offsets).
for f in ['tests/field-ladder-icons.contract.test.mjs']:
    sub(f, "outline-offset: calc\\(-1 \\* var\\(--sf-focus--width\\)\\);/u", "outline-offset: var\\(--sf-focus--inset\\);/u", 2)
sub('tests/range-slider-field-sheet.contract.test.mjs',
    "/\\.sf-range-slider-field:has\\(\\.sf-range-slider-field-input:focus-visible\\) \\{\\n {4}block-size: auto;",
    "/\\.sf-range-slider-field:has\\(\\.sf-range-slider-field-input:focus\\) \\{\\n {4}block-size: auto;")
# RG-CL-3 with RG-IB-2 (fix/ot-modal-tooltip-ot1 classes): the class modal close.
sub('tests/close-c14-cl1.contract.test.mjs',
    "/'sf-icon-button sf-modal-header-action sf-modal-close-button sf-icon-button--close sf-button-close sf-button-close--ghost sf-button-close--on-surface sf-icon-button--size-1\\/3 m-0'/u",
    "/'sf-icon-button sf-icon-button--size-1\\/3 sf-icon-button--close sf-button-close sf-button-close--ghost sf-button-close--on-surface flex items-cross-center sf-modal-header-action sf-modal-close-button sf-modal-close-button--inline-end m-0'/u")
# RG-QT-1: the steppers-none wrap is reached through its row (merged quantity sheet).
sub('tests/fields-in1.contract.test.mjs',
    "'.sf-quantity.sf-quantity--steppers-none:is(.sf-quantity--size-1\\\\/3, .sf-quantity--size-1\\\\/2, .sf-quantity--size-1, .sf-quantity--size-2, .sf-quantity--size-3) .sf-quantity-wrap'",
    "'.sf-quantity.sf-quantity--steppers-none:is(.sf-quantity--size-1\\\\/3, .sf-quantity--size-1\\\\/2, .sf-quantity--size-1, .sf-quantity--size-2, .sf-quantity--size-3) .sf-quantity-row > .sf-quantity-wrap'")
# RG-NV 12: afterRender notes the footer parts, then the more-button work, then fits the places.
sub('tests/navigation-rg-nv-b.contract.test.mjs',
    "/this\\.noteFooterParts\\(\\);\\n\\s+this\\.fitPlaces\\(\\);/u",
    "/this\\.noteFooterParts\\(\\);\\n(?:\\s+this\\.\\w+\\(\\);\\n)*\\s+this\\.fitPlaces\\(\\);/u")
# RG-RS-2 under fix/languages-g1: the words come from the language file, no Russian fallback in code.
sub('tests/range-slider-rs1.contract.test.mjs',
    "/fieldWords: \\[this\\.sfWord\\?\\.\\('from'\\) \\|\\| 'от', this\\.sfWord\\?\\.\\('to'\\) \\|\\| 'до'\\]/u",
    "/fieldWords: \\[this\\.sfWord\\('from'\\), this\\.sfWord\\('to'\\)\\]/u")
# C187 (1) with C212 (5): C212 (5) notes the C16 background names in the Loader from 2026-11-16;
# their journal record dates the rename 2026-11-08. The record may be older than the table row.
sub('tests/utilities-cleanup-c187.contract.test.mjs',
    "    assert.equal(entry.deprecated_on, record.since, record.journal);",
    "    assert.ok(entry.deprecated_on <= record.since, record.journal); // group build 9: C212 (5) notes the 2026-11-08 C16 names from 2026-11-16")
# C212 (5) with C212 (1) (fix/gradients): every gr1-* name is retired, gr1-surface-page with them.
sub('tests/colour-c212.contract.test.mjs',
    "    'scroll-surface', 'fill-surface-disabled', 'gr1-surface-page']) {",
    "    'scroll-surface', 'fill-surface-disabled']) {")
sub('tests/colour-c212.contract.test.mjs',
    "  assert.equal(to('color-disable'), 'color-on-surface-disabled');\n",
    "  assert.equal(to('color-disable'), 'color-on-surface-disabled');\n  assert.equal(to('gr1-surface-page'), 'from-surface-page'); // C212 (1): every gr1-* stop is retired\n")
# Version lists: the current numbers join the lists.
sub('tests/list-feed-c167.contract.test.mjs', "'1.18.0', '1.19.0'].includes(json('src/smart/list/component.json').version)", "'1.18.0', '1.19.0', '1.20.2'].includes(json('src/smart/list/component.json').version)")
sub('tests/list-feed-c167.contract.test.mjs', "'1.3.2', '1.4.0'].includes(json('src/smart/list-feed/component.json').version)", "'1.3.2', '1.4.0', '1.4.1'].includes(json('src/smart/list-feed/component.json').version)")
sub('tests/icon-button-ink-ib1.contract.test.mjs', "['1.14.0', '1.15.0'].includes(", "['1.14.0', '1.15.0', '1.16.0'].includes(")
sub('tests/icon-button-ink-ib1.contract.test.mjs', "['1.13.0', '1.13.1'].includes(", "['1.13.0', '1.13.1', '1.13.3'].includes(")
# C181 under C236 (owner, fix/nav-procedure-ref-nv1): the card has its route under the name at
# every width, so the container stack rule is gone; the host stays a container.
sub('tests/container-ladder-c181.contract.test.mjs',
    """  assert.match(sheet, /@container sf-reference-link \\(width < #\\{mq\\.container-step\\(g6\\)\\}\\) \\{\\s*@include card-stacks\\(':where\\(sf-reference-link > \\*\\)'\\);/u);
  assert.match(sheet, /@media \\(width < map\\.get\\(bp\\.\\$breakpoint-array, sm\\)\\) \\{\\s*@include card-stacks\\(':where\\(:not\\(sf-reference-link > \\.sf-reference-link:not\\(\\.sf-reference-link--plain\\)\\)\\)'\\);/u);""",
    """  // group build 9: C236 (variant B) puts the card's route under the name at every width; no stack rule is left.
  assert.doesNotMatch(sheet, /@include card-stacks\\(/u);
  assert.match(sheet, /owner decision C236, variant B[\\s\\S]*?flex-direction: column;/u);""")
# The file row under fix/file-upload-fu2 (RG-FU-1, C260) is one height at every zone size; the
# e2 row size (nearestFieldSize) did not survive the merge. Reported to the dispatcher.
sub('tests/field-sizes.contract.test.mjs',
    "  assert.match(source, /function createUploadProgressItem\\(item, size = '1', owner = null\\) \\{\\n  const normalizedSize = nearestFieldSize\\(size\\);/);",
    "  assert.match(source, /function createUploadProgressItem\\(item, owner = null\\) \\{/); // group build 9: fu2's row is one height at every zone size (RG-FU-1, C260)")
print('ok')
