#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Decimals in the field renderers (simai.property-view-port 1.18.0; Larena
// property types standard: «never a float on the wire»). The cells of the
// types the View set draws -- money, percent, items -- read in the page's
// language from the digits, and money and percent are filtered as numbers; the
// number editor reads a comma or a point, writes a decimal string for a field
// whose value is a string or that declares precision, a number otherwise, and
// reports text that is not a number, or too many digits after the point,
// through setFieldError instead of writing NaN.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/dropdown/css/dropdown.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js', 'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/field-renderers/js/field-renderers.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const expect = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push({case: name, got, want});
};
const browser = await chromium.launch();
let report = {};
try {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  await page.setContent('<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"></head>'
    + '<body style="margin:0"><div id="host" style="width:600px"></div></body></html>');
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(window.SF?.fieldRenderers?.renderEditField && window.SF?.render), null, {timeout: 10000});

  report = await page.evaluate(async () => {
    const set = window.SF.fieldRenderers;
    const {render} = window.SF;
    const nbsp = (text) => (typeof text === 'string' ? text.replace(/[  ]/gu, ' ') : text);
    const holder = document.getElementById('host');
    const en = document.createElement('div');
    en.lang = 'en';
    holder.append(en);

    const cells = {
      moneyRu: nbsp(set.renderCellField({key: 'p', propertyType: 'money'}, {amount: '1500.5', currency: 'RUB'}, holder)),
      moneyEn: nbsp(set.renderCellField({key: 'p', propertyType: 'money'}, {amount: '99999999999999999.99', currency: 'USD'}, en)),
      moneyFixed: nbsp(set.renderCellField({key: 'p', propertyType: 'money', currency: 'JPY'}, '1200', holder)),
      moneyHost: set.renderCellField({key: 'p', propertyType: 'money'}, {amount: '1', currency: 'RUB'}, {formatFieldValue: () => 'host'}),
      moneyNotDecimal: set.renderCellField({key: 'p', propertyType: 'money'}, {amount: 'n/a', currency: 'RUB'}, holder),
      percentRu: nbsp(set.renderCellField({key: 'd', propertyType: 'percent'}, '12.5', holder)),
      percentEn: set.renderCellField({key: 'd', propertyType: 'percent'}, '20', en),
      items1: set.renderCellField({key: 'i', propertyType: 'items'}, [{a: '1'}], holder),
      items3: set.renderCellField({key: 'i', propertyType: 'items'}, [{}, {}, {}], holder),
      items5: set.renderCellField({key: 'i', propertyType: 'items'}, [{}, {}, {}, {}, {}], holder),
      items2En: set.renderCellField({key: 'i', propertyType: 'items'}, [{}, {}], en),
      itemsEmpty: set.renderCellField({key: 'i', propertyType: 'items'}, [], holder),
    };
    const modes = Object.fromEntries(set.registry.filter((entry) => entry.set)
      .map((entry) => [entry.type, {set: entry.set, ...entry.modes}]));

    // A money filter is the number filter: an input and an operator list.
    const filterHost = {
      getFilterControlValue: () => ({}), patchTempFilterValue() {}, getFilterOperatorLabel: (operator) => operator,
    };
    const filterBox = document.createElement('div');
    holder.append(filterBox);
    render(set.renderFilterField({key: 'p', propertyType: 'money', filter: {operators: ['eq', 'between']}}, filterHost), filterBox);

    const writes = [];
    const errors = [];
    const host = {
      setFieldValue: (field, value) => writes.push([field.key, value]),
      setFieldError: (field, message) => errors.push([field.key, message]),
    };
    const fields = [
      {key: 'plain', propertyType: 'number', label: 'Число'},
      {key: 'stringy', propertyType: 'number', label: 'Строкой'},
      {key: 'fixed', propertyType: 'number', label: 'Точность', precision: 2},
      {key: 'whole', propertyType: 'integer', label: 'Целое'},
    ];
    const start = {plain: 3.5, stringy: '3.50', fixed: null, whole: 3};
    for (const field of fields) {
      const box = document.createElement('div');
      box.dataset.field = field.key;
      holder.append(box);
      render(set.renderEditField(field, start[field.key], host), box);
    }
    await new Promise((done) => setTimeout(done, 400));
    const type = (key, text) => {
      const input = document.querySelector(`[data-field="${key}"] input`);
      if (!input) return false;
      input.value = text;
      input.dispatchEvent(new Event('change', {bubbles: true}));
      return true;
    };
    const step = (key, text) => {
      writes.length = 0;
      errors.length = 0;
      const typed = type(key, text);
      const control = document.querySelector(`[data-field="${key}"] sf-input`);
      return {typed, writes: [...writes], errors: [...errors], invalid: control?.hasAttribute('invalid') ?? null,
        inputmode: control?.getAttribute('inputmode') ?? null};
    };
    const edits = {
      plainComma: step('plain', '1 234,5'),
      stringy: step('stringy', '1 500,50'),
      stringyCleared: step('stringy', ''),
      notNumber: step('plain', 'abc'),
      fixedOk: step('fixed', '12.30'),
      fixedTooMany: step('fixed', '12.345'),
      whole: step('whole', '7'),
    };
    return {cells, modes, filter: {inputs: filterBox.querySelectorAll('sf-input').length, operators: filterBox.querySelectorAll('sf-dropdown').length}, edits};
  });

  const {cells, modes, filter, edits} = report;
  expect('money cell ru', cells.moneyRu, '1 500,50 ₽');
  expect('money cell en keeps every digit', cells.moneyEn, '$99,999,999,999,999,999.99');
  expect('money cell under a fixed currency', cells.moneyFixed, '1 200 ¥');
  expect('money cell: the host formats first', cells.moneyHost, 'host');
  expect('money cell: not a decimal falls through', cells.moneyNotDecimal, null);
  expect('percent cell ru', cells.percentRu, '12,5 %');
  expect('percent cell en', cells.percentEn, '20%');
  expect('items cell 1', cells.items1, '1 строка');
  expect('items cell 3', cells.items3, '3 строки');
  expect('items cell 5', cells.items5, '5 строк');
  expect('items cell en', cells.items2En, '2 rows');
  expect('items cell empty', cells.itemsEmpty, '');
  expect('set types: modes', modes, {
    money: {set: 'view', view: false, edit: false, cell: 'own', filter: 'own'},
    percent: {set: 'view', view: false, edit: false, cell: 'own', filter: 'own'},
    items: {set: 'view', view: false, edit: false, cell: 'own', filter: 'own'},
    compound: {set: 'view', view: false, edit: false, cell: 'text', filter: 'text'},
    'ru.requisites': {set: 'view', view: false, edit: false, cell: 'text', filter: 'text'},
  });
  expect('money filter is the number filter', filter, {inputs: 1, operators: 1});
  expect('a number field writes a number, comma read', edits.plainComma.writes, [['plain', 1234.5]]);
  expect('a number whose value is a string writes a decimal string', edits.stringy.writes, [['stringy', '1500.50']]);
  expect('a decimal-string field cleared writes null', edits.stringyCleared.writes, [['stringy', null]]);
  expect('text that is not a number is reported, not written as NaN', [edits.notNumber.writes, edits.notNumber.errors, edits.notNumber.invalid],
    [[['plain', 'abc']], [['plain', 'Введите число']], true]);
  expect('precision: a decimal string within it', [edits.fixedOk.writes, edits.fixedOk.errors], [[['fixed', '12.30']], [['fixed', null]]]);
  expect('precision: more digits are reported', [edits.fixedTooMany.errors, edits.fixedTooMany.invalid],
    [[['fixed', 'Не больше 2 знаков после запятой']], true]);
  expect('an integer is unchanged', [edits.whole.writes, edits.whole.inputmode], [[['whole', 7]], 'numeric']);
  expect('a number is typed with the decimal keyboard', edits.plainComma.inputmode, 'decimal');
} finally {
  await browser.close();
}
console.log(JSON.stringify(report));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('FIELD_DECIMAL_OK');
