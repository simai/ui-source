import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

import {DATE_FILTER_OPERATORS, DATE_FUTURE_OPERATORS, NUMBER_FILTER_OPERATORS, PROPERTY_TYPES, TIME_FILTER_OPERATORS} from '../src/smart/field-renderers/registry.js';
import {resolveField} from '../src/smart/field-renderers/templates.js';
import {dateConditionValue, dateFilterChipText, dateFilterConditions, dateFilterKind, isEmptyFilterEntry} from '../src/smart/field-renderers/date-filter.js';
import {composeLink, innError, isLinkAddress, isWebAddress, readLink, shortAddress} from '../src/smart/field-renderers/text-types.js';

// Steps 3-5 of the type-template catalogue (owner decisions C302, C303,
// 2026-11-17; ui-control research 2026-11-17-type-template-catalogue):
// 3 the url, link and ru.inn types; 4 the filter conditions in the registry
// (dates by C293) and a time condition; 5 the percent templates stepper,
// scale and meter.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'src/smart/field-renderers/index.js'), 'utf8');
const mapKeys = (name) => {
  const body = source.slice(source.indexOf(`${name} = {`), source.indexOf('};', source.indexOf(`${name} = {`)));
  return new Set([...body.matchAll(/^\s+'?([a-z.-]+)'?:/gmu)].map(([, key]) => key));
};
const MAPS = {view: mapKeys('VIEW_RENDERERS'), edit: mapKeys('EDIT_RENDERERS'), cell: mapKeys('CELL_RENDERERS'), filter: mapKeys('FILTER_RENDERERS')};
const entry = (type) => PROPERTY_TYPES.find((one) => one.type === type);
const words = (code) => JSON.parse(readFileSync(join(root, `src/smart/field-renderers/lang/${code}.json`), 'utf8')).runtime;

test('step 3: url, link and ru.inn are types with one default template, drawn in every place', () => {
  assert.deepEqual(entry('url').templates.map((one) => one.id), ['input']);
  assert.deepEqual(entry('link').templates.map((one) => one.id), ['link']);
  assert.deepEqual(entry('ru.inn').templates.map((one) => one.id), ['input']);
  assert.ok(entry('ru.inn').params.includes('holder'));
  for (const type of ['url', 'link', 'ru.inn']) {
    for (const place of ['view', 'edit', 'cell', 'filter']) assert.ok(MAPS[place].has(type), `${type}: ${place}`);
    assert.equal(resolveField({propertyType: type}).type, type);
    assert.ok(entry(type).label.ru && entry(type).label.ru !== entry(type).label.en, `${type}: named in Russian`);
  }
});

test('step 3: a web address is absolute http(s), without a login, at most 2048 bytes', () => {
  for (const good of ['https://simai.io', 'http://example.com/a?b=1#c', 'https://пример.рф/путь']) assert.ok(isWebAddress(good), good);
  for (const bad of ['simai.io', 'ftp://x.io', 'https://u:p@x.io', 'javascript:alert(1)', 'https://a b.io', ` https://x.io`, `https://x.io/${'a'.repeat(2048)}`]) {
    assert.ok(!isWebAddress(bad), bad);
  }
  assert.equal(shortAddress('https://www.simai.io/'), 'simai.io');
  assert.equal(shortAddress('https://simai.io/docs/fields?x=1'), 'simai.io/docs/fields?x=1');
  assert.ok(shortAddress(`https://simai.io/${'a'.repeat(80)}`).endsWith('…'));
  assert.equal(shortAddress(`https://simai.io/${'a'.repeat(80)}`).length, 40);
});

