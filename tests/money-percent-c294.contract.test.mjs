import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

import {addDecimal, currencyOf, formatDecimal, formatMoney, formatPercent, moneyTotals, readTypedDecimal, restingDecimal} from '../src/smart/field-renderers/decimal.js';
import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';
import {formatNumber, percentSign} from '../src/core/js/format-number.js';

// Owner decision C294 (2026-11-17, MP-1..MP-12; ui-control
// control/research/2026-11-17-money-percent). The browser probe
// field-money-percent-c294 drives the built set.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const renderers = read('src/smart/field-renderers/index.js');
const plain = (text) => text.replace(/[  ]/gu, ' ');
const NBSP = ' ';

test('C294 (MP-3): the standard sign, never the narrow one; code by the field', () => {
  assert.equal(formatMoney({amount: '10', currency: 'USD'}, {}, 'en'), '$10.00');
  assert.equal(formatMoney({amount: '10', currency: 'CAD'}, {}, 'en'), 'CA$10.00');
  assert.notEqual(formatMoney({amount: '10', currency: 'CAD'}, {}, 'ru'), formatMoney({amount: '10', currency: 'USD'}, {}, 'ru'));
  assert.equal(formatMoney('1500.5', {currency: 'RUB', currencyDisplay: 'code'}, 'en'), `RUB${NBSP}1,500.50`);
  // A field asking for the narrow sign gets the standard one.
  assert.equal(formatMoney({amount: '10', currency: 'CAD'}, {currencyDisplay: 'narrowSymbol'}, 'en'), 'CA$10.00');
  assert.doesNotMatch(read('src/smart/field-renderers/decimal.js'), /currencyDisplay: 'narrowSymbol'/u);
});

test('C294 (MP-9): a minus and nothing else, no break between the amount and its sign, a direction mark on ar', () => {
  assert.equal(formatMoney({amount: '-1500.5', currency: 'USD'}, {}, 'en'), '-$1,500.50');
  assert.equal(plain(formatMoney({amount: '-1500.5', currency: 'RUB'}, {}, 'ru')), '-1 500,50 ₽');
  assert.doesNotMatch(formatMoney({amount: '1500.5', currency: 'RUB'}, {}, 'ru'), / /u);
  assert.equal(formatMoney({amount: '0', currency: 'RUB'}, {}, 'ru'), `0,00${NBSP}₽`);
  assert.ok(formatMoney({amount: '1500.5', currency: 'RUB'}, {}, 'ar').startsWith('\u200f'));
  assert.ok(formatPercent('12.5', 'ar').startsWith('\u200f'));
  // A sign ending in a neutral mark is isolated left to right, or the page draws «$US».
  assert.match(formatMoney({amount: '10', currency: 'USD'}, {}, 'ar'), /\u2066US\$\u2069/u);
  assert.equal(formatPercent('12.5', 'en'), `12.5${NBSP}%`);
  assert.equal(percentSign('12.5‎%‎'), `12.5${NBSP}%`);
});

test('C294 (MP-2, MP-4): a float is rounded to the currency\'s digits (a percent\'s six), never shown with its error', () => {
  assert.equal(plain(formatMoney(0.1 + 0.2, {currency: 'RUB'}, 'ru')), '0,30 ₽');
  assert.equal(plain(formatPercent(0.1 + 0.2, 'ru')), '0,3 %');
  assert.equal(plain(formatDecimal('1234567.5', 'ru')), '1 234 567,5');
  // SF.format: share is the share, percent its older name, unit-percent the percent itself.
  assert.equal(formatNumber(0.125, 'share', {locale: 'en'}), `12.5${NBSP}%`);
  assert.equal(formatNumber(0.125, 'percent', {locale: 'en'}), `12.5${NBSP}%`);
  assert.equal(formatNumber(12.5, 'unit-percent', {locale: 'en'}), `12.5${NBSP}%`);
});

