#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [result folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// A tonal badge on a translucent fill (owner decision C43, 2026-11-10; the
// view 1.6.0 acceptance, D1). A selected, open or current row draws an alpha
// of primary over its place; a tonal badge is an alpha of its own colour. Laid
// one over the other, a warning badge on the open record read as a grey fact.
// The row declares the solid place under it (--sf-surface-underlay, core mix
// sf-place-fill) and the tonal badge lays its tone over that colour.
//
// On the built bytes with the real Loader, light and dark, three loads each,
// every appearance (main, tonal, outline) in every colour (neutral, primary,
// secondary, tertiary and the four statuses), measured on the screen's pixels:
//
// - On a solid place -- the page, a card, a popup, a strong and a soft
//   coloured place -- nothing changes: no badge has a background image, its
//   background-color is its tone, as before.
// - On the Framework's translucent rows -- a selected list option, a current
//   context-menu item, the navigation menu's current page, a selected tree
//   item -- and on a row that declares the role with its own fill (a table
//   row, an open record, as a set writes it), a tonal badge's fill is the
//   same pixel as on the place the row stands on (each channel within 1), and
//   its text keeps 4.5:1. A main or an outline badge is untouched.
// - A place inside such a row (a popup) takes the role back: no image there.
// - A row that does not declare the role is drawn as before (no image).
// Each pixel is the mean of a 4 x 4 block (Chrome dithers gradients by one
// step).
// - The page has no errors and a clean console.
// With a result folder, the measured pixels go to <folder>/badge-on-fill.json
// and each theme's screenshot beside it.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const folder = process.argv[3] || '';
if (folder) mkdirSync(folder, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const LOOKS = ['main', 'tonal', 'outline'];
const COLOURS = ['neutral', 'primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error'];
const badges = (id) => LOOKS.map((look) => `<div class="set">${COLOURS.map((colour) => `<span class="sf-badge sf-badge--${look} sf-badge--${colour} sf-badge--size-1/3" data-badge="${id}:${look}:${colour}"><span class="sf-badge-text-container"><span class="sf-badge-text">SSL · 6 дн</span></span></span>`).join('')}</div>`).join('');

// Where a badge stands. `solid` are places (nothing may change there); `fill`
// are translucent rows that declare the role, with the place they stand on.
const CONTEXTS = [
  {id: 'page', kind: 'solid', html: (b) => `<div class="ctx" id="page">${b}</div>`},
  {id: 'card', kind: 'solid', html: (b) => `<div class="sf-card ctx" id="card">${b}</div>`},
  {id: 'popup', kind: 'solid', html: (b) => `<div class="bg-surface-popup ctx" id="popup">${b}</div>`},
  {id: 'strong', kind: 'solid', html: (b) => `<div class="bg-primary color-on-primary ctx" id="strong">${b}</div>`},
  {id: 'soft', kind: 'solid', html: (b) => `<div class="bg-warning-container ctx" id="soft">${b}</div>`},
  {id: 'list', kind: 'fill', on: 'page', html: (b) => `<div class="sf-list" role="listbox"><div class="sf-list-item selected ctx" role="option" aria-selected="true" id="list">${b}</div></div>`},
  {id: 'context', kind: 'fill', on: 'page', html: (b) => `<div class="sf-context-menu-item sf-context-menu-item--current ctx" id="context">${b}</div>`},
  {id: 'nav', kind: 'fill', on: 'page', html: (b) => `<nav class="sf-menu sf-menu--navigation"><div class="sf-menu-element ctx" aria-current="page" id="nav">${b}</div></nav>`},
  {id: 'tree', kind: 'fill', on: 'page', html: (b) => `<div class="sf-tree"><div class="sf-tree-item" aria-selected="true"><div class="sf-tree-item-container ctx" id="tree">${b}</div></div></div>`},
  {id: 'table', kind: 'fill', on: 'page', html: (b) => `<table><tbody><tr class="open-row" aria-current="true"><td class="ctx" id="table">${b}</td></tr></tbody></table>`},
  {id: 'popup-row', kind: 'fill', on: 'popup', html: (b) => `<div class="bg-surface-popup ctx-wrap" id="popup-host"><div class="sf-list" role="listbox"><div class="sf-list-item selected ctx" role="option" aria-selected="true" id="popup-row">${b}</div></div></div>`},
  {id: 'nested', kind: 'reset', html: (b) => `<div class="sf-list" role="listbox"><div class="sf-list-item selected" role="option" aria-selected="true"><div class="bg-surface-popup ctx" id="nested">${b}</div></div></div>`},
  {id: 'undeclared', kind: 'undeclared', html: (b) => `<div class="own-row ctx" id="undeclared">${b}</div>`},
];

const sheets = ['badges', 'card', 'dropdown', 'context-menu', 'menu', 'tree'].map((name) => `<link rel="stylesheet" href="/distr/component/${name}/css/${name}.css">`).join('');
const shell = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">${sheets}<script src="/distr/core/js/core.js"></script>
<style>
body{margin:0;padding:var(--sf-space-1);background:var(--sf-surface-page);color:var(--sf-on-surface)}
.ctx,.ctx-wrap{display:block;padding:var(--sf-space-1);margin-block-end:var(--sf-space-1)}
.ctx-wrap>.sf-list{padding:var(--sf-space-1)}
.set{display:flex;flex-wrap:wrap;gap:var(--sf-space-1);margin-block-end:var(--sf-space-1\\/2)}
table{border-collapse:collapse;inline-size:100%}
/* A set's open record, as sf-view-table draws it: an alpha fill on the row,
   and the role declared with it (C43). */
tr.open-row{background-image:linear-gradient(var(--sf-primary-container),var(--sf-primary-container));--sf-surface-underlay:var(--sf-surface-place)}
/* A row of a page's own that has the fill and does not declare the role. */
.own-row{background-image:linear-gradient(var(--sf-primary-container),var(--sf-primary-container))}
</style></head>
<body>${CONTEXTS.map((c) => c.html(badges(c.id))).join('\n')}</body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();
const measured = {};

const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const near = (a, b, d = 1) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= d);

