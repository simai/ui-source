#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The month and year choices (docs report on pair ui-2d39b617a719): with
// context="month" or "year" the panel shows the choice alone --
// - the weekday row is not drawn above a month or year grid;
// - every month and year button lies inside the panel and inside the grid's
//   own box, none clipped at the bottom.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/datepicker/css/datepicker.css', 'smart/smart/input-date/css/input-date.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-button/js/icon-button.js', 'smart/smart/input/js/input.js', 'smart/smart/input-date/js/input-date.js'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const seen = {};
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  const origin = 'http://probe.test';
  const serve = (path, route) => (existsSync(path)
    ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
    : route.fulfill({status: 404, body: ''}));
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body style="margin:20px">
    <sf-input-date id="dp" input="false" value="2026-09-15" locale="ru"></sf-input-date></body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-input-date') && document.querySelector('#dp .sf-datepicker-day'), null, {timeout: 8000});
  await page.waitForTimeout(400);
  const measure = () => page.evaluate(() => {
    const panel = document.querySelector('#dp .sf-datepicker');
    const weekdays = panel.querySelector('.sf-datepicker-weekdays');
    const grid = panel.querySelector('.sf-datepicker-context');
    const box = (node) => node.getBoundingClientRect();
    const p = box(panel);
    const g = grid ? box(grid) : null;
    const buttons = grid ? [...grid.querySelectorAll('button')] : [];
    const outside = buttons.filter((button) => {
      const b = box(button);
      return b.bottom > Math.min(p.bottom, g.bottom) + 0.5 || b.top < g.top - 0.5;
    }).map((button) => button.textContent.trim());
    return {
      // Seen means on top: the topmost element at a weekday's centre is that weekday.
      weekdaysShown: [...weekdays.children].some((weekday) => {
        const b = box(weekday);
        return b.height > 0 && weekday.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2));
      }),
      buttons: buttons.length, outside, gridScrolls: grid ? grid.scrollHeight > grid.clientHeight + 1 : null,
    };
  });
  for (const context of ['month', 'year']) {
    await page.evaluate((mode) => { document.getElementById('dp').toggleContext(mode); }, context);
    await page.waitForTimeout(300);
    const got = await measure();
    seen[context] = got;
    if (got.weekdaysShown) note({context, case: 'no weekday row over the choice', got});
    if (!got.buttons) note({context, case: 'the choice is drawn', got});
    if (got.outside.length || got.gridScrolls) note({context, case: 'every choice lies inside the panel', got});
    await page.evaluate((mode) => { document.getElementById('dp').toggleContext(mode); }, context);
    await page.waitForTimeout(200);
  }
  seen.days = await measure();
  if (!seen.days.weekdaysShown) note({case: 'the day grid keeps its weekday row', got: seen.days});
  console.log(JSON.stringify(seen, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DATEPICKER_CONTEXT_OK');
