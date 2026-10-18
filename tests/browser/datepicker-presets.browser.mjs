#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Quick ranges in sf-datepicker (owner, 2026-10-15), on the built bytes:
// - choosing one sets its dates, shows the month it ends in and emits change
//   once, with preset {id, relative};
// - a stored preset given back wins over start/end values, is resolved for
//   today and emits nothing;
// - a manual pick lets go of it; a range past max-date is clamped, and one
//   with nothing left is disabled;
// - the list sits beside the grid, rows a day high, and wraps above it as a
//   row where the panel has no room; it is one tab stop, arrows move along it.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/datepicker/css/datepicker.css', 'smart/smart/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/inputs/js/inputs.js', 'smart/smart/datepicker/js/datepicker.js'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru" class="theme-dark"><head><meta charset="utf-8"></head><body style="margin:20px">
    <sf-datepicker id="dp" input="false" range presets="today,last-7-days,this-month,last-month" close-on-select="false"></sf-datepicker>
    <sf-datepicker id="narrow" input="false" range root-style="inline-size:300px" presets="today,yesterday,last-7-days"></sf-datepicker>
    <sf-datepicker id="stored" input="false" range preset="last-7-days" presets="last-7-days,last-month" start-value="2020-01-01" end-value="2020-01-05"></sf-datepicker>
    <sf-datepicker id="capped" input="false" range presets="today,last-7-days,last-month"></sf-datepicker>
    <sf-datepicker id="sat" input="false" week-start="6"></sf-datepicker>
    <sf-datepicker id="eg" input="false" locale="ar-EG"></sf-datepicker>
    <sf-datepicker id="us" input="false" locale="en-US"></sf-datepicker>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-datepicker') && document.querySelector('#dp .sf-datepicker-preset'), null, {timeout: 8000});
  await page.waitForTimeout(400);

  const got = await page.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const day = (offset) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
    const result = {};
    const dp = document.getElementById('dp');
    const events = [];
    dp.addEventListener('change', (event) => events.push(event.detail));
    result.labels = [...dp.querySelectorAll('.sf-datepicker-preset')].map((one) => one.textContent.trim());
    // A range not chosen lies on the panel: no box of the page's colour round it.
    result.idle = getComputedStyle(dp.querySelector('[data-preset="today"]')).backgroundColor;
    // Beside the grid, rows a day high.
    const list = dp.querySelector('.sf-datepicker-presets').getBoundingClientRect();
    const grid = dp.querySelector('.sf-datepicker-grid').getBoundingClientRect();
    const dayBox = dp.querySelector('.sf-datepicker-day').getBoundingClientRect();
    const row = dp.querySelector('.sf-datepicker-preset').getBoundingClientRect();
    result.beside = {listRight: Math.round(list.right), gridLeft: Math.round(grid.left), row: Math.round(row.height), day: Math.round(dayBox.height)};
    // Choose «last 7 days».
    dp.querySelector('[data-preset="last-7-days"]').click();
    await wait(150);
    result.chosen = {value: dp.value, expected: [day(-6), day(0)], events: events.length, preset: events[0]?.preset ?? null,
      pressed: dp.querySelector('[data-preset="last-7-days"]').getAttribute('aria-pressed'),
      month: dp.month, todayMonth: today.getMonth()};
    // A manual pick lets go.
    const pick = dp.querySelector('.sf-datepicker-day:not(.sf-datepicker-another-month):not(:disabled)');
    pick.click();
    await wait(150);
    result.manual = {preset: dp.getAttribute('preset'), pressed: [...dp.querySelectorAll('.sf-datepicker-preset[aria-pressed="true"]')].map((one) => one.dataset.preset),
      lastEventPreset: events.length && 'preset' in events.at(-1) ? events.at(-1).preset : 'missing'};
    // Stored preset wins and emits nothing.
    const stored = document.getElementById('stored');
    let storedEvents = 0;
    stored.addEventListener('change', () => { storedEvents += 1; });
    stored.requestComponentUpdate?.('probe');
    await wait(150);
    result.stored = {value: stored.value, expected: [day(-6), day(0)], events: storedEvents,
      shown: [...stored.querySelectorAll('.sf-datepicker-day-start, .sf-datepicker-day-end')].map((one) => one.dataset.date)};
    // Clamped by max-date.
    const capped = document.getElementById('capped');
    capped.setAttribute('max-date', day(-3));
    await wait(150);
    capped.querySelector('[data-preset="last-7-days"]').click();
    await wait(150);
    result.capped = {value: capped.value, expected: [day(-6), day(-3)],
      todayDisabled: capped.querySelector('[data-preset="today"]').disabled};
    // Narrow: the list above the grid, as a row.
    const narrow = document.getElementById('narrow');
    const nList = narrow.querySelector('.sf-datepicker-presets').getBoundingClientRect();
    const nGrid = narrow.querySelector('.sf-datepicker-grid').getBoundingClientRect();
    const nButtons = [...narrow.querySelectorAll('.sf-datepicker-preset')].map((one) => one.getBoundingClientRect());
    result.narrow = {listBottom: Math.round(nList.bottom), gridTop: Math.round(nGrid.top),
      oneLine: nButtons[0].top === nButtons[1].top, panel: Math.round(narrow.querySelector('.sf-datepicker').getBoundingClientRect().width)};
    // Keyboard: one tab stop, arrows move.
    const buttons = [...dp.querySelectorAll('.sf-datepicker-preset')];
    result.tabStops = buttons.filter((one) => one.tabIndex === 0).length;
    const first = buttons.find((one) => one.tabIndex === 0);
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    result.arrow = {moved: document.activeElement !== first && document.activeElement?.classList.contains('sf-datepicker-preset'),
      tabStops: buttons.filter((one) => one.tabIndex === 0).length};
    return result;
  });

  if (got.labels.join('|') !== 'Сегодня|Последние 7 дней|Этот месяц|Прошлый месяц|Свой период') note({case: 'labels in the page language, «Свой период» last', got: got.labels});
  if (!/^rgba\(\d+, \d+, \d+, 0\)$|transparent/u.test(got.idle)) note({case: 'a range not chosen has no box of its own', got: got.idle});
  if (got.beside.listRight > got.beside.gridLeft) note({case: 'the list beside the grid, at its inline start', got: got.beside});
  if (got.beside.row !== got.beside.day) note({case: 'a list row is a day high', got: got.beside});
  const c = got.chosen;
  if (c.value.join() !== c.expected.join() || c.events !== 1 || c.preset?.relative !== 'last-7-days' || c.pressed !== 'true' || c.month !== c.todayMonth) {
    note({case: 'choosing a quick range: its dates, one change with the preset, the month it ends in', got: c});
  }
  // «Свой период» (data-preset="") is the pressed one after a pick on the grid.
  if (got.manual.preset !== null || got.manual.pressed.length !== 1 || got.manual.pressed[0] !== '' || got.manual.lastEventPreset !== null) {
    note({case: 'a manual pick lets go of the quick range', got: got.manual});
  }
  const s = got.stored;
  if (s.value.join() !== s.expected.join() || s.events !== 0 || s.shown.join() !== s.expected.join()) note({case: 'a stored preset wins, resolved for today, emitting nothing', got: s});
  if (got.capped.value.join() !== got.capped.expected.join() || !got.capped.todayDisabled) note({case: 'clamped by max-date; nothing left is disabled', got: got.capped});
  if (got.narrow.listBottom > got.narrow.gridTop || !got.narrow.oneLine) note({case: 'no room: the list above the grid, as a row', got: got.narrow});
  if (got.tabStops !== 1 || !got.arrow.moved || got.arrow.tabStops !== 1) note({case: 'one tab stop, arrows move along the list', got: {tabStops: got.tabStops, arrow: got.arrow}});
  // Any day may open the week (documentation trial 6, 2026-10-18): Saturday by
  // the attribute and by a Saturday-first language, Sunday and Monday as before.
  const weeks = await page.evaluate(() => Object.fromEntries(['sat', 'eg', 'us', 'dp'].map((id) => [id, document.getElementById(id).weekStart])));
  if (weeks.sat !== 6 || weeks.eg !== 6 || weeks.us !== 0 || weeks.dp !== 1) note({case: 'the week opens on the day the attribute or the language says', got: weeks, expected: {sat: 6, eg: 6, us: 0, dp: 1}});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('DATEPICKER_PRESETS_OK');