test('step 3: a link is {href, text?}; href http(s), a site path or an anchor', () => {
  for (const good of ['/about', '#prices', 'https://simai.io']) assert.ok(isLinkAddress(good), good);
  for (const bad of ['//evil.io', 'javascript:alert(1)', 'about', '#', '/\\evil']) assert.ok(!isLinkAddress(bad), bad);
  assert.deepEqual(composeLink('/about', ''), {value: {href: '/about'}});
  assert.deepEqual(composeLink('#prices', ' Цены '), {value: {href: '#prices', text: 'Цены'}});
  assert.deepEqual(composeLink('', ''), {value: null});
  assert.deepEqual(composeLink('', 'текст'), {error: 'linkNeedsAddress'});
  assert.deepEqual(composeLink('mailto:a@b.c', 'x'), {error: 'linkInvalid'});
  assert.deepEqual(composeLink('/a', 'я'.repeat(256)), {error: 'linkTextLong'});
  assert.deepEqual(readLink('https://simai.io'), {href: 'https://simai.io', text: ''});
  assert.equal(readLink({}), null);
  // The view draws a link only for an address that is one; a link's own
  // `text` is its words, not a host's formatted text ({value, text}).
  assert.match(source, /typeof value\.href === 'string' \? value : scalarValue\(value\)/u);
  assert.match(source, /if \(!link\.safe\) return html`\$\{link\.words\}`;/u);
});

test('step 3: an INN is 10 digits (organisation) or 12 (person) with the check digits', () => {
  assert.equal(innError('7707083893'), null);
  assert.equal(innError('500100732259'), null);
  assert.equal(innError(''), null);
  assert.equal(innError('7707083894'), 'innChecksum');
  assert.equal(innError('500100732258'), 'innChecksum');
  assert.equal(innError('12345'), 'innDigits');
  assert.equal(innError('77070838９3'), 'innDigits');
  assert.equal(innError('500100732259', 'organization'), 'innOrganization');
  assert.equal(innError('7707083893', 'person'), 'innPerson');
  for (const key of ['urlInvalid', 'linkNeedsAddress', 'linkInvalid', 'linkTextLong', 'innDigits', 'innOrganization', 'innPerson', 'innChecksum']) {
    for (const code of ['en', 'ru']) assert.equal(typeof words(code)[key], 'string', `${key} in ${code}`);
  }
});

test('step 4: the registry lists each condition-first filter; the date list is C293\'s own', () => {
  const operators = (field) => [...new Set(dateFilterConditions(field).map((one) => one.operator))];
  for (const type of ['date', 'datetime']) {
    assert.deepEqual([...entry(type).conditions.operators], operators({propertyType: type}), type);
    assert.equal(entry(type).conditions.default, 'between');
    const future = operators({propertyType: type, filter: {future: true}});
    for (const one of entry(type).conditions.future) assert.ok(future.includes(one), `${type}: ${one} for a deadline`);
  }
  assert.deepEqual([...DATE_FILTER_OPERATORS], operators({propertyType: 'date'}));
  assert.deepEqual([...DATE_FUTURE_OPERATORS], ['next-days']);
  assert.deepEqual([...entry('time').conditions.operators], [...TIME_FILTER_OPERATORS]);
  assert.deepEqual([...TIME_FILTER_OPERATORS], ['eq', 'between', 'lt', 'gt', 'empty', 'not-empty']);
  for (const type of ['number', 'money', 'percent']) assert.deepEqual([...entry(type).conditions.operators], [...NUMBER_FILTER_OPERATORS], type);
  assert.deepEqual([...entry('password').conditions.operators], ['not-empty', 'empty']);
  // The table's number list is the registry's.
  assert.match(source, /export \{NUMBER_FILTER_OPERATORS\};/u);
  for (const one of PROPERTY_TYPES.filter((item) => item.conditions)) assert.ok(one.conditions.operators.includes(one.conditions.default), one.type);
});

