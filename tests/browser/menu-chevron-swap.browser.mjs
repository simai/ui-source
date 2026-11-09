#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [runs]
// A disclosure's chevron never goes blank when it swaps (C30 follow-up). The
// row draws ⌄ on a closed section and ⌃ on an open one, a column › and ⌄;
// the icon font is a subset asked for by name, so a glyph the first request
// did not carry used to wait about 660 ms for a second font with the chevron
// drawn at font-size 0. The icon runtime now asks for each disclosure
// glyph's swap partner in the same request.
//
// Each run is a fresh browser context (a cold cache) in the light and the
// dark theme, `runs` times (3 by default). A frame sampler (one sample per
// animation frame) measures the chevron's glyph: the width of its text as
// drawn. In the first 100 ms after the chevron is first drawn the probe
// opens its branch, then closes it; in every frame from the first drawn one
// to the end the glyph is drawn (width > 0) and is a glyph, not the
// ligature's words (width at most 1.5 em). The swap asks for no new font:
// the request that brought the chevrons brought their partners too.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const RUNS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const leaf = (id, label) => ({id, label, href: `#${id}`});
const ROW = [
  {id: 'catalog', label: 'Каталог', href: '#catalog', children: [leaf('pumps', 'Насосы'), leaf('valves', 'Арматура')]},
  {id: 'about', label: 'О компании', children: [leaf('history', 'История'), leaf('jobs', 'Вакансии')]},
  leaf('news', 'Новости'),
];
const COLUMN = [
  {id: 'c-pumps', label: 'Насосы', href: '#c-pumps', children: [leaf('c-console', 'Консольные'), leaf('c-borehole', 'Скважинные')]},
  leaf('c-parts', 'Запчасти'),
];
const json = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');

const PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0}.side{inline-size:20rem;padding:var(--sf-space-1)}</style></head><body>
<sf-header-site id="h" collapse="none">
  <a slot="brand" href="#home">Технопром</a>
  <sf-menu id="row" label="Разделы сайта" orientation="horizontal" appearance="navigation" open-on="click" items='${json(ROW)}'></sf-menu>
