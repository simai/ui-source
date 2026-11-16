import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-menu in a header row (owner decisions C30, C104, C181 (2); recipe
// site-header gap check, ui-control control/evidence/2026-11-15-recipe-gaps-check).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sheet = read('src/component/menu/scss/_css__menu.scss');
const source = read('src/smart/menu/index.js');

test('C30: the header row finds its current section with no :has() inside a :has()', () => {
  const rowCurrent = sheet.match(/^\$row-current: "([^"]*)";$/mu)[1];
  // A :has() nested in a :has() is invalid CSS: the browser drops the whole rule.
  for (const [, inner] of rowCurrent.matchAll(/:has\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/gu)) {
    assert.doesNotMatch(inner, /:has\(/u, `${inner} nests a :has()`);
  }
  // The split row: its link with aria-current inside the row.
  assert.match(rowCurrent, /:has\(> \.sf-menu-element > :is\(\[aria-current='page'\], \[aria-current='true'\]\)\)/u);
  assert.match(rowCurrent, /:has\(> \.sf-menu-element:is\(\[aria-current='page'\], \[aria-current='true'\]\)\)/u);
});

test('C104 / C181 (2): inside sf-header-site the row reads the phone step on the bar\'s own width', () => {
  assert.match(source, /readNarrow\(\) \{\n\s+const frame = this\.closest\?\.\('\.sf-site-header'\);/u);
  assert.match(source, /return width < Number\.parseFloat\(BREAKPOINTS\.md\) \* rem;/u);
  assert.match(source, /return this\._narrowMedia\?\.matches === true;\n\s+\}/u);
  assert.match(source, /this\._frameObserver = new ResizeObserver\(\(\) => this\._onNarrow\?\.\(\)\);/u);
  assert.match(source, /const narrow = this\.readNarrow\(\);\n\s+if \(narrow === this\._narrow\) return;/u);
  assert.match(source, /this\._frameObserver\?\.disconnect\(\);/u);
});
