// The badge's side room (docs review R020, owner decision C02): by default the
// text sits --sf-space-1/2 from the badge's edge at every size and line size,
// whatever the look; only sf-badge--tight takes the size's own text inset
// (--sf-ui-*--text-space-x), the narrow room before; an outline counts its
// border inside the room (each side's padding gives up the border's width).
// --sf-space-1/2 is an adaptive token (12px from 60rem, 8px below), so the
// room follows it; tests/browser/badge-geometry measures it in a browser.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sheet = readFileSync(new URL('../src/component/badges/scss/_css__badges.scss', import.meta.url), 'utf8');
const rule = (selector) => {
  const at = sheet.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `rule ${selector} is in the sheet`);
  return sheet.slice(at, sheet.indexOf('}', at));
};
const SIZES = {
  '.sf-badge--size-1\\/3': '--sf-ui-1\\/3--text-space-x',
  '.sf-badge--size-1\\/2': '--sf-ui-1\\/2--text-space-x',
  '.sf-badge--size-1': '--sf-ui-1--text-space-x',
  '.sf-badge.sf-badge--line-1\\/2': '--sf-ui-1\\/2--text-space-x',
  '.sf-badge.sf-badge--line-1': '--sf-ui-1--text-space-x',
  '.sf-badge.sf-badge--line-2': '--sf-ui-2--text-space-x',
};

test('the default side room is --sf-space-1/2 and both sides take it', () => {
  const base = rule('.sf-badge');
  assert.match(base, /--sf-badge--side-room: var\(--sf-space-1\\\/2\);/);
  assert.match(base, /--sf-badge--padding-inline-start: var\(--sf-badge-padding-inline, var\(--sf-badge--side-room\)\);/);
  assert.match(base, /--sf-badge--padding-inline-end: var\(--sf-badge-padding-inline, var\(--sf-badge--side-room\)\);/);
});

for (const [selector, tight] of Object.entries(SIZES)) {
  test(`${selector}: keeps the default room, names its tight room ${tight}`, () => {
    const body = rule(selector);
    assert.doesNotMatch(body, /--sf-badge--side-room:/, 'a size does not change the default room');
    assert.doesNotMatch(body, /--sf-badge--padding-inline/, 'a size does not set the inline padding');
    assert.ok(body.includes(`--sf-badge--side-tight: var(${tight});`), `tight room ${tight}`);
  });
}

test('the looks do not change the room; the outline border is inside it', () => {
  for (const look of ['tonal', 'main', 'outline']) {
    for (const match of sheet.matchAll(new RegExp(`\\.sf-badge--${look}[^{]*\\{([^}]*)\\}`, 'g'))) {
      assert.doesNotMatch(match[1], /--sf-badge--(side-room|padding-inline)/, `${look} keeps the room`);
    }
  }
  assert.match(rule('.sf-badge'), /padding-inline-start: max\(var\(--sf-a0\), calc\(var\(--sf-badge--padding-inline-start\) - var\(--sf-badge--border-inline-start-width\)\)\);/);
  assert.match(rule('.sf-badge'), /padding-inline-end: max\(var\(--sf-a0\), calc\(var\(--sf-badge--padding-inline-end\) - var\(--sf-badge--border-inline-end-width\)\)\);/);
});

test('only tight (and a figure or a class counter, round by C02) swaps in the narrow room', () => {
  const swaps = [...sheet.matchAll(/([^{}]+)\{[^}]*--sf-badge--side-room: var\(--sf-badge--side-tight\)/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim());
  assert.deepEqual(swaps.sort(), ['.sf-badge.sf-badge--tight', '.sf-badge:is(.sf-badge--figure, [data-count])'].sort());
});
