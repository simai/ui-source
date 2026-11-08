#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An sf-icon drawn by a control the drawer moves -- the close button a record
// window puts beside its panel (slot="edge"), the row icons of a docked
// drawer's content -- must draw on every load, however the move and the
// icon's first render interleave (simai/ui-source#56: a static icon in a
// docked drawer; then the record window's edge Close button on the ui-doc
// property-view showcase, upgraded and connected with an empty innerHTML).
// A race, so every case runs in many fresh contexts, as a page that builds the
// window at once, a little later, or opens it after building it closed, and
// wants every icon drawn every time -- and an icon whose host was emptied
// after it drew draws again when it is put back.
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

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
// The record window as sf-view-properties builds it: one template, the drawer
// and its children created together, the close control asking for the edge.
const WINDOW = `<sf-drawer id="w" placement="inline-end" modal="true" overlay="true" show-close="false" close-on-esc="false" label="Запись" OPEN>
  <div class="flex flex-col gap-1/2" slot="edge" aria-label="Закрыть">
    <sf-button-icon id="close" appearance="tonal" scheme="on-surface" size="1" icon="close" aria-label="Закрыть" title="Закрыть"></sf-button-icon>
    <sf-button-icon id="copy" appearance="tonal" scheme="on-surface" size="1" icon="link" aria-label="Ссылка"></sf-button-icon>
  </div>
  <div><sf-icon id="row" icon="tune" size="1"></sf-icon> Параметры</div>
</sf-drawer>`;
// The Loader loads a component when it meets its tag in the page; a seed of
// each tag makes them defined before the window is built, as on a page that
// already shows them.
// (The Loader passes over a [hidden] subtree, so the seed is only out of view.)
const SEED = '<div style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)"><sf-drawer id="seed" modal="false"></sf-drawer><sf-button-icon icon="add" aria-label="seed"></sf-button-icon><sf-icon icon="add"></sf-icon></div>';
const pageOf = (script, seed = '') => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body><main>page</main>${seed}
<template id="window">${WINDOW}</template>
<script>${script}</script></body></html>`;
const build = (open) => `const node = document.importNode(document.getElementById('window').content, true);
  ${open ? `node.querySelector('sf-drawer').setAttribute('open', '');` : ''}
  document.body.append(node);`;
const pages = {
  // Built while the page parses, before any component is defined.
  '/at-once.html': pageOf(build(true)),
  // Built when the page has loaded: the Loader meets the tags in the window.
  '/after-load.html': pageOf(`addEventListener('load', () => { ${build(true)} });`),
  // Built once the components are defined, as a host's render does.
  '/defined.html': pageOf(`const ready = () => Promise.all(['sf-drawer', 'sf-button-icon', 'sf-icon'].map((tag) => customElements.whenDefined(tag)));
    ready().then(() => { ${build(true)} });`, SEED),
  // Built at the next frame after the components are defined.
  '/later.html': pageOf(`customElements.whenDefined('sf-drawer').then(() => requestAnimationFrame(() => { ${build(true)} }));`, SEED),
  // Built closed, then opened: a record opened in a window built before it.
  '/open-later.html': pageOf(`customElements.whenDefined('sf-drawer').then(() => {
    ${build(false)}
    setTimeout(() => document.getElementById('w').open(), 30);
  });`, SEED),
};
for (const path of Object.keys(pages)) pages[path] = pages[path].replace(' OPEN>', '>');

const serve = () => createServer(async (request, response) => {
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
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

const LOADS = Number(process.env.SF_PROBE_LOADS || 10);
const failures = [];
const counts = {};
const server = serve();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const path of Object.keys(pages)) {
    counts[path] = {loads: LOADS, drawn: 0};
    for (let load = 0; load < LOADS; load += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(`${base}${path}`);
      await page.waitForFunction(() => document.getElementById('w')?.openState === true
        && document.querySelector('[data-sf-drawer-edge] #close'), null, {timeout: 10000}).catch(() => {});
      await page.waitForTimeout(1200);
      const result = await page.evaluate(() => {
        const read = (selector) => {
          const icon = document.querySelector(selector);
          return {drawn: Boolean(icon?.querySelector(':scope i.sf-icon, :scope > .sf-badge-anchor > i.sf-icon')),
            upgraded: icon?.constructor === customElements.get('sf-icon'), connected: Boolean(icon?.isConnected),
            onEdge: Boolean(icon?.closest('[data-sf-drawer-edge]')), inPortal: Boolean(icon?.closest('[data-sf-drawer-portal]'))};
        };
        return {close: read('#close sf-icon'), copy: read('#copy sf-icon'), row: read('#row')};
      });
      const drawn = Object.values(result).every((icon) => icon.drawn && icon.upgraded && icon.connected && icon.inPortal)
        && result.close.onEdge && result.copy.onEdge;
      if (drawn && !errors.length) counts[path].drawn += 1;
      else failures.push({path, load, result, errors});
      // An icon whose host was emptied after it drew draws again when it is
      // put back (ui-mail replaced such icons with fresh copies).
      if (drawn) {
        const healed = await page.evaluate(async () => {
          const icon = document.querySelector('#close sf-icon');
          const parent = icon.parentNode;
          const next = icon.nextSibling;
          icon.replaceChildren();
          icon.remove();
          parent.insertBefore(icon, next);
          await new Promise((done) => setTimeout(done, 400));
          return Boolean(icon.querySelector(':scope > i.sf-icon'));
        });
        if (!healed) failures.push({path, load, case: 'an emptied icon put back draws again'});
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({counts, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} load(s) left an icon undrawn`);
  process.exit(1);
}
