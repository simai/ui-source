#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The calendar (owner, 2026-10-14), measured on the built bytes in both themes:
// - a day's number keeps the row's line when a caption stands under it;
// - a neighbouring month's day is muted, apart from this month's and still
//   4.5:1, and a neighbouring weekend keeps a muted red, also 4.5:1;
// - the weekday row is a 1/2 control's height, the day a 1 control's, and the
//   arrows and the month in the head share one centre line.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/datepicker/css/datepicker.css', 'smart/smart/datepicker/css/datepicker.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-button/js/icon-button.js', 'smart/smart/input/js/input.js', 'smart/smart/datepicker/js/datepicker.js'];

const day = (n, classes = '', info = '') => `<button class="sf-datepicker-day ${classes} flex flex-col content-main-center items-cross-center" type="button" data-n="${n}"><span class="sf-datepicker-day-date">${n}</span>${info ? `<span class="sf-datepicker-day-info">${info}</span>` : ''}</button>`;
const WEEK = `<div class="sf-datepicker flex flex-col" id="week"><div class="sf-datepicker-row grid grid-col-7">
  ${day(28)}${day(29, '', '3')}${day(30)}${day(1, 'sf-datepicker-another-month')}${day(2, 'sf-datepicker-another-month')}
  ${day(3, 'sf-datepicker-another-month sf-datepicker-day-off')}${day(27, 'sf-datepicker-day-off')}</div></div>`;

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
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    return serve(join(out, url.pathname), route);
  });
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    return serve(join(out, product, product, ...rest), route);
  });
  await page.goto(`${origin}/`);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.setContent(`<!doctype html><html lang="ru" class="${theme}"><body style="margin:20px">${WEEK}
      <sf-datepicker id="dp" input="false" value="2026-09-15"></sf-datepicker><sf-button id="half" size="1/2" text="x"></sf-button></body></html>`);
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
    // Core takes its distr from its own script URL when sfPath is unset
    // (simai/ui-source#8); here that is the build output's core/ root, not a
    // distr, so the page names the distr this probe routes.
    await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => customElements.get('sf-datepicker') && document.querySelector('#dp .sf-datepicker-day'), null, {timeout: 8000});
    await page.waitForTimeout(400);
    const got = await page.evaluate(() => {
      // rgb(r g b) in 0..255, or color(srgb r g b / a) in 0..1.
      const rgb = (c) => {
        const values = c.replace(/^color\(srgb/u, '').match(/[\d.]+/g).map(Number);
        return c.startsWith('color(') ? [...values.slice(0, 3).map((v) => v * 255), ...values.slice(3)] : values;
      };
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((sum, v, at) => sum + v * [0.2126, 0.7152, 0.0722][at], 0);
      // A colour with alpha is laid over the panel before it is measured.
      const over = (c, bg) => { const [r, g, b, a = 1] = rgb(c); const base = rgb(bg); return [r, g, b].map((v, at) => v * a + base[at] * (1 - a)); };
      const ratio = (c, bg) => { const [x, y] = [lum(over(c, bg)), lum(rgb(bg))].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
      const week = document.getElementById('week');
      const bg = getComputedStyle(week).backgroundColor;
      const of = (n) => week.querySelector(`[data-n="${n}"] .sf-datepicker-day-date`);
      const colour = (n) => getComputedStyle(of(n)).color;
      const dp = document.querySelector('#dp .sf-datepicker');
      const centre = (node) => { const box = node.getBoundingClientRect(); return Math.round(box.top + box.height / 2); };
      const head = dp.querySelector('.sf-datepicker-top');
      return {
        tops: [28, 29, 30].map((n) => Math.round(of(n).getBoundingClientRect().top)),
        current: colour(28), neighbour: colour(1), weekend: colour(27), neighbourWeekend: colour(3),
        neighbourRatio: ratio(colour(1), bg), neighbourWeekendRatio: ratio(colour(3), bg),
        weekday: Math.round(dp.querySelector('.sf-datepicker-weekday').getBoundingClientRect().height),
        half: Math.round(document.querySelector('#half button').getBoundingClientRect().height),
        dayHeight: Math.round(dp.querySelector('.sf-datepicker-day').getBoundingClientRect().height),
        head: [centre(head.querySelector('sf-icon-button button')), centre(head.querySelector('.sf-datepicker-month-toggle button')),
          centre([...head.querySelectorAll('sf-icon-button button')].pop())],
      };
    });
    seen[theme] = got;
    if (new Set(got.tops).size !== 1) note({theme, case: 'a caption does not lift the number', got: got.tops});
    if (got.neighbour === got.current || got.neighbourRatio < 4.5) note({theme, case: 'a neighbouring day is muted and legible', got});
    if (got.neighbourWeekend === got.weekend || got.neighbourWeekendRatio < 4.5) note({theme, case: 'a neighbouring weekend is a muted red', got});
    if (got.weekday !== got.half || got.dayHeight !== 40) note({theme, case: 'row heights are ladder steps', got: {weekday: got.weekday, half: got.half, day: got.dayHeight}});
    if (new Set(got.head).size !== 1) note({theme, case: 'the head shares one centre line', got: got.head});
  }
  console.log(JSON.stringify(seen, null, 1));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DATEPICKER_GEOMETRY_OK');
