// The badge's side room (docs review R020, owner decision C02): by default the
// text sits --sf-space-1/2 from the badge's edge at every size and line size,
// whatever the look; only sf-badge--tight takes the narrow room
// (--sf-space-1/3 since component.badges 1.8.0, BG-9); an outline counts its
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
const SIZES = [
  '.sf-badge--size-1\\/3',
  '.sf-badge--size-1\\/2',
  '.sf-badge--size-1',
  '.sf-badge.sf-badge--line-1\\/2',
  '.sf-badge.sf-badge--line-1',
  '.sf-badge.sf-badge--line-2',
];

test('the default side room is --sf-space-1/2 and both sides take it', () => {
  const base = rule('.sf-badge');
  assert.match(base, /--sf-badge--side-room: var\(--sf-space-1\\\/2\);/);
  assert.match(base, /--sf-badge--padding-inline-start: var\(--sf-badge-padding-inline, var\(--sf-badge--side-room\)\);/);
  assert.match(base, /--sf-badge--padding-inline-end: var\(--sf-badge-padding-inline, var\(--sf-badge--side-room\)\);/);
});

// BG-9 (badges study 2026-11-14, C19, C105): the tight room is a space step,
// --sf-space-1/3 at every size and line, not the button's text inset (5 and 7
// are not space steps); a figure and a class counter take --sf-space-1/4.
test('the tight room is --sf-space-1/3, one value for every size and line', () => {
  assert.match(rule('.sf-badge'), /--sf-badge--side-tight: var\(--sf-space-1\\\/3\);/);
  assert.doesNotMatch(sheet, /text-space-x\)/, 'no room reads the button text inset');
});

for (const selector of SIZES) {
  test(`${selector}: keeps the default and the tight room`, () => {
    const body = rule(selector);
    assert.doesNotMatch(body, /--sf-badge--side-(room|tight):/, 'a size does not change the room');
    assert.doesNotMatch(body, /--sf-badge--padding-inline/, 'a size does not set the inline padding');
  });
}

test('a figure and a class counter take the quarter step and stay round', () => {
  assert.match(rule('.sf-badge:is(.sf-badge--figure, [data-count])'), /--sf-badge--side-room: var\(--sf-space-1\\\/4\);/);
});

test('the looks do not change the room; the outline border is inside it', () => {
  for (const look of ['tonal', 'main', 'outline']) {
    for (const match of sheet.matchAll(new RegExp(`\\.sf-badge--${look}[^{]*\\{([^}]*)\\}`, 'g'))) {
      assert.doesNotMatch(match[1], /--sf-badge--(side-room|padding-inline)/, `${look} keeps the room`);
    }
  }
  assert.match(rule('.sf-badge'), /padding-inline-start: max\(var\(--sf-a0\), calc\(var\(--sf-badge--padding-inline-start\) - var\(--sf-badge--border-inline-start-width\)\)\);/);
  assert.match(rule('.sf-badge'), /padding-inline-end: max\(var\(--sf-a0\), calc\(var\(--sf-badge--padding-inline-end\) - var\(--sf-badge--border-inline-end-width\)\)\);/);
});

test('only tight swaps in the narrow room', () => {
  const swaps = [...sheet.matchAll(/([^{}]+)\{[^}]*--sf-badge--side-room: var\(--sf-badge--side-tight\)/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim());
  assert.deepEqual(swaps, ['.sf-badge.sf-badge--tight']);
});
