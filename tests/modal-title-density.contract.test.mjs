import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// Every window's title is on the heading-4 step in bold (owner decision C159
// (5), 2026-11-14): 20 on 24, 16 on 18 on a phone. It was heading 3 (C44) with
// the question window alone on heading 4 (C39); one unscoped rule sizes it now
// and no size scopes another. Headings do not follow density (pair next 2).
// tests/browser/headings-density.browser.mjs measures the build.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sheet = read('src/component/modal/scss/_css__modal_custom.scss').replace(/\/\*[\s\S]*?\*\//gu, '');
const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(([, selector, body]) => ({selector: selector.trim(), body}));

test('every window title is the heading-4 step; no size sets another', () => {
  const sizing = rules.filter(({selector, body}) => /\.sf-modal-title\b/u.test(selector) && /font-size|line-height/u.test(body));
  const plain = sizing.filter(({selector}) => selector === '.sf-modal-title');
  assert.equal(plain.length, 1, 'one unscoped rule sizes the title');
  assert.match(plain[0].body, /font-size: var\(--sf-heading-4--size\);/u);
  assert.match(plain[0].body, /line-height: var\(--sf-heading-4--height\);/u);
  assert.deepEqual(sizing.filter(({selector}) => selector !== '.sf-modal-title').map(({selector}) => selector), []);
});

test('the question title reads values density does not move', () => {
  const density = read('src/core/scss/_sf_css__density.scss');
  const compact = density.slice(density.indexOf('[data-sf-density="compact"] {'));
  const block = compact.slice(0, compact.indexOf('}'));
  // Heading 4 is written in the compact block with its normal value (C44).
  assert.match(block, /--sf-heading-4--size: var\(--sf-c0\);/u);
  assert.match(block, /--sf-heading-3--size: var\(--sf-c2\);/u);
  // The h4 step's line (the title ladder's second step) is not a density
  // variable at all.
  assert.doesNotMatch(density, /--sf-heading-4--height:/u);
  assert.doesNotMatch(density, /--sf-title--height-2:/u);
  assert.doesNotMatch(density, /--sf-heading-4--size: var\(--sf-(?!c0\))/u);
});
