import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';
import './support/russian-language-file.mjs';

import {compareDecimal, currencyOf, editableDecimal, formatMoney, formatPercent} from '../src/smart/field-renderers/decimal.js';
import {PROPERTY_TYPES} from '../src/smart/field-renderers/registry.js';

// Owner decision C291 (2), (3), 2026-11-17 (ui-control control/docs-review/
// decisions.md; orders FO-7, FO-8). The browser probe
// field-money-percent-c291 drives the built set and sf-form.
const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const renderers = read('src/smart/field-renderers/index.js');
const form = read('src/smart/form/index.js');
const template = read('src/smart/form/js/templates/default.js');

test('C291 (2): money and percent are registered without a set, with the port\'s option names', () => {
  const money = PROPERTY_TYPES.find((entry) => entry.type === 'money');
  const percent = PROPERTY_TYPES.find((entry) => entry.type === 'percent');
  assert.equal(money.set, undefined);
  assert.equal(percent.set, undefined);
  // C294 adds currencies and currencyDisplay to money, step to percent.
  assert.deepEqual(money.params, ['currency', 'currencies', 'currencyDisplay', 'min', 'max', 'placeholder', 'required', 'readonly']);
  // C303 (2): decimals, the digits a percent keeps (precision its former name).
  assert.deepEqual(percent.params, ['decimals', 'min', 'max', 'step', 'precision', 'placeholder', 'required', 'readonly']);
  for (const map of ['VIEW_RENDERERS', 'EDIT_RENDERERS']) {
    const body = renderers.slice(renderers.indexOf(`${map} = {`), renderers.indexOf('};', renderers.indexOf(`${map} = {`)));
    assert.match(body, /money: renderMoney(View|Edit),/u, map);
    assert.match(body, /percent: renderPercent(View|Edit),/u, map);
  }
  assert.match(renderers, /money: renderMoneyFilterControl,\n\s+percent: renderPercentFilterControl,/u);
});

test('C291 (2): decimals compared by their digits, never as floats', () => {
  assert.equal(compareDecimal('10.5', '10.50'), 0);
  assert.equal(compareDecimal('0.1', '0.10000000000000001'), -1);
  assert.equal(compareDecimal('-1', '0'), -1);
  assert.equal(compareDecimal('99999999999999999.99', '99999999999999999.98'), 1);
  assert.equal(compareDecimal('abc', '1'), null);
  assert.equal(editableDecimal('1500.5', 'ru'), '1500,5');
  assert.equal(editableDecimal('1500.5', 'en'), '1500.5');
  assert.equal(editableDecimal(null, 'ru'), '');
});

test('C291 (2): a currency\'s sign, side and minor units come from Intl', () => {
  assert.deepEqual(currencyOf('RUB', 'ru'), {sign: '₽', before: false, minor: 2});
  // The standard sign since C294: the Canadian dollar is «CA$», never «$».
  assert.deepEqual(currencyOf('CAD', 'en'), {sign: 'CA$', before: true, minor: 2});
  assert.deepEqual(currencyOf('USD', 'en'), {sign: '$', before: true, minor: 2});
  assert.equal(currencyOf('JPY', 'ru').minor, 0);
  assert.equal(currencyOf('KWD', 'en').minor, 3);
  assert.deepEqual(currencyOf('rub', 'ru'), {sign: 'rub', before: false, minor: 2});
  assert.equal(formatMoney({amount: '1500.5', currency: 'RUB'}, {}, 'ru').replace(/[  ]/gu, ' '), '1 500,50 ₽');
  assert.equal(formatPercent('12.5', 'ru'), '12,5 %');
});

test('C291 (2): the editors write decimal strings and say what is wrong through setFieldError', () => {
  assert.match(renderers, /inputmode="decimal"/u);
  assert.match(renderers, /host\.setFieldError\(field, message\);\n\s+host\.setFieldValue\(field, value\);/u);
  assert.match(renderers, /amount === null \|\| amount === '' \? null : \{amount, currency: code \?\? null\}/u);
  // C294 (MP-11): a percent is bounded by the field's min and max alone.
  assert.match(renderers, /const min = hasBound\(field\.min\) \? field\.min : null;/u);
  assert.doesNotMatch(renderers, /field\.max : '100'/u);
  for (const language of ['en', 'ru']) {
    const words = json(`src/smart/field-renderers/lang/${language}.json`).runtime;
    for (const key of ['fractionNone', 'boundBetween', 'boundAtLeast', 'boundAtMost', 'currency', 'chooseCurrency']) assert.ok(words[key], `${language}.${key}`);
  }
  assert.equal(json('src/smart/field-renderers/lang/ru.json').runtime.chooseCurrency, 'Выберите валюту');
});

test('C291 (3): sf-form apply answer, size and state over the confirm surface\'s words', () => {
  const manifest = json('src/smart/form/component.json');
  assert.equal(manifest.version, '1.7.0'); // form fields: field host // field orders FO-1, FO-6 // C302/C303: template keys declared
  assert.deepEqual(manifest.settings.apply.values, ['submit', 'instant', 'answer']);
  assert.deepEqual(manifest.settings.size.values, ['1', '1/2']);
  assert.equal(manifest.settings.size.default, '1');
  assert.deepEqual(manifest.settings.state.values, ['open', 'pending', 'accepted', 'declined', 'expired']);
  assert.equal(manifest.events.answer.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.answer.carries), ['accepted', 'value']);
  assert.equal(manifest['host-states']['data-state'], 'string');
  assert.match(form, /import \{CONFIRM_ICON, CONFIRM_STATES\} from '\.\.\/helpers\/confirm-surface\.js';/u);
  // pending before the event, so a host may settle in its handler; a cancelled event reopens.
  assert.match(form, /this\.state = 'pending';\n\s+const detail = accepted \? \{accepted, value: this\.value\} : \{accepted\};\n\s+if \(!this\.sfEmit\('answer', detail, \{cancelable: true\}\)\) \{/u);
  // No «Изменить» after the answer: the answer footer has no edit button.
  const answerFooter = template.slice(template.indexOf('function answerFooter'), template.indexOf('function footerBlock'));
  assert.doesNotMatch(answerFooter, /sf-form-edit/u);
  assert.match(answerFooter, /text=\$\{context\.words\.send\}/u);
  assert.match(template, /if \(context\.answer\) return answerFooter\(context\);/u);
  const ru = json('src/smart/form/lang/ru.json').runtime;
  const en = json('src/smart/form/lang/en.json').runtime;
  assert.deepEqual([ru.send, ru['answer-sending'], ru['answer-sent'], ru['answer-expired']], ['Отправить', 'Отправляем…', 'Отправлено', 'Время ответа истекло']);
  assert.deepEqual([en.send, en['answer-sent']], ['Send', 'Sent']);
});

test('C291 (3): size 1/2 reaches the controls and the buttons; size 1 writes nothing new', () => {
  assert.match(form, /if \(this\.size === '1\/2'\) options\.size = '1\/2';/u);
  assert.equal((template.match(/(?<!-)size=\$\{context\.size === '1\/2' \? '1\/2' : nothing\}/gu) || []).length, 4);
});
