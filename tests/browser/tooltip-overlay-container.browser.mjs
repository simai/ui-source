#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A tooltip stands on its trigger wherever the trigger is (simai/ui-source#63).
// [data-sf-overlay-container] gets contain: layout (drawer and modal sheets),
// and contain: layout -- as a transform or a filter does -- makes the box the
// containing block of every position: fixed descendant. SF.Position measured
// the tooltip while the stylesheet still had it absolute, so Floating UI read
// the page as its offset parent and answered viewport coordinates; written as
// fixed, they were taken from the container: under a 48px top bar the tooltip
// stood 48px low, over the button it describes, and took the pointer from it.
// Here the same trigger stands on the page, in an overlay container under a
// 48px bar and 120px in (the plain form, and the Smart sf-tooltip the
// composition overlay's toolbar uses, in an anchor and in a static one), in a box with a transform and in one with a filter;
// in each the tooltip is above the trigger, centred on it, at the first frame
// it shows and after it settles, light and dark.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const required = ['core/core/js/core.js', 'core/core/css/core.css', 'component/component/tooltip/css/tooltip.css', 'smart/smart/drawer/css/drawer.css'];
const absent = required.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`asset(s) not found under ${out}: ${absent.join(', ')}`);

const trigger = (id) => `<span class="sf-tooltip-anchor">
  <button id="${id}" class="sf-icon-button sf-icon-button--size-1" type="button" data-tooltip="${id}-tip" aria-label="Перетащить" style="inline-size:40px;block-size:40px">
    <i class="sf-icon" aria-hidden="true">drag_indicator</i>
  </button>
  <span id="${id}-tip" class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 sf-tooltip--arrow-bottom-center" hidden>
    <span class="sf-tooltip-content"><span class="sf-tooltip-text">Перетащить блок</span><span class="sf-tooltip-tail"></span></span>
  </span>
</span>`;
// The Smart form, as sf-composition-overlay's toolbar draws it (core
// composition/overlay.mjs): sf-tooltip beside the button, the anchor static
// inside a toolbar the overlay places itself.
const smart = (id, anchorStyle = '') => `<span class="sf-tooltip-anchor" style="${anchorStyle}">
  <button id="${id}" class="sf-icon-button sf-icon-button--size-1/2" type="button" data-tooltip="" aria-label="Перетащить" style="inline-size:32px;block-size:32px">
    <i class="sf-icon" aria-hidden="true">drag_indicator</i>
  </button>
  <sf-tooltip id="${id}-tip" appearance="dark" size="1/2" arrow="bottom-center" text="Перетащить блок" hidden></sf-tooltip>
</span>`;
const body = `
  <header style="block-size:48px;background:#ddd">bar</header>
  <div style="padding:160px 0 0 120px">${trigger('page')}</div>
  <main data-sf-overlay-container style="position:relative;margin-inline-start:120px;block-size:220px;background:#f4f4f4">
    <div style="padding:120px 0 0 300px">${trigger('container')}</div>
    <div style="position:absolute;inset-block-start:60px;inset-inline-start:520px">${smart('smart')}</div>
    <div style="position:absolute;inset-block-start:140px;inset-inline-start:700px;display:flex">${smart('toolbar', 'position:static')}</div>
  </main>
  <div style="transform:translateX(0);margin:40px 0 0 200px;block-size:200px">
    <div style="padding:120px 0 0 60px">${trigger('transform')}</div>
  </div>
  <div style="filter:opacity(1);margin:40px 0 0 80px;block-size:200px">
    <div style="padding:120px 0 0 240px">${trigger('filter')}</div>
  </div>`;

const failures = [];
const note = (detail) => failures.push(detail);
const measures = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 1300}});
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.route('http://probe.test/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') {
        return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
          <link rel="stylesheet" href="/distr/core/css/core.css">
          <link rel="stylesheet" href="/distr/component/tooltip/css/tooltip.css">
          <link rel="stylesheet" href="/distr/smart/drawer/css/drawer.css">
          <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
          <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
      }
      const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
      const file = join(out, product, product, ...rest);
      return existsSync(file)
        ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
        : route.fulfill({status: 404, body: ''});
    });
    await page.goto('http://probe.test/');
    await page.waitForFunction(() => document.getElementById('page')?.getAttribute('aria-describedby') !== null
      || document.getElementById('page-tip')?.getAttribute('role') === 'tooltip', null, {timeout: 15000});
    const contain = await page.evaluate(() => getComputedStyle(document.querySelector('[data-sf-overlay-container]')).contain);
    if (!/layout/u.test(contain)) note({case: `the overlay container contains layout (${theme})`, got: contain});

    for (const id of ['page', 'container', 'smart', 'toolbar', 'transform', 'filter']) {
      await page.mouse.move(5, 5);
      await page.waitForTimeout(150);
      await page.hover(`#${id}`);
      // The first frame the tooltip shows, then after it settles.
      const read = () => page.evaluate((key) => {
        const button = document.getElementById(key).getBoundingClientRect();
        const host = document.getElementById(`${key}-tip`);
        // A Smart sf-tooltip draws no box of its own: its .sf-tooltip does.
        const tip = host.localName === 'sf-tooltip' ? host.querySelector('.sf-tooltip') ?? host : host;
        const box = tip.getBoundingClientRect();
        return {shown: !host.hidden && box.width > 0, gap: Math.round(button.top - box.bottom),
          centre: Math.round((box.left + box.width / 2) - (button.left + button.width / 2)),
          overlaps: box.bottom > button.top + 1, hit: document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2)?.closest(`#${key}`) !== null};
      }, id);
      const first = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
        .then(read);
      await page.waitForTimeout(300);
      const settled = await read();
      // SF_PROBE_SHOTS=<dir> keeps a picture of each case for the evidence.
      if (process.env.SF_PROBE_SHOTS) await page.screenshot({path: join(process.env.SF_PROBE_SHOTS, `tooltip-${id}-${theme}.png`)});
      measures[`${id} ${theme}`] = {first, settled};
      for (const [when, got] of [['first frame', first], ['settled', settled]]) {
        if (!got.shown) { note({case: `${id}: the tooltip shows on hover (${when}, ${theme})`, got}); continue; }
        if (got.overlaps || got.gap < 0 || got.gap > 16) note({case: `${id}: the tooltip stands above its trigger (${when}, ${theme})`, got});
        if (Math.abs(got.centre) > 2) note({case: `${id}: the tooltip is centred on its trigger (${when}, ${theme})`, got});
        if (!got.hit) note({case: `${id}: the trigger keeps the pointer (${when}, ${theme})`, got});
      }
    }
    if (errors.length) note({case: `no page errors (${theme})`, errors});
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({measures}, null, 1));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('TOOLTIP_OVERLAY_CONTAINER_OK');
