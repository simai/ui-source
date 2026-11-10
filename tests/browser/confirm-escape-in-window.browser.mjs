#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Escape on an sf-confirm in a window (dispatcher decision D4, recipes gaps
// acceptance, 2026-11-10). With the window's first focus on the confirm's
// «Отмена» (sf-modal 1.6.0, C39), Escape reaches the question first. In a
// window it reports the decline and the window closes on the same press, so a
// host that sets no outcome is not left with an open window and greyed
// answers. A host that refuses the answer (cancels sf-confirm-answer) keeps
// the question and the window. In a page -- here inside a drawer -- Escape
// still declines and goes no further: the drawer stays open. 3 loads.
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
async function open(browser, body, viewport = {width: 1200, height: 800}, theme = "light") {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
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

const confirmWindow = `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button" data-sf-modal-open="m">Удалить</button>
  <sf-modal modal-id="m" heading="Удаление" show-footer="false">
    <div slot="content"><sf-confirm question="Удалить «Смета.xlsx»?" accept-text="Удалить" status="danger"></sf-confirm></div>
  </sf-modal></div>`;
const confirmDrawer = `<div data-sf-overlay-container style="min-block-size:520px">
  <button id="open" type="button">Фильтры</button>
  <sf-drawer drawer-id="d" modal="false" placement="inline-end" heading="Фильтры">
    <sf-confirm question="Сбросить фильтры?" accept-text="Сбросить"></sf-confirm>
  </sf-drawer></div>`;

const state = (page) => page.evaluate(() => {
  const dialog = document.querySelector('[data-sf-modal-panel]');
  const drawer = document.querySelector('[data-sf-drawer-panel]');
  const shown = (node) => Boolean(node) && node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== 'hidden'
    && !node.closest('[data-sf-modal-state="closed"], [inert]');
  return {window: dialog ? shown(dialog) && document.querySelector('sf-modal').hasAttribute('open') : null,
    drawer: drawer ? document.querySelector('sf-drawer').hasAttribute('open') : null,
    state: document.querySelector('sf-confirm').getAttribute('state'), answers: window.__answers,
    focus: document.activeElement?.closest('[data-action]')?.dataset.action || document.activeElement?.tagName.toLowerCase()};
});

const cases = [
  {name: 'window, no host: decline reported, window closes', body: confirmWindow, open: 'modal', want: {window: false, answers: [false]}},
  {name: 'window, host refuses the answer: question and window stay', body: confirmWindow, open: 'modal', refuse: true, want: {window: true, state: 'open', answers: [false]}},
  {name: 'drawer in a page: decline reported, drawer stays open', body: confirmDrawer, open: 'drawer', want: {drawer: true, state: 'pending', answers: [false]}},
];

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    for (const item of cases) {
      const page = await open(browser, item.body);
      // sf-confirm is fetched once the window or the drawer draws it.
      await defined(page, [item.open === 'modal' ? 'sf-modal' : 'sf-drawer']);
      await page.waitForTimeout(500);
      await page.evaluate((refuse) => {
        window.__answers = [];
        document.addEventListener('sf-confirm-answer', (event) => { window.__answers.push(event.detail.accepted); if (refuse) event.preventDefault(); });
      }, Boolean(item.refuse));
      if (item.open === 'modal') { await page.focus('#open'); await page.keyboard.press('Enter'); } else {
        await page.evaluate(() => document.querySelector('sf-drawer').open());
      }
      await defined(page, ['sf-confirm']);
      await page.waitForTimeout(900);
      if (item.open === 'drawer') await page.focus('sf-confirm [data-action="decline"] button, sf-confirm [data-action="decline"]');
      const before = await state(page);
      if (before.focus !== 'decline') note({load, case: `${item.name}: the focus is on «Отмена» before Escape`, got: before});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const after = await state(page);
      for (const [key, value] of Object.entries(item.want)) {
        if (JSON.stringify(after[key]) !== JSON.stringify(value)) note({load, case: item.name, key, want: value, got: after});
      }
      if (page.errors.length) note({load, case: `${item.name}: console clean`, errors: page.errors});
      console.log(JSON.stringify({load, case: item.name, before, after}));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('CONFIRM_ESCAPE_IN_WINDOW_OK');
