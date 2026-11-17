#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The date filter on the built set (owner decision C293, 2026-11-17; ui-control
// prototypes/date-filter-conditions-study.html, variant A): a grouped condition
// list and then only what the condition needs; choosing a condition writes its
// own value (a period by name, «Пусто» with true, a day kept as a day, never a
// stale day with a period); a quick range pressed in «Между» makes the
// condition that period; the chip says the condition; the request carries one
// {operator, value} per field and the context {timeZone, weekStart}; the
// calendar's quick ranges are whole periods (DF-5), its field takes the row
// (DF-7) and its days keep seven columns under a host page's own .grid (DF-8).
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
  'component/component/quantity/css/quantity.css',
].map((p) => join(out, p));
const ruPack = join(out, 'core/core/lang/ru.js');
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/list-item/js/list-item.js', 'smart/smart/input/js/input.js',
  'smart/smart/dropdown/js/dropdown.js', 'smart/smart/input-date/js/input-date.js', 'smart/smart/input-quantity/js/input-quantity.js',
  'smart/smart/field-renderers/js/field-renderers.js',
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
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => { if (!String(error).includes('Automatic publicPath')) errors.push(String(error)); });
  // A host page's own unlayered .grid (DF-8): the calendar must not depend on it.
  await page.setContent(`<!doctype html><html class="theme-light" lang="${lang}"><head><meta charset="utf-8">`
    + '<style>.grid{display:block}</style></head>'
    + '<body style="margin:0"><div id="host" style="width:350px"></div></body></html>');
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  if (lang === 'ru') await page.addScriptTag({path: ruPack});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => Boolean(window.SF?.fieldRenderers?.dateFilter && window.SF?.render), null, {timeout: 10000});

  const result = await page.evaluate(async () => {
    const set = window.SF.fieldRenderers;
    const rules = set.dateFilter;
    const {render} = window.SF;
    const holder = document.getElementById('host');
    const settle = (ms = 250) => new Promise((done) => setTimeout(done, ms));
    // A filter window: the entry it holds, merged by every patch, as the table's.
    function window_(field) {
      const box = document.createElement('div');
      holder.append(box);
      const host = {
        size: '1',
        entry: {},
        getFilterControlValue: () => host.entry,
        patchTempFilterValue(key, patch) { host.entry = {...host.entry, ...patch}; draw(); },
        getFilterOperatorLabel: (one) => one,
      };
      const draw = () => render(set.renderFilterField(field, host), box);
      draw();
      const controls = () => [...box.firstElementChild.children].slice(1)
        .map((node) => (node.localName === 'sf-input-date' && node.hasAttribute('range') ? 'sf-input-date[range]' : node.localName));
      const choose = async (key) => {
        const dropdown = box.firstElementChild.firstElementChild;
        dropdown.dispatchEvent(new CustomEvent('change', {detail: {value: key, values: [key]}, bubbles: true}));
        await settle();
      };
      return {box, host, controls, choose, draw};
    }
    const report = {};
    const fields = {
      paid: {key: 'paid_at', label: lang() === 'ru' ? 'Дата оплаты' : 'Paid', propertyType: 'date'},
      created: {key: 'created_at', label: lang() === 'ru' ? 'Создана' : 'Created', propertyType: 'datetime'},
      stay: {key: 'stay', label: lang() === 'ru' ? 'Проживание' : 'Stay', propertyType: 'period'},
      due: {key: 'due', label: lang() === 'ru' ? 'Срок' : 'Due', propertyType: 'date', filter: {future: true}},
    };
    function lang() { return document.documentElement.lang; }

    // Each condition: what it draws and what it writes.
    for (const [name, field] of Object.entries(fields)) {
      const one = window_(field);
      await settle(400);
      const dropdown = one.box.querySelector('sf-dropdown');
      // Read from a box not in the page: sf-dropdown takes its items into its panel once connected.
      const loose = document.createElement('div');
      render(set.renderFilterField(field, {...one.host, entry: {}, getFilterControlValue: () => ({})}), loose);
      report[`${name}Groups`] = [...new Set([...loose.querySelectorAll('sf-list-item')].map((item) => item.getAttribute('group')))];
      report[`${name}Label`] = dropdown.getAttribute('label');
      report[`${name}Hint`] = dropdown.getAttribute('hint');
      const rows = [];
      for (const condition of rules.conditions(field)) {
        await one.choose(condition.key);
        const shown = String(one.box.querySelector('sf-dropdown')?.value ?? '');
        rows.push({key: condition.key, need: condition.need, controls: one.controls(), entry: {...one.host.entry}, shown,
          chip: rules.chipText(field, one.host.entry, document.documentElement),
          empty: rules.isEmptyEntry(one.host.entry)});
      }
      report[name] = rows;
      one.box.remove();
    }

    // DF-2: a day stays a day, a period drops it.
    {
      const one = window_(fields.paid);
      await one.choose('eq');
      const day = one.box.querySelector('sf-input-date');
      day.dispatchEvent(new CustomEvent('change', {detail: {value: '2026-11-10'}}));
      await settle();
      const afterDay = {...one.host.entry};
      await one.choose('gt');
      const afterGt = {...one.host.entry};
      await one.choose('period:this-week');
      report.df2 = {afterDay, afterGt, afterPeriod: {...one.host.entry}};
      one.box.remove();
    }

    // C293 (4): a quick range pressed in «Между» becomes that period by name.
    {
      const one = window_(fields.paid);
      await one.choose('between');
      await settle(300);
      const range = one.box.querySelector('sf-input-date[range]');
      report.presetIds = range?.presetItems?.map((item) => item.id) ?? null;
      const input = range?.querySelector('input');
      input?.click();
      await settle(500);
      const button = document.querySelector('[data-preset="last-week"]');
      report.pressedFound = Boolean(button);
      button?.click();
      await settle(400);
      report.quickRange = {...one.host.entry};
      report.quickRangeControls = one.controls();
      document.body.click();
      one.box.remove();
    }

    // A period field's «when»: own dates draw a range calendar under it.
    {
      const one = window_(fields.stay);
      await one.choose('within');
      const when = one.box.querySelectorAll('sf-dropdown')[1];
      when.dispatchEvent(new CustomEvent('change', {detail: {value: 'own', values: ['own']}}));
      await settle();
      report.ownControls = one.controls();
      report.ownEntry = {...one.host.entry};
      one.box.querySelector('sf-input-date').dispatchEvent(new CustomEvent('change', {detail: {value: ['2026-11-20', '2026-11-30'], preset: null}}));
      await settle();
      report.ownDays = {...one.host.entry};
      report.ownChip = rules.chipText(fields.stay, one.host.entry, document.documentElement);
      one.box.remove();
    }

    // The request: one {operator, value} per field and the context.
    report.request = rules.buildRequest({
      paid_at: {operator: 'month'},
      created_at: {operator: 'period', value: 'today'},
      stay: {operator: 'overlaps', value: 'this-week'},
      note: {operator: 'eq', value: ''},
    }, {node: document.documentElement, context: {timeZone: 'Europe/Moscow'}});

    // DF-5: whole periods on the calendar.
    const today = new Date();
    const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const inline = document.createElement('sf-input-date');
    inline.setAttribute('input', 'false');
    inline.setAttribute('range', '');
    inline.setAttribute('week-start', '1');
    inline.setAttribute('presets', 'this-week,last-week,this-month,this-year,last-7-days');
    holder.append(inline);
    await settle(400);
    const items = Object.fromEntries((inline.presetItems || []).map((item) => [item.id, [iso(item.from), iso(item.to)]]));
    const weekFirst = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    report.df5 = {
      got: items,
      want: {
        'this-week': [iso(weekFirst), iso(new Date(weekFirst.getFullYear(), weekFirst.getMonth(), weekFirst.getDate() + 6))],
        'last-week': [iso(new Date(weekFirst.getFullYear(), weekFirst.getMonth(), weekFirst.getDate() - 7)), iso(new Date(weekFirst.getFullYear(), weekFirst.getMonth(), weekFirst.getDate() - 1))],
        'this-month': [iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0))],
        'this-year': [`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`],
        'last-7-days': [iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), iso(today)],
      },
    };
    // DF-8: seven columns under the host's own .grid.
    const days = [...inline.querySelectorAll('.sf-datepicker-grid .sf-datepicker-day')].slice(0, 7);
    report.df8Columns = new Set(days.map((one) => Math.round(one.getBoundingClientRect().left))).size;
    report.df8Weekdays = new Set([...inline.querySelectorAll('.sf-datepicker-weekdays > *')].map((one) => Math.round(one.getBoundingClientRect().left))).size;
    report.df8Markup = [...inline.querySelectorAll('[class]')].some((node) => /(^|\s)(grid|grid-col-7|inline-flex)(\s|$)/u.test(node.className));
    inline.remove();
    // DF-7: the field takes the row of the 350 px window.
    const field = document.createElement('sf-input-date');
    holder.append(field);
    await settle(300);
    report.df7 = {wrap: Math.round(field.querySelector('.sf-datepicker-wrap').getBoundingClientRect().width),
      row: Math.round(holder.getBoundingClientRect().width)};
    field.remove();
    return report;
  });
  await page.close();
  return {result, errors};
}

