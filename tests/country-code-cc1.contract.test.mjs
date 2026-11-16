import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// sf-country-code / sf-input-country, DEV letter msg-5241318c (study
// ui-control prototypes/forms-country-code-study.html, pair 5.20261115.1622),
// items RG-CC-1..6. The class script and sheets are the lowest layer: the
// Smart field draws with them.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('src/component/country-code/js/_country_code.js');
const css = await read('src/component/country-code/scss/_css_country_code.scss');
const custom = await read('src/component/country-code/scss/_css_country_code_custom.scss');
const {items} = JSON.parse(await read('src/component/country-code/data/countries.json'));
const country = (iso) => items.find((item) => item.iso2 === iso);
const slice = (start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  const to = source.indexOf(end, from);
  assert.ok(to > from, end);
  return source.slice(from, to);
};

test('RG-CC-1: a masked field with a choice of countries does not lock its code', () => {
  const context = vm.createContext({});
  vm.runInContext(slice('function getLockedPrefix', 'function enforceDialCodePrefix'), context);
  const root = {dataset: {dialCode: '+7'}};
  // A masked field with the list: the code is the start of the text.
  assert.equal(context.getLockedPrefix(root, {showCode: true, multiCountry: true, useMask: true}), '');
  assert.equal(context.getLockedPrefix(root, {showCode: true, multiCountry: true, useMask: false}), '');
  // One fixed country keeps it locked, masked or not.
  assert.equal(context.getLockedPrefix(root, {showCode: true, multiCountry: false, useMask: true}), '+7 ');
  assert.equal(context.getLockedPrefix(root, {showCode: true, multiCountry: false, useMask: false}), '+7 ');
});

test('RG-CC-1: the mask follows the code in the text and never cuts a number', () => {
  const asked = [];
  const context = vm.createContext({
    normalizeMaskPatternByStyle: (pattern) => String(pattern || '').trim(),
    applyMaskForRoot: (root, input, pattern) => { asked.push(pattern); root.__sfCountryMaskPattern = pattern; },
  });
  vm.runInContext(slice('function countryTextPattern', '// A field without a placeholder'), context);
  const config = {useMask: true, useCountryMasks: true};
  const field = (value, pattern) => ({root: {__sfCountryMaskPattern: pattern}, input: {value}});
  const run = (value, iso, pattern = '+0 000 000-00-00') => {
    asked.length = 0;
    const {root, input} = field(value, pattern);
    context.syncTextMask(root, input, config, iso ? country(iso) : null);
    return asked.slice();
  };
  // The code erased or unknown: the mask stands back, so it cannot put +7 back.
  assert.deepEqual(run('+ 903 123-45-67', null), ['']);
  // A German number pasted into a Russian field: the German pattern.
  assert.deepEqual(run('+49 30 123456', 'DE'), ['+00 00 000000']);
  // More digits than the pattern holds: no mask, the digits stay.
  assert.deepEqual(run('+49 90 31234567', 'DE'), ['']);
  // A text whose code is another country's is not laid out by this one.
  assert.deepEqual(run('+999 123', 'RU'), ['']);
  // The same pattern asked again: nothing to do.
  assert.deepEqual(run('+7 903 123-45-67', 'RU'), []);
  assert.deepEqual(run('+7 701 123-45-67', 'KZ'), []);
  // Without use-mask the text path alone lays the number out.
  asked.length = 0;
  context.syncTextMask({}, {value: '+49 30 123456'}, {useMask: false}, country('DE'));
  assert.deepEqual(asked, []);
});

