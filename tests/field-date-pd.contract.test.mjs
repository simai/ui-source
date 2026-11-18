import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {formatDecimal} from '../src/smart/field-renderers/decimal.js';
import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// The property type study «Дата» (ui-control prototypes/property-type-date-study.html,
// PD-1..PD-8) and the set boundary study (numbers in the page's language, an
// unknown type in sf-form). The browser probe field-date-pd drives the built
// set; this holds the shape of each fix in the source.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const set = read('src/smart/field-renderers/index.js');
const body = (name) => {
  const start = set.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  const end = set.indexOf('\nfunction ', start + 10);
  return set.slice(start, end > 0 ? end : undefined);
};

test('PD-1: renderEditField takes options.error and the date controls say it themselves', () => {
  assert.match(set, /EDIT_ERROR = typeof options\?\.error === 'string' \? options\.error\.trim\(\) : '';/u);
  assert.match(set, /EDIT_ERROR = outerError;/u);
  for (const name of ['renderDateEdit', 'renderDateTimeEdit', 'renderTimeEdit']) {
    const one = body(name);
    assert.ok(one.includes('?invalid=${Boolean(EDIT_ERROR)}'), name);
    assert.ok(one.includes('error-message=${EDIT_ERROR || nothing}'), name);
  }
});

test('PD-2: a date reads min and max as the day bounds of its calendar', () => {
  const one = body('renderDateEdit');
  assert.ok(one.includes('min-date=${min || nothing}') && one.includes('max-date=${max || nothing}'));
  const date = PROPERTY_TYPES.find((entry) => entry.type === 'date');
  assert.deepEqual(date.params, ['min', 'max', 'format', 'required', 'readonly']);
});

test('PD-3: format is the date\'s length, Intl dateStyle, medium by default', () => {
  assert.match(set, /const DATE_FORMATS = new Set\(\['short', 'medium', 'long', 'full'\]\);/u);
  assert.ok(body('defaultDateText').includes('const dateStyle = dateFormatOf(field);'));
  const datetime = PROPERTY_TYPES.find((entry) => entry.type === 'datetime');
  assert.ok(datetime.params.includes('format'));
});

test('PD-4, PD-5, PD-8 under C293: the date filter is the condition first, then its value at the table\'s size in the page\'s language', () => {
  const one = body('renderDateFilterControl') + body('renderDateConditionValue') + body('renderDateRangeValue');
  // PD-8: the condition list comes before the value.
  const control = body('renderDateFilterControl');
  assert.ok(control.indexOf('<sf-dropdown') > 0 && control.indexOf('<sf-dropdown') < control.indexOf('renderDateConditionValue('));
  // PD-4: the day fields take the table's size.
  assert.match(one, /<sf-input-date\s+size=\$\{(size|filterSize\(host\))\}/u);
  // PD-5: no hard-coded locale; the calendar follows the page.
  assert.ok(!/locale=/u.test(one));
  // PD-6 and PD-7 are replaced by C293 (tests/field-date-filter-c293.contract.test.mjs): the
  // condition words come from date-filter.js, the periods are one operator with a name.
  assert.ok(control.includes('dateConditionLabel(host, item)'));
  assert.ok(!set.includes('DATE_NO_VALUE_OPERATORS'));
});

test('C293: the date condition words are in both language files; the PD-6 operator words are gone', () => {
  const en = JSON.parse(read('src/smart/field-renderers/lang/en.json')).runtime;
  const ru = JSON.parse(read('src/smart/field-renderers/lang/ru.json')).runtime;
  assert.deepEqual(['gt', 'gte', 'lt', 'lte'].map((key) => en[`dateCondition_${key}`]), ['After', 'On or after', 'Before', 'On or before']);
  assert.deepEqual(['gt', 'gte', 'lt', 'lte'].map((key) => ru[`dateCondition_${key}`]), ['Позже', 'Не раньше', 'Раньше', 'Не позже']);
  assert.ok(!Object.keys(en).some((key) => key.startsWith('dateOperator_')));
});

test('a number is printed with the page locale\'s decimal separator, every digit kept', () => {
  assert.equal(formatDecimal(12.5, 'ru'), '12,5');
  assert.equal(formatDecimal('12.50', 'ru'), '12,50');
  assert.equal(formatDecimal(12.5, 'en'), '12.5');
  assert.equal(formatDecimal('1500.25', 'de'), '1.500,25');
  assert.equal(formatDecimal('не число', 'ru'), '');
  assert.ok(body('numberText').includes('formatDecimal(scalarValue(value), pageLocale(host ?? null))'));
  assert.ok(body('renderNumberView').includes('const text = numberText(field, value, host);'));
  assert.ok(body('renderNumericCell').includes('formatDecimal(scalarValue(value), pageLocale(host ?? null))'));
});

test('sf-form still leaves out a field of an unknown type, and says so once per type', () => {
  const form = read('src/smart/form/index.js');
  assert.match(form, /const UNKNOWN_TYPES_TOLD = new Set\(\);/u);
  assert.match(form, /if \(modes\.view \|\| modes\.edit\) return;\n {2}UNKNOWN_TYPES_TOLD\.add\(type\);\n {2}console\.warn\(/u);
  assert.ok(form.includes('warnUnknownType(field, this.hostDraws(field));')); // form fields 1.7.0: a type a field host draws is not unknown
});
