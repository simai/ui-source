#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The field set edits a datetime as a day and a time (Larena acceptance,
// 2026-10-22: «Дата и время» edited only the day; ui-admin drew the pair itself,
// and this is its acceptance lifted into the set). On the built bytes, with the
// harness as the host (getFieldValue, setFieldValue, setFieldError), at the
// set's sizes 1 and 1/2, at 600px and 360px:
// - the day (sf-datepicker) and the time (sf-input, hh:mm) stand on one row, at
//   one height -- an sf-input's of the same size -- each with its own accessible
//   name inside a group named by the label;
// - the stored value shows: 15.11.2026 and 10:30; untouched, nothing is written;
// - a changed day keeps the stored time and zone; a changed time keeps the zone;
// - a cleared time is a field error: said under the row, the time marked
//   invalid, the host told, the change withdrawn (undefined); putting it right
//   clears the error; a time that is not one (25:00) is an error too;
// - both cleared write null; back to the stored value writes undefined;
// - a new value is ISO 8601 with the time and no zone.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/datepicker/css/datepicker.css', 'smart/smart/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/inputs/js/inputs.js', 'smart/smart/datepicker/js/datepicker.js',
  'smart/smart/field-renderers/js/field-renderers.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
const origin = 'http://probe.test';

async function open(width) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">
    <div id="stored" style="max-inline-size:420px"></div>
    <div id="fresh" style="max-inline-size:420px;margin-block-start:24px"></div>
    <div id="ref" style="max-inline-size:420px;margin-block-start:24px"></div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => window.SF?.fieldRenderers?.renderEditField && window.SF?.render && customElements.get('sf-datepicker') && customElements.get('sf-input'), null, {timeout: 10000});
  return page;
}

const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

