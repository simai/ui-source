import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// A window's title keeps its heading step in a compact region (owner decision
// C44): heading 3, 24 on the desktop. A question window's title (C39) is
// heading 4 in bold, 20 on 28, and keeps it in compact too (pair next 2,
// dispatcher: headings do not follow density). The question rule was
// page-wide when C44 landed, so every window's title drew at 20 (compact 16):
// it is scoped to the question size, and nothing else sizes .sf-modal-title.
// tests/browser/headings-density.browser.mjs measures both on the build.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sheet = read('src/component/modal/scss/_css__modal_custom.scss').replace(/\/\*[\s\S]*?\*\//gu, '');
const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(([, selector, body]) => ({selector: selector.trim(), body}));

test('a plain window title is the heading-3 step; only the question size sets another', () => {
  const sizing = rules.filter(({selector, body}) => /\.sf-modal-title\b/u.test(selector) && /font-size|line-height/u.test(body));
  const plain = sizing.filter(({selector}) => selector === '.sf-modal-title');
  assert.equal(plain.length, 1, 'one unscoped rule sizes the title');
  assert.match(plain[0].body, /font-size: var\(--sf-heading-3--size\);/u);
  assert.match(plain[0].body, /line-height: var\(--sf-heading-3--height\);/u);
  const others = sizing.filter(({selector}) => selector !== '.sf-modal-title');
  assert.deepEqual(others.map(({selector}) => selector), ['.sf-modal--size-question .sf-modal-title']);
  assert.match(others[0].body, /font-size: var\(--sf-heading-4--size\);/u);
  assert.match(others[0].body, /line-height: var\(--sf-title--height-6\);/u);
  // The plain rule comes first, so the scoped one wins only by its selector.
  assert.ok(sheet.indexOf(plain[0].selector + ' {') < sheet.indexOf(others[0].selector));
});

test('the question title reads values density does not move', () => {
  const density = read('src/core/scss/_sf_css__density.scss');
  const compact = density.slice(density.indexOf('[data-sf-density="compact"] {'));
  const block = compact.slice(0, compact.indexOf('}'));
  // Heading 4 is written in the compact block with its normal value (C44).
  assert.match(block, /--sf-heading-4--size: var\(--sf-c0\);/u);
  assert.match(block, /--sf-heading-3--size: var\(--sf-c2\);/u);
  // The title line ladder is not a density variable at all.
  assert.doesNotMatch(density, /--sf-title--height-6:/u);
  assert.doesNotMatch(density, /--sf-heading-4--size: var\(--sf-(?!c0\))/u);
});
