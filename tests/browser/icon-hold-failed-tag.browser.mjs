#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// D2 (acceptance of pair ui-a0370c0c99fb): the page's first icon request
// waits for the Smart tags the Loader asked for (holdFirstIconRequest, up to
// an 8 s cap). A tag whose module failed to load was waited for until the
// cap: with sf-tag's script aborted the Loader said «Failed to load script»
// at 0.23 s and the first icon request left at 8.20 s (0.21 s on the pair
// before). The wait ends when every awaited tag is defined or has failed.
//
// Through the real Loader against a subset service served here. The page
// holds sf-button (search), sf-button-icon (more_vert) and sf-tag (label).
//   aborted  -- smart/tag/js/tag*.js answer 404 (both forms): the first
//               /ms/css request leaves within 300 ms of the failure, and the
//               button icons draw;
//   delay-3  -- tag*.js held 3 s: one request, with label, at about 3.3 s;
//   delay-12 -- tag*.js held 12 s: the first request at the 8 s cap, then
//               label in a second request once the tag arrives.
// Three loads each. No page error; the only console error allowed is the
// aborted script's own.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const fontFile = join(out, 'component', 'component', 'icons', 'fonts', 'MaterialSymbols-Outlined.woff2');
if (!existsSync(fontFile)) throw new Error(`asset not found: ${fontFile}`);

const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>failed tag</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'icon-hold-failed-tag', pluginListVersion: 'icon-hold-failed-tag',
    preloader: {enabled: false}, icons: {subsetHost: location.origin + '/subset'}, smart: {base: true}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
</head><body><main><sf-button text="Найти" icon-start="search"></sf-button>
<sf-button-icon icon="more_vert" aria-label="Ещё"></sf-button-icon>
<sf-tag kind="icon" icon="label" text="Метка"></sf-tag></main></body></html>`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let variant = 'aborted';
let started = 0;
let requests = [];
let failedAt = null;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page);
  }
  if (path === '/subset/ms/css') {
    const icons = String(url.searchParams.get('icon_names') || '').split(',').filter(Boolean).sort();
    requests.push({ms: Date.now() - started, icons});
    const fontUrl = `/subset/ms/font/f.woff2`;
    response.writeHead(200, {'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(`@font-face { font-family: 'Material Symbols Outlined Subset'; src: url('${fontUrl}') format('woff2'); font-weight: 400; font-display: block; }
.sf-icon { font-family: 'Material Symbols Outlined Subset'; font-feature-settings: 'liga'; }`);
  }
  if (path === '/subset/ms/font/f.woff2') {
    response.writeHead(200, {'content-type': 'font/woff2'});
    return response.end(await readFile(fontFile));
  }
  if (/^\/distr\/smart\/tag\/js\/tag(\.min)?\.js$/u.test(path)) {
    if (variant === 'aborted') {
      failedAt = Date.now() - started;
      response.writeHead(404);
      return response.end();
    }
    await sleep(variant === 'delay-3' ? 3000 : 12000);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    if (response.destroyed) return undefined;
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const name of ['aborted', 'delay-3', 'delay-12']) {
    for (let load = 1; load <= LOADS; load += 1) {
      const label = `${name} load ${load}`;
      variant = name;
      requests = [];
      failedAt = null;
      const context = await browser.newContext({viewport: {width: 600, height: 200}});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
      tab.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        // The aborted script's own failure (the 404 resource, the Loader's warning).
        if (name === 'aborted' && /404|tag(\.min)?\.js/.test(text)) return;
        errors.push(text);
      });
      started = Date.now();
      await tab.goto(`${base}/page`);
      const wait = name === 'delay-12' ? 14000 : name === 'delay-3' ? 6000 : 10000;
      const until = Date.now() + wait;
      while (Date.now() < until) {
        if (name === 'aborted' && requests.length) break;
        if (name === 'delay-3' && requests.length && Date.now() - started > 4500) break;
        if (name === 'delay-12' && requests.length >= 2) break;
        await sleep(25);
      }
      await sleep(300);
      const first = requests[0];
      seen[label] = {failedAt, requests: requests.map((one) => `${one.ms} ms ${one.icons.join(',')}`)};
      if (!first) failures.push(`${label}: no icon request`);
      else if (name === 'aborted') {
        if (failedAt === null) failures.push(`${label}: the tag's script was never asked for`);
        else if (first.ms - failedAt > 300) failures.push(`${label}: the first icon request left ${first.ms - failedAt} ms after the tag failed (at ${first.ms} ms), limit 300 ms`);
        if (!['search', 'more_vert'].every((icon) => first.icons.includes(icon))) failures.push(`${label}: the first request lacks the button icons (${first.icons})`);
        const drawn = await tab.evaluate(() => [...document.querySelectorAll('sf-button sf-icon, sf-button-icon sf-icon')].every((icon) => icon.loaded === true));
        if (!drawn) failures.push(`${label}: the button icons are not drawn`);
      } else if (name === 'delay-3') {
        if (requests.length !== 1) failures.push(`${label}: ${requests.length} icon requests, not one`);
        if (first.ms < 2900 || first.ms > 4500) failures.push(`${label}: the request left at ${first.ms} ms, expected about 3.3 s`);
        if (!first.icons.includes('label')) failures.push(`${label}: the request lacks the tag's label`);
      } else {
        if (first.ms < 7500 || first.ms > 9500) failures.push(`${label}: the first request left at ${first.ms} ms, expected the 8 s cap`);
        if (first.icons.includes('label')) failures.push(`${label}: label in the first request before the tag arrived`);
        if (!requests[1]?.icons.includes('label')) failures.push(`${label}: label never reached a second request`);
      }
      if (errors.length) failures.push(`${label}: console ${JSON.stringify(errors)}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 1));
if (failures.length) process.exit(1);
console.log('ICON_HOLD_FAILED_TAG_OK');
