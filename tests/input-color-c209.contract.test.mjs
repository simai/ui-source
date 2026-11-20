// Owner decision C209 (2026-11-15, prototype ui-control
// prototypes/colour-field-study.html #q-cf-simple B) and defect CF-1 for
// sf-input-color's «Своё»: what can be read from the source. The browser half
// -- the row as drawn, typed colours read as hex, Apply, the copy action and
// the keyboard path -- is tests/browser/input-color-c209.browser.mjs.
//
//   (1) the code is always hex: no format menu, no format state, no format
//       words; any CSS colour is still read;
//   (2) «Применить» right of the code field applies and closes;
//   (3) the bottom row is the code field and «Применить», one group apart;
//   (4) the copy action is sf-button-copy inside the field frame (C123), the
//       check shown 1.2 s;
//   (5) the window stays on --sf-surface-popup and draws no hint line;
//   CF-1: the focus leaving the window closes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseColour} from '../src/smart/input-color/js/color-math.js';
import {paintBlocks} from './support/paint-blocks.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is in the sheet`);
  return css.slice(at, css.indexOf('}', at));
};
const base = 'src/smart/input-color';
const template = read(`${base}/js/templates/default.js`);
const element = read(`${base}/index.js`);
const css = read(`${base}/js/templates/default.css`);
const own = template.slice(template.indexOf('function renderOwn'));

test('the version and the new relations', () => {
  const manifest = json(`${base}/component.json`);
  assert.equal(manifest.version, '1.20.0'); // 1.17.1: the ratio by Intl, no decimal word (C177 follow-up #86) // group build 9: 1.17.1 moved on by the merged branches or a GB9 patch // C282: 1.18.1 moved on by the language-file patch (Russian is a language file) // group build 10: 1.19.2 moved on by the merged branches or a GB10 patch // group build 13: 1.19.4 moved on by the merged branches or the C278 language patch // group build 14: 1.19.5 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
  for (const name of ['cl-button', 'cl-button-copy']) {
    assert.ok(manifest.relations.some((relation) => relation.name === name && relation.lazy), `${name}, lazy`);
  }
  const uses = json(`${base}/smart.manifest.json`).composition.uses;
  assert.ok(uses.includes('smart.button') && uses.includes('smart.button-copy'));
  const parts = manifest['x-registry']['public-parts'];
  assert.ok(parts.includes('copy') && parts.includes('apply'));
  assert.ok(!parts.includes('format') && !parts.includes('format-menu'));
});