async function run(theme, round) {
  page = shell(theme);
  const context = await browser.newContext({viewport: {width: 1100, height: 900}, deviceScaleFactor: 1, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  await tab.goto(`${base}/page`, {waitUntil: 'load'});
  await tab.waitForFunction(() => {
    const opaque = (id) => getComputedStyle(document.getElementById(id)).backgroundColor !== 'rgba(0, 0, 0, 0)';
    const badge = document.querySelector('[data-badge="page:tonal:warning"]');
    return ['strong', 'soft', 'popup', 'card', 'list', 'context', 'tree'].every(opaque)
      && getComputedStyle(document.getElementById('nav')).backgroundColor !== 'rgba(0, 0, 0, 0)'
      && badge && getComputedStyle(badge).backgroundColor !== 'rgba(0, 0, 0, 0)';
  }, null, {timeout: 20000});
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);

  // Every badge: its computed paint and the point to sample (inside the pill,
  // in its start padding, away from the text and the rounded ends).
  const boxes = await tab.evaluate(() => {
    const doc = document.documentElement;
    const scroll = {x: window.scrollX, y: window.scrollY};
    const list = [...document.querySelectorAll('[data-badge]')].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const text = el.querySelector('.sf-badge-text');
      return {key: el.dataset.badge, x: Math.round(r.left + scroll.x + Math.min(r.height / 2, 6)), y: Math.round(r.top + scroll.y + r.height / 2),
        image: s.backgroundImage, color: s.backgroundColor, ink: getComputedStyle(text).color};
    });
    const rows = [...document.querySelectorAll('.ctx')].map((el) => {
      const r = el.getBoundingClientRect();
      return {id: el.id, x: Math.round(r.left + window.scrollX + 2), y: Math.round(r.top + window.scrollY + 2)};
    });
    return {list, rows, height: doc.scrollHeight};
  });
  await tab.setViewportSize({width: 1100, height: boxes.height});
  const png = await tab.screenshot({fullPage: true});
  if (folder && round === 1) writeFileSync(join(folder, `badge-on-fill-${theme}.png`), png);
  const points = [...boxes.list.map((b) => [b.x, b.y]), ...boxes.rows.map((r) => [r.x, r.y])];
  const pixels = await tab.evaluate(async ({data, points}) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', {colorSpace: 'srgb', willReadFrequently: true});
    ctx.drawImage(image, 0, 0);
    // The mean of a 4 x 4 block: Chrome dithers a gradient by one step from
    // pixel to pixel, so a single pixel of a badge drawn as an image is +-1.
    return points.map(([x, y]) => {
      const d = ctx.getImageData(x - 2, y - 2, 4, 4).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c += 1) sum[c] += d[i + c];
      return sum.map((v) => Math.round(v / 16));
    });
  }, {data: png.toString('base64'), points});
  const fill = {};
  boxes.list.forEach((b, i) => { fill[b.key] = {...b, pixel: pixels[i]}; });
  const ground = {};
  boxes.rows.forEach((r, i) => { ground[r.id] = pixels[boxes.list.length + i]; });

  const where = `${theme} #${round}`;
  ok(`${where}: console clean`, errors.length === 0, errors.join(' | '));
  for (const c of CONTEXTS) {
    for (const look of LOOKS) for (const colour of COLOURS) {
      const b = fill[`${c.id}:${look}:${colour}`];
      const name = `${where} ${c.id} ${look} ${colour}`;
      if (c.kind === 'solid' || c.kind === 'reset' || c.kind === 'undeclared' || look !== 'tonal') {
        ok(`${name}: no background image (drawn as before)`, b.image === 'none', b.image);
        continue;
      }
      const reference = fill[`${c.on}:${look}:${colour}`];
      ok(`${name}: fill is the badge's own on ${c.on}`, near(b.pixel, reference.pixel), `${b.pixel} vs ${reference.pixel} (row ${ground[c.id]})`);
      ok(`${name}: text 4.5:1 on its fill`, contrast(b.ink.match(/[\d.]+/gu).slice(0, 3).map(Number), b.pixel) >= 4.5, contrast(b.ink.match(/[\d.]+/gu).slice(0, 3).map(Number), b.pixel).toFixed(2));
    }
    if (c.kind === 'fill') ok(`${where} ${c.id}: the row is a translucent fill, not the place`, !near(ground[c.id], ground[c.on], 2), `${ground[c.id]} vs ${ground[c.on]}`);
  }
  if (round === 1) {
    measured[theme] = Object.fromEntries(Object.entries(fill).map(([key, b]) => [key, {pixel: b.pixel, at: [b.x, b.y], ink: b.ink, image: b.image === 'none' ? 'none' : 'set', color: b.color,
      contrast: Number(contrast(b.ink.match(/[\d.]+/gu).slice(0, 3).map(Number), b.pixel).toFixed(2))}]));
    measured[`${theme}-rows`] = ground;
  }
  await context.close();
}

try {
  for (const theme of ['light', 'dark']) for (let round = 1; round <= 3; round += 1) await run(theme, round);
} finally {
  await browser.close();
  server.close();
}
if (folder) writeFileSync(join(folder, 'badge-on-fill.json'), `${JSON.stringify(measured, null, 1)}\n`);
const failures = results.filter((r) => !r.pass);
console.log(JSON.stringify({probe: 'badge-on-fill', checks: results.length, failures}, null, 1));
process.exit(failures.length ? 1 : 0);
