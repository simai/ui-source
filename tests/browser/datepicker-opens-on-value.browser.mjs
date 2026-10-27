#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The calendar opens on the month of the value (Larena acceptance, 2026-10-22:
// 15.11.2026 typed into the field, the calendar opened on August -- the month
// it had been left on). On the built bytes, with core.css, UTF-8, the grid's
// month read from the days it draws:
// - a date typed and committed (Enter), or typed and the field clicked without
//   leaving it, opens on that date's month, with the day to focus in it;
// - a value set by the property or by the attribute after the grid was moved
//   elsewhere opens on the value's month; so does a range value;
// - no value: today's month, also after the grid was moved and closed; inside
//   min-date / max-date when today is outside them;
// - an inline calendar (input=false) moves to a value set by the property.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js', 'smart/smart/datepicker/js/datepicker.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
const origin = 'http://probe.test';
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
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
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:20px">
    <p><sf-datepicker id="typed" value="2026-08-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="clicked" value="2026-08-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="property" value="2026-08-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="attribute" value="2026-08-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="empty" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="min" min-date="2099-05-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="max" max-date="2001-02-10" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="range" range aria-label="Период"></sf-datepicker></p>
    <div><sf-datepicker id="inline" input="false" value="2026-08-10" aria-label="Дата"></sf-datepicker></div>
    <div><sf-datepicker id="inline-attribute" input="false" value="2026-08-10" aria-label="Дата"></sf-datepicker></div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-datepicker') && document.querySelector('#typed input') && document.querySelector('#range input')
    && document.querySelector('#inline .sf-datepicker-day'), null, {timeout: 8000});
  await page.waitForTimeout(300);
  const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 30)))));

  // The month the grid draws: its own days, not the neighbours' ends.
  const shown = (id) => page.evaluate((id) => {
    const host = document.getElementById(id);
    const input = host.querySelector('input');
    const panel = input ? document.getElementById(input.getAttribute('aria-controls')) : host;
    const days = [...(panel?.querySelectorAll('.sf-datepicker-day:not(.sf-datepicker-another-month)') || [])];
    const focus = panel?.querySelector('.sf-datepicker-day[tabindex="0"]')?.dataset.date || '';
    return {month: days[0]?.dataset.date?.slice(0, 7) || '', focus, open: host.open, value: host.value};
  }, id);
  const open = async (id) => { await page.click(`#${id} input`); await settle(); return shown(id); };
  const close = async () => { await page.keyboard.press('Escape'); await settle(); };
  // Move the grid away from the value: the next-month arrow, three times.
  const wander = async (id) => {
    await open(id);
    for (let step = 0; step < 3; step += 1) {
      await page.evaluate((id) => document.getElementById(id).shiftMonth(1), id);
      await settle();
    }
    const moved = await shown(id);
    await close();
    return moved;
  };

  // Typed and committed with Enter.
  const typedMoved = await wander('typed');
  check('the grid can be moved away first', typedMoved.month === '2026-11', typedMoved);
  await page.fill('#typed input', '15.11.2026');
  await page.press('#typed input', 'Enter');
  await settle();
  await page.evaluate(() => document.getElementById('typed').shiftMonth(-5));
  await close();
  const typed = await open('typed');
  check('a typed date (Enter) opens on its month', typed.month === '2026-11' && typed.focus === '2026-11-15' && typed.value === '2026-11-15', typed);
  await close();

  // Typed, then the field clicked without leaving it: no change has fired yet.
  await wander('clicked');
  await page.fill('#clicked input', '15.11.2026');
  const clicked = await open('clicked');
  check('a typed date opens on its month without leaving the field', clicked.month === '2026-11' && clicked.focus === '2026-11-15'
    && clicked.value === '2026-11-15', clicked);
  await close();
  await page.fill('#clicked input', '15.11.20');
  const half = await open('clicked');
  check('half-typed text is not committed by opening', half.value === '2026-11-15' && half.month === '2026-11', half);
  await close();

  // Set by the property, after the grid was moved.
  await wander('property');
  await page.evaluate(() => { document.getElementById('property').value = '2027-03-05'; });
  const property = await open('property');
  check('a value set by the property opens on its month', property.month === '2027-03' && property.focus === '2027-03-05', property);
  await close();

  // Set by the attribute, after the grid was moved.
  await wander('attribute');
  await page.evaluate(() => document.getElementById('attribute').setAttribute('value', '2025-01-20'));
  await settle();
  const attribute = await open('attribute');
  check('a value set by the attribute opens on its month', attribute.month === '2025-01' && attribute.focus === '2025-01-20', attribute);
  await close();

  // No value: today's month, also after wandering.
  const empty = await open('empty');
  check('no value opens on today\'s month', empty.month === thisMonth, empty);
  await close();
  await wander('empty');
  const back = await open('empty');
  check('no value opens on today\'s month after the grid was moved', back.month === thisMonth, back);
  await close();

  // min-date / max-date hold the opening month.
  const min = await open('min');
  check('no value under min-date opens on min-date\'s month', min.month === '2099-05', min);
  await close();
  const max = await open('max');
  check('no value over max-date opens on max-date\'s month', max.month === '2001-02', max);
  await close();

  // A range value set by the property.
  await wander('range');
  await page.evaluate(() => { document.getElementById('range').value = ['2026-11-03', '2026-11-20']; });
  const range = await open('range');
  check('a range opens on its month', range.month === '2026-11', range);
  await close();

  // Inline: no opening, the property moves it.
  await page.evaluate(() => { document.getElementById('inline').value = '2026-04-02'; });
  await settle();
  const inline = await shown('inline');
  check('an inline calendar moves to a value set by the property', inline.month === '2026-04', inline);
  await page.evaluate(() => document.getElementById('inline-attribute').setAttribute('value', '2026-06-02'));
  await settle();
  const inlineAttribute = await shown('inline-attribute');
  check('an inline calendar follows the value attribute', inlineAttribute.month === '2026-06', inlineAttribute);
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DATEPICKER_OPENS_ON_VALUE_OK');
