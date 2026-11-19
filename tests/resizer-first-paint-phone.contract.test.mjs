// sf-resizer 1.5.2 (fix/first-paint-390): on a phone screen the sheet hides
// the handle, as the script does below the split step (C158 (4)), so a printed
// first paint holds at 390 before the script measures the split
// (first-paint gate 24: the five examples moved 24 -> 0 there).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const sheet = read('src/smart/resizer/scss/_smart__resizer.scss');
const uncomment = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

// The block a prelude opens, to its matching brace.
function block(source, prelude) {
  const at = source.indexOf(prelude);
  if (at < 0) return null;
  let depth = 0;
  for (let i = source.indexOf('{', at); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  return null;
}

test('sf-resizer: below sm the sheet takes the handle away, the exact complement of the sm breakpoint', () => {
  const phone = block(uncomment(sheet), '@media not all and (min-width: map.get(bp.$breakpoint-array, sm))');
  assert.ok(phone, 'the phone screen rule is in the sheet');
  assert.match(phone, /sf-resizer\s*\{\s*display:\s*none;\s*\}/u);
  assert.match(sheet, /@use '\.\.\/\.\.\/\.\.\/core\/scss\/vars\/sf_var__breakpoint' as bp;/u);
});

test('sf-resizer: sm is under the split step the script reads, so the sheet never hides a handle the script would show on a wide split', () => {
  const breakpoints = read('src/core/scss/vars/_sf_var__breakpoint.scss');
  const sm = Number(breakpoints.match(/\bsm: ([0-9.]+)rem/u)[1]);
  const split = Number(breakpoints.match(/\bh0: map\.get\(size\.\$size-array, h, 0\), \/\/ ([0-9.]+)rem/u)[1]);
  assert.ok(sm < split, `sm ${sm}rem is under the split step h0 ${split}rem`);
  assert.match(read('src/smart/resizer/index.js'), /const SPLIT_STEP = 'var\(--sf-h0\)';/u);
});

test('sf-resizer: the narrow handle the script marks stays hidden at every width', () => {
  assert.match(uncomment(sheet), /sf-resizer\[data-sf-resizer-narrow\]\s*\{\s*display:\s*none;\s*\}/u);
});

test('sf-resizer: the built sheet carries the phone rule', {skip: process.env.UI_CORE_ROOT ? false : 'UI_CORE_ROOT names no build'}, () => {
  // UI_CORE_ROOT=<ui root>: its distribution, distr/ (as container-ladder-c181 reads it).
  const file = join(process.env.UI_CORE_ROOT, 'distr', 'smart', 'resizer', 'css', 'resizer.min.css');
  if (!existsSync(file)) return assert.fail(`${file} is missing`);
  const css = readFileSync(file, 'utf8');
  assert.match(css, /@media not all and \(min-width:\s*32rem\)\s*\{[^}]*sf-resizer\s*\{\s*display:\s*none;?\s*\}/u);
});