</sf-header-site>
<div class="side"><sf-menu id="column" label="Каталог" appearance="navigation" items='${json(COLUMN)}'></sf-menu></div>
</body></html>`;

// The sampler: each frame, the glyph of each watched chevron. A chevron is
// opened 50 ms after it is first drawn (inside the first 100 ms) and closed
// 600 ms later, by a click on its button.
const SAMPLER = () => {
  const watched = {
    row: '#row [data-sf-menu-toggle="catalog"]',
    column: '#column [data-sf-menu-toggle="c-pumps"]',
  };
  const state = {frames: [], first: {}, opened: {}, closed: {}, start: performance.now()};
  window.__chevron = state;
  const glyph = (button) => {
    const icon = button?.querySelector('.sf-icon');
    const text = icon?.firstChild;
    if (!icon || !text) return null;
    const range = document.createRange();
    range.selectNodeContents(icon);
    const width = range.getBoundingClientRect().width;
    return {name: icon.textContent.trim(), width: Math.round(width * 10) / 10, em: parseFloat(getComputedStyle(icon).fontSize) || 0, loaded: icon.classList.contains('sf-icon-loaded')};
  };
  const tick = () => {
    const now = performance.now();
    const frame = {t: Math.round(now - state.start)};
    for (const [key, selector] of Object.entries(watched)) {
      const button = document.querySelector(selector);
      const sample = glyph(button);
      frame[key] = sample;
      if (sample && sample.width > 0 && state.first[key] === undefined) {
        state.first[key] = now;
        setTimeout(() => {
          state.opened[key] = Math.round(performance.now() - now);
          button.click();
          setTimeout(() => {
            state.closed[key] = true;
            document.querySelector(selector).click();
          }, 600);
        }, 50);
      }
    }
    state.frames.push(frame);
    if (now - state.start < 6000) requestAnimationFrame(tick);
    else state.done = true;
  };
  requestAnimationFrame(tick);
};

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/swap/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(PAGE);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const passes = [];
const failures = [];
const seen = {};
const check = (ok, message) => (ok ? passes : failures).push(message);
const OPEN = {row: 'keyboard_arrow_up', column: 'keyboard_arrow_down'};

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (let run = 1; run <= RUNS; run += 1) {
      const k = `${theme} #${run}`;
      // A new context: no font, sheet or script in its cache.
      const context = await browser.newContext({viewport: {width: 1280, height: 800}, colorScheme: theme});
      const iconRequests = [];
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (url.searchParams.has('icon_names')) iconRequests.push(url.searchParams.get('icon_names').split(','));
      });
      const consoleErrors = [];
      const tab = await context.newPage();
      tab.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      tab.on('pageerror', (error) => consoleErrors.push(error.message));
      await tab.addInitScript(SAMPLER);
      await tab.goto(`${origin}/swap/`);
      await tab.waitForFunction(() => window.__chevron?.done, null, {timeout: 20000});
      const state = await tab.evaluate(() => window.__chevron);
      seen[k] = {iconRequests, opened: state.opened};
      for (const key of ['row', 'column']) {
        const firstAt = state.first[key];
        check(firstAt !== undefined, `${k} ${key}: the chevron is drawn`);
        if (firstAt === undefined) continue;
        check(state.opened[key] !== undefined && state.opened[key] < 100, `${k} ${key}: opened in the first 100 ms after it was drawn (${state.opened[key]} ms)`);
        const frames = state.frames.filter((frame) => frame.t >= Math.round(firstAt - state.start) && frame[key]);
        const blank = frames.filter((frame) => !(frame[key].width > 0));
        const words = frames.filter((frame) => frame[key].width > frame[key].em * 1.5);
        const names = [...new Set(frames.map((frame) => frame[key].name))];
        check(names.includes(OPEN[key]) && frames.at(-1)[key].name !== OPEN[key], `${k} ${key}: the glyph swapped open and back (${names.join(' → ')})`);
        check(frames.length > 30 && !blank.length, `${k} ${key}: the glyph is drawn in every one of ${frames.length} frames${blank.length ? ` — blank at ${blank.slice(0, 5).map((frame) => `${frame.t} ms ${frame[key].name}`).join(', ')}` : ''}`);
        check(!words.length, `${k} ${key}: never the ligature's words (${words.length ? `${words[0][key].width}px at ${words[0].t} ms` : 'ok'})`);
      }
      // The request that first brings a chevron brings its swap partners
      // with it; no later request asks for any of them.
      const CHEVRONS = ['keyboard_arrow_down', 'keyboard_arrow_up', 'chevron_right'];
      const at = iconRequests.findIndex((names) => names.some((name) => CHEVRONS.includes(name)));
      const first = new Set(at >= 0 ? iconRequests[at] : []);
      check(CHEVRONS.every((name) => first.has(name)), `${k}: the request that brings the chevrons carries ⌄, ⌃ and › together (${[...first].sort().join(',')})`);
      const late = iconRequests.slice(at + 1).flat().filter((name) => CHEVRONS.includes(name) && !first.has(name));
      check(at >= 0 && !late.length, `${k}: no swap asks for a later font (${iconRequests.length} icon request(s): ${iconRequests.map((names) => names.join(',')).join(' | ')})`);
      check(!consoleErrors.length, `${k}: console clean ${consoleErrors.join(' | ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const message of passes) console.log(`PASS ${message}`);
for (const message of failures) console.log(`FAIL ${message}`);
console.log(JSON.stringify({seen}, null, 1));
console.log(`menu-chevron-swap: ${passes.length} passed, ${failures.length} failed`);
process.exitCode = failures.length ? 1 : 0;
