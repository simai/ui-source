#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Region navigation (simai.interface-fragment 1.0.0; Larena handoff and the
// exact contract Larena Backend answers, 2026-10-15), on the built core:
//   1. a link swaps the content region, not the page: the address, the title,
//      the heading and focus on it, the shell untouched;
//   2. assets come once: those named in the answer and the <link>/<script src>
//      inside the region html; one already on the page is not asked for;
//   3. the elements that leave are disconnected and release their listeners;
//   4. Back and Forward swap the region back, and Back brings the scroll back;
//   5. a full load instead, whenever the shell revision differs, the answer is
//      a redirect (sign-in), or the link asks for one.
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
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error('core.js not found');

const SHELL = 'shell-r1';
const filler = Array.from({length: 80}, (_, i) => `<p>Строка ${i}</p>`).join('');
const regions = {
  '/admin/a': {title: 'Страница A', html: `<nav class="path">Админка / A</nav><h1>Страница A</h1>${filler}`, assets: [{key: 'shared', href: '/assets/shared.css', kind: 'css'}]},
  '/admin/b': {title: 'Страница B', html: `<link rel="stylesheet" href="/assets/b.css"><nav class="path">Админка / B</nav><h1>Страница B</h1><probe-leaver></probe-leaver><script defer src="/assets/b.js"></script>${filler}`, assets: [{key: 'shared', href: '/assets/shared.css', kind: 'css'}]},
  '/admin/c': {title: 'Страница C', html: '<nav class="path">Админка / C</nav><h1>Страница C</h1>', assets: [{key: 'shared', href: '/assets/shared.css', kind: 'css'}]},
  '/admin/x': {title: 'Страница X', html: '<h1>Страница X</h1>', assets: [], shell: 'shell-r2'},
};
const page = (path) => {
  const region = regions[path] ?? {title: 'Вход', html: '<h1>Вход</h1>'};
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${region.title}</title>
<meta name="test-shell-revision" content="${region.shell ?? SHELL}">
<link rel="stylesheet" href="/assets/shared.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'region-nav', pluginListVersion: 'region-nav', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
</head><body>
<header id="shell" style="position:fixed;inset-block-start:0;inset-inline:0;background:#fff;z-index:1"><a href="/admin/a">A</a> <a href="/admin/b">B</a> <a href="/admin/c">C</a> <a href="/admin/x">X</a> <a href="/admin/r">R</a> <a href="/admin/c" data-full-load id="full">C full</a> <a href="https://other.example/admin/a" id="other">other</a></header>
<main id="content"><!--larena-region:content-->${region.html}<!--/larena-region:content--></main>
<script src="/distr/core/js/core.js"></script></body></html>`;
};
const files = {
  '/assets/shared.css': ['text/css', 'body{margin:0;padding-top:40px} main{min-block-size:200px}'],
  '/assets/b.css': ['text/css', 'probe-leaver{display:block}'],
  '/assets/b.js': ['text/javascript', `window.__bLoads = (window.__bLoads || 0) + 1;
    if (!customElements.get('probe-leaver')) customElements.define('probe-leaver', class extends HTMLElement {
      connectedCallback() { this.listener = () => {}; window.addEventListener('resize', this.listener); window.__live = (window.__live || 0) + 1; }
      disconnectedCallback() { window.removeEventListener('resize', this.listener); window.__live -= 1; }
    });`],
};

const hits = new Map();
const hit = (key) => hits.set(key, (hits.get(key) ?? 0) + 1);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const region = request.headers['x-test-region'];
  if (path.startsWith('/admin/')) {
    hit(`${region ? 'region' : 'page'}:${path}`);
    if (path === '/admin/r') {
      response.writeHead(302, {location: '/login'});
      return response.end();
    }
    if (region === 'content' && regions[path]) {
      const answer = regions[path];
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', vary: 'X-Test-Region', 'cache-control': 'no-store'});
      return response.end(JSON.stringify({region: 'content', html: answer.html, title: answer.title, assets: answer.assets, shell_revision: answer.shell ?? SHELL, url: path}));
    }
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path));
  }
  if (path === '/login') {
    hit('page:/login');
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end('<!doctype html><html><head><meta charset="utf-8"><title>Вход</title></head><body><h1>Вход</h1></body></html>');
  }
  if (files[path]) {
    hit(path);
    response.writeHead(200, {'content-type': `${files[path][0]}; charset=utf-8`});
    return response.end(files[path][1]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/javascript';
    response.writeHead(200, {'content-type': `${type}; charset=utf-8`});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 900, height: 600}});
  await tab.goto(`${base}/admin/a`);
  await tab.waitForFunction(() => window.SF?.RegionNavigation, null, {timeout: 10000});
  const enable = () => tab.evaluate(() => {
    window.__marker = 'same document';
    window.SF.RegionNavigation.enable({root: '#content', header: 'X-Test-Region', revisionMeta: 'test-shell-revision', scope: '/admin'});
  });
  await enable();
  const look = () => tab.evaluate(() => ({
    path: location.pathname, title: document.title, marker: window.__marker ?? null,
    heading: document.querySelector('#content h1')?.textContent ?? null,
    focused: document.activeElement?.tagName === 'H1' ? document.activeElement.textContent : null,
    shell: Boolean(document.getElementById('shell')), scroll: Math.round(window.scrollY),
    live: window.__live ?? 0, bLoads: window.__bLoads ?? 0,
    path_line: document.querySelector('#content .path')?.textContent ?? null,
  }));
  const settle = () => tab.waitForTimeout(400);

  // 1-2. To B from a scrolled A.
  await tab.evaluate(() => window.scrollTo(0, 300));
  await tab.click('#shell a[href="/admin/b"]');
  await settle();
  const atB = await look();
  if (atB.marker !== 'same document' || atB.path !== '/admin/b' || atB.title !== 'Страница B' || atB.heading !== 'Страница B' || atB.path_line !== 'Админка / B') note({case: 'a link swaps the region, not the page', got: atB});
  if (atB.focused !== 'Страница B') note({case: 'focus goes to the new heading', got: atB});
  if (atB.scroll !== 0) note({case: 'a new page starts at the top', got: atB});
  if (atB.live !== 1 || atB.bLoads !== 1) note({case: 'the region\'s own script runs and its element upgrades', got: atB});

  // 3. To C: what B placed leaves and lets go.
  await tab.click('#shell a[href="/admin/c"]');
  await settle();
  const atC = await look();
  if (atC.live !== 0 || atC.path !== '/admin/c') note({case: 'the elements that leave release their listeners', got: atC});

  // 4. Back to B, back to A with its scroll, forward to B.
  await tab.goBack();
  await settle();
  const backB = await look();
  await tab.goBack();
  await settle();
  const backA = await look();
  await tab.goForward();
  await settle();
  const forwardB = await look();
  if (backB.path !== '/admin/b' || backB.heading !== 'Страница B' || backB.marker !== 'same document') note({case: 'Back swaps the region back', got: backB});
  if (backA.path !== '/admin/a' || backA.heading !== 'Страница A' || backA.scroll !== 300) note({case: 'Back brings the scroll back', got: backA});
  if (forwardB.path !== '/admin/b' || forwardB.heading !== 'Страница B' || forwardB.bLoads !== 1) note({case: 'Forward swaps it again, its script not loaded twice', got: forwardB});
  const once = {shared: hits.get('/assets/shared.css'), bCss: hits.get('/assets/b.css'), bJs: hits.get('/assets/b.js')};
  if (once.shared !== 1 || once.bCss !== 1 || once.bJs !== 1) note({case: 'every asset is asked for once', got: once});

  // 5. Full loads.
  await tab.click('#shell a[href="/admin/x"]');
  await tab.waitForLoadState('load');
  await settle();
  const atX = await look();
  if (atX.marker !== null || atX.path !== '/admin/x' || hits.get('page:/admin/x') !== 1) note({case: 'another shell revision loads the page in full', got: {atX, page: hits.get('page:/admin/x')}});

  await tab.goto(`${base}/admin/a`);
  await tab.waitForFunction(() => window.SF?.RegionNavigation, null, {timeout: 10000});
  await enable();
  await tab.click('#shell a[href="/admin/r"]');
  await tab.waitForLoadState('load');
  await settle();
  const atR = await look();
  if (atR.path !== '/login' || atR.marker !== null) note({case: 'a redirect (sign-in) is followed by a full load', got: atR});

  await tab.goto(`${base}/admin/a`);
  await tab.waitForFunction(() => window.SF?.RegionNavigation, null, {timeout: 10000});
  await enable();
  const regionHitsBefore = hits.get('region:/admin/c') ?? 0;
  await tab.click('#full');
  await tab.waitForLoadState('load');
  await settle();
  const full = await look();
  if (full.marker !== null || full.path !== '/admin/c' || (hits.get('region:/admin/c') ?? 0) !== regionHitsBefore) note({case: 'data-full-load is a full load', got: full});
  console.log(JSON.stringify({atB, atC, backB, backA, forwardB, once, atX, atR, full}));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('REGION_NAVIGATION_OK');
