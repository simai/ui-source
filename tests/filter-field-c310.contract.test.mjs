// Owner decision C310 (2026-11-18; study ui-control control/research/
// 2026-11-18-filter-field-choice, the per-property table): a filter field's
// window per property type -- the conditions (FF-8), what needs a value,
// the number on the button, the width -- and the dropdown trigger slot
// without a button inside a button (FF-9). The window's composition waits
// for the owner's answer on the window without repeats.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {filterActive, filterCondition, filterConditions, filterCount, filterKindOf, filterSummary, filterValueless, filterWidth} from '../src/smart/field-renderers/filter-conditions.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('FF-8: the conditions of each property type', () => {
  assert.deepEqual(filterConditions({propertyType: 'choice'}), ['in', 'not_in', 'empty', 'not_empty']);
  assert.deepEqual(filterConditions({propertyType: 'user'}), ['in', 'not_in', 'empty', 'not_empty']);
  assert.deepEqual(filterConditions({propertyType: 'record'}), ['in', 'not_in', 'empty', 'not_empty']);
  assert.deepEqual(filterConditions({propertyType: 'choices'}), ['in', 'all', 'not_in', 'empty', 'not_empty']);
  assert.deepEqual(filterConditions({propertyType: 'string'}), ['contains', 'startsWith', 'empty', 'not_empty']);
  assert.deepEqual(filterConditions({propertyType: 'money'}), ['between', 'eq', 'gt', 'lt']);
  assert.deepEqual(filterConditions({propertyType: 'boolean'}), []);
  assert.deepEqual(filterConditions({propertyType: 'date'}), []);
  assert.equal(filterKindOf({propertyType: 'date'}), 'own');
  assert.deepEqual(filterConditions({propertyType: 'choice', filter: {conditions: ['in', 'empty']}}), ['in', 'empty']);
  assert.equal(filterCondition({propertyType: 'choice'}, {}), 'in');
  assert.equal(filterCondition({propertyType: 'choice'}, {operator: 'not_in'}), 'not_in');
  assert.ok(filterValueless('empty') && filterValueless('not_empty') && !filterValueless('in'));
});

test('the number on the button is for list conditions only; не задано / задано colour without a number', () => {
  const status = {propertyType: 'choice', filter: {options: [{value: 'a', label: 'Новая'}, {value: 'b', label: 'В работе'}]}};
  assert.equal(filterCount(status, {operator: 'in', values: ['a', 'b']}), 2);
  assert.equal(filterCount(status, {operator: 'empty', values: ['a']}), 0);
  assert.equal(filterActive(status, {operator: 'empty'}), true);
  assert.equal(filterActive(status, {operator: 'in', values: []}), false);
  assert.equal(filterCount({propertyType: 'string'}, {operator: 'contains', value: 'x'}), 0);
  assert.equal(filterActive({propertyType: 'string'}, {operator: 'contains', value: 'x'}), true);
  assert.equal(filterCount({propertyType: 'money'}, {operator: 'gt', value: '10'}), 0);
  const words = {label: (op) => ({in: 'любой из', empty: 'не задано', contains: 'содержит'})[op] ?? op, name: (one) => ({a: 'Новая', b: 'В работе'})[one] ?? one};
  assert.deepEqual(filterSummary(status, {operator: 'in', values: ['a', 'b']}, words), {active: true, count: 2, words: 'любой из: Новая, В работе'});
  assert.deepEqual(filterSummary(status, {operator: 'empty'}, words), {active: true, count: 0, words: 'не задано'});
  assert.deepEqual(filterSummary({propertyType: 'string'}, {operator: 'contains', value: 'отчёт'}, words), {active: true, count: 0, words: 'содержит отчёт'});
  assert.deepEqual(filterSummary({propertyType: 'boolean'}, {operator: 'eq', value: true}, {yes: 'Да', no: 'Нет'}), {active: true, count: 0, words: 'Да'});
});

