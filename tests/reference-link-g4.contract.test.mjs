import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Reference link study 2026-11-14 (RL-8..RL-11, RL-16..RL-19): the rules the
// measured fixes rest on, so a later edit cannot drop one silently.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/component/reference-link/scss/_css__reference_link.scss').replace(/\/\*[\s\S]*?\*\//gu, '');
const template = read('src/smart/reference-link/js/templates/default.js');
const element = read('src/smart/reference-link/index.js');

test('icon to label: H2 in a card and a sized reference, H3 on a line or plain (C105)', () => {
  assert.match(css, /gap: var\(--sf-reference-link--main-gap, var\(--sf-space-1\\\/2\)\)/u);
  assert.doesNotMatch(css, /--sf-reference-link--main-gap: var\(--sf-ui-/u);
  assert.match(css, /\.sf-reference-link--plain, \.sf-reference-link--line-1\\\/2, \.sf-reference-link--line-1, \.sf-reference-link--line-2\) \{\s*--sf-reference-link--main-gap: var\(--sf-space-1\\\/4\)/u);
});

test('a sized reference keeps one line with the line form ellipsis (RL-19)', () => {
  assert.match(css, /\.sf-reference-link--size-2\)\s*:where\(\.sf-reference-link__link[^{]*\{\s*overflow: hidden;\s*overflow-wrap: normal;\s*text-overflow: ellipsis;\s*white-space: nowrap;/u);
});

test('a line reference takes no fill on hover (RL-9)', () => {
  assert.match(css, /\.sf-reference-link--line-2\):has\([^{]*:is\(:hover, :active\)\) \{\s*--sf-reference-link--background-color: transparent;/u);
});

test('the icon is not copied, the route is selectable and still follows the link (RL-10, RL-11)', () => {
  assert.match(css, /\.sf-reference-link__icon, \.sf-reference-link-left > \.sf-icon\) \{[^}]*user-select: none;/u);
  // Only inside the Smart element: class markup keeps the overlay over the route (dispatcher 2026-11-14).
  assert.match(css, /:where\(sf-reference-link\) \.sf-reference-link:has\([^{]*\.sf-reference-link__meta, \.sf-reference-link-text\) \{\s*position: relative;\s*z-index: 1;[^}]*user-select: text;/u);
  assert.match(template, /class="sf-reference-link__icon sf-icon" aria-hidden="true"/u);
  assert.match(element, /followFromRoute\(event\)/u);
  assert.match(element, /selection\.isCollapsed/u);
});

test('a disabled reference is an unavailable link (RL-16) and the arrow turns in RTL (RL-17)', () => {
  assert.match(template, /<span role="link" aria-disabled="true"/u);
  assert.doesNotMatch(template, /aria-disabled=\$\{disabled/u);
  assert.match(css, /sf-reference-link:not\(\[icon\]\)[^{]*:dir\(rtl\)[^{]*\{\s*transform: scaleX\(-1\);/u);
});
