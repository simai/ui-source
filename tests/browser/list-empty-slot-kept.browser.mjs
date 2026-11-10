#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-list keeps the page's own empty state (slot="empty") in the document
// while it has rows (ui-doc «Рецепты», 2026-11-10): it was drawn only while the
// list was empty, so a page that looked it up by id to give it its actions
// found nothing whenever rows were shown. It is hidden while there are rows,
// shown when there are none, the same node every time, and the list's own
// empty state is not drawn beside it. A list with no slot is unchanged.
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
    const page = await open(browser, `<sf-list id="l" label="Сайты"><sf-empty-state slot="empty" id="e" kind="nothing-found" size="1/2" text="Ничего не нашлось"></sf-empty-state></sf-list>
      <sf-list id="plain" label="Пусто" empty-text="Нет записей"></sf-list>`);
    await defined(page, ['sf-list', 'sf-empty-state']);
    await page.waitForFunction(() => document.querySelector('#e')?.closest('.sf-list__empty') && document.querySelector('#plain .sf-list__empty'), null, {timeout: 10000});
    const got = await page.evaluate(async () => {
      const list = document.querySelector('#l');
      const first = document.querySelector('#e');
      const wait = () => new Promise((done) => setTimeout(done, 300));
      const look = () => {
        const node = document.querySelector('#e');
        const wrap = node?.closest('.sf-list__empty');
        return {found: Boolean(node), same: node === first, shown: Boolean(wrap) && getComputedStyle(wrap).display !== 'none',
          rows: list.querySelectorAll('sf-list-item').length, ownEmpty: list.querySelectorAll('sf-empty-state').length};
      };
      const empty = look();
      list.setItems({items: [{id: 'a', text: 'Строка'}], options: {hasMore: false}});
      await wait();
      const withRows = look();
      list.setItems({items: [], options: {hasMore: false}});
      await wait();
      const emptyAgain = look();
      const plain = document.querySelector('#plain');
      const plainEmpty = plain.querySelectorAll('.sf-list__empty sf-empty-state').length;
      plain.setItems({items: [{id: 'a', text: 'Строка'}], options: {hasMore: false}});
      await wait();
      return {empty, withRows, emptyAgain, plainEmpty, plainWithRows: plain.querySelectorAll('.sf-list__empty').length};
    });
    const ok = got.empty.found && got.empty.shown && got.empty.ownEmpty === 1
      && got.withRows.found && got.withRows.same && !got.withRows.shown && got.withRows.rows === 1
      && got.emptyAgain.found && got.emptyAgain.same && got.emptyAgain.shown && got.emptyAgain.ownEmpty === 1
      && got.plainEmpty === 1 && got.plainWithRows === 0;
    if (!ok) note({load, case: 'the slotted empty state stays in the document, hidden while there are rows', got});
    if (page.errors.length) note({load, case: 'console clean', errors: page.errors});
    console.log(JSON.stringify({load, ...got}));
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('LIST_EMPTY_SLOT_KEPT_OK');
