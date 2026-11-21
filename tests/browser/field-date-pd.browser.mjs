#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The date property type on the built set (property type study «Дата»,
// PD-1..PD-8, 2026-11-17) and numbers in the page's language (set boundary
// study): the filter is the operator first and a day field at the table's size
// in the page's language, with a day's words for the comparisons and no day
// field for a period that is one by itself; the edit control takes the field's
// error and its day bounds; the view and the cell print the date in the
// field's format; a number has the page locale's decimal separator; sf-form
// says once per type that it left out a field of a type the set does not draw.
// Run on an English page and on a Russian one (core/lang/ru.js before core).
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/dropdown/css/dropdown.css',
  'component/component/buttons/css/buttons.css', 'component/component/datepicker/css/datepicker.css',
].map((p) => join(out, p));
const ruPack = join(out, 'core/core/lang/ru.js');
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/input-date/js/input-date.js',
  'smart/smart/field-renderers/js/field-renderers.js', 'smart/smart/form/js/form.js',
].map((p) => join(out, p));
const absent = [...styles, ruPack, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const failures = [];
const expect = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push({case: name, got, want});
};
const browser = await chromium.launch({headless: true});

async function run(lang) {
  const page = await browser.newPage({viewport: {width: 900, height: 900}});
  const warnings = [];
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  // Scripts added inline (addScriptTag with a path) have no src, so a bundle
  // that computes its public path says so; the page loads every module anyway.
  page.on('pageerror', (error) => { if (!String(error).includes('Automatic publicPath')) errors.push(String(error)); });
  await page.setContent(`<!doctype html><html class="theme-light" lang="${lang}"><head><meta charset="utf-8"></head>`
    + '<body style="margin:0"><div id="host" style="width:600px"></div></body></html>');
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  if (lang === 'ru') await page.addScriptTag({path: ruPack});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(window.SF?.fieldRenderers?.renderFilterField && window.SF?.render), null, {timeout: 10000});

  const result = await page.evaluate(async () => {
    const set = window.SF.fieldRenderers;
    const {render} = window.SF;
    const holder = document.getElementById('host');
    const draw = (content) => {
      const box = document.createElement('div');
      holder.append(box);
      render(content, box);
      return box;
    };
    const settle = () => new Promise((done) => setTimeout(done, 400));
    const filterHost = (operator) => ({
      size: '1/2',
      getFilterControlValue: () => ({operator, value: operator === 'between' ? ['', ''] : ''}),
      patchTempFilterValue() {},
      getFilterOperatorLabel: (one) => `host:${one}`,
    });
    const dateField = {key: 'due', label: 'Due', propertyType: 'date',
      filter: {operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'today', 'week', 'month']}};

    const report = {};
    const gt = draw(set.renderFilterField(dateField, filterHost('gt')));
    // Read from a box that is not in the page: sf-dropdown takes its items
    // into its panel once it is connected.
    const loose = document.createElement('div');
    render(set.renderFilterField(dateField, filterHost('gt')), loose);
    report.words = [...loose.querySelectorAll('sf-list-item')].map((item) => item.getAttribute('text'));
    const today = draw(set.renderFilterField(dateField, filterHost('today')));
    const between = draw(set.renderFilterField(dateField, filterHost('between')));

    const editHost = {setFieldValue() {}, getFieldValue: () => null};
    const edit = draw(set.renderEditField({key: 'pay', label: 'Pay by', propertyType: 'date', min: '2026-11-01', max: '2026-12-31T10:00'},
      '2026-11-17', editHost, {error: 'Enter the due date'}));
    const clean = draw(set.renderEditField({key: 'pay2', label: 'Pay by', propertyType: 'date'}, '2026-11-17', editHost));
    const datetime = draw(set.renderEditField({key: 'at', label: 'At', propertyType: 'datetime'}, '2026-11-17T10:30', editHost, {error: 'Wrong'}));
    await settle();

    const kids = (box) => [...box.querySelector('div').children].map((node) => node.localName);
    const dateIn = (box) => box.querySelector('sf-input-date');
    report.order = kids(gt);
    report.filterSize = dateIn(gt)?.getAttribute('size') ?? null;
    report.filterLocale = dateIn(gt)?.getAttribute('locale') ?? null;
    report.filterPlaceholder = dateIn(gt)?.querySelector('input')?.getAttribute('placeholder') ?? null;
    report.todayHasDay = Boolean(dateIn(today));
    report.betweenRange = dateIn(between)?.hasAttribute('range') ?? null;
    report.betweenPresets = String(dateIn(between)?.presets ?? '');
    report.betweenPresetButtons = dateIn(between)?.presetItems?.map?.((item) => item.id) ?? null;

    report.editInvalid = dateIn(edit)?.hasAttribute('invalid') ?? null;
    report.editMessage = dateIn(edit)?.getAttribute('error-message') ?? null;
    report.editMessageShown = edit.textContent.includes('Enter the due date');
    report.editBounds = [dateIn(edit)?.getAttribute('min-date'), dateIn(edit)?.getAttribute('max-date')];
    report.cleanInvalid = dateIn(clean)?.hasAttribute('invalid') ?? null;
    report.datetimeInvalid = dateIn(datetime)?.hasAttribute('invalid') ?? null;

    const viewText = (field, value) => draw(set.renderViewField(field, value, null)).textContent.trim();
    report.view = {
      medium: viewText({key: 'd', propertyType: 'date'}, '2026-11-17'),
      short: viewText({key: 'd', propertyType: 'date', format: 'short'}, '2026-11-17'),
      long: viewText({key: 'd', propertyType: 'date', format: 'long'}, '2026-11-17'),
      wrong: viewText({key: 'd', propertyType: 'date', format: 'DD.MM'}, '2026-11-17'),
      datetimeLong: viewText({key: 'd', propertyType: 'datetime', format: 'long'}, '2026-11-17T10:30'),
    };
    report.cellLong = set.renderCellField({key: 'd', propertyType: 'date', format: 'long'}, '2026-11-17', null);
    report.number = {
      view: viewText({key: 'w', propertyType: 'number', unit: 'kg'}, 12.5),
      viewString: viewText({key: 'w', propertyType: 'number'}, '1500.50'),
      carried: viewText({key: 'w', propertyType: 'number'}, {value: 12.5, text: 'twelve and a half'}),
      cell: set.renderCellField({key: 'w', propertyType: 'number'}, 12.5, null),
      integerCell: set.renderCellField({key: 'n', propertyType: 'integer'}, 42, null),
      host: set.renderCellField({key: 'w', propertyType: 'number'}, 12.5, {formatFieldValue: () => 'host text'}),
    };

    const form = document.createElement('sf-form');
    form.fields = [
      // money and percent are drawn since C291 (2); items and compound are
      // still the View set's.
      {key: 'price', label: 'Price', propertyType: 'items'},
      {key: 'cost', label: 'Cost', propertyType: 'items'},
      {key: 'share', label: 'Share', propertyType: 'compound'},
      {key: 'title', label: 'Title', propertyType: 'string'},
    ];
    holder.append(form);
    await settle();
    report.formFields = [...form.querySelectorAll('[name^="sf_field_"]')].map((node) => node.getAttribute('name'));
    return report;
  });
  await page.close();
  return {result, warnings: warnings.filter((text) => text.startsWith('sf-form:')), otherWarnings: warnings.filter((text) => !text.startsWith('sf-form:')), errors};
}

