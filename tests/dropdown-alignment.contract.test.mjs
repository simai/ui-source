import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

/* The field and its open list are one composition. Measured in the browser
   before this contract: field pictures were 2px smaller than the list's
   (22 against 24 at size 1), sat 3px left of them, the label after a picture
   started 4-6px later in the field, and the chevron sat 4px left of the check.
   The rules below are the mechanism; the alignment probe measures the result
   for every kind, size and look at desktop and mobile widths. */
const SIZES = ['1\\/2', '1', '2'];

test('dropdown alignment: pictures take the whole line, the padding gives up the border', async () => {
  const dropdown = await read('component/dropdown/scss/_css__dropdown.scss');
  const custom = await read('component/dropdown/scss/_css__custom.scss');
  assert.match(custom, /--sf-dropdown-tag-line--box: var\(--sf-dropdown-tag-line--height\);/);
  for (const size of SIZES) {
    for (const side of ['top', 'bottom']) {
      assert.ok(dropdown.includes(`--sf-dropdown-field--padding-${side}: calc(var(--sf-ui-${size}--space-y-tightness-default) - var(--sf-px));`), `${side} ${size}`);
    }
  }
});

// Since R029 (owner C05, 2026-11-07) an option no longer lines up with its
// field: it is a row of the dropping panel, its picture or text --sf-space-1/2
// inside its highlight at every size, the picture --sf-space-1/2 before the
// text (the context menu's geometry; dropdown-panels-inset measures it).
test('dropdown alignment: an option is a dropping panel row, its content --sf-space-1/2 inside its highlight', async () => {
  const custom = await read('component/dropdown/scss/_css__custom.scss');
  assert.match(custom, /\.sf-dropdown \.sf-list \.sf-list-item,\n\.sf-list--menu \.sf-list-item \{\n  --sf-list-item--padding-inline-start: var\(--sf-space-1\\\/2\);\n  --sf-list-item--padding-inline-end: var\(--sf-space-1\\\/2\);/);
  assert.match(custom, /\.sf-list-item-wrap,\n\.sf-list--menu \.sf-list-item \.sf-list-item-wrap \{\n  gap: var\(--sf-space-1\\\/2\);/);
  assert.match(custom, /--sf-list-item-container--padding-inline-start: 0;/);
  assert.ok(!custom.includes('var(--sf-list--padding-left, 0px)'), 'no option gives the list inset back');
  for (const size of SIZES) {
    // The picture, or the glyph of the sf-icon that draws it (sf-dropdown 1.8.0).
    assert.ok(custom.includes(`.sf-dropdown.sf-dropdown--size-${size} .sf-dropdown-field > .sf-dropdown-field-visual,\n.sf-dropdown.sf-dropdown--size-${size} .sf-dropdown-field > sf-icon > .sf-dropdown-field-visual { margin-inline-end: var(--sf-ui-${size}--text-space-x); }`), `label step ${size}`);
  }
  assert.match(custom, /\.sf-dropdown \.sf-dropdown-field:has\(> \.sf-dropdown-field-visual, > sf-icon > \.sf-dropdown-field-visual\) \{\s*column-gap: 0;/);
  assert.match(custom, /inset-inline-end: calc\(var\(--sf-dropdown-field--padding-inline-end\) - var\(--sf-icon-button--padding-inline-end, 0px\)\);/);
});

test('dropdown alignment: a flag has one size in the field and the list', async () => {
  const custom = await read('component/dropdown/scss/_css__custom.scss');
  assert.match(custom, /\.sf-flag\.sf-dropdown-field-visual \{\s*--sf-flag--size: calc\(var\(--sf-dropdown-tag-line--box\) \* 3 \/ 4\);/);
  for (const size of SIZES) {
    assert.ok(custom.includes(`.sf-list-item--size-${size} .sf-list-item-wrap > .sf-flag {\n  --sf-flag--size: calc(var(--sf-text-height-${size}) * 3 / 4);`), size);
  }
});
