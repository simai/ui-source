#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The boot preloader never covers content already drawn (input-choice
// first-paint audit 2026-11-11, item 1). In Docara's example frames the page
// ships its modules preloaded (SF_PRELOADED): the Smart elements are drawn
// before core.js runs, and mountPreloader() put its fixed, opaque layer over
// them 300 ms later, until the core loader was ready -- the cards appeared,
// vanished and came back on a cold load.
//
// Each case is a cold load (a new context) at CPU x4, at 1440 and 390, light
// and dark, three loads each; the core loader is held back LOADER_DELAY ms and
// every other script a random 0-300 ms (timing-hostile), every frame recorded:
//   preloaded  SF_PRELOADED.modules is not empty, no preloader setting:
//              no frame shows the preloader;
//   drawn      no SF_PRELOADED, a Smart element already drawn (isRendered)
//              when the preloader's delay ends: no frame shows it;
//   bare       nothing drawn, nothing preloaded: the preloader shows (the
//              probe sees it when it is there).
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADER_DELAY = Number(process.env.LOADER_DELAY || 1500);
const file = (path) => {
  const [product, ...rest] = path.split('/');
  return join(out, product, product, ...rest);
};
if (!existsSync(file('core/js/core.js'))) throw new Error(`no built core.js under ${out}`);

const DRAWN = `<script>
  // A Smart element drawn before core.js, as a preloaded module draws it.
  customElements.define('sf-probe-drawn', class extends HTMLElement {
    connectedCallback() { this.textContent = 'Карточка'; this.isRendered = true; }
  });
</script>`;
const page = (mode, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><title>preloader</title>
  <link rel="stylesheet" href="/distr/core/css/core.css">
  <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'preloader-${mode}', pluginListVersion: 'preloader-${mode}', icons: {enabled: false}, theme: false};
  ${mode === 'preloaded' ? "window.SF_PRELOADED = {modules: {'smart/probe': {}}, loadedPlugins: {}};" : ''}</script>
  ${mode === 'bare' ? '' : DRAWN}
  </head><body>
  ${mode === 'bare' ? '<p>Текст</p>' : '<sf-probe-drawn></sf-probe-drawn>'}
  <script src="/distr/core/js/core.js"></script></body></html>`;

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
const runs = {};
try {
  for (const mode of ['preloaded', 'drawn', 'bare']) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (let load = 1; load <= 3; load += 1) {
    const key = `${mode} ${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 700}, colorScheme: theme});
    const tab = await context.newPage();
    const cdp = await context.newCDPSession(tab);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    // Every frame: is the boot preloader there and shown?
    await tab.addInitScript(() => {
      window.__frames = [];
      const read = () => {
        const boot = document.querySelector('.sf-loader-boot');
        const wrap = boot?.closest('.sf-loader');
        const shown = Boolean(wrap && !wrap.classList.contains('hidden') && getComputedStyle(wrap).display !== 'none' && getComputedStyle(wrap).visibility !== 'hidden' && Number(getComputedStyle(wrap).opacity) > 0);
        window.__frames.push([Math.round(performance.now()), shown ? 1 : 0]);
        if (!window.__done) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
      window.addEventListener('sf-loader-ready', () => { window.__ready = Math.round(performance.now()); setTimeout(() => { window.__done = true; }, 400); }, {once: true});
    });
    await tab.route('http://probe.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: page(mode, theme)});
      const path = url.pathname.replace(/^\/distr\//u, '');
      const target = file(path);
      if (/\/core-loader(\.min)?\.js$/u.test(path)) await new Promise((done) => setTimeout(done, LOADER_DELAY));
      else if (path.endsWith('.js')) await new Promise((done) => setTimeout(done, Math.round(Math.random() * 300)));
      return existsSync(target)
        ? route.fulfill({status: 200, contentType: target.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(target)})
        : route.fulfill({status: 404, body: ''});
    });
    await tab.goto('http://probe.test/');
    await tab.waitForFunction(() => window.__done === true, null, {timeout: 60000});
    const state = await tab.evaluate(() => ({frames: window.__frames, ready: window.__ready}));
    runs[key] = {mode, frames: state.frames.length, shown: state.frames.filter(([, shown]) => shown).length, ready: state.ready, errors};
    await context.close();
  }
  for (const [key, run] of Object.entries(runs)) {
    if (run.mode === 'preloaded' && run.shown) note({case: `${key}: preloaded modules, no frame shows the preloader`, got: run});
    if (run.mode === 'drawn' && run.shown) note({case: `${key}: a drawn Smart element, no frame shows the preloader`, got: run});
    if (run.mode === 'bare' && !run.shown) note({case: `${key}: a bare page with a slow loader keeps the preloader (the probe sees it)`, got: run});
    if (run.errors.length) note({case: `${key}: no page error`, got: run.errors});
  }
  console.log(JSON.stringify(runs));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PRELOADER_DRAWN_CONTENT_OK');
