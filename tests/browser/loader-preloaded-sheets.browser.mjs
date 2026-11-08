#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A sheet the page says it holds is not linked again. A site that merges the
// Framework sheets into its own (Docara's shell styles) reports them in
// SF_PRELOADED.loadedPlugins with css: true. The style gate of a Smart element
// (styleSheetsOfRule, ensureStylesReady) asked for the sheets of its rule by
// path, found no <link> of that path and linked each one a second time: on a
// Docara page eleven of the fifteen links the Loader added were sheets the
// shell styles already held (2026-11-08).
//
// The page here merges every sheet sf-button draws with into one stylesheet
// and reports them preloaded. It must get no Framework link for any of them,
// and the button must draw the same box from its first frame to the last as
// it does on a page that links each sheet itself.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const table = JSON.parse(readFileSync(new URL('../../src/core/js/template-utilities.generated.json', import.meta.url), 'utf8'));

// What sf-button draws with: its rule's non-lazy relations, cl-icon's, and the
// utilities both templates write.
const UTILITIES = [...new Set(['pointer-events/default', 'text-align/default', ...(table['cl-button'] ?? []), ...(table['cl-icon'] ?? [])])].sort();
const COMPONENTS = ['buttons', 'icons'];
const file = (path) => {
  const [product, ...rest] = path.split('/');
  return join(out, product, product, ...rest);
};
const sheetPath = (name) => (name.includes('/')
  ? `utility/${name.split('/')[0]}/${name.split('/')[1]}/css/${name.split('/')[1]}.css`
  : `component/${name}/css/${name}.css`);
const merged = [...COMPONENTS, ...UTILITIES].map((name) => {
  const path = sheetPath(name);
  if (!existsSync(file(path))) throw new Error(`no built sheet ${path}`);
  return `/* ${path} */\n${readFileSync(file(path), 'utf8')}`;
}).join('\n');
const preloaded = {
  // The sheets only: the Smart elements' scripts are the Loader's to fetch.
  modules: [...COMPONENTS, ...UTILITIES],
  loadedPlugins: Object.fromEntries([
    ...[...COMPONENTS, ...UTILITIES].map((name) => [name, {css: true, js: false, ready: true}]),
  ]),
};

const page = (mode) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <link rel="stylesheet" href="/distr/core/css/core.css">
  ${mode === 'merged'
    ? '<link rel="stylesheet" href="/site/merged.css">'
    : [...COMPONENTS, ...UTILITIES].map((name) => `<link rel="stylesheet" href="/distr/${sheetPath(name)}">`).join('\n  ')}
  <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'preloaded-${mode}', pluginListVersion: 'preloaded-${mode}', preloader: {enabled: false}, icons: {enabled: false}, theme: false};
  ${mode === 'merged' ? `window.SF_PRELOADED = ${JSON.stringify(preloaded)};` : ''}</script></head><body>
  <sf-button id="probe" text="Поиск" icon-start="search" appearance="outline"></sf-button>
  <script src="/distr/core/js/core.js"></script></body></html>`;

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const runs = {};
try {
  for (const mode of ['merged', 'linked']) {
    const tab = await browser.newPage({viewport: {width: 800, height: 400}});
    tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({mode, said: `page error: ${error.message}`}); });
    // Every frame from the first paint on: the button's box, read before the
    // page's own scripts run further.
    await tab.addInitScript(() => {
      window.__boxes = [];
      const read = () => {
        const host = document.getElementById('probe');
        const box = host?.querySelector('button')?.getBoundingClientRect();
        if (box) window.__boxes.push([Math.round(box.x * 10) / 10, Math.round(box.y * 10) / 10, Math.round(box.width * 10) / 10, Math.round(box.height * 10) / 10].join(','));
        if (window.__boxes.length < 400) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    await tab.route('http://probe.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: page(mode)});
      if (url.pathname === '/site/merged.css') return route.fulfill({status: 200, contentType: 'text/css; charset=utf-8', body: merged});
      const path = url.pathname.replace(/^\/distr\//u, '');
      const target = file(path);
      return existsSync(target)
        ? route.fulfill({status: 200, contentType: target.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(target)})
        : route.fulfill({status: 404, body: ''});
    });
    await tab.goto('http://probe.test/');
    await tab.waitForFunction(() => customElements.get('sf-button') && document.querySelector('#probe button'), null, {timeout: 10000});
    await tab.waitForTimeout(1500);
    const state = await tab.evaluate(() => ({
      links: [...document.querySelectorAll('link[rel~="stylesheet"]')].map((link) => new URL(link.href).pathname),
      boxes: [...new Set(window.__boxes)],
      visible: getComputedStyle(document.querySelector('#probe button')).visibility,
    }));
    runs[mode] = state;
    await tab.close();
  }
  const added = runs.merged.links.filter((path) => path !== '/distr/core/css/core.css' && path !== '/site/merged.css');
  const twice = added.filter((path) => [...COMPONENTS, ...UTILITIES].some((name) => path.replace(/\.min\.css$/u, '.css') === `/distr/${sheetPath(name)}`));
  if (twice.length) note({case: 'a sheet the page reports as held is not linked again', got: twice});
  for (const mode of ['merged', 'linked']) {
    if (runs[mode].boxes.length !== 1) note({case: `${mode}: the button draws one box from its first frame`, got: runs[mode].boxes});
    if (runs[mode].visible !== 'visible') note({case: `${mode}: the style gate lets the button draw`, got: runs[mode].visible});
  }
  if (runs.merged.boxes.at(-1) !== runs.linked.boxes.at(-1)) note({case: 'the merged page draws the box the linked page draws', got: {merged: runs.merged.boxes.at(-1), linked: runs.linked.boxes.at(-1)}});
  console.log(JSON.stringify({utilities: UTILITIES.length, mergedLinks: runs.merged.links, linkedLinks: runs.linked.links.length, box: runs.merged.boxes.at(-1)}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('LOADER_PRELOADED_SHEETS_OK');
