#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A component script that is slow, or never answered, under a CPU slowed four
// times (R074 F-1, 2026-11-11):
//
// - hang: the request for sf-tag's script is accepted and never answered. The
//   page reaches sf-loader-ready once the script's time limit has passed, the
//   other components draw, sf-tag's elements are shown as they are, and the
//   console says so once -- one warning, nothing else;
// - late: the script answers after its time limit. The page is ready at the
//   limit as above, and when the script arrives it runs once (one request, one
//   script element) and its elements are upgraded and drawn: the tag is not
//   left counted as failed;
// - healthy: every script answers; ready, every element drawn, a clean console.
//
// And the Loader's preloads (the record window's icon buttons): Chrome never
// reports a script "preloaded but not used", on a page that builds its record
// window at once, on load, or once sf-drawer is defined -- and on one that
// builds it on load while a sheet only sf-button-icon waits for (badges) takes
// 4.5 s, so the button's script is used more than 3 s after the load event.
//
// The time limit is shortened on the page (the Loader's scriptLoadTimeoutMs) so
// a load takes seconds, not the 15 s of the default. Each case is loaded
// SF_PROBE_LOADS times (default 3) in a fresh context.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const LIMIT = 2500;
const LATE = 4500;
const LOADS = Number(process.env.SF_PROBE_LOADS || 3);
const CPU = Number(process.env.SF_PROBE_CPU || 4);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const head = (limit) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};
  window.__ready = null; addEventListener('sf-loader-ready', () => { window.__ready = Math.round(performance.now()); });
  // When each component script and each script preload goes into the page.
  window.__inserted = [];
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.localName === 'script' && node.src) window.__inserted.push(['script', node.src.replace(/^.*\\/distr\\//u, ''), Math.round(performance.now())]);
    if (node.localName === 'link' && node.rel === 'preload') window.__inserted.push(['preload', node.href.replace(/^.*\\/distr\\//u, ''), Math.round(performance.now())]);
  }))).observe(document.documentElement, {childList: true, subtree: true});</script>
${limit ? `<script>
  // core.js loads the Loader in parts: the limit is set on the instance the
  // moment it is made, before it asks for any script.
  (() => { let loader; window.SF = window.SF || {};
    Object.defineProperty(window.SF, 'Loader', {configurable: true, enumerable: true, get: () => loader,
      set: (value) => { loader = value; if (value) value.scriptLoadTimeoutMs = ${limit}; }}); })();
</script>` : ''}
<script src="/distr/core/js/core.js"></script></head>`;

const componentsPage = () => `${head(LIMIT)}<body><main>
  <sf-button id="b" icon-start="search" text="Найти"></sf-button>
  <sf-tag id="t" text="Метка"></sf-tag>
  <sf-icon id="i" icon="settings"></sf-icon>
</main></body></html>`;

// The record window as sf-view-properties builds it (portal-origin-hostile).
const WINDOW = `<sf-drawer id="w" placement="inline-end" modal="true" overlay="true" show-close="false" close-on-esc="false" label="Запись">
  <div class="flex flex-col gap-1/2" slot="edge" aria-label="Закрыть">
    <sf-button-icon id="close" appearance="tonal" scheme="on-surface" size="1" icon="close" aria-label="Закрыть"></sf-button-icon>
    <sf-button-icon id="copy" appearance="tonal" scheme="on-surface" size="1" icon="link" aria-label="Ссылка"></sf-button-icon>
  </div>
  <div><sf-icon id="row" icon="tune" size="1"></sf-icon> Параметры</div>
</sf-drawer>`;
const recordPage = (when) => `${head(0)}<body><main>
  <section id="box-a"></section>
  <sf-drawer id="dock" side="left" docked open size="1/2"><div><sf-icon id="docked" icon="tune" size="2"></sf-icon> text</div></sf-drawer>
</main><template id="window">${WINDOW}</template>
<script>
  const build = () => document.getElementById('box-a').append(document.importNode(document.getElementById('window').content, true));
  ${when === 'at-once' ? 'build();' : when === 'after-load' ? "addEventListener('load', build);" : "customElements.whenDefined('sf-drawer').then(() => requestAnimationFrame(build));"}
</script></body></html>`;

const pages = {'/components.html': componentsPage()};
for (const when of ['at-once', 'after-load', 'defined']) pages[`/record-${when}.html`] = recordPage(when);

const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
let mode = 'healthy';
const tagScript = /\/smart\/tag\/js\/tag(?:\.min)?\.js$/u;
const badgesSheet = /\/component\/badges\/css\/badges(?:\.min)?\.css$/u;
let slowRelation = false;
const served = [];
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  if (tagScript.test(path)) {
    served.push(path);
    if (mode === 'hang') return; // accepted, never answered
    if (mode === 'late') await new Promise((done) => setTimeout(done, LATE));
  }
  if (slowRelation && badgesSheet.test(path)) await new Promise((done) => setTimeout(done, 4500));
  try {
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    // Timing-hostile, as portal-origin-hostile: sheets 150-1200 ms, scripts 0-400 ms.
    await new Promise((done) => setTimeout(done, ext === '.css' ? rand(150, 1200) : ext === '.js' ? rand(0, 400) : 0));
    response.writeHead(200, {'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const results = [];

const open = async (path) => {
  const context = await browser.newContext({viewport: {width: 1050, height: 800}});
  const page = await context.newPage();
  const messages = [];
  page.on('pageerror', (error) => messages.push(`pageerror: ${error}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') messages.push(`${message.type()}: ${message.text()}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: CPU});
  await page.goto(`${base}${path}`, {waitUntil: 'domcontentloaded'});
  return {context, page, messages};
};

const drawn = () => ({
  ready: window.__ready,
  button: Boolean(customElements.get('sf-button')) && document.getElementById('b')?.matches(':defined'),
  icon: Boolean(customElements.get('sf-icon')) && document.getElementById('i')?.matches(':defined'),
  tag: Boolean(customElements.get('sf-tag')) && document.getElementById('t')?.matches(':defined'),
  tagText: document.getElementById('t')?.textContent.trim() || document.getElementById('t')?.shadowRoot?.textContent.trim() || '',
  tagVisible: document.getElementById('t') ? getComputedStyle(document.getElementById('t')).visibility : null,
  failed: window.SF?.__internal?.pendingTags?.failed?.() ?? null,
  tagScripts: [...document.scripts].filter((script) => /\/smart\/tag\/js\//u.test(script.src)).length,
});

const check = (name, load, ok, detail) => {
  if (!ok) failures.push({name, load, detail});
};

try {
  for (const which of ['healthy', 'hang', 'late']) {
    mode = which;
    for (let load = 0; load < LOADS; load += 1) {
      served.length = 0;
      const {context, page, messages} = await open('/components.html');
      const started = Date.now();
      await page.waitForFunction(() => window.__ready !== null, null, {timeout: LIMIT + 15000, polling: 100}).catch(() => {});
      const atReady = await page.evaluate(drawn);
      if (which === 'late') {
        await page.waitForFunction(() => document.getElementById('t')?.matches(':defined'), null, {timeout: LATE + 10000, polling: 100}).catch(() => {});
      } else {
        await page.waitForTimeout(which === 'hang' ? 1500 : 500);
      }
      const after = await page.evaluate(drawn);
      const warnings = messages.filter((text) => /not loaded within/u.test(text));
      const others = messages.filter((text) => !/not loaded within/u.test(text));
      const row = {case: which, load, readyMs: atReady.ready, wallMs: Date.now() - started, atReady, after,
        requests: served.length, warnings, others};
      results.push(row);
      check(which, load, atReady.ready !== null, 'sf-loader-ready never came');
      check(which, load, after.button && after.icon, 'sf-button or sf-icon not drawn');
      check(which, load, others.length === 0, `console: ${others.join(' | ')}`);
      if (which === 'healthy') {
        check(which, load, after.tag && warnings.length === 0, 'sf-tag not drawn, or a time-limit warning');
      } else {
        check(which, load, warnings.length === 1, `${warnings.length} time-limit warnings, want 1`);
        check(which, load, atReady.ready >= LIMIT - 200, `ready at ${atReady.ready} ms, before the limit`);
        check(which, load, atReady.tagVisible === 'visible', 'sf-tag still held after the limit');
        check(which, load, served.length === 1 && after.tagScripts === 1, `sf-tag script asked for ${served.length} times, ${after.tagScripts} elements`);
      }
      if (which === 'hang') check(which, load, !after.tag && after.failed?.includes('sf-tag'), 'sf-tag not counted as failed');
      if (which === 'late') {
        check(which, load, atReady.ready < LATE, `ready at ${atReady.ready} ms waited for the late script`);
        check(which, load, after.tag && after.tagText.includes('Метка'), 'the late sf-tag was not drawn');
        check(which, load, !after.failed?.includes('sf-tag'), 'the late sf-tag is still counted as failed');
      }
      await context.close();
    }
  }
  mode = 'healthy';
  for (const when of ['at-once', 'after-load', 'defined', 'after-load-slow-relation']) {
    slowRelation = when === 'after-load-slow-relation';
    for (let load = 0; load < LOADS; load += 1) {
      const {context, page, messages} = await open(`/record-${slowRelation ? 'after-load' : when}.html`);
      await page.waitForFunction(() => window.__ready !== null && document.querySelector('#close')?.matches(':defined'), null, {timeout: 30000, polling: 100}).catch(() => {});
      // Chrome reports an unused preload 3 s after the load event.
      await page.waitForFunction(() => document.readyState === 'complete', null, {timeout: 20000}).catch(() => {});
      await page.waitForTimeout(4500);
      const state = await page.evaluate(() => ({
        ready: window.__ready,
        close: Boolean(document.querySelector('#close')?.matches(':defined')),
        loadEvent: Math.round(performance.getEntriesByType('navigation')[0]?.loadEventStart ?? -1),
        // Each preload, and how long after it the script it announced went in.
        preloads: window.__inserted.filter(([kind]) => kind === 'preload').map(([, url, at]) => {
          const used = window.__inserted.find(([kind, src]) => kind === 'script' && src === url);
          return {url, at, usedAt: used ? used[2] : null};
        }),
      }));
      results.push({case: `record-${when}`, load, ...state, messages});
      check(`record-${when}`, load, state.ready !== null && state.close, 'not ready, or the edge button not drawn');
      check(`record-${when}`, load, messages.length === 0, `console: ${messages.join(' | ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({cpu: CPU, limitMs: LIMIT, lateMs: LATE, results, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}