test('(1) the code is always hex; the format menu is gone', () => {
  assert.doesNotMatch(template, /sf-color-format|menuitemradio|formatWords|formatOpen/u);
  assert.doesNotMatch(element, /_format|toggleFormatMenu|setFormat|FORMAT_WORD/u);
  assert.match(element, /parseColour\(text, "hex"/u);
  assert.match(element, /formatColour\(this\._hsv \|\| \[0, 0, 0\], "hex"\)/u);
  for (const lang of ['ru', 'en']) {
    const words = json(`${base}/lang/${lang}.json`).runtime;
    for (const gone of ['format', 'format-current', 'code-in']) assert.equal(words[gone], undefined, `${lang} ${gone}`);
    assert.doesNotMatch(words['not-a-colour'], /\{format\}/u, `${lang} not-a-colour`);
    assert.ok(words.copy && words.apply, `${lang} copy, apply`);
  }
  const ru = json(`${base}/lang/ru.json`).runtime;
  assert.equal(ru.apply, 'Применить');
  assert.equal(ru.copy, 'Скопировать код');
  // Read as hex whatever is typed: a hex with or without #; rgb(), hsl(),
  // oklch() and names are asked of the page.
  assert.deepEqual(parseColour('1d9367', 'hex').rgb, [29, 147, 103]);
  assert.deepEqual(parseColour('#1D9367', 'hex').rgb, [29, 147, 103]);
  const asked = [];
  parseColour('rgb(21, 101, 192)', 'hex', (text) => (asked.push(text), {rgb: [21, 101, 192], a: 1}));
  parseColour('oklch(0.6 0.15 250)', 'hex', (text) => (asked.push(text), null));
  parseColour('rebeccapurple', 'hex', (text) => (asked.push(text), null));
  assert.deepEqual(asked, ['rgb(21, 101, 192)', 'oklch(0.6 0.15 250)', 'rebeccapurple']);
  // oklch(), lab(), color() stay so in a computed style: read through a canvas.
  assert.match(element, /return cssRgb\(read\) \|\| this\._canvasRgb\(read\);/u);
});

test('(2) «Применить» applies the typed code and closes; after a move it only closes', () => {
  assert.match(own, /<sf-button class="sf-color-apply"\s+size="1\/2"\s+text=\$\{word\('apply'\)\}\s+data-action="apply"/u);
  assert.match(own, /@click=\$\{\(\) => component\.applyCode\(\)\}/u);
  const apply = element.slice(element.indexOf('    applyCode() {'), element.indexOf('    get copyText()'));
  assert.match(apply, /this\._typing && !this\._takeCode\(field\.value, true\)/u, 'a typed code is read and committed');
  assert.match(apply, /return false;/u, 'an unreadable code keeps the window open');
  assert.match(apply, /closePicker\(\{reason: "apply", restoreFocus: true\}\)/u);
});

test('(3) the bottom row: the code field and «Применить», one group apart (C105 H5)', () => {
  assert.match(own, /<div class="sf-color-bottom">\s*<div class="sf-color-code-row sf-input-field"/u);
  assert.match(rule(css, '.sf-color-bottom'), /gap: var\(--sf-space-1\\\/3\);/u);
  const row = rule(css, '.sf-color-code-row');
  assert.match(row, /block-size: var\(--sf-ui-1\\\/2--control-height\);/u);
  assert.match(row, /--sf-field-action--inset: var\(--sf-ui-1\\\/2--space-x\);/u);
  assert.match(row, /--sf-field-action--glyph: var\(--sf-text-height-1\\\/2\);/u);
  assert.match(row, /--sf-field-action--height: var\(--sf-ui-1\\\/2--control-height\);/u);
  assert.match(row, /gap: var\(--sf-field-action--value-space\);/u);
});

test('(4) the copy action is sf-button-copy in the field frame, the check for 1.2 s', () => {
  assert.match(own, /<sf-button-copy class="sf-color-copy"\s+size="1\/2"\s+value=\$\{context\.copyText\}\s+duration=\$\{String\(context\.copyShown\)\}\s+label=\$\{word\('copy'\)\}>/u);
  assert.match(element, /const COPY_SHOWN = 1200;/u);
  assert.match(element, /get copyText\(\) \{\s*return this\.ownColour\.toUpperCase\(\);/u);
  assert.match(rule(css, '.sf-color-code-row:has(> .sf-color-copy:last-child)'), /padding-inline-end: var\(--sf-field-action--inset\);/u);
});

test('(5) the window stays on the popup surface, no hint line', () => {
  assert.match(rule(paintBlocks(css), '.sf-color-window'), /background-color: var\(--sf-surface-popup\);/u); // C273: paint
  assert.doesNotMatch(own, /sf-color-hint|mhint/u);
});

test('CF-1: the focus leaving the window closes it, the focus stays where it went', () => {
  const open = element.slice(element.indexOf('    openPicker('), element.indexOf('    closePicker('));
  assert.match(open, /this\.addEventListener\("focusout", this\._onFocusOut\)/u);
  assert.match(open, /if \(!this\._open \|\| !next \|\| this\.contains\(next\)/u);
  assert.match(open, /closePicker\(\{reason: "focus", restoreFocus: false\}\)/u);
  assert.match(element, /this\.removeEventListener\("focusout", this\._onFocusOut\)/u);
});
