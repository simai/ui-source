#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-language holds its own box before it draws (Docara, 2026-11-07: the
// header tools moved left by 40 px when the trigger appeared, and Docara
// held a 2.5rem placeholder until data-look). On the built bytes, with the
// real Loader, every script and every sheet but core.css held back
// SCRIPT_DELAY ms (the page links core.css, as every page does; the
// component sheets come with the code), and every animation frame recorded
// from the first one:
//   - a header row of a brand, sf-language mode="menu" (its languages in an
//     island, so no attribute says how many), a tool before it and a button
//     after it; neither moves, from the first frame with the row to the last
//     (the tools before it are what moved in Docara);
//   - mode menu and search at each size of the ladder (1/3, 1/2, 1, 2, 3):
//     before the element draws, its box is a square one control of its size
//     high, and that is the drawn trigger's box -- the column of buttons after
//     each never moves sideways;
//   - mode inline and auto (two languages) at each size: the box is one
//     control high before and after, so the row below never moves;
//   - the frames see the element before its code (undefined, nothing drawn).
// Light and dark, at a desktop and a phone width (the ladder has a mobile
// step); console errors fail the run.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const SCRIPT_DELAY = Number(process.env.SCRIPT_DELAY || 400);
const evidence = process.env.SF_EVIDENCE || '';
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'css', 'core.css'), join(out, 'smart', 'smart', 'language', 'js', 'language.js')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const island = JSON.stringify({languages: 'ru en de fr es'});
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<title>sf-language first paint</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},theme:false,cacheVersion:'language-first-paint',pluginListVersion:'language-first-paint'};</script>
<script>${WATCH}</script>
<style>
  body{margin:0;padding:16px;background:var(--sf-surface-0);color:var(--sf-on-surface);font-family:system-ui}
  .bar{display:flex;align-items:center;gap:8px;block-size:56px;padding-inline:12px;border:1px solid var(--sf-outline-variant)}
  .bar .brand{margin-inline-end:auto}
  .row{display:flex;align-items:center;gap:8px;margin-block:8px}
  .mark{inline-size:12px;block-size:12px;background:var(--sf-primary);flex:none}
</style>
<script src="/distr/core/js/core.js"></script></head><body>
<div class="bar"><span class="brand">SIMAI</span>
  <span id="header-before" class="mark"></span>
  <sf-language id="header" mode="menu" size="1" label="Язык" apply="none"><script type="application/json" data-sf-settings>${island}</script></sf-language>
  <span id="header-after" class="mark"></span></div>
