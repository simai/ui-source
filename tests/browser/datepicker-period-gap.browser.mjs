#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-input-date: the month and the year at the top of the calendar are two
// buttons of one group (owner decision C105 H5; DEV GB5 answers, 2026-11-15,
// spacing gate H5 buttons): they stand --sf-gap--actions apart, 8 (4 in
// compact density), as every row of buttons of one group. They stood 4 apart
// (the template's gap-1/4, the step of tags and toolbars). Measured on the
// built bytes at 1440, 1440 compact and 390, light and dark, on the calendar
// drawn without a field.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});

const browser = await chromium.launch();
try {
  for (const [width, density, theme] of [[1440, '', 'light'], [1440, 'compact', 'light'], [390, '', 'light'], [1440, '', 'dark']]) {
    const context = await browser.newContext({viewport: {width, height: 800}, isMobile: width < 768, hasTouch: width < 768});
    await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"${density ? ` data-sf-density="${density}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/css/core.css">
      <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
      <script type="module" src="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/js/core.js"></script></head>
      <body style="margin:16px"><sf-input-date id="calendar" input="false" value="2026-09-03"></sf-input-date>
      <div id="role" style="inline-size: var(--sf-gap--actions)"></div></body></html>`}));
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    const view = `${width} ${density || 'normal'} ${theme}`;
    page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => document.querySelector('.sf-datepicker-month-toggle button') && document.querySelector('.sf-datepicker-year-toggle button'), null, {timeout: 15000});
    await page.waitForTimeout(300);
    const got = await page.evaluate(() => {
      const month = document.querySelector('.sf-datepicker-month-toggle button').getBoundingClientRect();
      const year = document.querySelector('.sf-datepicker-year-toggle button').getBoundingClientRect();
      return {gap: year.left - month.right, sameRow: Math.abs(year.top - month.top) < 1, role: document.getElementById('role').getBoundingClientRect().width,
        utility: document.querySelector('.sf-datepicker-period').classList.contains('gap-1/4')};
    });
    if (!got.sameRow) failures.push({view, name: 'the month and the year stand in one row', got});
    if (Math.abs(got.gap - got.role) > 0.5) failures.push({view, name: 'the month and the year stand --sf-gap--actions apart', gap: got.gap, role: got.role});
    if (got.role < 4) failures.push({view, name: 'the actions role resolves', role: got.role});
    if (got.utility) failures.push({view, name: 'the gap is the sheet\'s, not a utility in the template'});
    console.log(JSON.stringify({view, ...got}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`datepicker period gap: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('datepicker period gap: pass');
