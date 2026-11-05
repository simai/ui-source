#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The field set edits a datetime as a day and a time (Larena acceptance,
// 2026-10-22: «Дата и время» edited only the day) -- since sf-input-date 1.4.0
// as one control, sf-input-date in datetime mode, and a time of day as
// sf-input-date in time mode (duplication audit A-14). On the built bytes,
// with the harness as the host (getFieldValue, setFieldValue, setFieldError),
// at the set's sizes 1 and 1/2, at 600px and 360px:
// - one control, at an sf-input's height of the same size, named by the label;
// - the stored value shows: «15.11.2026 10:30»; untouched, nothing is written;
// - a changed day keeps the stored time below the minute and the zone; a
//   changed time keeps the zone; back to the stored value writes undefined;
// - a day without its time is put back, never written; a cleared field writes null;
// - a day chosen on the grid keeps the time; the time row steps the hours;
// - a new value is ISO 8601 with the time and no zone;
// - a time field shows hh:mm, writes the stored shape (hh:mm:00) and reads min/max/step.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/datepicker/css/datepicker.css', 'smart/smart/input-date/css/input-date.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/input/js/input.js', 'smart/smart/input-date/js/input-date.js',
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
    <div id="alarm" style="max-inline-size:420px;margin-block-start:24px"></div>
    <div id="ref" style="max-inline-size:420px;margin-block-start:24px"></div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => window.SF?.fieldRenderers?.renderEditField && window.SF?.render && customElements.get('sf-input-date') && customElements.get('sf-input'), null, {timeout: 10000});
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
        window.values = {start: '2026-11-15T10:30:15+03:00', fresh: null, alarm: '10:30:15'};
        const host = {
          getFieldValue: (field) => window.values[field.key],
          setFieldValue: (field, value) => { window.writes.push([field.key, value]); },
          setFieldError: (field, message) => { window.errors.push([field.key, message]); },
        };
        const draw = (id, field) => window.SF.render(set.renderEditField(field, window.values[field.key], host, {size}), document.getElementById(id));
        draw('stored', {key: 'start', label: 'Начало', propertyType: 'datetime', required: true});
        draw('fresh', {key: 'fresh', label: 'Встреча', propertyType: 'datetime', step: 15});
        draw('alarm', {key: 'alarm', label: 'Напоминание', propertyType: 'time', min: '08:00', max: '20:00', step: 5});
        window.SF.render(window.SF.html`<sf-input size=${size} appearance="bordered" aria-label="ref"></sf-input>`, document.getElementById('ref'));
      }, size);
      await page.waitForFunction(() => document.querySelector('#stored sf-input-date input') && document.querySelector('#alarm sf-input-date input')
        && document.querySelector('#ref input'), null, {timeout: 8000});
      await page.waitForTimeout(400);

      const layout = await page.evaluate(() => {
        const box = (node) => { const rect = node.getBoundingClientRect(); return {top: rect.top, height: rect.height}; };
        const field = (id) => document.querySelector(`#${id} sf-input-date .sf-input-field`) || document.querySelector(`#${id} sf-input-date input`);
        const picker = (id) => document.querySelector(`#${id} sf-input-date`);
        const input = (id) => document.querySelector(`#${id} sf-input-date input`);
        return {day: box(field('stored')), time: box(field('alarm')), ref: box(document.querySelector('#ref .sf-input-field') || document.querySelector('#ref input')),
          controls: document.querySelectorAll('#stored sf-input-date, #stored sf-input:not(sf-input-date sf-input)').length,
          mode: picker('stored').getAttribute('mode'), timeMode: picker('alarm').getAttribute('mode'),
          name: input('stored').getAttribute('aria-label') || input('stored').labels?.[0]?.textContent,
          shown: input('stored').value, timeShown: input('alarm').value,
          size: picker('stored').getAttribute('size'), timeSize: picker('alarm').getAttribute('size'),
          bounds: [picker('alarm').getAttribute('min-time'), picker('alarm').getAttribute('max-time'), picker('alarm').getAttribute('minute-step'),
            picker('fresh').getAttribute('minute-step')],
          writes: window.writes.length, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth};
      });
      check(at('one control in datetime mode, one in time mode'), layout.controls === 1 && layout.mode === 'datetime' && layout.timeMode === 'time', layout);
      check(at('named by the label'), layout.name === 'Начало', layout);
      check(at('at the field\'s size and an sf-input\'s height'), layout.size === size && layout.timeSize === size
        && Math.abs(layout.day.height - layout.ref.height) < 0.5 && Math.abs(layout.time.height - layout.ref.height) < 0.5, layout);
      check(at('min, max and step reach the control'), JSON.stringify(layout.bounds) === JSON.stringify(['08:00', '20:00', '5', '15']), layout);
      check(at('no horizontal scroll'), layout.scroll, layout);
      check(at('the stored value shows'), layout.shown === '15.11.2026 10:30' && layout.timeShown === '10:30', layout);
      check(at('untouched writes nothing'), layout.writes === 0, layout);

      const step = async (selector, text) => {
        await page.fill(selector, text);
        await page.press(selector, 'Enter');
        await settle(page);
        return page.evaluate((selector) => ({writes: window.writes.splice(0), errors: window.errors.splice(0),
          shown: document.querySelector(selector).value}), selector);
      };
      const FIELD = '#stored sf-input-date input';
      const last = (got) => got.writes[got.writes.length - 1]?.[1];

      const day = await step(FIELD, '16.11.2026 10:30');
      check(at('a changed day keeps the stored clock and zone'), day.writes.length === 1 && last(day) === '2026-11-16T10:30:15+03:00', day);
      const time = await step(FIELD, '16.11.2026 18:05');
      check(at('a changed time keeps the zone'), last(time) === '2026-11-16T18:05:00+03:00', time);
      const partial = await step(FIELD, '17.11.2026');
      check(at('a day without its time is put back, never written'), partial.writes.length === 0 && partial.shown === '16.11.2026 18:05'
        && partial.errors.length === 0, partial);
      const back = await step(FIELD, '15.11.2026 10:30');
      check(at('back to the stored value writes undefined: no change'), back.writes.length === 1 && last(back) === undefined, back);
      const none = await step(FIELD, '');
      check(at('a cleared field writes null'), last(none) === null, none);

      // The grid and the time row, as a pointer and the keys use them.
      await step(FIELD, '15.11.2026 10:30');
      await page.click(FIELD);
      await page.waitForSelector('#stored .sf-datepicker-day[data-date="2026-11-20"]');
      await page.click('#stored .sf-datepicker-day[data-date="2026-11-20"]');
      await settle(page);
      const picked = await page.evaluate(() => ({writes: window.writes.splice(0), focus: document.activeElement?.dataset?.timePart}));
      check(at('a day on the grid keeps the time and the focus goes to the hours'), picked.writes.length === 1
        && picked.writes[0][1] === '2026-11-20T10:30:15+03:00' && picked.focus === 'hours', picked);
      await page.keyboard.press('ArrowUp');
      await settle(page);
      const stepped = await page.evaluate(() => window.writes.splice(0));
      check(at('ArrowUp on the hours is an hour later'), stepped.length === 1 && stepped[0][1] === '2026-11-20T11:30:00+03:00', stepped);
      await page.keyboard.press('Enter');
      await settle(page);
      const closed = await page.evaluate(() => ({open: document.querySelector('#stored sf-input-date').open,
        focus: document.activeElement === document.querySelector('#stored sf-input-date input')}));
      check(at('Enter closes the panel and returns to the field'), !closed.open && closed.focus, closed);

      // A new value: no zone, on the minute step.
      const fresh = await step('#fresh sf-input-date input', '01.02.2026 12:00');
      check(at('a new value is ISO 8601 with the time and no zone'), fresh.writes.length === 1 && fresh.writes[0][1] === '2026-02-01T12:00:00', fresh);
      const offStep = await step('#fresh sf-input-date input', '01.02.2026 12:07');
      check(at('a time off the field\'s step is put back'), offStep.writes.length === 0 && offStep.shown === '01.02.2026 12:00', offStep);

      // A time of day.
      const alarm = await step('#alarm sf-input-date input', '18:05');
      check(at('a changed time keeps the stored shape'), alarm.writes.length === 1 && alarm.writes[0][1] === '18:05:00', alarm);
      const early = await step('#alarm sf-input-date input', '07:00');
      check(at('a time before min is put back'), early.writes.length === 0 && early.shown === '18:05', early);
      const again = await step('#alarm sf-input-date input', '10:30');
      check(at('back to the stored time writes undefined'), again.writes.length === 1 && again.writes[0][1] === undefined, again);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_DATETIME_EDIT_OK');
