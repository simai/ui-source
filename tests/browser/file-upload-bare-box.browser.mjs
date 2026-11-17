#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A bare sf-file-upload holds its box before its code (defects-d12; the GB9
// pair acceptance «files» page: the tag was 0 px until its code, and an
// sf-input-image under it that drew first was pushed down by 134, 114 on a
// phone, CLS 0.02-0.03 in every load). The core placeholder sheet gives the
// undefined area of size 1 its height from its attributes; this reads that
// held box with the code withheld (core.css only) and the drawn area with
// the code, and asks they agree, with and without a supporting text; then
// the whole page (the upload over an sf-input-image, both bare) loads with
// no layout shift. 1440 and 390 (a touch phone), light and dark, 3 loads.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const base = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';
// Each element in its own section, as on the files page: the drawn host is
// display: contents, so in a flex parent with a gap its hidden message,
// status and empty list would each take a gap the held box cannot know.
const body = `<main id="stage" style="display:flex;flex-direction:column;gap:16px">
  <section><sf-file-upload id="full" link-text="Выберите файлы" text="или перетащите их сюда" formats="PDF, PNG или JPG" supporting-text="Можно загрузить несколько документов" multiple></sf-file-upload></section>
  <section><sf-file-upload id="plain" link-text="Выберите файл"></sf-file-upload></section>
  <section><sf-input-image id="image" label="Логотип" name="logo" hint="PNG или SVG, до 1 МБ"></sf-input-image></section>
</main>`;
const html = (theme, code) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${base}core/css/core.css">
  ${code ? `<script>window.sfPath='${base}';</script><script src="${base}core/lang/ru.js"></script><script type="module" src="${base}core/js/core.js"></script>` : ''}
  <script>window.__cls = 0; new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value; }).observe({type: 'layout-shift', buffered: true});</script>
  </head><body style="margin:16px">${body}</body></html>`;

const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    for (let load = 1; load <= 3; load += 1) {
      const view = `${width} ${theme} load ${load}`;
      const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 768, hasTouch: width < 768});
      await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8',
        body: html(theme, !route.request().url().endsWith('/held'))}));
      await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
        const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
        return serve(route, join(out, product, product, ...rest));
      });
      const page = await context.newPage();
      const said = [];
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) said.push(message.text()); });
      page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));

      await page.goto('http://probe.test/held');
      const held = await page.evaluate(() => Object.fromEntries(['full', 'plain'].map((id) => [id, document.getElementById(id).getBoundingClientRect().height])));

      await page.goto('http://probe.test/drawn');
      await page.waitForFunction(() => document.querySelectorAll('.sf-file-upload').length === 2 && document.querySelector('.sf-image-field'), null, {timeout: 15000});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const drawn = await page.evaluate(() => ({
        ...Object.fromEntries(['full', 'plain'].map((id) => [id, document.querySelector(`#${id} .sf-file-upload`).getBoundingClientRect().height])),
        cls: window.__cls,
      }));
      for (const id of ['full', 'plain']) {
        if (Math.abs(held[id] - drawn[id]) > 0.5) failures.push({view, name: `the bare ${id} area holds the box it draws`, held: held[id], drawn: drawn[id]});
      }
      if (drawn.cls > 0) failures.push({view, name: 'nothing shifts while the upload and the image field draw', cls: drawn.cls});
      if (said.length) failures.push({view, name: 'console', said});
      console.log(JSON.stringify({view, held, drawn}));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`file-upload bare box: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('file-upload bare box: pass');