test('step 4: a time of day is filtered by its conditions, not as text', () => {
  assert.ok(MAPS.filter.has('time'));
  assert.match(source, /time: renderDateFilterControl,/u);
  assert.equal(dateFilterKind({propertyType: 'time'}), 'time');
  assert.equal(dateFilterKind({propertyType: 'date'}), 'date');
  assert.equal(dateFilterKind({propertyType: 'datetime'}), 'date');
  const list = dateFilterConditions({propertyType: 'time'});
  assert.deepEqual(list.map((one) => [one.operator, one.need, one.group]), [
    ['eq', 'time', 'time'], ['between', 'times', 'time'], ['lt', 'time', 'time'], ['gt', 'time', 'time'],
    ['empty', 'none', 'filled'], ['not-empty', 'none', 'filled']]);
  // A condition writes its own starting value: a time stays a time, two stay two.
  const at = (key) => list.find((one) => one.key === key);
  assert.equal(dateConditionValue(at('lt'), {value: '10:30'}), '10:30');
  assert.deepEqual(dateConditionValue(at('between'), {value: '10:30'}), ['10:30', '']);
  assert.deepEqual(dateConditionValue(at('between'), {value: ['09:00', '18:00']}), ['09:00', '18:00']);
  assert.equal(dateConditionValue(at('eq'), {value: ['09:00', '18:00']}), '09:00');
  assert.equal(dateConditionValue(at('empty'), {value: '10:30'}), true);
  assert.equal(isEmptyFilterEntry({operator: 'eq', value: ''}), true);
  assert.equal(isEmptyFilterEntry({operator: 'empty', value: true}), false);
  // The chip in words, in the page's language.
  const field = {key: 'starts', label: 'Starts', propertyType: 'time'};
  assert.equal(dateFilterChipText(field, {operator: 'lt', value: '10:30'}), 'Starts: before 10:30 AM');
  assert.equal(dateFilterChipText(field, {operator: 'between', value: ['09:00', '18:00']}), 'Starts: 9:00 AM–6:00 PM');
  assert.equal(dateFilterChipText(field, {operator: 'not-empty', value: true}), 'Starts: not empty');
  for (const key of ['dateGroup_time', 'timeCondition_eq', 'timeValue']) for (const code of ['en', 'ru']) assert.equal(typeof words(code)[key], 'string', `${key} in ${code}`);
});

test('step 5: a percent has the number\'s templates; scale and meter fit 0..100', () => {
  assert.deepEqual(entry('percent').templates.map((one) => [one.id, [...one.places]]), [
    ['input', ['view', 'compact', 'edit', 'filter']], ['stepper', ['edit']], ['scale', ['view', 'compact']], ['meter', ['view', 'compact']]]);
  assert.deepEqual([...entry('percent').variants], [], 'no former variants');
  const said = [];
  const warn = console.warn;
  console.warn = (...parts) => said.push(parts.join(' '));
  try {
    for (const id of ['stepper', 'scale', 'meter']) assert.equal(resolveField({propertyType: 'percent', template: id}).template, id);
    assert.equal(resolveField({propertyType: 'percent', template: 'scale', max: 200}).template, 'input');
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(said.length, 1);
  assert.match(said[0], /template_fallback:percent\.scale/u);
  // The stepper writes a percent's decimal string with «%» beside it; scale
  // and meter draw in the view and the cell.
  assert.match(source, /if \(isStepperField\(field\)\) return renderStepperEdit\(field, value, host, \{percent: true\}\);/u);
  assert.match(source, /unit=\$\{percent \? '%' : fieldUnit\(field\) \|\| nothing\}/u);
  assert.match(source, /const level = levelView\(field, value\);/u);
  assert.match(source, /const level = levelCell\(field, value\);/u);
  // integer reaches the same drawings as number with decimals 0.
  assert.deepEqual([resolveField({propertyType: 'integer', template: 'scale'}).type, resolveField({propertyType: 'integer', template: 'scale'}).decimals], ['number', 0]);
});

// Cards study CV-7 (ui-control research 2026-11-18-cards-view): the place
// Кратко carries a number's unit as Показ does -- a card's stock read «13»
// beside a record that said «13 шт».
test('CV-7: a number in the compact place keeps the field unit, as the view does', () => {
  const cell = source.slice(source.indexOf('function renderNumericCell('), source.indexOf('\n}\n', source.indexOf('function renderNumericCell(')));
  assert.match(cell, /return text && field\.unit \? `\$\{text\} \$\{field\.unit\}` : text;/u);
  const view = source.slice(source.indexOf('function renderNumberView('), source.indexOf('\n}\n', source.indexOf('function renderNumberView(')));
  assert.match(view, /field\.unit \? `\$\{text\} \$\{field\.unit\}` : text/u);
});
