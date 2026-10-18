#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-modal and sf-drawer inside a box rather than the window (DEV, 2026-10-18:
// a modal example in a frame was cut to ~45px without a stage of its own), on
// the built bytes:
//   1. a modal inside [data-sf-overlay-container] renders its backdrop and
//      surface in that box and covers the box, not the viewport;
//   2. it leaves the page scrollable; a modal outside any box still covers the
//      viewport and locks the page;
//   3. a modal drawer inside the box is as tall as the box and leaves the page
//      scrollable too.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 800}});
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({said: `page error: ${error.message}`}); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'overlay-box', pluginListVersion: 'overlay-box', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">
        <div id="stage" data-sf-overlay-container style="position: relative; block-size: 320px; inline-size: 560px; margin: 40px">
          <sf-modal id="boxed" title="В рамке"><p>Текст</p></sf-modal>
        </div>
        <div id="drawer-stage" data-sf-overlay-container style="position: relative; block-size: 280px; inline-size: 480px; margin: 40px">
          <sf-drawer id="boxed-drawer" placement="inline-end" title="Панель в рамке"><p>Текст</p></sf-drawer>
        </div>
        <sf-modal id="page" title="На странице"><p>Текст</p></sf-modal>
        <div style="block-size: 2400px">Длинная страница</div>
        <script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => customElements.get('sf-modal') && customElements.get('sf-drawer'), null, {timeout: 10000});
  await page.waitForTimeout(600);
  await page.addStyleTag({content: '*, *::before, *::after { transition: none !important; animation: none !important; }'});

  const locked = () => page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden' || getComputedStyle(document.body).overflow === 'hidden');
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height)};
  };

  // 1, 2: the boxed modal.
  await page.evaluate(() => document.getElementById('boxed').open());
  await page.waitForTimeout(500);
  const boxed = await page.evaluate((rectSource) => {
    const rect = new Function(`return (${rectSource})`)();
    const stage = document.getElementById('stage');
    const root = stage.querySelector('[data-sf-modal-portal] [data-sf-modal-id]');
    return {stage: rect(stage), root: rect(root), overlay: rect(root?.querySelector('[data-sf-modal-overlay]')), surface: rect(root?.querySelector('[data-sf-modal-surface]')), inBody: Boolean(document.body.querySelector(':scope > [data-sf-modal-portal] [data-sf-modal-id]'))};
  }, rect.toString());
  const same = (a, b) => a && b && Math.abs(a.left - b.left) <= 1 && Math.abs(a.top - b.top) <= 1 && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1;
  const inside = (inner, outer) => inner && outer && inner.left >= outer.left - 1 && inner.top >= outer.top - 1 && inner.left + inner.width <= outer.left + outer.width + 1 && inner.top + inner.height <= outer.top + outer.height + 1;
  if (!boxed.root) note({case: 'a modal in a box is rendered into the box', got: boxed});
  else {
    if (!same(boxed.root, boxed.stage)) note({case: 'a modal in a box covers the box', got: boxed});
    if (!same(boxed.overlay, boxed.stage)) note({case: 'its backdrop covers the box', got: boxed});
    if (!boxed.surface || !inside(boxed.surface, boxed.stage)) note({case: 'its surface stands in the box', got: boxed});
  }
  const lockedBoxed = await locked();
  if (lockedBoxed) note({case: 'a modal in a box leaves the page scrollable'});
  await page.evaluate(() => document.getElementById('boxed').close());
  await page.waitForTimeout(400);

  // 2: the page modal.
  await page.evaluate(() => document.getElementById('page').open());
  await page.waitForTimeout(500);
  const onPage = await page.evaluate((rectSource) => {
    const rect = new Function(`return (${rectSource})`)();
    return {root: rect(document.querySelector('body > [data-sf-modal-portal="page"] [data-sf-modal-id]') || document.querySelector('[data-sf-modal-id="page"]')), viewport: {left: 0, top: 0, width: innerWidth, height: innerHeight}};
  }, rect.toString());
  if (!same(onPage.root, onPage.viewport)) note({case: 'a modal outside a box covers the viewport', got: onPage});
  if (!(await locked())) note({case: 'a modal outside a box locks the page'});
  await page.evaluate(() => document.getElementById('page').close());
  await page.waitForTimeout(400);
  if (await locked()) note({case: 'the page is unlocked once the page modal closes'});

  // 3: a modal drawer in a box.
  await page.evaluate(() => document.getElementById('boxed-drawer').show?.() ?? document.getElementById('boxed-drawer').setAttribute('open', ''));
  await page.waitForTimeout(600);
  const drawer = await page.evaluate((rectSource) => {
    const rect = new Function(`return (${rectSource})`)();
    const stage = document.getElementById('drawer-stage');
    return {stage: rect(stage), panel: rect(stage.querySelector('[data-sf-drawer-portal] [data-sf-drawer-panel]'))};
  }, rect.toString());
  if (!drawer.panel || Math.abs(drawer.panel.height - drawer.stage.height) > 1 || !inside(drawer.panel, drawer.stage)) note({case: 'a drawer in an overlay container is as tall as the box', got: drawer});
  if (await locked()) note({case: 'a modal drawer in a box leaves the page scrollable'});
  console.log(JSON.stringify({boxed, onPage, drawer}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('OVERLAY_CONTAINER_OK');
