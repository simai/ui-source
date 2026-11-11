#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-header-page takes an action the page adds after it has drawn (ui-doc
// «Рецепты», 2026-11-10): the base took the slot children once, at connect, and
// an sf-button slot="actions" appended later stood after the drawn header,
// outside it. Each slot (path, start, actions) given late lands in its place,
// after what the slot already held, and the header draws once more.
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
    const page = await open(browser, `<sf-header-page id="h" heading="Товары" count="3"><sf-button slot="actions" id="early" text="Экспорт"></sf-button></sf-header-page>`);
    await defined(page, ['sf-header-page', 'sf-button']);
    await page.waitForFunction(() => document.querySelector('#early')?.closest('.sf-page-header-actions'), null, {timeout: 10000});
    await page.evaluate(() => {
      const host = document.querySelector('#h');
      const add = (tag, id, slot, attributes = {}) => {
        const node = document.createElement(tag);
        node.id = id;
        node.slot = slot;
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        host.append(node);
      };
      add('sf-button', 'late', 'actions', {text: 'Создать'});
      add('span', 'late-start', 'start', {});
      add('nav', 'late-path', 'path', {'aria-label': 'Путь'});
    });
    await page.waitForTimeout(500);
    const got = await page.evaluate(() => ({
      actions: [...document.querySelectorAll('.sf-page-header-actions [id]')].map((node) => node.id).filter((id) => ['early', 'late'].includes(id)),
      start: Boolean(document.querySelector('#late-start')?.closest('.sf-page-header-line')),
      path: Boolean(document.querySelector('#late-path')?.closest('.sf-page-header-path')),
      strays: [...document.querySelector('#h').children].filter((node) => node.hasAttribute('slot')).map((node) => node.id),
      drawn: Boolean(document.querySelector('#late button')),
    }));
    if (JSON.stringify(got.actions) !== JSON.stringify(['early', 'late']) || !got.start || !got.path || got.strays.length || !got.drawn) {
      note({load, case: 'a slot child added after the header drew stands in its slot', got});
    }
    if (page.errors.length) note({load, case: 'console clean', errors: page.errors});
    console.log(JSON.stringify({load, ...got}));
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('HEADER_PAGE_LATE_SLOT_OK');
