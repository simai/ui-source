#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A window opened from the keyboard does not stand in a focus ring (ui-doc
// «Рецепты», «Удаление», 2026-11-10). The panel takes the focus when the window
// opens and drew the page's :focus-visible ring around the whole window; it
// draws none now, as sf-drawer's panel, and the ring belongs to the controls
// inside it. The page's [autofocus] -- the safe answer (C25, C39) -- still takes
// the focus first and still shows its ring from the keyboard.
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

const markup = (auto) => `<div data-sf-overlay-container style="min-block-size:500px">
  <button id="open" type="button" data-sf-modal-open="m">Удалить сайт</button>
  <sf-modal modal-id="m" heading="Удалить сайт shop-example?" show-footer="false" width="var(--sf-g4)">
    <form slot="content" class="flex flex-col"><p class="m-0">Вернуть будет нельзя.</p>
      <div class="m-top-3 flex gap-2"><button type="submit" id="go">Удалить сайт</button><button type="button" id="cancel" data-sf-modal-close="m"${auto ? ' autofocus' : ''}>Отмена</button></div></form>
  </sf-modal></div>`;

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    for (const auto of [false, true]) {
      const page = await open(browser, markup(auto));
      await defined(page, ['sf-modal']);
      await page.waitForTimeout(600);
      await page.focus('#open');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement && document.activeElement !== document.querySelector('#open') && document.activeElement !== document.body, null, {timeout: 5000}).catch(() => {});
      await page.waitForTimeout(500);
      const got = await page.evaluate(() => {
        const active = document.activeElement;
        const css = getComputedStyle(active);
        return {active: active.hasAttribute('data-sf-modal-panel') ? 'panel' : active.id || active.tagName.toLowerCase(),
          focusVisible: active.matches(':focus-visible'), outline: `${css.outlineStyle} ${css.outlineWidth}`};
      });
      const ring = got.outline.startsWith('solid') || got.outline.startsWith('auto');
      if (!auto && (got.active !== 'panel' || ring)) note({load, auto, case: 'the window\'s panel takes the focus and draws no ring', got});
      if (auto && (got.active !== 'cancel' || !ring)) note({load, auto, case: '[autofocus] takes the focus and shows its ring from the keyboard', got});
      if (page.errors.length) note({load, auto, case: 'console clean', errors: page.errors});
      console.log(JSON.stringify({load, auto, ...got}));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('MODAL_PANEL_NO_RING_OK');
