#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A cold visit sets bold Latin bold, on the built bytes. Inter is font-display
// optional, so a first visit may keep the metric fallback for the whole page;
// that fallback had a regular face only, and bold Latin was drawn at 400 (a
// heading's «Larena» measured the same at 400 and 700; simai.io hub,
// 2026-10-19). Inter's files are withheld here, as on a cold slow visit, and
// the same word set at 400 and at 700 must differ in width.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <link rel="stylesheet" href="/distr/core/css/core.css"></head><body>
        <span id="regular" style="font-family: var(--sf-text--family); font-weight: 400; font-size: 32px">Larena Cloud</span><br>
        <span id="bold" style="font-family: var(--sf-text--family); font-weight: 700; font-size: 32px">Larena Cloud</span><br>
        <h1 id="heading">Larena Cloud</h1></body></html>`});
    }
    // Inter never arrives: the cold visit that stays on the fallback.
    if (url.pathname.endsWith('.woff2')) return route.abort();
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForTimeout(800);
  const got = await page.evaluate(() => ({
    regular: document.getElementById('regular').getBoundingClientRect().width,
    bold: document.getElementById('bold').getBoundingClientRect().width,
    headingWeight: getComputedStyle(document.getElementById('heading')).fontWeight,
    interLoaded: [...document.fonts].some((face) => face.family.includes('Inter Variable') && face.status === 'loaded'),
  }));
  if (got.interLoaded) failures.push({case: 'the probe withholds Inter', got});
  if (!(got.bold > got.regular * 1.03)) failures.push({case: 'bold Latin is drawn bold on the fallback', got});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FONT_FALLBACK_BOLD_OK');
