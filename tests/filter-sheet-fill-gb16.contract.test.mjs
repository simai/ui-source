import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Group build 16 return GB16-3: in the phone sheet only the filter window's
// rows scroll (sf-drawer 1.21.0 data-sf-drawer-fill), the last row's text 12
// from the foot's line, the title and the buttons on the rows' text.
test('GB16-3: sf-drawer lets content that scrolls itself fill the body', () => {
  const sheet = read('src/smart/drawer/scss/_smart__drawer.scss');
  assert.match(sheet, /\.sf-drawer-panel:has\(> \.sf-drawer-body > \[data-sf-drawer-fill\]\) \{\n    overflow: hidden;/u);
  assert.match(sheet, /\.sf-drawer-panel:has\(> \.sf-drawer-body > \[data-sf-drawer-fill\]\) > \.sf-drawer-body \{\n    flex-shrink: 1;\n    overflow: hidden;\n    padding-block-end: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(sheet, /\[data-sf-drawer-fill\]\) > \.sf-drawer-foot:not\(:empty\) \{\n    box-shadow: 0 calc\(-1 \* var\(--sf-px\)\) 0 var\(--sf-outline-variant\);/u);
});

test('GB16-3: the filter window\'s sheet fills the drawer and stands on the rows\' column', () => {
  const source = read('src/smart/field-renderers/filter-window.js');
  assert.match(source, /body\.setAttribute\('data-sf-drawer-fill', ''\);/u);
  assert.match(source, /frame\.style\.setProperty\('--sf-drawer-gutter', 'calc\(var\(--sf-space-1\\\\\/4\) \+ var\(--sf-space-1\\\\\/2\)\)'\);/u);
});
