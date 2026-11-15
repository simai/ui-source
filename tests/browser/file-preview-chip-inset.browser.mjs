#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-file-preview appearance="chip": the chip's inset (DEV GB5 answers on
// owner decisions C149 (1), C105 and C145, 2026-11-15). The room between the
// plate's edge and the holder is the same on every side -- the chip's height
// less the holder's, halved: 8 on a computer and a phone, 6 in compact -- and
// the «×» stands the same room from the end; the name follows the holder by
// that room and keeps no padding of its own. Measured on the built bytes at
// 1440, 1440 compact and 390 (a touch phone), light and dark.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});

const browser = await chromium.launch();
try {
  for (const [width, density, theme] of [[1440, '', 'light'], [1440, 'compact', 'light'], [390, '', 'light'], [1440, '', 'dark']]) {
    const context = await browser.newContext({viewport: {width, height: 700}, isMobile: width < 768, hasTouch: width < 768});
    await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"${density ? ` data-sf-density="${density}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/css/core.css">
      <script>window.sfPath='https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';</script>
      <script type="module" src="https://cdn.jsdelivr.net/gh/simai/ui@main/distr/core/js/core.js"></script></head>
      <body style="margin:16px"><sf-file-preview id="pdf" appearance="chip" file-name="Договор поставки.pdf" file-size="2516582"></sf-file-preview>
      <sf-file-preview id="long" appearance="chip" file-name="Очень длинное имя файла с приложениями к договору.docx" file-size="125165"></sf-file-preview></body></html>`}));
    await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
      const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
      return serve(route, join(out, product, product, ...rest));
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({view: `${width} ${density || 'normal'} ${theme}`, name: 'page error', said: error.message}));
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => document.querySelectorAll('.sf-file-preview--chip .sf-file-preview-holder').length === 2, null, {timeout: 15000});
    await page.waitForTimeout(300);
    const chips = await page.evaluate(() => [...document.querySelectorAll('.sf-file-preview--chip')].map((chip) => {
      const box = chip.getBoundingClientRect();
      const holder = chip.querySelector('.sf-file-preview-holder').getBoundingClientRect();
      const main = chip.querySelector('.sf-file-preview-main');
      const name = chip.querySelector('.sf-file-preview-name');
      const buttons = [...chip.querySelectorAll('.sf-file-preview-actions button')].map((button) => button.getBoundingClientRect()).filter((rect) => rect.width);
      const end = buttons.at(-1);
      const style = (element) => getComputedStyle(element);
      return {
        id: chip.closest('sf-file-preview').id, height: box.height,
        top: holder.top - box.top, start: holder.left - box.left, toText: main.getBoundingClientRect().left - holder.right,
        endTop: end ? end.top - box.top : null, end: end ? box.right - end.right : null,
        padding: [style(main).paddingInlineStart, style(main).paddingInlineEnd, style(name).paddingInlineStart, style(name).paddingInlineEnd],
      };
    }));
    for (const chip of chips) {
      const view = `${width} ${density || 'normal'} ${theme} ${chip.id}`;
      const inset = chip.top;
      if (!near(chip.start, inset)) failures.push({view, name: 'the holder stands as far from the start edge as from the top', start: chip.start, top: inset});
      if (!near(chip.toText, inset)) failures.push({view, name: 'the name follows the holder by the same inset', toText: chip.toText, inset});
      if (chip.end !== null && !near(chip.end, chip.endTop)) failures.push({view, name: 'the «×» stands as far from the end as from the top', end: chip.end, top: chip.endTop});
      if (chip.padding.some((value) => value !== '0px')) failures.push({view, name: 'the name keeps no padding of its own', padding: chip.padding});
      if (inset < 4) failures.push({view, name: 'the inset is a step of the ladder, not a sliver', inset});
    }
    console.log(JSON.stringify({view: `${width} ${density || 'normal'} ${theme}`, chips}));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`file-preview chip inset: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('file-preview chip inset: pass');
