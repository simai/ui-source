#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A closed sf-drawer draws nothing (ui-doc «Рецепты», «Фильтры в шторке»,
// 2026-11-10). Moved out by its own width the closed panel stood beside its
// box: in a [data-sf-overlay-container] with room around it (a documentation
// example's body has 3px of padding) its first pixels and its shadow showed at
// the box's edge, and in a window its shadow reached back over the edge.
// Closed: hidden (an inert panel is not hit-tested either way, so the probe
// reads its visibility). Opening: shown at once,
// focusable. Closing: still drawn while it slides, hidden when the slide ends.
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const page404 = new Set();

// One page of the probe over the built bytes: <body> markup, the core, nothing else.
async function open(browser, body, viewport = {width: 1200, height: 800}) {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'probe', pluginListVersion: 'probe', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = product === 'rule' ? join(out, 'core', 'rule', ...rest) : join(out, product, product, ...rest);
    if (existsSync(file) && statSync(file).isFile()) return route.fulfill({status: 200, contentType: types[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
    page404.add(url.pathname);
    return route.fulfill({status: 404, body: ''});
  });
  page.errors = errors;
  await page.goto('http://probe.test/');
  return page;
}
const defined = (page, tags) => page.waitForFunction((list) => list.every((tag) => customElements.get(tag)), tags, {timeout: 15000});

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    const page = await open(browser, `<div style="padding:3px"><div id="box" data-sf-overlay-container style="min-block-size:400px">
        <p>Страница</p>
        <sf-drawer drawer-id="filters" modal="false" placement="inline-end" size="1/2" heading="Фильтры"><p>Тело</p></sf-drawer></div></div>
      <sf-drawer drawer-id="window" modal="false" placement="inline-start" heading="Окно"><p>Тело</p></sf-drawer>`, {width: 900, height: 600});
    await defined(page, ['sf-drawer']);
    await page.waitForFunction(() => document.querySelectorAll('[data-sf-drawer-panel]').length === 2, null, {timeout: 10000});
    await page.waitForTimeout(600);
    const state = () => page.evaluate(() => {
      const panel = document.querySelector('[data-sf-drawer-portal="filters"] [data-sf-drawer-panel]');
      const other = document.querySelector('[data-sf-drawer-portal="window"] [data-sf-drawer-panel]');
      const box = document.querySelector('#box').getBoundingClientRect();
      // The panel's own visibility, and the box shadow it would draw past the box.
      return {visibility: getComputedStyle(panel).visibility, windowVisibility: getComputedStyle(other).visibility,
        left: Math.round(panel.getBoundingClientRect().left), boxRight: Math.round(box.right)};
    });
    const closed = await state();
    if (closed.visibility !== 'hidden' || closed.windowVisibility !== 'hidden') note({load, case: 'a closed panel is not drawn, in a box and in the window', got: closed});
    await page.evaluate(() => document.querySelector('sf-drawer[drawer-id="filters"]').open());
    await page.waitForTimeout(80);
    const opening = await state();
    if (opening.visibility !== 'visible') note({load, case: 'an opening panel is drawn at once', got: opening});
    await page.waitForTimeout(700);
    const open1 = await state();
    if (open1.visibility !== 'visible' || open1.left >= open1.boxRight) note({load, case: 'an open panel stands in its box', got: open1});
    await page.evaluate(() => document.querySelector('sf-drawer[drawer-id="filters"]').close());
    await page.waitForTimeout(60);
    const closing = await state();
    if (closing.visibility !== 'visible') note({load, case: 'a closing panel is drawn while it slides out', got: closing});
    await page.waitForTimeout(900);
    const closedAgain = await state();
    if (closedAgain.visibility !== 'hidden') note({load, case: 'a closed panel is hidden once the slide ends', got: closedAgain});
    if (page.errors.length) note({load, case: 'console clean', errors: page.errors});
    console.log(JSON.stringify({load, closed, opening, open: open1, closing, closedAgain}));
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('DRAWER_CLOSED_HIDDEN_OK');