test('the window width: 20rem, 24rem for people and records or options with a caption', () => {
  assert.equal(filterWidth({propertyType: 'choice'}), 'panel');
  assert.equal(filterWidth({propertyType: 'user'}), 'wide');
  assert.equal(filterWidth({propertyType: 'lookup'}), 'wide');
  assert.equal(filterWidth({propertyType: 'choice', filter: {options: [{value: 'a', label: 'A', caption: 'отдел'}]}}), 'wide');
  assert.equal(filterWidth({propertyType: 'user', filter: {width: 'panel'}}), 'panel');
  const window = read('src/smart/field-renderers/filter-window.js');
  assert.match(window, /surface\.style\.inlineSize = width === 'wide' \? 'var\(--sf-popup-form-wide-width\)' : 'var\(--sf-popup-panel-width\)';/u);
  assert.match(window, /const number = typeof count === 'function' \? count\(temp\)/u);
});

test('the words: любой из, все из, ни один из, не задано, задано in the language packs', () => {
  const ru = json('src/smart/field-renderers/lang/ru.json').runtime;
  const en = json('src/smart/field-renderers/lang/en.json').runtime;
  assert.deepEqual([ru.operatorAnyOf, ru.operatorAllOf, ru.operatorNoneOf, ru.operatorEmpty, ru.operatorFilled], ['любой из', 'все из', 'ни один из', 'не задано', 'задано']);
  assert.deepEqual([en.operatorAnyOf, en.operatorAllOf, en.operatorNoneOf, en.operatorEmpty, en.operatorFilled], ['any of', 'all of', 'none of', 'not set', 'set']);
  assert.equal(ru.operatorIn, 'В списке', 'the former word stays for a host that names it');
  assert.match(read('src/smart/field-renderers/filter-window.js'), /in: 'operatorAnyOf', all: 'operatorAllOf', not_in: 'operatorNoneOf', empty: 'operatorEmpty', not_empty: 'operatorFilled',/u);
});

test('the window draws the condition first and only what it needs; a boolean is three rows', () => {
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /const control = filterValueless\(operator\) \? nothing/u);
  assert.match(source, /\{value: 'true', label: words\.yes\}, \{value: 'false', label: words\.no\}, \{value: 'empty', label: setText\(host, 'filterNotSet'\)\}/u);
  assert.match(source, /renderControl: renderFilterWindowField,/u);
  assert.match(source, /filterWindow: \{open: openFilterWindow, operatorLabel: filterOperatorLabel, summary: filterFieldSummary, conditions: filterConditions, count: filterCount\},/u);
  assert.match(source, /if \(mode === 'off' \|\| asked === false\) return false;/u);
});

test('FF-9: a trigger handed in is the control it holds, not a wrapper with role button', () => {
  const source = read('src/component/dropdown/interaction.js');
  assert.match(source, /box\.querySelector\(':scope > \* > button, :scope > a\[href\]'\)/u);
});

test('the window speaks one lower-case line: содержит, начинается с; от – до, равно, больше, меньше', () => {
  const ru = json('src/smart/field-renderers/lang/ru.json').runtime;
  assert.deepEqual([ru.operatorContainsWord, ru.operatorStartsWithWord, ru.operatorFromTo, ru.operatorEqualWord, ru.operatorMoreWord, ru.operatorLessWord], ['содержит', 'начинается с', 'от – до', 'равно', 'больше', 'меньше']);
  const window = read('src/smart/field-renderers/filter-window.js');
  assert.match(window, /const key = CONDITION_WORDS\[kind\]\?\.\[operator\] \?\? OPERATOR_WORDS\[operator\];/u);
  assert.match(window, /getFilterOperatorLabel: \(operator\) => filterOperatorLabel\(operator, anchor, kind\),/u);
  assert.match(read('src/component/dropdown/interaction.js'), /if\(button!==box\)\{\['role','aria-expanded','aria-haspopup','aria-controls','aria-labelledby','aria-label','aria-describedby'\]\.forEach\(name=>box\.removeAttribute\(name\)\);\}/u);
});
