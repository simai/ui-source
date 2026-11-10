#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A grid cell's span by its container's width (utility.query-layout 1.1.0,
// ui-doc «Рецепты», 2026-11-10): cq-<bp>:col-span-N, cq-<bp>:col-span-full and
// cq-<bp>:col-auto, unnamed and for the sidebar container. For each breakpoint
// (sm 32rem, md 44rem, lg 60rem, xl 72rem) a query container a pixel narrower
// and a pixel wider than it, in a 1400px window (the window's own md:/lg:
// conditions hold in every case, so only the container decides): a 12-column
// grid whose cells ask for 6, full and auto at that breakpoint. Below the
// threshold each cell is one column; at it, six, twelve and one (col-auto
// keeps the auto placement).
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

const breakpoints = {sm: 32, md: 44, lg: 60, xl: 72};
const scene = Object.entries(breakpoints).flatMap(([bp, rem]) => [-1, 1].map((delta) => {
  const width = rem * 16 + delta;
  return ['', '/sidebar'].map((name) => `<div class="${name ? 'query-container/sidebar' : 'query-container'}" style="inline-size:${width}px" data-bp="${bp}" data-delta="${delta}" data-name="${name}">
    <div class="grid grid-col-12" style="gap:0">
      <div data-ask="6" class="cq-${bp}${name}:col-span-6">a</div><div data-ask="full" class="cq-${bp}${name}:col-span-full">b</div><div data-ask="auto" class="cq-${bp}${name}:col-auto">c</div>
    </div></div>`).join('');
})).join('');

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    const page = await open(browser, scene, {width: 1400, height: 900});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-bp="sm"][data-delta="1"] [data-ask="6"]')).gridColumnEnd === 'span 6', null, {timeout: 15000}).catch(() => {});
    await page.waitForTimeout(300);
    const cells = await page.evaluate(() => [...document.querySelectorAll('[data-bp]')].map((box) => {
      const grid = box.firstElementChild;
      const column = grid.getBoundingClientRect().width / 12;
      const span = (ask) => Math.round(box.querySelector(`[data-ask="${ask}"]`).getBoundingClientRect().width / column);
      return {bp: box.dataset.bp, delta: Number(box.dataset.delta), name: box.dataset.name, six: span('6'), full: span('full'), auto: span('auto')};
    }));
    for (const cell of cells) {
      const want = cell.delta > 0 ? {six: 6, full: 12, auto: 1} : {six: 1, full: 1, auto: 1};
      if (cell.six !== want.six || cell.full !== want.full || cell.auto !== want.auto) note({load, case: 'a cell spans by its container\'s width', got: cell, want});
    }
    if (page.errors.length) note({load, case: 'console clean', errors: page.errors});
    console.log(JSON.stringify({load, cells}));
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('QUERY_LAYOUT_COLUMN_SPAN_OK');
