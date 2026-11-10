#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// Every status glyph of a toast draws (sf-toast 1.2.1). The toast printed its
// status icon as a bare <i class="sf-icon">name</i>: the Loader learnt the name
// only from its page scan, so a glyph outside the names the page had already
// asked for -- `delete` beside `warning` -- was never declared in the subset
// request and its icon stayed an empty box. The toast now draws the icon
// through sf-icon, as sf-alert does, and asks the Loader for its glyph.
//
// A page prints one warning toast, so its first icon request names warning
// alone. After the page has loaded it adds a toast for every status glyph (and
// `delete` on a neutral and an error toast), on one page where the Loader
// observes the page (late), on another in a region it does not observe
// (quiet: data-sf-observer="ignore"; the Loader's scan never sees it, as it
// never sees a shadow root). There the bare icon of 1.2.0 kept an empty box
// for every name but warning. Light and dark, 1440 and 390, three loads of
// each page:
//   - every icon has ink in a screenshot of its box (> 20 pixels off the fill);
//   - every icon box is the line's size and stands where it stood (size and
//     offset from the toast's root, compared with --expect <file> when given);
//   - the console is clean.
// --report prints the readings and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const flag = (name) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : ''; };
const jsonFile = flag('--json');
const expectFile = flag('--expect');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SET = [
  ['neutral', 'notifications'],
  ['info', 'info'],
  ['success', 'check_circle'],
  ['warning', 'warning'],
  ['error', 'error'],
  ['neutral', 'delete'],
  ['error', 'delete'],
];
const PRINTED = SET.filter(([, icon]) => icon === 'warning');
const H = 'Представление удалено';
const toast = (where, [status, icon]) => `<sf-toast data-k="${where}-${status}-${icon}" status="${status}" icon="${icon}" heading="${H}"></sf-toast>`;

const page = (theme, mode) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>body{display:flex;flex-wrap:wrap;align-items:flex-start}.zone{display:flex;flex-direction:column;gap:8px;margin:16px;inline-size:22rem;max-inline-size:calc(100vw - 32px)}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<section class="zone" id="printed">
${PRINTED.map((one) => toast('printed', one)).join('\n')}
</section>
<section class="zone" id="late"></section>
<section class="zone" id="quiet" data-sf-observer="ignore"></section>
<script>
window.addEventListener('load', () => setTimeout(() => {
  document.getElementById(${JSON.stringify(mode)}).innerHTML = ${JSON.stringify(SET.map((one) => toast(mode, one)).join('\n'))};
}, 600));
</script>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light', url.searchParams.get('mode') === 'quiet' ? 'quiet' : 'late'));
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

const keysOf = (mode) => [...PRINTED.map(([status, icon]) => `printed-${status}-${icon}`), ...SET.map(([status, icon]) => `${mode}-${status}-${icon}`)];
const keys = [...new Set([...keysOf('late'), ...keysOf('quiet')])];

// The drawn glyph of each toast: its box against the toast's root, and the
// text line it is centred on.
const BOXES = (names) => Object.fromEntries(names.map((key) => {
  const root = document.querySelector(`[data-k="${key}"] .sf-toast`);
  const icon = root?.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon');
  if (!root || !icon) return [key, null];
  const r = root.getBoundingClientRect();
  const b = icon.getBoundingClientRect();
  return [key, {x: b.x, y: b.y, w: b.width, h: b.height, dx: Math.round((b.x - r.x) * 100) / 100, dy: Math.round((b.y - r.y) * 100) / 100,
    name: icon.textContent.trim(), loaded: icon.classList.contains('sf-icon-loaded'), tag: icon.parentElement.tagName.toLowerCase(),
    color: getComputedStyle(icon).color, fontSize: getComputedStyle(icon).fontSize}];
}));

const INK = async ({png, boxes, scaleBase}) => {
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const scale = image.width / scaleBase;
  return Object.fromEntries(Object.entries(boxes).map(([key, box]) => {
    if (!box) return [key, 0];
    const data = context.getImageData(Math.round(box.x * scale), Math.round(box.y * scale),
      Math.max(1, Math.round(box.w * scale)), Math.max(1, Math.round(box.h * scale))).data;
    const [r0, g0, b0] = data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 96) count += 1;
    }
    return [key, count];
  }));
};