test('RG-CC-1: input and selection go through the text mask before the mask listener', () => {
  const bind = slice('function bindCountryCode', 'function unbindCountryCode');
  const onInput = bind.slice(bind.indexOf('const onInput'), bind.indexOf('const onPaste'));
  assert.match(onInput, /syncTextMask\(root, input, config, null\);\s*markCountryUnknown\(root\);/u);
  assert.match(onInput, /if \(!root\.__sfCountryMask\) syncTextMask\(root, input, config, read\.country\);/u);
  const select = slice('function applyCountrySelection', '// ─── The list');
  assert.match(select, /if \(config\.useMask && config\.showCode && config\.multiCountry\) \{[\s\S]*?syncTextMask\(root, input, config, country\);/u);
  // The pattern asked for is remembered, and forgotten at unbind.
  assert.match(source, /root\.__sfCountryMaskPattern = maskPattern \|\| '';/u);
  assert.match(source, /delete root\.__sfCountryMaskPattern;/u);
});

test('RG-CC-2: the list takes the surface radius, as other popups', () => {
  assert.match(css, /\.sf-country-code\.open \.sf-country-code-list:not\(\[data-sf-sheet\]\) \{[^}]*border-radius: var\(--sf-radius--surface\);/u);
});

test('RG-CC-3 and RG-CC-5 (C06): the search header is laid out as a row, its glyph box as wide as a flag', () => {
  const search = css.slice(css.indexOf('.sf-country-code .sf-country-code-search {'), css.indexOf('.sf-country-code .sf-country-code-search input {'));
  assert.match(search, /gap: var\(--sf-country-code-item--gap/u);
  assert.match(search, /padding-inline: calc\(var\(--sf-country-code--inset\) - var\(--sf-country-code-list--padding-inline-start, 0px\)\);/u);
  // The glyph box is the flag's width (7:5), not its height: a 16 or 12 box
  // clipped the glyph and the icon check called the glyph missing.
  assert.match(search, /--sf-icon--width: calc\(var\(--sf-country-code--flag-height\) \* 1\.4\);/u);
  assert.doesNotMatch(search, /--sf-icon--width: var\(--sf-country-code--flag-height\);/u);
  assert.match(search, /--sf-icon--font-size: var\(--sf-country-code-item--line-height/u);
  // Every size gives the search the rows' gap and type.
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(custom.includes(`.sf-country-code.sf-country-code--size-${size} :is(.sf-country-code-item, .sf-country-code-search) {\n  --sf-country-code-item--font-size`), size);
  }
  assert.match(custom, /\.sf-country-code\.#\{ladder\.size-class\('sf-country-code', \$size\)\} :is\(\.sf-country-code-item, \.sf-country-code-search\) \{/u);
});

test('RG-CC-4: the listbox holds the options only; the search stands before it', () => {
  const access = slice('function syncCountryAccessibility', 'function getNodes');
  assert.match(access, /const box = itemsWrap \|\| list;\s*box\.setAttribute\('role', 'listbox'\);\s*setCountryName\(box, countryName\);/u);
  assert.match(access, /toggle\.setAttribute\('aria-controls', ensureCountryId\(itemsWrap \|\| list\)\);/u);
  assert.doesNotMatch(access, /list\.setAttribute\('role', 'listbox'\)/u);
  // The group headings and the «nothing found» line are drawn, not read as rows.
  const groups = slice('function ensureCountryGroups', 'function syncCountryEmpty');
  assert.match(groups, /head\.setAttribute\('aria-hidden', 'true'\);/u);
  assert.doesNotMatch(groups, /'presentation'/u);
  const empty = slice('function syncCountryEmpty', 'function arrangeCountryList');
  assert.match(empty, /row\.setAttribute\('aria-hidden', 'true'\);/u);
  // The search is the panel's header, outside the rows' wrap.
  assert.match(source, /list\.insertBefore\(head, list\.firstChild\);/u);
  assert.match(source, /field\.setAttribute\('aria-controls', ensureCountryId\(itemsWrap\)\);/u);
});

test('RG-CC-6: the list hangs from the field, not from the label and hint', () => {
  const viewport = slice('function bindCountryViewport', 'function countryListOnPhone');
  assert.match(viewport, /const field = root\.querySelector\('\.sf-country-code-field'\) \|\| root;\s*anchor = positioning\(\)\.anchor\(field, list, \{/u);
  assert.doesNotMatch(viewport, /anchor\(root, list/u);
});