const pick = (rows) => Object.fromEntries(rows.map((row) => [row.key, row.controls.join('+') || '-']));
const entries = (rows) => Object.fromEntries(rows.map((row) => [row.key, row.entry]));
try {
  const en = await run('en');
  const ru = await run('ru');
  console.log(JSON.stringify({en, ru}, null, 1));
  for (const [lang, {result: r, errors}] of [['en', en], ['ru', ru]]) {
    const at = (name) => `${lang}: ${name}`;
    const words = lang === 'ru'
      ? {groups: ['Дата', 'Период', 'Заполнено'], range: ['Период записи', 'Заполнено'], label: 'Условие'}
      : {groups: ['Date', 'Period', 'Filled'], range: ["The record's period", 'Filled'], label: 'Condition'};
    expect(at('the list is grouped'), r.paidGroups, words.groups);
    expect(at('a period field\'s groups'), r.stayGroups, words.range);
    expect(at('the list is the condition'), r.paidLabel, words.label);
    expect(at('a date and time says it compares days in the zone'), [r.paidHint, Boolean(r.createdHint && r.createdHint.includes('Europe/') || r.createdHint?.includes('UTC'))], [null, true]);
    // Each condition draws only what it needs.
    const single = {eq: 'sf-input-date', between: 'sf-input-date[range]', lt: 'sf-input-date', gt: 'sf-input-date', gte: 'sf-input-date', lte: 'sf-input-date',
      'period:today': '-', 'period:yesterday': '-', 'period:this-week': '-', 'period:last-week': '-', 'period:last-7-days': '-',
      'period:this-month': '-', 'period:last-month': '-', 'period:this-year': '-', 'last-days': 'sf-input-quantity', empty: '-', 'not-empty': '-'};
    expect(at('a date: only the inputs each condition needs'), pick(r.paid), single);
    expect(at('a date and time: the same'), pick(r.created), single);
    expect(at('a period field: only the inputs each condition needs'), pick(r.stay),
      {overlaps: 'sf-dropdown', within: 'sf-dropdown', starts: 'sf-dropdown', ends: 'sf-dropdown', contains: 'sf-input-date', empty: '-', 'not-empty': '-'});
    expect(at('a deadline also looks forward'), ['period:tomorrow', 'period:next-week', 'next-days', 'period:next-month'].map((key) => pick(r.due)[key]),
      ['-', '-', 'sf-input-quantity', '-']);
    expect(at('the list shows the chosen condition'), [...r.paid, ...r.stay].filter((row) => row.shown !== row.key).map((row) => [row.key, row.shown]), []);
    // The payload of each condition, as chosen.
    const sent = entries(r.paid);
    expect(at('a period is one operator with a name'), sent['period:last-month'], {operator: 'period', value: 'last-month'});
    expect(at('empty and not empty carry true'), [sent.empty, sent['not-empty']], [{operator: 'empty', value: true}, {operator: 'not-empty', value: true}]);
    expect(at('last N days starts at 30'), sent['last-days'], {operator: 'last-days', value: 30});
    expect(at('a period field\'s when starts at this week'), entries(r.stay).overlaps, {operator: 'overlaps', value: 'this-week'});
    expect(at('DF-1 a period, empty and not empty are not empty entries'),
      r.paid.filter((row) => row.need === 'none' || row.need === 'count').every((row) => row.empty === false), true);
    expect(at('DF-1 a day condition without a day is an empty entry'), r.paid.find((row) => row.key === 'eq').empty, true);
    expect(at('DF-2 a day stays a day, a period drops it'), r.df2, {
      afterDay: {operator: 'eq', value: '2026-11-10'}, afterGt: {operator: 'gt', value: '2026-11-10'}, afterPeriod: {operator: 'period', value: 'this-week'}});
    // DF-4: the chip says the condition.
    const chip = Object.fromEntries(r.paid.map((row) => [row.key, row.chip]));
    expect(at('DF-4 chips'), [chip['period:last-month'], chip['period:this-week'], chip['last-days'], chip.empty], lang === 'ru'
      ? ['Дата оплаты: в прошлом месяце', 'Дата оплаты: на этой неделе', 'Дата оплаты: за последние 30 дней', 'Дата оплаты: пусто']
      : ['Paid: last month', 'Paid: this week', 'Paid: in the last 30 days', 'Paid: empty']);
    expect(at('DF-4 a period field\'s chip'), entries(r.stay).overlaps && r.stay.find((row) => row.key === 'overlaps').chip,
      lang === 'ru' ? 'Проживание: идёт на этой неделе' : 'Stay: runs this week');
    expect(at('a period field\'s own dates'), [r.ownControls, r.ownEntry, r.ownDays],
      [['sf-dropdown', 'sf-input-date[range]'], {operator: 'within', value: ['', '']}, {operator: 'within', value: ['2026-11-20', '2026-11-30']}]);
    expect(at('the own dates chip'), r.ownChip.startsWith(lang === 'ru' ? 'Проживание: целиком в ' : 'Stay: entirely within '), true);
    // C293 (4) and DF-5.
    expect(at('the quick ranges in «Между» are the whole periods'), r.presetIds,
      ['today', 'yesterday', 'this-week', 'last-week', 'last-7-days', 'this-month', 'last-month', 'this-year']);
    expect(at('a quick range pressed in «Между» becomes that period'), [r.pressedFound, r.quickRange, r.quickRangeControls],
      [true, {operator: 'period', value: 'last-week'}, []]);
    expect(at('DF-6 the request: one {operator, value} per field and the context'), [r.request.values, r.request.context.timeZone,
      Number.isInteger(r.request.context.weekStart)], [{
      paid_at: {operator: 'period', value: 'this-month'},
      created_at: {operator: 'period', value: 'today'},
      stay: {operator: 'overlaps', value: 'this-week'},
    }, 'Europe/Moscow', true]);
    expect(at('DF-5 whole periods'), r.df5.got, r.df5.want);
    expect(at('DF-8 seven columns under a host .grid'), [r.df8Columns, r.df8Weekdays, r.df8Markup], [7, 7, false]);
    expect(at('DF-7 the field takes the row'), r.df7.wrap, r.df7.row);
    expect(at('no page errors'), errors, []);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('FIELD_DATE_FILTER_C293_OK');
