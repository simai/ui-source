#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-drawer inside a box rather than the window (DEV, 2026-10-18: overlay
// examples needed stages of their own), on the built bytes:
//   1. a panel inside a [data-sf-drawer-container] (an editor pane, an example
//      frame) is rendered in that box and is as tall as the box, not as the
//      viewport;
//   2. a docked drawer reserves room by the width of its dock host, not of the
//      window: a narrow host in a wide window reserves nothing, a wide one
//      reserves the panel.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'drawer-box', pluginListVersion: 'drawer-box', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">
        <div id="stage" data-sf-drawer-container style="position: relative; block-size: 300px; inline-size: 520px; margin: 20px">
          <sf-drawer id="boxed" open modal="false" placement="inline-end" title="В рамке"><p>Текст</p></sf-drawer>
        </div>
        <div id="host" data-sf-drawer-dock-host style="inline-size: 600px">Страница</div>
        <sf-drawer id="docked" docked open placement="inline-start" size="1/2" title="Блоки"><p>Блоки</p></sf-drawer>
        <script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => customElements.get('sf-drawer'), null, {timeout: 10000});
  await page.waitForTimeout(900);
  const boxed = await page.evaluate(() => {
    const stage = document.getElementById('stage').getBoundingClientRect();
    const panel = document.querySelector('#stage [data-sf-drawer-portal="boxed"] [data-sf-drawer-panel]')?.getBoundingClientRect();
    return panel ? {height: Math.round(panel.height), stage: Math.round(stage.height), top: Math.round(panel.top - stage.top), bottom: Math.round(stage.bottom - panel.bottom)} : null;
  });
  if (!boxed || boxed.height !== boxed.stage || boxed.top !== 0 || boxed.bottom !== 0) note({case: 'a panel in a box that contains it is as tall as the box', got: boxed});

  const reserved = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sf-drawer-dock-inline-start').trim());
  const narrow = await reserved();
  await page.evaluate(() => { document.getElementById('host').style.inlineSize = '1000px'; });
  await page.waitForTimeout(500);
  const wide = await reserved();
  await page.evaluate(() => { document.getElementById('host').style.inlineSize = '600px'; });
  await page.waitForTimeout(500);
  const narrowAgain = await reserved();
  if (narrow !== '' || !/^\d+px$/u.test(wide) || narrowAgain !== '') {
    note({case: 'a docked drawer reserves room by its host\'s width, not the window\'s', got: {narrow, wide, narrowAgain}, expected: {narrow: '', wide: '<n>px', narrowAgain: ''}});
  }
  console.log(JSON.stringify({boxed, narrow, wide, narrowAgain}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DRAWER_CONTAINER_OK');
