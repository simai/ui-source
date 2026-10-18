#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Utilities on inline SVG load, on the built bytes: the classes on <svg> and on
// its shapes -- svg-*, fill-*, stroke-* -- are found by the Loader and drawn.
// svg, path and g were skipped with their subtree, so a brand mark coloured
// the way the documentation shows (`<svg class="svg-8 fill-primary">`) loaded
// nothing (documentation trial 6, 2026-10-18).
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({said: `page error: ${error.message}`}); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'svg', pluginListVersion: 'svg', preloader: {enabled: false}, icons: {enabled: false}};</script></head><body>
        <svg id="mark" class="svg-8 fill-primary" viewBox="0 0 24 24" aria-hidden="true">
          <g><path id="shape" class="stroke-error" d="M2 2h20v20H2z"/></g>
          <circle id="dot" class="fill-success" cx="12" cy="12" r="4"/>
        </svg>
        <script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => window.SF?.Loader, null, {timeout: 10000});
  await page.waitForTimeout(1500);
  const got = await page.evaluate(() => {
    const role = (name) => {
      const probe = document.createElement('span');
      probe.style.color = `var(--sf-${name})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const mark = document.getElementById('mark');
    return {
      width: Math.round(mark.getBoundingClientRect().width),
      fill: getComputedStyle(mark).fill, primary: role('primary'),
      stroke: getComputedStyle(document.getElementById('shape')).stroke, error: role('error'),
      dot: getComputedStyle(document.getElementById('dot')).fill, success: role('success'),
    };
  });
  if (got.fill !== got.primary) note({case: 'fill-primary on <svg> draws the primary role', got});
  if (got.stroke !== got.error) note({case: 'stroke-error on a path inside g draws the error role', got});
  if (got.dot !== got.success) note({case: 'fill-success on a shape draws the success role', got});
  if (!(got.width > 24)) note({case: 'svg-8 sizes the mark', got});
  console.log(JSON.stringify(got));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SVG_UTILITIES_OK');
