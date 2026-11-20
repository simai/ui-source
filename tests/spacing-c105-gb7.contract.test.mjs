// C105 H5 (DEV recipes list-bottom and brand-theme, 2026-11-15): what can be
// read from the source. The browser half -- the gaps as drawn at 1440 and 390,
// normal and compact, and the words -- is tests/browser/spacing-c105-gb7.browser.mjs.
//
//   (1) the row of sf-pagination is one group of buttons: the list names
//       --sf-space-1/3 itself (8; 4 in the compact density of a desktop) behind the footer
//       container's variable, which the C97 appearances never set;
//   (2) the frame of sf-input-color spaces its value and its reset as buttons
//       of one group (--sf-space-1/3), not by the button's icon-to-text space;
//   (3) the brand field's clear says «Вернуть цвет SIMAI» / «Restore SIMAI
//       colour»; the field variant keeps the inherited words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is in the sheet`);
  return css.slice(at, css.indexOf('}', at));
};

test('(1) the pagination list is one group of buttons: --sf-space-1/3 behind the footer variable', () => {
  const css = read('src/component/pagination/scss/_css__pagination.scss');
  const list = rule(css, '.sf-pagination .sf-pagination-list');
  assert.match(list, /gap: var\(--sf-pagination-container--gap, var\(--sf-pagination-gap, var\(--sf-space-1\\\/3\)\)\);/u);
  assert.equal(json('src/component/pagination/passport.json').version, '1.7.0'); // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch // defects-d11: component.pagination 1.6.2 above 1.6.1 on fix/c178-findings: a place never below its own number (RG-NV 9) // group build 14: 1.6.3 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  assert.equal(json('src/smart/pagination/component.json').version, '1.10.1'); // reds-before-gb15: 1.10.1 probe only; // group build 8: fix/pagination-more-c167's 1.7.0 (group build 7: 1.6.2, the branch wrote 1.6.1) // group build 9: 1.7.3 moved on by the merged branches or a GB9 patch // C282: 1.8.4 moved on by the language-file patch (Russian is a language file) // group build 10: 1.8.7 moved on by the merged branches or a GB10 patch // C295: 1.9.0, the band is sf-bulk-actions // group build 13: 1.9.0 moved on by the merged branches or a GB11 merge
});

test('(2) the colour frame spaces its value and its glyphs by C123, not by the icon-to-text space', () => {
  const css = read('src/smart/input-color/js/templates/default.css');
  const frame = rule(css, '.sf-color-frame');
  assert.doesNotMatch(frame, /gap: var\(--sf-color--text-space-x\)/u);
  // 1.11.0 (owner decision C123): the reset is a field action and the frame
  // keeps the half inset round its glyph (tests/input-color-reset-c123.*).
  // 1.13.0: without an action the value -> chevron step is half the inset too
  // (C123 (3), (6)), no longer H5's --sf-space-1/3.
  assert.match(frame, /gap: calc\(var\(--sf-color--space-x\) \/ 2\);/u);
  assert.equal(json('src/smart/input-color/component.json').version, '1.20.0'); // C209 (fix/input-color-c209), above group build 7's 1.14.0 // group build 9: 1.17.1 moved on by the merged branches or a GB9 patch // C282: 1.18.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.19.2 moved on by the merged branches or a GB10 patch // group build 13: 1.19.4 moved on by the merged branches or the C278 language patch // group build 14: 1.19.5 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
});

test('(3) the brand clear has words of its own; the field keeps the inherited ones', () => {
  const ru = json('src/smart/input-color/lang/ru.json').runtime;
  const en = json('src/smart/input-color/lang/en.json').runtime;
  assert.equal(ru['brand-reset'], 'Вернуть цвет SIMAI');
  assert.equal(en['brand-reset'], 'Restore SIMAI colour');
  assert.equal(ru.clear, 'Вернуть унаследованный');
  const source = read('src/smart/input-color/index.js');
  assert.match(source, /get brandResetLabel\(\) \{\s+return this\.getAttribute\("clear-label"\) \|\| this\.sfWord\("brand-reset"\);/u);
  assert.match(source, /clearLabel: this\.isBrand \? this\.brandResetLabel : this\.clearLabel,/u);
});
