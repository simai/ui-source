import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// sf-pager 1.2.4: the defects of the pager study that stand without the
// narrowing of the component (ui-control control/research/2026-11-12-pagination.md,
// owner remark R183, decision C97). PR-02 steps place line, PR-04 row titles,
// PR-05 cards and row on a phone.

const root = resolve(import.meta.dirname, '..');
const sheet = readFileSync(resolve(root, 'src/smart/pager/scss/_smart__pager.scss'), 'utf8');
const component = JSON.parse(readFileSync(resolve(root, 'src/smart/pager/component.json'), 'utf8'));
const rule = (selector, from = sheet) => {
  const at = from.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} has a rule`);
  return from.slice(at, from.indexOf('}', at));
};

// 1.3.0 (C97 point 7) narrows the looks to cards, row and counter; steps and
// course stay values until 2027-01-01 (tests/pager-c97.contract.test.mjs).
test('version 1.3.2: the five values still parse, three are the component\'s looks', () => {
  assert.equal(component.version, '1.3.2');
  assert.deepEqual(component.settings.appearance.values, ['cards', 'row', 'steps', 'course', 'counter']);
});

test('PR-02: the steps place line wraps rather than cutting the step\'s name', () => {
  const place = rule('.sf-pager--steps .sf-pager-place');
  assert.match(place, /white-space: normal;/u);
  assert.doesNotMatch(place, /text-overflow: ellipsis|white-space: nowrap|overflow: hidden/u);
});

test('PR-04: row shows each title whole up to two lines', () => {
  const title = rule('.sf-pager--row .sf-pager-title');
  assert.match(title, /-webkit-line-clamp: 2;/u);
  assert.match(title, /line-clamp: 2;/u);
  assert.match(title, /white-space: normal;/u);
  // The arrow stands on the first line of a two-line title.
  assert.match(rule('.sf-pager--row .sf-pager-side'), /align-items: flex-start;/u);
});

// DEV's intent acceptance (2026-11-14) returned PR-04: in a card 440 pixels
// wide the sides were capped at half the row (199 px), and «Как мы перенесли
// каталог на Larena за выходные» was still cut after two lines. The row is
// two columns only while it is at least sm wide; narrower, it stacks.
test('PR-04 return: a row narrower than sm stacks, side by side only from sm', () => {
  // The rule reads to its own close: the sm step is interpolated with #{}.
  const row = sheet.slice(sheet.indexOf('.sf-pager--row {'), sheet.indexOf('\n}\n', sheet.indexOf('.sf-pager--row {')));
  assert.match(row, /display: grid;/u);
  assert.match(row, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, calc\(\(#\{map\.get\(bp\.\$breakpoint-array, sm\)\} - var\(--sf-pager--gap\)\) \/ 2\)\), 1fr\)\);/u);
  assert.match(row, /gap: var\(--sf-pager--gap\);/u);
  const side = rule('.sf-pager--row .sf-pager-side');
  assert.match(side, /justify-self: start;/u);
  assert.match(side, /max-inline-size: 100%;/u);
  assert.doesNotMatch(side, /50%/u, 'a side is not capped at half of a narrow card');
  // The next side keeps the inline end, alone or below the previous one.
  const next = sheet.match(/\.sf-pager--row \.sf-pager-side--next \{[^}]*grid-column: -2;[^}]*\}/u);
  assert.ok(next, 'the next side takes the last column');
  assert.match(next[0], /justify-self: end;/u);
  assert.doesNotMatch(sheet, /margin-inline-start: auto/u);
});

test('PR-05: cards and row stack on a phone', () => {
  const phone = sheet.slice(sheet.indexOf('@media not all and (min-width: map.get(bp.$breakpoint-array, sm))'));
  assert.ok(phone.length > 0, 'a phone query below the sm step');
  assert.match(rule('.sf-pager--cards', phone), /grid-template-columns: minmax\(0, 1fr\);/u);
  assert.match(rule('.sf-pager--cards .sf-pager-side--next', phone), /grid-column: 1;/u);
  // The row stacks by its own width, which on a phone is below sm (PR-04 return).
  assert.match(sheet, /@use "\.\.\/\.\.\/\.\.\/core\/scss\/vars\/sf_var__breakpoint" as bp;/u);
});
