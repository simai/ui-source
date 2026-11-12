import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// sf-input-country, owner decision C87 (2026-11-12, variant V4 with the caret;
// ui-control prototypes/phone-country-study.html#r3-variant) and DEV letter
// msg-1fc1c8741a0f480cb867 P1 (a list drawn open showed broken flags).
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('src/component/country-code/js/_country_code.js');
const template = await read('src/smart/input-country/js/templates/default.js');
const css = await read('src/component/country-code/scss/_css_country_code.scss');
const custom = await read('src/component/country-code/scss/_css_country_code_custom.scss');
const {items} = JSON.parse(await read('src/component/country-code/data/countries.json'));

function runtime() {
  const context = vm.createContext({COUNTRY_ITEMS: items, syncCountryAccessibility: () => {}});
  for (const [start, end] of [
    ['function normalizeIso2', 'function resolveDefaultFlagBase'],
    ['function getCountryByIso2', 'function normalizeMaskPatternByStyle'],
    ['function resolveInitialCountry', 'function syncDisabledState'],
    ['function countryMatchRank', 'function ensureCountryGroups'],
  ]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  return context;
}
const ctx = runtime();
const root = {__sfCountryOptions: items};
const country = (iso) => items.find((item) => item.iso2 === iso);
const readNumber = (text, current, options) => {
  const result = ctx.readTypedNumber(root, text, current ? country(current) : null, options);
  return {text: result.text, iso: result.country?.iso2 ?? null, wait: result.wait};
};

test('the code is the first group of the number and the flag follows it', () => {
  assert.deepEqual(readNumber('+49 30 123456', 'AZ'), {text: '+49 30 123456', iso: 'DE', wait: false});
  assert.equal(readNumber('+374 50 123456', 'AZ').iso, 'AM');
  // «+3745 0…» asks for +3745, which no country has; never for +374.
  assert.equal(readNumber('+3745 0', 'AZ').iso, null);
  assert.equal(readNumber('+7 701 123 45 67', 'RU').iso, 'KZ');
  assert.equal(readNumber('+7 903 123 45 67', 'KZ').iso, 'RU');
  assert.equal(readNumber('+7 ', 'KZ').iso, 'KZ');
  assert.equal(readNumber('+1 416 555 0100', 'CA').iso, 'CA');
});

test('«8 9…» is Russia from any country, a lone 8 waits, digits take the current code', () => {
  assert.deepEqual(readNumber('8 903 123 45 67', 'AZ'), {text: '+7 903 123 45 67', iso: 'RU', wait: false});
  assert.equal(readNumber('8', 'AZ').wait, true);
  assert.deepEqual(readNumber('903', 'RU'), {text: '+7 903', iso: 'RU', wait: false});
  assert.deepEqual(readNumber('50 123456', 'AM'), {text: '+374 50 123456', iso: 'AM', wait: false});
});

test('an erased code leaves no country and keeps the number', () => {
  assert.deepEqual(readNumber('+ 30 123456', 'DE'), {text: '+ 30 123456', iso: null, wait: false});
  assert.equal(readNumber('+', 'DE').iso, null);
});

test('a finished code gets its space, unless a longer code starts with it', () => {
  assert.equal(readNumber('+374', null).text, '+374 ');
  assert.equal(readNumber('+79031234567', null).text, '+7 9031234567');
  assert.equal(readNumber('+1', null).text, '+1 ');
  // Where a longer code starts with the one typed (a list that gives the
  // Bahamas +1242), the person may still be typing: no space yet.
  const own = {__sfCountryOptions: [{iso2: 'US', dialCode: '+1'}, {iso2: 'BS', dialCode: '+1242'}]};
  assert.equal(ctx.readTypedNumber(own, '+1', null).text, '+1');
  assert.equal(ctx.readTypedNumber(own, '+1242', null).country.iso2, 'BS');
  // Deleting never adds the space back.
  assert.equal(readNumber('+374', null, {deleting: true}).text, '+374');
});

test('extra digits are never cut', () => {
  const text = '+7 903 123 45 67 89 01';
  assert.equal(readNumber(text, 'RU').text, text);
});

test('the search finds a country by its name in either language, its ISO code and its dial code', () => {
  const row = (iso, label) => ({dataset: {iso2: iso, code: country(iso).dialCode}, querySelector: () => ({textContent: label}), textContent: label});
  const de = row('DE', 'Германия (+49)'), dk = row('DK', 'Дания (+45)'), bd = row('BD', 'Бангладеш (+880)');
  assert.equal(ctx.countryMatchRank(de, 'de'), 1);
  assert.ok(ctx.countryMatchRank(dk, 'de') > 1);
  assert.ok(ctx.countryMatchRank(bd, 'de') > ctx.countryMatchRank(de, 'de'));
  assert.equal(ctx.countryMatchRank(de, 'герм'), 3);
  assert.equal(ctx.countryMatchRank(de, 'germ'), 3);
  assert.equal(ctx.countryMatchRank(de, '+49'), 1);
  assert.equal(ctx.countryMatchRank(de, '4'), 2);
  assert.equal(ctx.countryMatchRank(dk, '+49'), null);
  assert.equal(ctx.countryMatchRank(dk, 'герм'), null);
});

test('every open path gives the rows their files and shows the chosen row (P1)', () => {
  const open = source.slice(source.indexOf('function setOpenState'), source.indexOf('function resolveConfig'));
  assert.match(open, /arrangeCountryList\(root\);/u);
  assert.match(open, /if \(open\) \{[\s\S]*prefetchVisibleFlags\(root\);[\s\S]*revealChosenCountry\(root\);/u);
  // Drawn open at bind, through the same path.
  assert.match(source, /if \(root\.classList\.contains\('open'\)\) setOpenState\(root, true\);/u);
  // A row image that does not load falls back to the emoji, template and markup alike.
  assert.match(template, /@error=\$\{flagFallback\}/u);
  assert.match(source, /img\.dataset\.flagFallback/u);
});

test('the field draws V4: rectangular flag on the C77 inset, a small caret, the code in the text', () => {
  assert.match(template, /<i class="sf-icon sf-country-code-caret" aria-hidden="true">arrow_drop_down<\/i>/u);
  assert.match(source, /icon\.textContent = 'arrow_drop_down';/u);
  for (const size of ['1', '2', '1\\/2']) {
    assert.ok(!css.includes(`--sf-country-code-field--padding-inline-start: var(--sf-ui-${size}--space-x);`), size);
  }
  assert.match(css, /--sf-country-code-field--padding-inline-start: calc\(var\(--sf-country-code--inset\) - var\(--sf-px\)\);/u);
  assert.match(css, /\.sf-country-code\.sf-country-code--size-2 \{\s*--sf-country-code--inset: var\(--sf-space-2\);/u);
  assert.match(css, /--sf-country-code-flag-icon--width: calc\(var\(--sf-country-code--flag-height\) \* 1\.4\);/u);
  assert.match(custom, /--sf-country-code-flag--height: var\(--sf-country-code--flag-height\);/u);
  // The code is locked only for one country or a country mask.
  assert.match(source, /if \(config\.multiCountry && !config\.useMask\) return '';/u);
});

test('the list: search header, frequent group, chosen row filled, a sheet on a phone', () => {
  assert.match(source, /const RECENT_KEY = 'sf-input-country:recent';/u);
  assert.match(source, /PREFERRED_BY_LOCALE = \{ru: \['RU', 'KZ', 'BY', 'UZ', 'KG', 'AM'\]\}/u);
  assert.match(source, /list\.setAttribute\('data-sf-sheet', ''\);/u);
  assert.match(css, /\.sf-country-code \.sf-country-code-item\[aria-selected="true"\] \{\s*--sf-country-code-item--background-color: var\(--sf-primary-container\);/u);
  assert.match(css, /\.sf-country-code \.sf-country-code-list\[data-sf-sheet\] \{/u);
  assert.match(css, /inline-size: var\(--sf-popup-panel-width\);/u);
});