test('C294 (MP-8): what a person pastes is read as they mean it', () => {
  const value = (text, locale, currency = null) => readTypedDecimal(text, {locale, currency}).value;
  assert.equal(value('1 234,50 ₽', 'ru', 'RUB'), '1234.5');
  assert.equal(value('1 234,50 ₽', 'ru', 'RUB'), '1234.5');
  assert.equal(value('$1,234.50', 'en', 'USD'), '1234.5');
  assert.equal(value('1,234', 'en'), '1234');
  assert.equal(value('1,234', 'ru'), '1.234');
  assert.equal(value('1,234.50', 'ru'), '1234.5');
  assert.equal(value('12,5 %', 'ru'), '12.5');
  assert.equal(value('RUB 1,500.50', 'en', 'RUB'), '1500.5');
  assert.equal(value('−150', 'en'), '-150');
  assert.equal(value('١٬٥٠٠٫٥', 'ar'), '1500.5');
  assert.equal(value('', 'ru'), null);
  assert.equal(readTypedDecimal('abc', {locale: 'ru'}).ok, false);
  assert.equal(readTypedDecimal('1500,555', {locale: 'ru'}).typedDigits, 3);
  assert.equal(plain(restingDecimal('1500.5', 'ru', 2)), '1 500,50');
});

test('C294 (MP-12): numeric in the registry; totals by the digits, one per currency', () => {
  const numeric = PROPERTY_TYPES.filter((entry) => entry.numeric).map((entry) => entry.type);
  // C303 (2): integer is read as number (decimals 0); it is numeric through it.
  assert.deepEqual(numeric, ['number', 'money', 'percent']);
  assert.equal(addDecimal('0.1', '0.2'), '0.3');
  assert.equal(addDecimal(['1500.5', '-0.5', null]), '1500');
  const totals = moneyTotals([{amount: '12500', currency: 'USD'}, {amount: '3000', currency: 'EUR'}, {amount: '7250.75', currency: 'USD'}, null], {}, 'en');
  assert.deepEqual(totals.map((one) => [one.currency, one.amount, one.text]), [['USD', '19750.75', '$19,750.75'], ['EUR', '3000', '€3,000.00']]);
  assert.match(renderers, /export function renderTotalField\(field = \{\}, values = \[\], host\)/u);
});

test('C294 (MP-6, MP-7): the filter puts the condition first, nine conditions, decimal strings, a currency for a value-currency field', () => {
  // The list lives in the registry (the number types' `conditions`, type templates step 4).
  assert.match(read('src/smart/field-renderers/registry.js'), /NUMBER_FILTER_OPERATORS = Object\.freeze\(\['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty'\]\)/u);
  const body = renderers.slice(renderers.indexOf('function renderNumberFilterControl'), renderers.indexOf('function renderIntegerFilterControl'));
  assert.ok(body.indexOf('data-sf-filter-part="operator"') < body.indexOf('sf-filter-operator-inputs'), 'the condition comes before the value');
  assert.match(body, /readTypedDecimal\(text, \{locale, currency\}\)/u);
  assert.match(body, /const value = next === 'none' \? true/u);
  assert.match(body, /data-sf-filter-part="currency"/u);
  for (const language of ['en', 'ru']) {
    const words = JSON.parse(read(`src/smart/field-renderers/lang/${language}.json`)).runtime;
    for (const key of ['condition', 'filterNumber', 'filterAmount', 'filterPercent', ...['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty'].map((op) => `numberOperator_${op}`)]) {
      assert.ok(words[key], `${language}.${key}`);
    }
  }
  const ru = JSON.parse(read('src/smart/field-renderers/lang/ru.json')).runtime;
  assert.deepEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not-empty'].map((op) => ru[`numberOperator_${op}`]),
    ['Равно', 'Не равно', 'Больше', 'Не меньше', 'Меньше', 'Не больше', 'Между', 'Пусто', 'Не пусто']);
});

test('C294 (MP-10, MP-11): currencies by the field, a percent without default bounds', () => {
  assert.deepEqual(currencyOf('CAD', 'ru', 'code').sign, 'CAD');
  assert.match(renderers, /function fieldCurrencies\(field\)/u);
  assert.match(renderers, /search=\$\{offered\.length > 12 \? 'true' : 'false'\}/u);
  const port = JSON.parse(read('src/core/contracts/ports/simai.property-view-port/1.19.0/port.json'));
  const fields = port.data.record.schema.properties.sections.items.properties.groups.items.properties.fields.items.properties;
  assert.deepEqual(fields.currencyDisplay.enum, ['symbol', 'code', 'name', null]);
  assert.equal(fields.currencies.items.pattern, '^[A-Z]{3}$');
});
