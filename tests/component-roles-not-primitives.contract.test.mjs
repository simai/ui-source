import assert from 'node:assert/strict';
import test from 'node:test';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

/* A component paints with roles, not with the palette's tones: a role follows
   the theme's light and dark and any theme made from one colour, a tone is one
   colour for ever. carousel.css read --sf-neutral-25 and -85 for a hover the
   theme had no role for (documentation trial 6, 2026-10-18); the role is
   --sf-surface-inverse-hover now. The translucent steps (--sf-<p>-<t>--alfa-<n>)
   are the alpha scale and are read on purpose. */
const ROOT = new URL('../src/', import.meta.url).pathname;
const PRIMITIVE = /var\(--sf-(?:primary|secondary|tertiary|neutral|error|warning|success|info)-\d+\)/gu;

function sheets(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sheets(path) : path.endsWith('.scss') ? [path] : [];
  });
}

test('components read colour roles, not palette tones', () => {
  const found = [];
  for (const area of ['component', 'smart']) {
    for (const path of sheets(join(ROOT, area))) {
      for (const match of readFileSync(path, 'utf8').matchAll(PRIMITIVE)) found.push(`${path.slice(ROOT.length)}: ${match[0]}`);
    }
  }
  assert.deepEqual(found, []);
});
