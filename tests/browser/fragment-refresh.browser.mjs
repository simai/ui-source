#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Block refresh (simai.interface-fragment 1.1.0, refreshable-block and
// block-refresh; contract 1 agreed with Larena 2026-11-23), on the built core,
// with real clicks. The page holds three real blocks beside region
// navigation: a data block whose parts are sf-tile-metric (period, scale),
// an html block with its own stylesheet, script and element (events_page),
// and a data block that reads period (linked). Checked at 1440 and 390,
// light and dark, three cold loads each:
//   F1  a period link: no navigation, one request with the three headers;
//   F2  the address takes the new keys, other keys kept, scroll unchanged;
//   F3  Back / Forward redraw the block, no request for a block whose keys did not change;
//   F4  a replace control keeps the history length;
//   F5  five rapid clicks: one drawn answer, the last;
//   F6  a slow answer shows the skeleton in the block only and keeps its height; a fast one shows none;
//   F7  500, timeout and network down: the error state in the block, the retry recovers;
//   F8  403, 404, redirect, missing header, other id, contract 2, unknown part, bad JSON, other port major, wrong type: full load;
//   F9  two blocks owning one key: both plain, one console error;
//   F10 html answers bring their assets once;
//   F11 a block removed by a region swap mid-request: the answer is dropped, its element released;
//   F12 linked blocks: the reader refreshes with its own request, the address written once;
//   F13 JavaScript off: a block link is a full-page link with the right keys;
//   F14 a product's own history entries are left alone by both runtimes.
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
const LOADS = Number(process.env.LOADS || 3);
const VIEWS = [{width: 1440, height: 900, scheme: 'light'}, {width: 1440, height: 900, scheme: 'dark'}, {width: 390, height: 844, scheme: 'light'}, {width: 390, height: 844, scheme: 'dark'}];

const SHELL = 'shell-r1';
const number = {'24h': 120, '7d': 840, '30d': 3600};
const esc = (value) => String(value).replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
const query = (keys) => `?${new URLSearchParams(keys)}`;
const stateOf = (url) => ({site: url.searchParams.get('site') ?? 's1', period: url.searchParams.get('period') ?? '24h', scale: url.searchParams.get('scale') ?? 'linear', events_page: url.searchParams.get('events_page') ?? '1'});
const loadValue = (period) => number[period] ?? 7;

function loadBlock(keys) {
  const link = (patch, text, id) => `<a id="${id}" href="${esc(query({...keys, ...patch}))}#env-charts">${text}</a>`;
  const island = JSON.stringify({parts: {requests: {value: loadValue(keys.period)}, errors: {value: keys.scale === 'log' ? 2 : 1}}, keys: {period: keys.period, scale: keys.scale}});
  return `<section id="load" data-sf-fragment="env.load-history" data-sf-fragment-keys="period scale" data-sf-fragment-mode="data" data-sf-fragment-contract="1" data-sf-fragment-port="test.env-history@1" aria-labelledby="env-charts">
<h2 id="env-charts">История нагрузки</h2>
<nav aria-label="Период" id="periods">${link({period: '24h'}, 'Сутки', 'p24h')} ${link({period: '7d'}, 'Неделя', 'p7d')} ${link({period: '30d'}, 'Месяц', 'p30d')}</nav>
<nav aria-label="Масштаб" data-sf-fragment-history="replace">${link({scale: 'linear'}, 'Линейный', 'slin')} ${link({scale: 'log'}, 'Логарифмический', 'slog')}</nav>
<nav aria-label="Пробы" id="faults"></nav>
<sf-tile-metric data-sf-fragment-part="requests" label="Запросы" style="display:block;min-block-size:96px"></sf-tile-metric>
<sf-tile-metric data-sf-fragment-part="errors" label="Ошибки" style="display:block;min-block-size:96px"></sf-tile-metric>
<script type="application/json" data-sf-fragment-data>${island}</script>
</section>`;
}

