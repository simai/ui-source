#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Typed dates are read whole (ui-admin, 2026-10-22: «20.11.202630.10.2026», two
// dates glued by a paste, was stored as the date 202630-11-20). On the built
// bytes, in a DD.MM.YYYY field holding 20.11.2026:
// - a glued pair, a five-digit year, a year below 1000, a date with something
//   after it, a day the month does not have and a half-typed masked date are not
//   dates: the field goes back to 20.11.2026, the value stays, nothing is said;
// - 05.12.2026, 6.1.2026, 07/12/2026 and 2026-12-08 are read as dates, each said once;
// - a YYYY-MM-DD field reads its own format the same way;
// - a range keeps two values apart: start and end set as two dates stay two,
//   and a start-value holding two glued dates is not a date.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/inputs/css/inputs.css',
  'component/component/buttons/css/buttons.css', 'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/datepicker/css/datepicker.css', 'smart/smart/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'smart/smart/input/js/input.js', 'smart/smart/datepicker/js/datepicker.js'];

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
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
    <p><sf-datepicker id="typed" value="2026-11-20" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="iso" format="YYYY-MM-DD" aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="masked" mask aria-label="Дата"></sf-datepicker></p>
    <p><sf-datepicker id="range" range aria-label="Период"></sf-datepicker></p>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-datepicker') && document.querySelector('#typed input') && document.querySelector('#masked input'), null, {timeout: 8000});
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    window.said = {};
    for (const node of document.querySelectorAll('sf-datepicker')) {
      window.said[node.id] = [];
      node.addEventListener('change', (event) => { if (event.target === node) window.said[node.id].push(event.detail?.value); });
    }
  });
  const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const type = async (id, text, key = 'Enter') => {
    await page.fill(`#${id} input`, text);
    await page.press(`#${id} input`, key);
    await settle();
    return page.evaluate((id) => {
      const node = document.getElementById(id);
      return {value: node.value, field: node.querySelector('input').value, said: window.said[id].splice(0)};
    }, id);
  };

  for (const wrong of ['20.11.202630.10.2026', '20.11.2026 30.10.2026', '20.11.20263', '20.11.0999', '20.11.2026x', '31.11.2026', '2026', '20.11']) {
    for (const key of ['Enter', 'Tab']) {
      const got = await type('typed', wrong, key);
      check(`«${wrong}» (${key}) is not a date: the field goes back and nothing is said`,
        got.value === '2026-11-20' && got.field === '20.11.2026' && got.said.length === 0, {wrong, got});
    }
  }
  for (const [text, iso] of [['05.12.2026', '2026-12-05'], ['6.1.2026', '2026-01-06'], ['07/12/2026', '2026-12-07'], ['2026-12-08', '2026-12-08'], ['07.12.1000', '1000-12-07'], ['08.12.9999', '9999-12-08']]) {
    const got = await type('typed', text);
    check(`«${text}» is ${iso}, said once`, got.value === iso && got.said.length === 1 && got.said[0] === iso, {text, got});
  }

  // The field's own format.
  await type('iso', '2026-02-03');
  for (const wrong of ['2026-02-0304.05.2026', '20260-02-03', '03.02.2026x']) {
    const got = await type('iso', wrong);
    check(`YYYY-MM-DD: «${wrong}» is not a date`, got.value === '2026-02-03' && got.said.length === 0, {wrong, got});
  }
  const own = await type('iso', '2026/02/09');
  check('YYYY-MM-DD reads its own format', own.value === '2026-02-09', own);

  // A masked field: a half-typed date is not a date.
  await type('masked', '03.04.2026');
  const half = await type('masked', '04.05.20');
  check('a half-typed masked date is not a date', half.value === '2026-04-03' && half.said.length === 0, half);

  // A range keeps two dates apart, and a glued start is not a date.
  const range = await page.evaluate(async () => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const node = document.getElementById('range');
    node.value = ['2026-11-20', '2026-11-30'];
    await frame();
    const two = {value: node.value, field: node.querySelector('input').value};
    node.value = ['20.11.202630.11.2026', ''];
    await frame();
    const glued = {value: node.value, start: node.startDate, field: node.querySelector('input').value};
    node.value = ['20.11.2026', '30.11.2026'];
    await frame();
    const formatted = {start: node.startDate?.getFullYear(), end: node.endDate?.getDate(), field: node.querySelector('input').value};
    return {two, glued, formatted};
  });
  check('a range shows its two dates', range.two.field === '20.11.2026 - 30.11.2026', range);
  check('a glued start is not a date', range.glued.start === null && range.glued.field === '', range);
  check('a range in the display format keeps its two dates', range.formatted.start === 2026 && range.formatted.end === 30
    && range.formatted.field === '20.11.2026 - 30.11.2026', range);
} finally {
  await browser.close();
}

if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DATEPICKER_TYPED_STRICT_OK');
