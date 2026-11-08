#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A static sf-icon inside a docked sf-drawer must draw on every load, also
// when the page is slow (simai/ui-source#56; the property-view drawer edge on
// the ui-doc showcase). drawer-static-icon loads the page at full speed; the
// race lives in timing, so this one makes the timing hostile: the CPU slowed
// (CDP Emulation.setCPUThrottlingRate), every asset delayed by a different
// random amount (so the scripts, the component bundles and the sheets arrive
// in a different order each load), and many fresh contexts. Every icon -- one
// outside, one in the drawer's content, one in a list item of the content,
// one in a button-icon on the drawer's edge -- must draw every time, in a
// docked drawer open from the start, one opened after load, and a record
// window (a modal panel with its edge controls) at 1050px, and every sf-*
// tag on the page must be defined.
//
// SF_PROBE_LOADS (default 24) loads per page; SF_PROBE_CPU (default 4) the
// CPU slow-down; SF_PROBE_DELAY (default 120) the largest asset delay in ms;
// SF_PROBE_SETTLE (default 20000) how long a load may take to draw everything;
// SF_PROBE_HEADED=1 runs a headed browser (real frames instead of headless
// ones: Smart definitions are batched per animation frame); SF_PROBE_CHANNEL
// picks an installed browser (chrome) when the headed build is not there.
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

const LOADS = Number(process.env.SF_PROBE_LOADS || 24);
const CPU = Number(process.env.SF_PROBE_CPU || 4);
const DELAY = Number(process.env.SF_PROBE_DELAY || 120);
const SETTLE = Number(process.env.SF_PROBE_SETTLE || 20000);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body) => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    if (DELAY > 0) await wait(Math.floor(Math.random() * DELAY));
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

// The ids are read by selector: a list item draws its start slot anew, so the
// icon there is found by where it stands, not by the id the page gave it.
const targets = {outside: '#outside', inside: '#inside', nested: 'sf-list-item sf-icon', edge: '#edge'};
const ids = [...Object.keys(targets), 'all'];
const drawer = (attributes) => `<sf-icon id="outside" icon="tune" size="2"></sf-icon>
  <main style="display:flex">
    <sf-drawer id="d" side="left" docked ${attributes} size="1/2">
      <sf-button-icon id="edge" slot="edge" icon="close" label="Close"></sf-button-icon>
      <div><sf-icon id="inside" icon="tune" size="2"></sf-icon> text</div>
      <sf-list><sf-list-item><sf-icon slot="leading" icon="settings"></sf-icon>Row</sf-list-item></sf-list>
    </sf-drawer>
    <div>canvas</div>
  </main>`;
// The record window as sf-view-properties builds it (the property-view
// showcase in the docs, seen blank at 1050px): a modal panel at the inline
// end, its Close and Link buttons asking for the edge beside it.
const record = `<sf-icon id="outside" icon="tune" size="2"></sf-icon>
  <sf-drawer id="d" placement="inline-end" modal="true" overlay="true" show-close="false" label="Запись" open>
    <div class="flex flex-col gap-1/2" slot="edge" aria-label="Закрыть">
      <sf-button-icon id="edge" appearance="tonal" scheme="on-surface" size="1" icon="close" aria-label="Закрыть"></sf-button-icon>
      <sf-button-icon appearance="tonal" scheme="on-surface" size="1" icon="link" aria-label="Ссылка"></sf-button-icon>
    </div>
    <div><sf-icon id="inside" icon="tune" size="1"></sf-icon> Параметры</div>
    <sf-list><sf-list-item><sf-icon slot="leading" icon="settings"></sf-icon>Row</sf-list-item></sf-list>
  </sf-drawer>`;
const pages = {
  '/static.html': pageOf(drawer('open')),
  '/record.html': pageOf(record),
  '/opened.html': pageOf(`${drawer('')}<script>addEventListener('DOMContentLoaded', () => customElements.whenDefined('sf-drawer').then(() => { document.getElementById('d').setAttribute('open', ''); }));</script>`),
};

const failures = [];
const counts = {};
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: !process.env.SF_PROBE_HEADED, channel: process.env.SF_PROBE_CHANNEL || undefined});
try {
  for (const path of Object.keys(pages)) {
    counts[path] = {loads: LOADS, drawn: Object.fromEntries(ids.map((id) => [id, 0]))};
    for (let load = 0; load < LOADS; load += 1) {
      const context = await browser.newContext({viewport: {width: 1050, height: 800}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      const cdp = await context.newCDPSession(page);
      if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', {rate: CPU});
      await page.goto(`${base}${path}`);
      await page.waitForFunction(() => customElements.get('sf-icon') && customElements.get('sf-drawer'), null, {timeout: 20000});
      // Settled: no icon drawn for a while, or the time is up.
      await page.waitForFunction(() => [...document.querySelectorAll('*')].every((node) => !node.localName.startsWith('sf-') || customElements.get(node.localName))
        && [...document.querySelectorAll('sf-icon')].every((icon) => icon.querySelector('i.sf-icon')), null, {timeout: SETTLE}).catch(() => {});
      await page.waitForTimeout(300);
      const result = await page.evaluate((selectors) => {
        const read = (element) => ({
          drawn: Boolean(element?.querySelector('i.sf-icon')),
          found: Boolean(element),
          upgraded: Boolean(element) && element.constructor === customElements.get(element.localName),
          rendered: element?.isRendered === true,
          html: (element?.innerHTML ?? '').length,
          inPortal: Boolean(element?.closest('[data-sf-drawer-portal]')),
        });
        const icons = [...document.querySelectorAll('sf-icon')];
        const blank = icons.filter((icon) => !icon.querySelector('i.sf-icon')).map((icon) => icon.parentElement?.localName);
        const undefinedTags = [...new Set([...document.querySelectorAll('*')].map((node) => node.localName)
          .filter((tag) => tag.startsWith('sf-') && !customElements.get(tag)))];
        return {...Object.fromEntries(Object.entries(selectors).map(([id, selector]) => [id, read(document.querySelector(selector))])),
          all: {drawn: !blank.length && !undefinedTags.length, icons: icons.length, blank, undefinedTags}};
      }, targets);
      for (const id of ids) if (result[id].drawn) counts[path].drawn[id] += 1;
      const undrawn = ids.filter((id) => !result[id].drawn);
      if (undrawn.length) failures.push({path, load, undrawn, result, errors});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const brief = failures.map(({path, load, undrawn, result, errors}) => ({path, load, errors,
  undrawn: Object.fromEntries(undrawn.map((id) => [id, result[id]]))}));
console.log(JSON.stringify({cpu: CPU, delay: DELAY, counts, failed: failures.length}, null, 2));
for (const entry of brief) console.log(JSON.stringify(entry));
if (failures.length) {
  console.error(`${failures.length} load(s) left an icon undrawn`);
  process.exit(1);
}