try {
  const en = await run('en');
  const ru = await run('ru');
  console.log(JSON.stringify({en, ru}, null, 1));
  for (const [lang, {result, warnings, errors}] of [['en', en], ['ru', ru]]) {
    const at = (name) => `${lang}: ${name}`;
    expect(at('PD-8 operator first, then the day'), result.order, ['sf-dropdown', 'sf-input-date']);
    expect(at('PD-4 the day field takes the table size'), result.filterSize, '1/2');
    expect(at('PD-5 no hard-coded locale'), result.filterLocale, null);
    expect(at('PD-5 the placeholder is the page language\'s'), result.filterPlaceholder, lang === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY');
    // PD-6 and PD-7 under C293 (field-date-filter-c293): the condition words
    // and the whole periods; the old today, week and month keep the periods.
    expect(at('C293 the condition words'), result.words, lang === 'ru'
      ? ['Точная дата', 'Между', 'Раньше', 'Позже', 'Не раньше', 'Не позже', 'Сегодня', 'Вчера', 'Эта неделя', 'Прошлая неделя',
        'Последние 7 дней', 'Этот месяц', 'Прошлый месяц', 'Этот год', 'Последние N дней']
      : ['Exact date', 'Between', 'Before', 'After', 'On or after', 'On or before', 'Today', 'Yesterday', 'This week', 'Last week',
        'Last 7 days', 'This month', 'Last month', 'This year', 'Last N days']);
    expect(at('PD-7 today draws no day field'), result.todayHasDay, false);
    expect(at('PD-7 a range is a range calendar'), result.betweenRange, true);
    expect(at('C293 with the whole periods as quick ranges'), result.betweenPresetButtons,
      ['today', 'yesterday', 'this-week', 'last-week', 'last-7-days', 'this-month', 'last-month', 'this-year']);
    expect(at('PD-1 the error marks the date field'), [result.editInvalid, result.editMessage, result.editMessageShown], [true, 'Enter the due date', true]);
    expect(at('PD-1 no error, no mark'), result.cleanInvalid, false);
    expect(at('PD-1 a datetime too'), result.datetimeInvalid, true);
    expect(at('PD-2 the day bounds'), result.editBounds, ['2026-11-01', '2026-12-31']);
    // GB15 A4: the year keeps what follows it (г., at) by a no-break space (core format-intl formatDateText).
    expect(at('PD-3 formats'), result.view, lang === 'ru'
      ? {medium: '17 нояб. 2026\u00a0г.', short: '17.11.2026', long: '17 ноября 2026\u00a0г.', wrong: '17 нояб. 2026\u00a0г.', datetimeLong: '17 ноября 2026\u00a0г. в 10:30'}
      : {medium: 'Nov 17, 2026', short: '11/17/26', long: 'November 17, 2026', wrong: 'Nov 17, 2026', datetimeLong: 'November 17, 2026\u00a0at 10:30 AM'});
    expect(at('PD-3 the cell follows the format'), result.cellLong, lang === 'ru' ? '17 ноября 2026\u00a0г.' : 'November 17, 2026');
    expect(at('numbers in the page language'), result.number, lang === 'ru'
      ? {view: '12,5 kg', viewString: '1\u00a0500,50', carried: 'twelve and a half', cell: '12,5', integerCell: '42', host: 'host text'}
      : {view: '12.5 kg', viewString: '1,500.50', carried: 'twelve and a half', cell: '12.5', integerCell: '42', host: 'host text'});
    expect(at('sf-form draws the known field only'), result.formFields, ['sf_field_title']);
    expect(at('sf-form says it once per unknown type'), warnings.length, 2);
    {
      expect(at('the warning names the field and the type'), [warnings[0]?.includes('«price»') && warnings[0]?.includes('«items»'),
        warnings[1]?.includes('«share»') && warnings[1]?.includes('«compound»')], [true, true]);
    }
    expect(at('no page errors'), errors, []);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('FIELD_DATE_PD_OK');
