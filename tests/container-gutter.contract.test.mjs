// The container's gutter (owner decision 2026-10-28): every container step
// reads the public --sf-container-gutter before its own step, so a product
// sets the gutter once and its header and content stay on one line; and
// container-flush empties one container without passing the zero to a
// container nested inside it (the inset does not inherit). The Loader loads
// the sheet for container-flush alone as well.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sheet = (step) => readFileSync(join(root, `src/utility/container/${step}/scss/_sf_css__container.scss`), 'utf8');
const STEPS = ['default', 'sm', 'md', 'lg', 'xl', 'xxl'];

test('every container step reads the inset, then the public gutter, then its step', () => {
  for (const step of STEPS) {
    const paddings = [...sheet(step).matchAll(/padding-inline-(?:start|end):\s*([^;]+);/g)].map((match) => match[1]);
    assert.ok(paddings.length >= 2, `${step}: no inline padding`);
    for (const value of paddings) {
      assert.match(value, /^var\(--sf-container--inset, var\(--sf-container-gutter, var\(--sf-space-[^)]+\)\)\)$/, `${step}: ${value}`);
    }
  }
});

test('container-flush sets the inset, which does not inherit', () => {
  const text = sheet('default');
  assert.match(text, /@property --sf-container--inset\s*\{[^}]*inherits:\s*false;/);
  assert.match(text, /\.container-flush\s*\{\s*--sf-container--inset:\s*0px;\s*\}/);
  assert.doesNotMatch(text, /\.container-flush\s*\{[^}]*--sf-container-gutter/, 'flush must not set the public gutter: it would inherit into nested containers');
});

test('the Loader rule takes container and container-flush', () => {
  const source = readFileSync(join(root, 'src/utility/container/default/rule.js'), 'utf8');
  const rule = new RegExp(JSON.parse(source.match(/new RegExp\(("(?:[^"\\]|\\.)*")\)/)[1]));
  for (const name of ['container', 'container-flush']) assert.ok(rule.test(name), name);
  for (const name of ['container-flushed', 'max-container', 'containers']) assert.ok(!rule.test(name), name);
});
