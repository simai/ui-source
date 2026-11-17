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

test('PD-4..PD-8: the date filter is the operator first, then a day field at the table\'s size in the page\'s language', () => {
  const one = body('renderDateFilterControl');
  // PD-8: the operator list comes before the day field.
  assert.ok(one.indexOf('<sf-dropdown') > 0 && one.indexOf('<sf-dropdown') < one.indexOf('<sf-input-date'));
  // PD-4: the day field takes the table's size.
  assert.match(one, /<sf-input-date\s+size=\$\{filterSize\(host\)\}/u);
  // PD-5: no hard-coded locale; the calendar follows the page.
  assert.ok(!/locale=/u.test(one));
  // PD-6: a day's words for the four comparisons.
  assert.ok(one.includes('dateOperatorLabel(host, operator)'));
  // PD-7: periods by themselves draw no day field; a range has quick ranges.
  assert.match(set, /const DATE_NO_VALUE_OPERATORS = new Set\(\['today', 'week', 'month', 'any'\]\);/u);
  assert.ok(one.includes('DATE_NO_VALUE_OPERATORS.has(selectedOperator) ? nothing'));
  assert.ok(one.includes('.presets=${isBetween ? dateFilterPresets(field) : \'\'}'));
});

test('PD-6: the date operator words are in both language files', () => {
  const en = JSON.parse(read('src/smart/field-renderers/lang/en.json')).runtime;
  const ru = JSON.parse(read('src/smart/field-renderers/lang/ru.json')).runtime;
  assert.deepEqual(['gt', 'gte', 'lt', 'lte'].map((key) => en[`dateOperator_${key}`]), ['After', 'On or after', 'Before', 'On or before']);
  assert.deepEqual(['gt', 'gte', 'lt', 'lte'].map((key) => ru[`dateOperator_${key}`]), ['Позже', 'Не раньше', 'Раньше', 'Не позже']);
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
  assert.ok(form.includes('warnUnknownType(field);'));
});