const failures = [];
const report = {};
const expected = expectFile && existsSync(expectFile) ? JSON.parse(readFileSync(expectFile, 'utf8')) : null;
const browser = await chromium.launch();
try {
  for (const [label, width] of [['desktop', 1440], ['phone', 390]]) {
    for (const theme of ['light', 'dark']) {
      const view = `${label}-${theme}`;
      const loads = [];
      for (const mode of ['late', 'quiet']) for (let load = 1; load <= 3; load += 1) {
        const tab = await browser.newPage({viewport: {width, height: 1000}});
        const errors = [];
        const subset = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        tab.on('request', (request) => { const url = request.url(); if (url.includes('icon_names=')) subset.push(decodeURIComponent(url.split('icon_names=')[1].split('&')[0])); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}&mode=${mode}`);
        const names = keysOf(mode);
        await tab.waitForFunction((n) => document.querySelectorAll('[data-k] .sf-toast').length === n, names.length, {timeout: 30000})
          .catch(() => failures.push(`${view} ${mode} load ${load}: the page never drew its ${names.length} toasts`));
        // The glyphs have the time a page gives them: until every icon says
        // its glyph is in the font (sf-icon-loaded), at most 8 s, then a frame.
        await tab.waitForFunction((list) => list.every((key) => document.querySelector(`[data-k="${key}"] .sf-toast :is(.sf-icon)`)?.classList.contains('sf-icon-loaded')),
          names, {timeout: 8000}).catch(() => {});
        await tab.waitForTimeout(500);
        const boxes = await tab.evaluate(BOXES, names);
        const png = (await tab.screenshot({fullPage: true})).toString('base64');
        const ink = await tab.evaluate(INK, {png, boxes, scaleBase: width});
        loads.push({mode, load, names, boxes, ink, subset, errors});
        if (errors.length) failures.push(`${view} ${mode} load ${load}: console ${JSON.stringify(errors)}`);
        await tab.close();
      }
      report[view] = loads.map(({mode, load, names, boxes, ink, subset}) => ({
        mode, load, subset,
        icons: Object.fromEntries(names.map((key) => [key, boxes[key] && {ink: ink[key], w: boxes[key].w, h: boxes[key].h, dx: boxes[key].dx, dy: boxes[key].dy,
          tag: boxes[key].tag, loaded: boxes[key].loaded, color: boxes[key].color, fontSize: boxes[key].fontSize}])),
      }));
      for (const one of report[view]) {
        const at = `${view} ${one.mode} load ${one.load}`;
        for (const [key, got] of Object.entries(one.icons)) {
          if (!got) { failures.push(`${at} ${key}: no status icon`); continue; }
          if (got.ink <= 20) failures.push(`${at} ${key}: the glyph has no ink (${got.ink} px)`);
          const want = expected?.[view]?.find((other) => other.mode === one.mode)?.icons?.[key];
          if (want && (want.w !== got.w || want.h !== got.h || want.dx !== got.dx || want.dy !== got.dy)) {
            failures.push(`${at} ${key}: box ${got.w}x${got.h} at ${got.dx},${got.dy}, was ${want.w}x${want.h} at ${want.dx},${want.dy}`);
          }
          if (want && want.color !== got.color) failures.push(`${at} ${key}: colour ${got.color}, was ${want.color}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
if (reportOnly) {
  for (const [view, loads] of Object.entries(report)) {
    for (const one of loads) {
      console.log(`${view} ${one.mode} load ${one.load} subset ${JSON.stringify(one.subset)}`);
      for (const [key, got] of Object.entries(one.icons)) console.log(`  ${key.padEnd(28)} ${got ? `ink ${String(got.ink).padStart(4)} box ${got.w}x${got.h} at ${got.dx},${got.dy} ${got.tag} ${got.loaded ? 'loaded' : 'not-loaded'} ${got.color}` : 'none'}`);
    }
  }
  if (failures.length) console.log(`${failures.length} failures`);
  process.exit(0);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`TOAST_STATUS_GLYPH_OK ${keysOf('late').length} toasts x 2 pages x 4 views x 3 loads, every glyph inked${expected ? ', boxes and colours as expected' : ''}`);
