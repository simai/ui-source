// FL-1 and FL-7 of the property page study (2026-11-17): a phone's edit writes
// E.164, view and cell lay the number out by its country, and an empty phone
// field starts on the page locale's country instead of Australia (+61).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {formatPhone, phoneDialCode, phoneE164} from '../src/smart/field-renderers/phone.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const countries = JSON.parse(read('../src/component/country-code/data/countries.json')).items;
const code = read('../src/component/country-code/js/_country_code.js');
const renderers = read('../src/smart/field-renderers/index.js');
const registry = read('../src/smart/field-renderers/registry.js');

// The real source, sliced: the same functions the component runs.
function countryCode() {
  const context = vm.createContext({COUNTRY_ITEMS: countries, Intl});
  const slice = (from, to) => code.slice(code.indexOf(from), code.indexOf(to));
  vm.runInContext(slice('function normalizeIso2', '/* The field has always'), context);
  vm.runInContext(slice('function countryFormValue', 'function closeAllCountryCodes'), context);
  vm.runInContext(slice('const LOCALE_FALLBACK_COUNTRY', '// Where several countries share'), context);
  vm.runInContext(slice('const SHARED_DIAL_CODES', '// The national number laid out'), context);
  vm.runInContext(slice('function countryFromNumber', '// The national number laid out'), context);
  vm.runInContext(slice('function formatByPattern', '// Where the caret goes'), context);
  vm.runInContext('this.api = {countryFormValue, countryForLocale, localeRegion, countryFromNumber, formatByPattern, SHARED_DIAL_CODES};', context);
  return context.api;
}

test('FL-1: every dial code of the country table is known to the set', () => {
  const {SHARED_DIAL_CODES} = countryCode();
  const byCode = new Map();
  for (const country of countries) {
    const list = byCode.get(country.dialCode) ?? [];
    list.push(country);
    byCode.set(country.dialCode, list);
  }
  for (const [dial, list] of byCode) {
    const country = list.find((one) => one.iso2 === SHARED_DIAL_CODES[dial]) ?? list[0];
    const sample = `${dial}${'1234567890123'.slice(0, (country.maskPattern.match(/0/gu) ?? []).length - (dial.length - 1))}`;
    assert.equal(phoneDialCode(sample), dial.slice(1), `${dial} is a known code`);
  }
});

// The pattern table is held equal to the country table here: for every
// country a number of its code reads as the box lays it out.
test('FL-1: view and cell read a number as the edit box lays it out', () => {
  const {formatByPattern, countryFromNumber} = countryCode();
  for (const country of countries) {
    const digits = (country.maskPattern.match(/0/gu) ?? []).length;
    const e164 = `${country.dialCode}${'9876543210987'.slice(0, Math.max(1, digits - (country.dialCode.length - 1)))}`;
    const box = countryFromNumber({}, e164);
    if (!box) continue;
    assert.equal(formatPhone(e164), formatByPattern(e164, box), `${country.iso2} ${e164}`);
  }
  assert.equal(formatPhone('+79161234567'), '+7 916 123-45-67');
  assert.equal(formatPhone('+442071234567'), '+44 207 123 4567');
  assert.equal(formatPhone('+12025550123'), '+1 202-555-0123');
});

test('FL-1: E.164 and the legacy formatted strings are one number; a round trip keeps E.164', () => {
  const {countryFormValue} = countryCode();
  for (const legacy of ['+7 916 123-45-67', '+7 (916) 123 45 67', '+79161234567', ' +7 916 1234567 ', '00 7 916 123 45 67']) {
    assert.equal(phoneE164(legacy), '+79161234567', legacy);
  }
  for (const e164 of ['+79161234567', '+77011234567', '+442071234567', '+12025550123', '+4930123456', '+971501234567', '+61212345678']) {
    const shown = formatPhone(e164);
    assert.notEqual(shown, e164, `${e164} is laid out`);
    // The edit box shows the laid-out text; what it writes is its form value.
    const dial = `+${phoneDialCode(e164)}`;
    assert.equal(countryFormValue(shown, dial), e164, `edit of ${e164} writes it back`);
    assert.equal(phoneE164(shown), e164);
  }
  assert.equal(countryFormValue('+7 ', '+7'), '', 'the code alone is no number');
  assert.equal(phoneE164(''), '');
  assert.equal(formatPhone('8 916 123-45-67'), '8 916 123-45-67', 'no country code: shown as it came');
});

test('FL-1: the phone edit writes the control\'s form value, view and cell read left to right', () => {
  const edit = renderers.slice(renderers.indexOf('function renderPhoneEdit'), renderers.indexOf('function isPhoneField'));
  assert.match(edit, /@change=\$\{\(event\) => host\.setFieldValue\(field, phoneWritten\(event\)\)\}/u);
  assert.match(edit, /control\.sfFormValue\(\)/u);
  assert.match(edit, /return phoneE164\(/u);
  assert.doesNotMatch(edit, /setFieldValue\(field, event\.(detail|target)/u, 'never the box text');
  assert.match(renderers, /if \(isPhoneField\(field\)\) \{\s+const text = phoneText\(field, value, host\);\s+return text \? html`<bdi dir="ltr">/u);
  assert.match(renderers, /<span class="sf-field-view"><bdi dir="ltr">\$\{text\}<\/bdi><\/span>/u);
});

test('FL-7: an empty field starts on the page locale\'s country', () => {
  const {countryForLocale, localeRegion} = countryCode();
  const iso = (tag, root = {}) => countryForLocale(root, tag)?.iso2;
  assert.equal(iso('ru'), 'RU');
  assert.equal(iso('ru-RU'), 'RU');
  assert.equal(iso('ru-KZ'), 'KZ', 'the region the locale writes');
  assert.equal(iso('en-GB'), 'GB');
  assert.equal(iso('en'), 'US');
  assert.equal(iso('de'), 'DE');
  assert.equal(iso('ar'), localeRegion('ar'), 'Arabic: Intl\'s likely region');
  assert.ok(iso('ar'), 'Arabic starts on a country');
  assert.equal(iso('pt_BR'), 'BR');
  assert.equal(iso(''), 'US', 'no locale: the fallback');
  assert.equal(iso('zz-QQ'), 'US', 'a region the table lacks: the fallback');
  const own = {__sfCountryOptions: [{iso2: 'DE', dialCode: '+49'}, {iso2: 'FR', dialCode: '+33'}]};
  assert.equal(iso('ru', own), undefined, 'a list without the page country leaves the first row to the caller');
  assert.equal(iso('fr', own), 'FR');
  assert.match(code, /countryFromNumber\(root, value\) \|\| countryForLocale\(root, config\.localeTag\) \|\|\n\s+root\.__sfCountryOptions\?\.\[0\]/u,
    'iso2, dial code and the number come first; the first row last');
});

test('FL-7: defaultCountry is a phone field\'s setting, passed only while the field is empty', () => {
  const edit = renderers.slice(renderers.indexOf('function renderPhoneEdit'), renderers.indexOf('function phoneWritten'));
  assert.match(edit, /field\.defaultCountry/u);
  assert.match(edit, /&& !String\(stored\)\.trim\(\) \? preferred : nothing/u);
  assert.match(edit, /iso2=\$\{iso2\}/u);
  assert.match(registry, /params: \['placeholder', 'mask', 'nullable', 'defaultCountry', 'required', 'readonly'\]/u);
});