try {
  for (const width of [600, 360]) {
    for (const size of ['1', '1/2']) {
      const at = (what) => `${width}px size ${size}: ${what}`;
      const page = await open(width);
      await page.evaluate((size) => {
        const set = window.SF.fieldRenderers;
        window.writes = [];
        window.errors = [];
        window.values = {start: '2026-11-15T10:30:15+03:00', fresh: null};
        const host = {
          getFieldValue: (field) => window.values[field.key],
          setFieldValue: (field, value) => { window.writes.push([field.key, value]); },
          setFieldError: (field, message) => { window.errors.push([field.key, message]); },
        };
        const draw = (id, field) => window.SF.render(set.renderEditField(field, window.values[field.key], host, {size}), document.getElementById(id));
        draw('stored', {key: 'start', label: 'Начало', propertyType: 'datetime', required: true});
        draw('fresh', {key: 'fresh', label: 'Встреча', propertyType: 'datetime'});
        // The reference: an sf-input of the same size, for the height.
        window.SF.render(window.SF.html`<sf-input size=${size} appearance="bordered" aria-label="ref"></sf-input>`, document.getElementById('ref'));
      }, size);
      await page.waitForFunction(() => document.querySelector('#stored sf-datepicker input') && document.querySelector('#stored sf-input input')
        && document.querySelector('#ref input'), null, {timeout: 8000});
      await page.waitForTimeout(400);

      const layout = await page.evaluate(() => {
        const group = document.querySelector('#stored .sf-field-datetime');
        const day = group.querySelector('sf-datepicker .sf-input-field') || group.querySelector('sf-datepicker input');
        const time = group.querySelector('sf-input.sf-field-datetime-time .sf-input-field') || group.querySelector('sf-input.sf-field-datetime-time input');
        const ref = document.querySelector('#ref .sf-input-field') || document.querySelector('#ref input');
        const box = (node) => { const rect = node.getBoundingClientRect(); return {top: rect.top, height: rect.height, left: rect.left, right: rect.right}; };
        const dayInput = group.querySelector('sf-datepicker input');
        const timeInput = group.querySelector('sf-input.sf-field-datetime-time input');
        return {day: box(day), time: box(time), ref: box(ref), group: box(group),
          role: group.getAttribute('role'), groupName: group.getAttribute('aria-label'),
          dayName: dayInput.getAttribute('aria-label') || dayInput.labels?.[0]?.textContent, timeName: timeInput.getAttribute('aria-label'),
          dayText: dayInput.value, timeText: timeInput.value, placeholder: timeInput.placeholder,
          daySize: group.querySelector('sf-datepicker').getAttribute('size'),
          timeSize: group.querySelector('sf-input.sf-field-datetime-time').getAttribute('size'),
          writes: window.writes.length, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth};
      });
      check(at('a group named by the label'), layout.role === 'group' && layout.groupName === 'Начало', layout);
      check(at('the day and the time are named for assistive technology'), layout.dayName === 'Начало: дата' && layout.timeName === 'Начало: время', layout);
      check(at('both at the field\'s size'), layout.daySize === size && layout.timeSize === size, layout);
      check(at('one row, one height: an sf-input\'s of the size'), Math.abs(layout.day.top - layout.time.top) < 0.5
        && Math.abs(layout.day.height - layout.time.height) < 0.5 && Math.abs(layout.day.height - layout.ref.height) < 0.5
        && layout.time.left >= layout.day.right, layout);
      check(at('no horizontal scroll'), layout.scroll, layout);
      check(at('the stored value shows'), layout.dayText === '15.11.2026' && layout.timeText === '10:30', layout);
      check(at('the placeholder says the shape'), layout.placeholder === 'чч:мм', layout);
      check(at('untouched writes nothing'), layout.writes === 0, layout);

      const step = async (selector, text, key = 'Enter') => {
        await page.fill(selector, text);
        await page.press(selector, key);
        await settle(page);
        return page.evaluate(() => {
          const group = document.querySelector('#stored .sf-field-datetime');
          const note = group.querySelector('.sf-field-datetime-message');
          return {writes: window.writes.splice(0), errors: window.errors.splice(0), message: note.hidden ? '' : note.textContent,
            invalid: group.querySelector('sf-input.sf-field-datetime-time').hasAttribute('invalid'),
            groupInvalid: group.hasAttribute('data-invalid'),
            time: group.querySelector('sf-input.sf-field-datetime-time input').value,
            day: group.querySelector('sf-datepicker input').value};
        });
      };
      const DAY = '#stored sf-datepicker input';
      const TIME = '#stored sf-input.sf-field-datetime-time input';
      const last = (got) => got.writes[got.writes.length - 1]?.[1];

      const day = await step(DAY, '16.11.2026');
      check(at('a changed day keeps the stored time and zone'), day.writes.length === 1 && last(day) === '2026-11-16T10:30:15+03:00', day);
      const time = await step(TIME, '18:05', 'Tab');
      check(at('a changed time keeps the zone'), last(time) === '2026-11-16T18:05:00+03:00', time);
      const cleared = await step(TIME, '', 'Tab');
      check(at('a cleared time is a field error, said and withdrawn'), cleared.writes.length === 1 && cleared.writes[0][1] === undefined
        && cleared.message === 'Укажите время' && cleared.invalid && cleared.groupInvalid
        && JSON.stringify(cleared.errors) === JSON.stringify([['start', 'Укажите время']]), cleared);
      const wrong = await step(TIME, '25:00', 'Tab');
      check(at('a time that is not one is an error'), wrong.message === 'Укажите время в виде чч:мм, от 00:00 до 23:59' && wrong.invalid
        && last(wrong) === undefined, wrong);
      const right = await step(TIME, '0930', 'Tab');
      check(at('putting it right clears the error'), right.message === '' && !right.invalid && !right.groupInvalid
        && JSON.stringify(right.errors) === JSON.stringify([['start', null]]) && last(right) === '2026-11-16T09:30:00+03:00' && right.time === '09:30', right);
      const back = await step(DAY, '15.11.2026');
      const backTime = await step(TIME, '10:30', 'Tab');
      check(at('back to the stored value writes undefined: no change'), last(back) === '2026-11-15T09:30:00+03:00' && last(backTime) === undefined
        && backTime.message === '', {back, backTime});
      const noDay = await step(DAY, '');
      check(at('a time without a day is an error'), noDay.message === 'Укажите дату' && last(noDay) === undefined && noDay.day === '', noDay);
      const none = await step(TIME, '', 'Tab');
      check(at('both cleared write null'), last(none) === null && none.message === '', none);

      // A new value: no zone.
      await page.fill('#fresh sf-datepicker input', '01.02.2026');
      await page.press('#fresh sf-datepicker input', 'Enter');
      await page.fill('#fresh sf-input.sf-field-datetime-time input', '12:00');
      await page.press('#fresh sf-input.sf-field-datetime-time input', 'Tab');
      await settle(page);
      const fresh = await page.evaluate(() => window.writes.splice(0).filter(([key]) => key === 'fresh'));
      check(at('a day alone on a new value waits for the time; then ISO 8601, no zone'), fresh.length === 2 && fresh[0][1] === undefined
        && fresh[1][1] === '2026-02-01T12:00:00', fresh);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_DATETIME_EDIT_OK');
