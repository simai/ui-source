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

test('CountryCode reads the country of a stored number by its dial code (simai/ui-source#34)', () => {
  const ctx = runtime();
  const root = {};
  assert.equal(ctx.resolveInitialCountry({}, root, '+7 900 123-45-67').iso2, 'RU');
  assert.equal(ctx.resolveInitialCountry({}, root, '+7 701 123-45-67').iso2, 'KZ');
  assert.equal(ctx.resolveInitialCountry({}, root, '+1 212 555-0100').iso2, 'US');
  assert.equal(ctx.resolveInitialCountry({}, root, '+44 20 7946 0958').iso2, 'GB');
  assert.equal(ctx.resolveInitialCountry({}, root, '+49 30 123456').iso2, 'DE');
  assert.equal(ctx.resolveInitialCountry({}, root, '+380 44 123 4567').iso2, 'UA');
  // An explicit country still wins; a local number keeps the first country.
  assert.equal(ctx.resolveInitialCountry({defaultIso2: 'DE'}, root, '+7 900 123-45-67').iso2, 'DE');
  assert.equal(ctx.resolveInitialCountry({}, root, '8 900 123-45-67'), items[0]);
  assert.equal(ctx.resolveInitialCountry({}, root, ''), items[0]);
  // A local list limits the guess to its own countries.
  const local = ctx.normalizeCountriesList([{iso2: 'DE'}, {iso2: 'KZ'}]);
  assert.equal(ctx.resolveInitialCountry({}, {__sfCountryOptions: local}, '+7 900 123-45-67').iso2, 'KZ');
});

// A mask is the pattern's zeros filled with the digits, in order.
function throughMask(pattern, number) {
  const digits = [...String(number).replace(/\D/gu, '')];
  return [...pattern].map((char) => (char === '0' ? digits.shift() ?? '' : char)).join('').trim();
}

test('CountryCode: the countries sharing +7 read a number in the national format', () => {
  const kazakhstan = items.find((item) => item.iso2 === 'KZ');
  const russia = items.find((item) => item.iso2 === 'RU');
  // Kazakhstan's plan is the same ten digits as Russia's: +7 701 123-45-67,
  // never +7 70112 3 45 67 (the pattern this list carried before).
  assert.equal(throughMask(kazakhstan.maskPattern, '+77011234567'), '+7 701 123-45-67');
  assert.equal(throughMask(russia.maskPattern, '+79001234567'), '+7 900 123-45-67');
  assert.equal(kazakhstan.maskPattern, russia.maskPattern);
  assert.equal(kazakhstan.maskHasHyphen, true);
  // Every country of a shared dial code has a pattern for that code, and the
  // countries that share one numbering plan share one pattern.
  const plans = [['+7', 'RU', 'KZ'], ['+1', 'US', 'CA', 'PR'], ['+39', 'IT', 'VA'], ['+47', 'NO', 'SJ'],
    ['+61', 'AU', 'CC', 'CX'], ['+212', 'MA', 'EH'], ['+262', 'RE', 'YT'], ['+358', 'FI', 'AX'], ['+590', 'GP', 'BL', 'MF']];
  for (const [code, ...countries] of plans) {
    const patterns = countries.map((iso2) => items.find((item) => item.iso2 === iso2));
    for (const country of patterns) assert.ok(country.maskPattern.startsWith(code.replace(/\d/gu, '0')), `${country.iso2}: ${country.maskPattern}`);
    assert.equal(new Set(patterns.map((country) => country.maskPattern)).size, 1, `${code}: ${patterns.map((country) => `${country.iso2} ${country.maskPattern}`).join(', ')}`);
  }
});