${SIZES.map((size) => ['menu', 'search'].map((mode) => `<div class="row"><sf-language data-case="${mode} ${size}" mode="${mode}" size="${size}" languages="ru en de fr es" apply="none"></sf-language><span class="mark after"></span></div>`).join('')).join('')}
${SIZES.map((size) => ['inline', 'auto'].map((mode) => `<div class="row"><sf-language data-case="${mode} ${size}" mode="${mode}" size="${size}" languages="ru en" apply="none"></sf-language></div><div class="mark below"></div>`).join('')).join('')}
</body></html>`;

// Installed before the body parses: one record per animation frame.
const WATCH = `(() => {
  window.__frames = [];
  const r = (n) => Math.round(n * 10) / 10;
  const tick = () => {
    const header = document.getElementById('header');
    if (header) {
      const after = document.getElementById('header-after');
      const record = {t: Math.round(performance.now()), header: {defined: header.matches(':defined'), look: header.getAttribute('data-look'), x: after ? r(after.getBoundingClientRect().left) : null, before: document.getElementById('header-before') ? r(document.getElementById('header-before').getBoundingClientRect().left) : null}, cases: {}};
      for (const host of document.querySelectorAll('sf-language[data-case]')) {
        const row = host.parentElement;
        const box = host.getBoundingClientRect();
        const drawn = host.querySelector('button, [role=radiogroup]');
        const d = drawn ? drawn.getBoundingClientRect() : null;
        const next = row.nextElementSibling;
        record.cases[host.dataset.case] = {
          defined: host.matches(':defined'), look: host.getAttribute('data-look'),
          box: [r(box.width), r(box.height)], drawn: d ? [r(d.width), r(d.height)] : null,
          rowHeight: r(row.getBoundingClientRect().height),
          after: row.querySelector('.after') ? r(row.querySelector('.after').getBoundingClientRect().left) : null,
          below: next?.classList.contains('below') ? r(next.getBoundingClientRect().top - row.getBoundingClientRect().top) : null,
        };
      }
      window.__frames.push(record);
    }
    if (performance.now() < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const types = new Map([['.js', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml']]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/light' || url.pathname === '/dark') {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    return response.end(page(url.pathname.slice(1)));
  }
  try {
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    // The code and every sheet but core.css come late: what the page shows
    // before them is what core.css alone draws.
    if (file.endsWith('.js') || (file.endsWith('.css') && !file.endsWith(`${sep}core.css`))) await new Promise((settle) => setTimeout(settle, SCRIPT_DELAY));
    response.writeHead(200, {'Content-Type': `${types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream'}; charset=utf-8`, 'Content-Length': bytes.length});
    return response.end(bytes);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = {scriptDelayMs: SCRIPT_DELAY};
const near = (a, b, tolerance = 0.6) => a !== null && b !== null && Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
try {
  for (const [theme, width] of [['light', 1000], ['dark', 1000], ['light', 390], ['dark', 390]]) {
    const tab = await browser.newPage({viewport: {width, height: 1400}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${origin}/${theme}`);
    await tab.waitForFunction(() => [...document.querySelectorAll('sf-language')].every((host) => host.getAttribute('data-look')), null, {timeout: 15000}).catch(() => {});
    await tab.waitForTimeout(600);
    const frames = await tab.evaluate(() => window.__frames);
    const last = frames.at(-1);
    const early = frames.filter((frame) => !frame.header.defined);
    const summary = {frames: frames.length, earlyFrames: early.length, header: {first: frames[0]?.header, last: last?.header}, cases: {}};
    if (!early.length) failures.push(`${theme} ${width}: no frame saw sf-language before its code; raise SCRIPT_DELAY`);
    // A frame taken before the parser reached a node records nothing for it.
    const headerXs = [...new Set(frames.map((frame) => frame.header.x).filter((x) => x !== null))];
    if (headerXs.length !== 1) failures.push(`${theme} ${width}: the button after the header picker moved: ${headerXs.join(' -> ')}`);
    // The tools before it are what moved in Docara: the bar ends with the picker, so it grows toward them.
    const beforeXs = [...new Set(frames.map((frame) => frame.header.before).filter((x) => x !== null))];
    if (beforeXs.length !== 1) failures.push(`${theme} ${width}: the tool before the header picker moved: ${beforeXs.join(' -> ')}`);
    for (const [name, end] of Object.entries(last?.cases ?? {})) {
      const [mode] = name.split(' ');
      const before = frames.map((frame) => frame.cases[name]).filter((one) => one && !one.look);
      const first = before[0];
      summary.cases[name] = {before: first ? {box: first.box, rowHeight: first.rowHeight} : null, after: {box: end.box, drawn: end.drawn, look: end.look, rowHeight: end.rowHeight}};
      if (!first) { failures.push(`${theme} ${width} ${name}: no frame before it drew`); continue; }
      if (!end.drawn) { failures.push(`${theme} ${width} ${name}: nothing drawn`); continue; }
      if (mode === 'menu' || mode === 'search') {
        if (!near(first.box[0], first.box[1])) failures.push(`${theme} ${width} ${name}: the box before is not square ${first.box}`);
        if (!near(first.box[0], end.drawn[0]) || !near(first.box[1], end.drawn[1])) failures.push(`${theme} ${width} ${name}: box before ${first.box}, trigger drawn ${end.drawn}`);
        const xs = [...new Set(frames.map((frame) => frame.cases[name]?.after).filter((x) => x !== undefined && x !== null))];
        if (xs.length !== 1) failures.push(`${theme} ${width} ${name}: the mark after it moved ${xs.join(' -> ')}`);
      } else {
        if (!near(first.box[1], end.drawn[1])) failures.push(`${theme} ${width} ${name}: height before ${first.box[1]}, switch drawn ${end.drawn[1]}`);
        const below = [...new Set(frames.map((frame) => frame.cases[name]?.below).filter((y) => y !== undefined && y !== null))];
        if (below.length !== 1) failures.push(`${theme} ${width} ${name}: the row below moved ${below.join(' -> ')}`);
      }
    }
    if (errors.length) failures.push(`${theme} ${width}: page errors ${errors.join(' | ')}`);
    report[`${theme} ${width}`] = summary;
    if (evidence) await tab.screenshot({path: join(evidence, `language-first-paint-${theme}-${width}.png`), fullPage: true});
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('LANGUAGE_FIRST_PAINT_OK');
