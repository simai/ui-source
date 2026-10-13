import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/component/country-code/js/_country_code.js', import.meta.url), 'utf8');
const {items} = JSON.parse(await readFile(new URL('../src/component/country-code/data/countries.json', import.meta.url), 'utf8'));
function runtime() {
  const context = vm.createContext({COUNTRY_ITEMS: items});
  for (const [start, end] of [
    ['function normalizeIso2', 'function resolveDefaultFlagBase'],
    ['function getCountryByIso2', 'function normalizeMaskPatternByStyle'],
    ['function getCountryLabel', 'function ensureListMarkup'],
    ['function resolveInitialCountry', 'function syncDisabledState'],
  ]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  return context;
}

test('CountryCode custom descriptors override dataset and missing built-in fields are filled', () => {
  const {normalizeCountriesList: normalize} = runtime();
  const [german, russian, custom] = normalize([
    {iso2: ' de ', label: 'My Germany', code: '+499', maskPattern: ''},
    {iso2: 'RU'},
    {code: '+999', maskPattern: '+999 000'},
  ], 'en');
  assert.equal(german.iso2, 'DE'); assert.equal(german.dialCode, '+499');
  assert.equal(german.label, 'My Germany'); assert.equal(german.maskPattern, '');
  assert.equal(russian.dialCode, '+7'); assert.equal(russian.maskPattern, items.find(i => i.iso2 === 'RU').maskPattern);
  assert.match(russian.label, /Russia/); assert.equal(custom.iso2, ''); assert.equal(custom.label, '+999');
});

test('CountryCode preserves default dataset, list order and maxItems, tolerates malformed entries', () => {
  const {normalizeCountriesList: normalize} = runtime();
  assert.equal(normalize([]).length, items.length);
  assert.equal(normalize(null).length, items.length);
  assert.equal(normalize([null, false, 'RU', {iso2: 'DE'}]).length, 1);
  const result = normalize([{iso2: 'RU'}, {iso2: 'DE'}], 'ru', 1);
  assert.equal(result.length, 1); assert.equal(result[0].iso2, 'RU');
});

test('CountryCode resolution uses local descriptors and first local default, retains explicit global fallback', () => {
  const ctx = runtime(), local = ctx.normalizeCountriesList([{iso2: 'DE', maskPattern: 'custom'}, {code: '+999'}]);
  const root = {__sfCountryOptions: local};
  assert.equal(ctx.resolveInitialCountry({}, root), local[0]);
  assert.equal(ctx.resolveCountry(root, 'de'), local[0]);
  assert.equal(ctx.resolveCountry(root, '', '+999'), local[1]);
  assert.equal(ctx.resolveCountry(root, 'RU').dialCode, '+7');
  assert.equal(ctx.resolveInitialCountry({defaultIso2: 'RU'}, root).iso2, 'RU');
  assert.equal(ctx.resolveInitialCountry({defaultIso2: 'RU', fixedDialCode: '+49'}, root).iso2, 'RU');
});
