import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {checkFocusOffsets, isFocusRule, KEPT, offsetsOf} from '../scripts/check-focus-offsets.mjs';

// Owner decision C212 (7), 2026-11-16: the focus ring stands off its element by
// one of two tokens, --sf-focus--offset outwards and --sf-focus--inset inwards;
// components write no distance of their own, and the check in the pair build
// fails on one that does. The look does not change: every rewritten spelling
// had the value of the token it now reads.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

test('core declares both offsets of the focus family', () => {
  const border = read('src/core/scss/_sf_css__border.scss');
  assert.match(border, /--sf-focus--offset: var\(--sf-px\);/u, 'outwards: one pixel');
  assert.match(border, /--sf-focus--inset: calc\(var\(--sf-focus--width\) \* -1\);/u, 'inwards: the focus width');
});

test('the check reads nested focus rules, skips other outlines and the former width name fails', () => {
  const sheet = [
    '.a { &:focus-visible { outline-offset: calc(var(--sf-focus--width) * -1); } }',
    '.b:has(input:focus-visible) .c { outline-offset: var(--sf-focus--inset); }',
    '.d[aria-current="true"] { outline-offset: var(--sf-a1); }',
    '@media (forced-colors: active) { .e:focus-within { outline-offset: 2px; } }',
    '.f:is(.g, .h):focus { outline-offset: var(--sf-focus--offset) !important; }',
  ].join('\n');
  const offsets = offsetsOf(sheet);
  assert.deepEqual(offsets.map((offset) => [offset.line, offset.value, isFocusRule(offset.chain)]), [
    [1, 'calc(var(--sf-focus--width) * -1)', true],
    [2, 'var(--sf-focus--inset)', true],
    [3, 'var(--sf-a1)', false],
    [4, '2px', true],
    [5, 'var(--sf-focus--offset)', true],
  ]);
});

test('every Framework focus ring reads the two tokens, apart from the listed ones', () => {
  const {findings, stale} = checkFocusOffsets(
    ['src/component', 'src/smart', 'src/core/scss'].map((path) => join(root, path)),
    {root},
  );
  assert.deepEqual(findings, [], 'no focus rule writes an offset of its own or reads --sf-focus-outline-width');
  assert.deepEqual(stale, [], 'every kept offset is still there; a fixed one leaves KEPT');
  // One offset everywhere (msg-bc1702eb, 2026-11-18): the 11 forced-colours
  // rings (the system Highlight, 2px out) and the owner's link ring (C186 (4):
  // text link, sf-link, crumb, reference in text, 2px out) keep their own.
  assert.equal(KEPT.length, 15);
  assert.equal(KEPT.filter((entry) => entry.why === 'forced colours, 2px out').length, 11);
  assert.ok(KEPT.every((entry) => entry.why === 'forced colours, 2px out' || /\(C186 \(4\)\)$/u.test(entry.why)), 'only forced-colours rings and C186 (4) links are kept');
  assert.ok(KEPT.every((entry) => entry.why), 'each kept offset says why');
});