function eventsBlock(keys) {
  const page = Number(keys.events_page) || 1;
  return `<section id="events" data-sf-fragment="env.recent-events" data-sf-fragment-keys="events_page" data-sf-fragment-mode="html" data-sf-fragment-contract="1">
<link rel="stylesheet" href="/assets/events.css">
<h2>События, страница ${page}</h2>
<ul>${Array.from({length: 3}, (_, i) => `<li>Событие ${(page - 1) * 3 + i + 1}</li>`).join('')}</ul>
<probe-leaver></probe-leaver>
<nav aria-label="Страницы"><a id="next" href="${esc(query({...keys, events_page: page + 1}))}">Дальше</a></nav>
<script src="/assets/events.js"></script>
</section>`;
}

function counterBlock(keys) {
  return `<section id="counter" data-sf-fragment="env.counter" data-sf-fragment-reads="period" data-sf-fragment-mode="data" data-sf-fragment-contract="1">
<sf-tile-metric data-sf-fragment-part="count" label="Новых"></sf-tile-metric>
<script type="application/json" data-sf-fragment-data>${JSON.stringify({parts: {count: {value: loadValue(keys.period) / 10}}})}</script>
</section>`;
}

const filler = Array.from({length: 40}, (_, i) => `<p>Строка ${i}</p>`).join('');
const page = (url, js = true) => {
  const keys = stateOf(url);
  const conflict = url.pathname === '/admin/conflict';
  const content = conflict
    ? `<h1>Конфликт</h1><section id="qa" data-sf-fragment="t.qa" data-sf-fragment-keys="q" data-sf-fragment-mode="html"><a id="qa-link" href="?q=a">A</a></section><section id="qb" data-sf-fragment="t.qb" data-sf-fragment-keys="q" data-sf-fragment-mode="html"><a id="qb-link" href="?q=b">B</a></section>`
    : url.pathname === '/admin/other'
      ? '<h1>Другая страница</h1>'
      : `<h1>Панель</h1>${loadBlock(keys)}${counterBlock(keys)}${eventsBlock(keys)}${filler}`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Панель</title>
<meta name="test-shell-revision" content="${SHELL}">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'fragment-refresh', pluginListVersion: 'fragment-refresh', preloader: {enabled: false}, icons: {enabled: false}};</script>
</head><body>
<header id="shell"><a id="to-other" href="/admin/other">Другая</a> <a id="to-env" href="/admin/env?site=s1">Панель</a></header>
<main id="content">${content}</main>
${js ? '<script src="/distr/core/js/core.js"></script>' : ''}</body></html>`;
};

const files = {
  '/assets/events.css': ['text/css', '#events li{color:inherit}'],
  '/assets/events.js': ['text/javascript', `window.__eventsLoads = (window.__eventsLoads || 0) + 1;
    if (!customElements.get('probe-leaver')) customElements.define('probe-leaver', class extends HTMLElement {
      connectedCallback() { this.listener = () => {}; window.addEventListener('resize', this.listener); window.__live = (window.__live || 0) + 1; }
      disconnectedCallback() { window.removeEventListener('resize', this.listener); window.__live -= 1; }
    });`],
};

const hits = new Map();
const hit = (key) => hits.set(key, (hits.get(key) ?? 0) + 1);
const requests = [];
const flaky = new Map();
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function confirming(id) {
  return {'x-simai-fragment': id, 'x-simai-fragment-contract': '1', vary: 'X-SIMAI-Fragment, X-SIMAI-Fragment-Mode', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff'};
}

async function answerData(request, response, url) {
  const id = request.headers['x-simai-fragment'];
  const keys = stateOf(url);
  const period = keys.period;
  const headers = {...confirming(id), 'content-type': 'application/json; charset=utf-8'};
  const delays = {slow: 450, fast: 40, r1: 260, r2: 220, r3: 180, r4: 140, r5: 100, gone: 600};
  if (delays[period]) await wait(delays[period]);
  if (period === 'hang') return; // never answers: the client's timeout
  if (period === 'down') return request.socket.destroy();
  if (period === 'e500' || (period === 'flaky' && !flaky.get(url.search))) {
    flaky.set(url.search, true);
    response.writeHead(500, {'content-type': 'text/plain'});
    return response.end('down');
  }
  if (period === 'e403' || period === 'e404') {
    response.writeHead(Number(period.slice(1)), {...headers});
    return response.end('{}');
  }
  if (period === 'redir') {
    response.writeHead(302, {location: '/login'});
    return response.end();
  }
  // The host may apply another period than asked (echo): it answers for what it applied.
  const applied = period === 'echo' ? '30d' : period;
  const parts = id === 'env.counter'
    ? {count: {value: loadValue(applied) / 10}}
    : {requests: {value: loadValue(applied)}, errors: {value: keys.scale === 'log' ? 2 : 1}};
  const body = {fragment: id, contract: 1, port: {standard: 'test.env-history', version: '1.4.0'}, state: period === 'none' ? 'no-access' : 'populated',
    url: `${url.pathname}${url.search}`, keys: {period, scale: keys.scale}, parts};
  if (id === 'env.counter') {
    delete body.port;
    delete body.keys;
  }
  if (period === 'echo') {
    body.url = `${url.pathname}${query({...keys, period: '30d'})}`;
    body.keys = {period: '30d', scale: keys.scale};
  }
  if (period === 'nohdr') delete headers['x-simai-fragment'];
  if (period === 'otherid') body.fragment = 'env.other';
  if (period === 'c2') headers['x-simai-fragment-contract'] = '2';
  if (period === 'part') body.parts.cpu = {value: 1};
  if (period === 'port2') body.port.version = '2.0.0';
  if (period === 'type') headers['content-type'] = 'text/html; charset=utf-8';
  response.writeHead(200, headers);
  response.end(period === 'badjson' ? '{"fragment":' : JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const fragment = request.headers['x-simai-fragment'];
  const region = request.headers['x-test-region'];
  if (path.startsWith('/admin/')) {
    if (fragment) {
      requests.push({id: fragment, mode: request.headers['x-simai-fragment-mode'], contract: request.headers['x-simai-fragment-contract'], accept: request.headers.accept, search: url.search});
      hit(`fragment:${fragment}`);
      if (request.headers['x-simai-fragment-mode'] === 'html') {
        if (url.searchParams.get('events_page') === 'slow') await wait(800);
        response.writeHead(200, {...confirming(fragment), 'content-type': 'text/html; charset=utf-8'});
        return response.end(eventsBlock(stateOf(url)));
      }
      return answerData(request, response, url);
    }
    if (region === 'content') {
      hit(`region:${path}`);
      const html = page(url).split('<main id="content">')[1].split('</main>')[0];
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      return response.end(JSON.stringify({region: 'content', html, title: 'Панель', assets: [], shell_revision: SHELL, url: `${path}${url.search}`}));
    }
    hit(`page:${path}${url.search}`);
    // The product's own page answer: a sign-in redirect where the block got one.
    if (url.searchParams.get('period') === 'redir') {
      response.writeHead(302, {location: '/login'});
      return response.end();
    }
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url));
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

let passed = 0;
const failures = [];
const check = (view, name, ok, got) => {
  if (ok) { passed += 1; console.log(`PASS ${view} ${name}`); }
  else { failures.push({view, name, got}); console.log(`FAIL ${view} ${name} ${JSON.stringify(got)}`); }
};

const browser = await chromium.launch({headless: true});
try {
  for (const view of VIEWS) {
    for (let load = 1; load <= LOADS; load += 1) {
      const label = `${view.width}-${view.scheme}-${load}`;
      const context = await browser.newContext({viewport: {width: view.width, height: view.height}, colorScheme: view.scheme});
      const tab = await context.newPage();
      const consoleErrors = [];
      tab.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      tab.on('pageerror', (error) => consoleErrors.push(`pageerror ${error.message}`));
      const fallbacks = [];
      await tab.exposeFunction('__fallback', (detail) => fallbacks.push(detail));
      hits.clear();
      requests.length = 0;
      flaky.clear();
      const open = async (address) => {
        await tab.goto(`${base}${address}`);
        await tab.waitForFunction(() => window.SF?.FragmentRefresh && window.SF?.RegionNavigation, null, {timeout: 15000});
        await tab.evaluate(() => {
          window.__marker = 'same document';
          window.__loads = [];
          document.addEventListener('sf-fragment-load', (event) => window.__loads.push(event.detail));
          document.addEventListener('sf-fragment-fallback', (event) => window.__fallback(event.detail));
          window.SF.RegionNavigation.enable({root: '#content', header: 'X-Test-Region', revisionMeta: 'test-shell-revision', scope: '/admin'});
          window.SF.FragmentRefresh.enable({scope: '/admin', timeoutMs: 1500, onFullLoad: (url, reason) => { window.__full = {url, reason}; location.assign(url); }});
        });
        if (!address.startsWith('/admin/env')) return;
        await tab.waitForFunction(() => customElements.get('sf-tile-metric') && document.querySelector('[data-sf-fragment-part="requests"]')?.value === 120, null, {timeout: 15000})
          .catch(async (error) => {
            console.log('DIAG', JSON.stringify(await tab.evaluate(() => ({defined: Boolean(customElements.get('sf-tile-metric')), value: document.querySelector('[data-sf-fragment-part="requests"]')?.value, has: 'value' in (document.querySelector('[data-sf-fragment-part="requests"]') ?? {}), sf: Object.keys(window.SF || {}).length}))), consoleErrors);
            throw error;
          });
      };
      const look = () => tab.evaluate(() => ({
        marker: window.__marker ?? null,
        navigations: performance.getEntriesByType('navigation').length,
        search: location.search, hash: location.hash, history: history.length, scroll: Math.round(scrollY),
        requests: document.querySelector('[data-sf-fragment-part="requests"]')?.value ?? null,
        errors: document.querySelector('[data-sf-fragment-part="errors"]')?.value ?? null,
        count: document.querySelector('[data-sf-fragment-part="count"]')?.value ?? null,
        current: [...document.querySelectorAll('#load a[aria-current="true"]')].map((link) => link.id),
        events: document.querySelector('#events h2')?.textContent ?? null,
        loads: window.__loads?.length ?? null,
        live: window.__live ?? 0, eventsLoads: window.__eventsLoads ?? 0,
        state: document.querySelector('#load')?.getAttribute('data-sf-fragment-state') ?? null,
        error: Boolean(document.querySelector('#load [data-sf-fragment-error]')),
      }));
      const addFault = (period) => tab.evaluate((value) => {
        const link = document.createElement('a');
        link.id = `f-${value}`;
        const url = new URL(location.href);
        url.searchParams.set('period', value);
        link.href = url.search;
        link.textContent = value;
        document.getElementById('faults').append(link, ' ');
      }, period);

      tab.setDefaultTimeout(8000);
      try {
      await open('/admin/env?site=s1');
      await tab.evaluate(() => window.scrollTo(0, 120));
      const start = await look();
      check(label, 'first data drawn from the island', start.requests === 120 && start.errors === 1 && start.count === 12, start);

      // F1, F2
      requests.length = 0;
      await tab.click('#p7d');
      await tab.waitForFunction(() => window.__loads.length >= 1);
      await tab.waitForTimeout(150);
      const atWeek = await look();
      const first = requests.find((entry) => entry.id === 'env.load-history');
      check(label, 'F1 no navigation, one request with the three headers', atWeek.marker === 'same document' && atWeek.navigations === 1
        && first?.mode === 'data' && first?.contract === '1' && /application\/json/u.test(first?.accept ?? '') && requests.filter((entry) => entry.id === 'env.load-history').length === 1, {atWeek, requests});
      const params = new URLSearchParams(atWeek.search);
      check(label, 'F2 keys: period 7d, site kept, scroll 120', params.get('period') === '7d' && params.get('site') === 's1' && atWeek.scroll === 120 && atWeek.requests === 840, atWeek);
      check(label, 'F2 aria-current moved', atWeek.current.includes('p7d') && !atWeek.current.includes('p24h'), atWeek.current);
      // F12 linked
      check(label, 'F12 the reader refreshed with its own request', atWeek.count === 84 && requests.filter((entry) => entry.id === 'env.counter').length === 1, {atWeek, requests});

      // F4 replace
      const before4 = await look();
      await tab.click('#slog');
      await tab.waitForFunction((n) => window.__loads.length > n, before4.loads);
      const after4 = await look();
      check(label, 'F4 a replace control keeps the history length', after4.history === before4.history && new URLSearchParams(after4.search).get('scale') === 'log' && after4.errors === 2, {before4, after4});

      // F3 Back / Forward
      await tab.click('#p30d');
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 3600);
      requests.length = 0;
      await tab.goBack();
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 840);
      await tab.waitForTimeout(200);
      const back = await look();
      const backRequests = [...requests];
      check(label, 'F3 Back redraws the block in the same document', back.marker === 'same document' && new URLSearchParams(back.search).get('period') === '7d' && back.requests === 840, back);
      check(label, 'F3 no request for the html block whose key did not change, none for the region', backRequests.every((entry) => entry.id !== 'env.recent-events') && !hits.has('region:/admin/env'), {backRequests, region: hits.get('region:/admin/env') ?? 0});
      await tab.goForward();
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 3600);
      check(label, 'F3 Forward again', (await look()).marker === 'same document', await look());

      // F10 html block, assets once
      await tab.click('#next');
      await tab.waitForFunction(() => document.querySelector('#events h2')?.textContent.includes('2'));
      await tab.waitForTimeout(100);
      await tab.click('#next');
      await tab.waitForFunction(() => document.querySelector('#events h2')?.textContent.includes('3'));
      await tab.waitForTimeout(150);
      const html = await look();
      check(label, 'F10 html block drawn, its assets asked once, the element that left released', html.events === 'События, страница 3' && hits.get('/assets/events.css') === 1 && hits.get('/assets/events.js') === 1 && html.live === 1 && html.eventsLoads === 1, {html, css: hits.get('/assets/events.css'), js: hits.get('/assets/events.js')});
      const focusKept = await tab.evaluate(() => document.activeElement?.id ?? null);
      check(label, 'F10 focus stays on the control used', focusKept === 'next', focusKept);
      const keptKeys = new URLSearchParams(html.search);
      check(label, 'F10 the other block keeps its keys', keptKeys.get('period') === '30d' && keptKeys.get('events_page') === '3', html.search);
      // A stale link of the data block (printed with events_page=1) is still the block's.
      requests.length = 0;
      await tab.click('#p24h');
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 120);
      const stale = await look();
      check(label, 'a link printed before another block refreshed is still its block\'s', stale.marker === 'same document' && new URLSearchParams(stale.search).get('events_page') === '3', stale);

      // F5 newest wins
      for (const period of ['r1', 'r2', 'r3', 'r4', 'r5']) await addFault(period);
      const before5 = await look();
      requests.length = 0;
      for (const period of ['r1', 'r2', 'r3', 'r4', 'r5']) await tab.click(`#f-${period}`);
      await tab.waitForFunction((n) => window.__loads.filter((entry) => entry.fragment === 'env.load-history').length > n, before5.loads === null ? 0 : (await tab.evaluate(() => window.__loads.filter((entry) => entry.fragment === 'env.load-history').length)));
      await tab.waitForTimeout(400);
      const after5 = await tab.evaluate(() => ({loads: window.__loads.filter((entry) => entry.fragment === 'env.load-history').map((entry) => new URL(entry.url).searchParams.get('period')), search: location.search}));
      const drawnNow = after5.loads.slice(-1)[0];
      const fiveLoads = after5.loads.length - (before5.loads ?? 0);
      check(label, 'F5 five rapid clicks: one drawn answer, the last', drawnNow === 'r5' && new URLSearchParams(after5.search).get('period') === 'r5' && requests.filter((entry) => entry.id === 'env.load-history').length === 5, {after5, fiveLoads, requests: requests.length});
      const loadsR = await tab.evaluate(() => window.__loads.filter((entry) => entry.fragment === 'env.load-history' && /period=r[1-4]/u.test(entry.url)).length);
      check(label, 'F5 no older answer drawn', loadsR === 0, loadsR);

      // F6 skeleton
      await tab.evaluate(() => {
        window.__seen = [];
        const block = document.getElementById('load');
        new MutationObserver(() => window.__seen.push({busy: block.getAttribute('aria-busy'), loading: block.getAttribute('data-sf-fragment-loading'), part: block.querySelector('[data-sf-fragment-part="requests"]')?.getAttribute('data-state') ?? null, height: Math.round(block.getBoundingClientRect().height)}))
          .observe(block, {attributes: true, subtree: true, attributeFilter: ['aria-busy', 'data-sf-fragment-loading', 'data-state']});
        window.__height = Math.round(block.getBoundingClientRect().height);
        window.__outside = document.querySelector('#events').getAttribute('aria-busy');
      });
      await addFault('fast');
      await tab.click('#f-fast');
      await tab.waitForFunction(() => new URL(location.href).searchParams.get('period') === 'fast');
      await tab.waitForTimeout(100);
      const fast = await tab.evaluate(() => window.__seen.filter((entry) => entry.loading));
      check(label, 'F6 a fast answer shows no skeleton', fast.length === 0, fast);
      await addFault('slow');
      await tab.click('#f-slow');
      await tab.waitForTimeout(300);
      const during = await tab.evaluate(() => ({busy: document.getElementById('load').getAttribute('aria-busy'), loading: document.getElementById('load').getAttribute('data-sf-fragment-loading'), part: document.querySelector('[data-sf-fragment-part="requests"]').getAttribute('data-state'), height: Math.round(document.getElementById('load').getBoundingClientRect().height), start: window.__height, outside: document.querySelector('#events').getAttribute('aria-busy'), counterBusy: document.getElementById('counter').getAttribute('aria-busy')}));
      check(label, 'F6 a slow answer: skeleton in the block, parts loading, height kept, nothing outside', during.busy === 'true' && during.loading === 'data' && during.part === 'loading' && Math.abs(during.height - during.start) <= 1 && during.outside === null && during.counterBusy === null, during);
      await tab.waitForFunction(() => new URL(location.href).searchParams.get('period') === 'slow');
      const doneSlow = await tab.evaluate(() => ({busy: document.getElementById('load').getAttribute('aria-busy'), part: document.querySelector('[data-sf-fragment-part="requests"]').getAttribute('data-state'), style: document.getElementById('load').getAttribute('style')}));
      check(label, 'F6 the skeleton leaves with the answer', doneSlow.busy === null && doneSlow.part === null && doneSlow.style === null, doneSlow);

      // F7 errors in the block: 500, timeout, network down; the retry asks again.
      for (const fault of ['e500', 'hang', 'down']) {
        await open('/admin/env?site=s1');
        await addFault(fault);
        const searchBefore = await tab.evaluate(() => location.search);
        requests.length = 0;
        await tab.click(`#f-${fault}`);
        await tab.waitForSelector('#load [data-sf-fragment-error]', {timeout: 5000}).catch(() => null);
        const shown = await look();
        const searchAfter = await tab.evaluate(() => location.search);
        check(label, `F7 ${fault}: the error state in the block, the address and the page stay`, shown.error && shown.state === 'error' && searchAfter === searchBefore && shown.marker === 'same document' && shown.events !== null, shown);
        await tab.locator('#load [data-sf-fragment-error]').getByRole('button').click();
        await tab.waitForTimeout(fault === 'hang' ? 1900 : 400);
        const again = await look();
        check(label, `F7 ${fault}: the retry asks again and shows the error again`, again.error && requests.filter((entry) => entry.id === 'env.load-history').length >= 2, {again, requests: requests.length});
      }
      // flaky: first 500, then the answer: the retry recovers and the controls come back.
      await open('/admin/env?site=s1');
      await addFault('flaky');
      await tab.click('#f-flaky');
      await tab.waitForSelector('#load [data-sf-fragment-error]', {timeout: 5000}).catch(() => null);
      const failed = await look();
      await tab.locator('#load [data-sf-fragment-error]').getByRole('button').click();
      await tab.waitForFunction(() => new URL(location.href).searchParams.get('period') === 'flaky', null, {timeout: 5000}).catch(() => null);
      await tab.waitForTimeout(100);
      const recovered = await look();
      check(label, 'F7 flaky: the retry recovers, the controls come back', failed.error && !recovered.error && recovered.state === null && recovered.requests === 7 && await tab.locator('#p7d').count() === 1, {failed, recovered});

      // F8 full loads
      await open('/admin/env?site=s1');
      for (const fault of ['e403', 'e404', 'redir', 'nohdr', 'otherid', 'c2', 'part', 'badjson', 'port2', 'type']) {
        await addFault(fault);
        fallbacks.length = 0;
        const navigation = tab.waitForEvent('load', {timeout: 8000}).catch(() => null);
        await tab.click(`#f-${fault}`);
        await navigation;
        await tab.waitForTimeout(100);
        const where = await tab.evaluate(() => ({marker: window.__marker ?? null, path: location.pathname, search: location.search, half: Boolean(document.querySelector('#load[aria-busy]'))}));
        const expectedPath = fault === 'redir' ? '/login' : '/admin/env';
        check(label, `F8 ${fault}: full load of the target, reason told`, where.marker === null && where.path === expectedPath && (fault === 'redir' || new URLSearchParams(where.search).get('period') === fault) && fallbacks.length === 1 && Boolean(fallbacks[0]?.reason), {where, fallbacks});
        await open('/admin/env?site=s1');
      }
      // An echo that differs from the address asked is written (replace).
      await addFault('echo');
      const beforeEcho = await look();
      await tab.click('#f-echo');
      await tab.waitForFunction(() => new URL(location.href).searchParams.get('period') === '30d');
      const echo = await look();
      check(label, 'the host\'s echo is the address written', echo.marker === 'same document' && echo.requests === 3600 && echo.history === beforeEcho.history + 1, {beforeEcho, echo});
      // no-access is a state, not an error.
      await addFault('none');
      await tab.click('#f-none');
      await tab.waitForFunction(() => document.getElementById('load').getAttribute('data-sf-fragment-state') === 'no-access');
      const noAccess = await tab.evaluate(() => ({state: document.getElementById('load').getAttribute('data-sf-fragment-state'), part: document.querySelector('[data-sf-fragment-part="requests"]').getAttribute('data-state'), error: Boolean(document.querySelector('#load [data-sf-fragment-error]'))}));
      check(label, 'no-access answered is drawn as the no-access state', noAccess.state === 'no-access' && noAccess.part === 'no-access' && !noAccess.error, noAccess);

      // F14 a product's own history entries.
      await open('/admin/env?site=s1');
      await tab.click('#p7d');
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 840);
      await tab.evaluate(() => history.pushState({larenaPanel: true}, '', `${location.search}&panel=1`));
      requests.length = 0;
      const regionHits = hits.get('region:/admin/env') ?? 0;
      await tab.goBack();
      await tab.waitForTimeout(300);
      await tab.goForward();
      await tab.waitForTimeout(300);
      const own = await look();
      check(label, 'F14 a product\'s own entry: neither runtime takes it', requests.length === 0 && (hits.get('region:/admin/env') ?? 0) === regionHits && own.marker === 'same document' && own.requests === 840, {requests, own});
      const ownState = await tab.evaluate(() => history.state);
      check(label, 'F14 its marker is kept as the product wrote it', ownState?.larenaPanel === true && !ownState.sfFragment, ownState);

      // F11 a block removed by a region swap mid-request.
      await open('/admin/env?site=s1');
      await addFault('gone');
      const live11 = await look();
      await tab.click('#f-gone');
      await tab.waitForTimeout(200);
      await tab.click('#to-other');
      await tab.waitForFunction(() => document.querySelector('#content h1')?.textContent === 'Другая страница');
      await tab.waitForTimeout(700);
      const gone = await tab.evaluate(() => ({path: location.pathname, search: location.search, marker: window.__marker ?? null, loads: window.__loads.filter((entry) => entry.fragment === 'env.load-history').length, live: window.__live ?? 0, block: Boolean(document.getElementById('load'))}));
      check(label, 'F11 the answer of a block that left is dropped, its elements released', gone.path === '/admin/other' && gone.marker === 'same document' && gone.loads === 0 && gone.live === 0 && !gone.block && live11.live === 1, gone);
      // Back through the region swap restores the page with its blocks, drawn again by their islands.
      await tab.goBack();
      await tab.waitForFunction(() => document.querySelector('[data-sf-fragment-part="requests"]')?.value === 120, null, {timeout: 5000}).catch(() => null);
      const regionBack = await look();
      check(label, 'Back over a region swap: region navigation brings the blocks back, islands drawn', regionBack.marker === 'same document' && regionBack.requests === 120 && regionBack.count === 12, regionBack);

      // F9 conflict.
      const errorsBefore = consoleErrors.length;
      await open('/admin/conflict');
      const plain = await tab.evaluate(() => ({a: document.getElementById('qa').hasAttribute('data-sf-fragment-plain'), b: document.getElementById('qb').hasAttribute('data-sf-fragment-plain')}));
      const conflictErrors = consoleErrors.slice(errorsBefore).filter((text) => /key q is declared by t\.qa and t\.qb/u.test(text));
      check(label, 'F9 two owners of one key: both plain, one console error', plain.a && plain.b && conflictErrors.length === 1, {plain, conflictErrors});
      const conflictNavigation = tab.waitForEvent('load', {timeout: 8000}).catch(() => null);
      requests.length = 0;
      await tab.click('#qa-link');
      await conflictNavigation;
      const conflictWhere = await tab.evaluate(() => ({marker: window.__marker ?? null, search: location.search}));
      check(label, 'F9 a plain block\'s link loads the page', conflictWhere.marker === null && conflictWhere.search === '?q=a' && requests.length === 0, conflictWhere);

      const unexpected = consoleErrors.filter((text) => !/key q is declared by/u.test(text) && !/status of (403|404|500)/u.test(text) && !/ERR_EMPTY_RESPONSE|net::ERR/u.test(text) && !/favicon/u.test(text));
      check(label, 'console clean (besides the faults asked for)', unexpected.length === 0, unexpected);
      } catch (error) {
        const state = await tab.evaluate(() => ({href: location.href, state: history.state, loads: window.__loads, full: window.__full ?? null})).catch(() => null);
        check(label, `no step stopped (${String(error.message).split('\n')[0]})`, false, {state, requests: requests.slice(-6), consoleErrors, fallbacks, at: String(error.stack).split('\n').find((line) => line.includes('fragment-refresh.browser'))});
      }
      await context.close();
    }
  }

  // F13 JavaScript off.
  const off = await browser.newContext({javaScriptEnabled: false, viewport: {width: 1440, height: 900}});
  const tab = await off.newPage();
  await tab.goto(`${base}/admin/env?site=s1`);
  await tab.click('#p7d');
  await tab.waitForLoadState('load');
  const noJs = new URL(tab.url());
  check('nojs', 'F13 a block link is a full-page link with the right keys', noJs.pathname === '/admin/env' && noJs.searchParams.get('period') === '7d' && noJs.searchParams.get('site') === 's1' && hits.has('page:/admin/env?site=s1&period=7d&scale=linear&events_page=1'), noJs.href);
  await off.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`fragment-refresh: ${passed} pass, ${failures.length} fail`);
if (failures.length) process.exit(1);
console.log('FRAGMENT_REFRESH_OK');
