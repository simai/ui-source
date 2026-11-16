import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// RG-MN-1 (owner report on Docara 3.16.0, 2026-11-16): in sf-menu--documentation-tree
// the current fill painted the link that carries aria-current (231 of 271 px) and left
// a parent's disclosure button outside the plate, while hover painted the whole row.
// fix/nav-menus-nv1 (RG-NV 24) moved the plate to the row; a browser probe over a build
// of a57977828 measured plate width = hover width, disclosure inside, link transparent,
// focus ring on the link (1440 / 390, light / dark, 3 loads). These pins keep it so.
const css = readFileSync(new URL('../src/component/menu/scss/_css__menu.scss', import.meta.url), 'utf8');
const tree = '.sf-menu.sf-menu--documentation-tree';

test('RG-MN-1: the current plate is the row\'s, the row holding the current link included', () => {
  const at = css.indexOf(`${tree} .sf-menu-element:not(:disabled):not(.disabled):not([aria-disabled='true']):is([aria-current='page'], :has(> [aria-current='page'])) {`);
  assert.notEqual(at, -1, 'the row that is or holds the current link takes the plate');
  assert.match(css.slice(at, css.indexOf('}', at)), /@include current-plate;/u);
});

test('RG-MN-1: the disclosure glyph of a current row takes the plate\'s ink', () => {
  assert.ok(css.includes(`${tree} .sf-menu-element:is([aria-current='page'], :has(> [aria-current='page'])) :is(.sf-menu-element-icon, .sf-icon-button .sf-icon) {\n  --sf-icon--color: var(--sf-on-primary-container);`));
});

test('RG-MN-1: the link inside a current row draws no plate of its own', () => {
  assert.ok(css.includes(`${tree} .sf-menu-element > [aria-current='page'] {\n  color: inherit;\n}`));
  assert.ok(css.includes(`${tree} [aria-current="page"]:not(.sf-menu-element, .sf-menu-element > *) {`), 'a bare current link keeps its own plate only outside a row');
  assert.doesNotMatch(css, /\.sf-menu\.sf-menu--documentation-tree \[aria-current="page"\] \{/u, 'no rule fills every element that carries aria-current');
});

test('RG-MN-1: an open branch that is current keeps its plate', () => {
  assert.ok(css.includes(`${tree} .sf-menu-element:is(.open, [aria-expanded='true']):not([aria-current='page'], :has(> [aria-current='page'])) {\n  --sf-menu-element--background-color: var(--sf-transparent);`));
});

test('RG-MN-1: the focus ring stays on the link, inside its box', () => {
  assert.match(css, /\.sf-menu\.sf-menu--documentation-tree \.sf-menu-element-wrap:focus-visible \{\s*outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\);/u);
});
