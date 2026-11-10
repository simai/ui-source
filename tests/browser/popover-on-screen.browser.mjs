#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An open sf-popover stays on screen (ui-doc «Рецепты», «Уведомления»,
// 2026-11-10). Placed by its stylesheet alone, a 320px panel hung from a
// trigger near the window's right edge ran past it. It is now kept by the
// shared anchored positioning (core/js/position.js), as the other floating
// surfaces are: it moves along the trigger's edge, or to the other side,
// when there is no room. With room it stands where its placement says, as
// before, and closed the stylesheet's placement is back.
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

const scene = (justify, placement, offset = '') => `<div style="display:flex;justify-content:${justify};padding:8px;padding-top:${placement.startsWith('top') ? '300px' : '8px'}">
  <sf-popover id="p" placement="${placement}" width="320px" label="Уведомления"${offset ? ` offset="${offset}"` : ''}>
    <button slot="trigger" id="t" style="inline-size:60px">Открыть</button>
    <div slot="content" id="c" style="padding:8px">Панель шириной 320px</div></sf-popover></div>`;

const browser = await chromium.launch();
try {
  for (let load = 1; load <= 3; load++) {
    for (const [justify, placement] of [['flex-end', 'bottom-start'], ['flex-start', 'bottom-end'], ['flex-end', 'top-start'], ['flex-start', 'bottom-start'], ['flex-end', 'bottom-end']]) {
      const page = await open(browser, scene(justify, placement), {width: 400, height: 600});
      await defined(page, ['sf-popover']);
      await page.waitForTimeout(500);
      await page.click('#t');
      await page.waitForTimeout(400);
      const got = await page.evaluate(() => {
        const c = document.querySelector('#c').getBoundingClientRect();
        const t = document.querySelector('#t').getBoundingClientRect();
        return {left: Math.round(c.left), right: Math.round(c.right), top: Math.round(c.top), bottom: Math.round(c.bottom),
          trigger: [Math.round(t.left), Math.round(t.right), Math.round(t.top), Math.round(t.bottom)],
          viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth};
      });
      const onScreen = got.left >= 0 && got.right <= got.viewport && got.scrollWidth <= got.viewport;
      if (!onScreen) note({load, justify, placement, case: 'the open panel stays inside the window', got});
      // With room it stands where its placement says.
      const [tl, tr, tt, tb] = got.trigger;
      if (justify === 'flex-start' && placement === 'bottom-start' && (got.left !== tl || got.top !== tb)) note({load, placement, case: 'with room, bottom-start hangs from the trigger\'s start corner', got});
      if (justify === 'flex-end' && placement === 'bottom-end' && (got.right !== tr || got.top !== tb)) note({load, placement, case: 'with room, bottom-end hangs from the trigger\'s end corner', got});
      if (placement === 'top-start' && got.bottom !== tt) note({load, placement, case: 'top-start stands above the trigger', got});
      await page.click('#t');
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => ({display: getComputedStyle(document.querySelector('#c')).display, inline: document.querySelector('#c').style.position}));
      if (closed.display !== 'none' || closed.inline) note({load, placement, case: 'closed, the panel is hidden and the inline placement is gone', got: closed});
      if (page.errors.length) note({load, placement, case: 'console clean', errors: page.errors});
      console.log(JSON.stringify({load, justify, placement, ...got}));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('POPOVER_ON_SCREEN_OK');
