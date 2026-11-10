#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// The notice's action plate against its toast (DEV look note on C35): the
// tonal action of an sf-toast is a translucent plate, and on a toast of the
// same hue it can merge with it. Measured on drawn pixels, not on tokens, for
// every status (neutral, info, success, warning, error), light and dark, three
// loads each:
//
//   - plate: a pixel of the plate's padding (no glyph), against a pixel of the
//     toast beside it (no content); the WCAG contrast of the two, which is what
//     a non-text edge needs (1.4.11, 3:1);
//   - label: the label's ink (computed, opaque) over the plate pixel (1.4.3).
//
// It reports the numbers; it fails only on a page error or on loads that
// disagree. The plate's tone rule is the toast's, so the numbers are what the
// stylesheet gives.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonAt = process.argv.indexOf('--json');
const jsonFile = jsonAt > 0 ? process.argv[jsonAt + 1] : '';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const STATUSES = ['neutral', 'info', 'success', 'warning', 'error'];

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.zone{display:flex;flex-direction:column;gap:16px;margin:16px;max-inline-size:28rem}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<section class="zone">
${STATUSES.map((status) => `  <sf-toast id="t-${status}" status="${status}" heading="Сессия закончится" supporting-text="Несохранённые изменения пропадут." action-text="Продлить" action="extend"></sf-toast>`).join('\n')}
</section></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
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

// Where to read: a point of the plate's own padding, and one of the toast to
// the right of the plate, on the same row (inside the toast, clear of the
// close). Device pixels = CSS pixels (deviceScaleFactor 1).
const POINTS = (statuses) => statuses.map((status) => {
  const toast = document.querySelector(`#t-${status} > .sf-toast`);
  const plate = toast?.querySelector('.sf-toast-bottom .sf-button');
  const label = plate?.querySelector('.sf-button-text-container');
  if (!toast || !plate) return {status, missing: true};
  const p = plate.getBoundingClientRect();
  const t = toast.getBoundingClientRect();
  return {status, plate: {x: Math.round(p.left + 3), y: Math.round(p.top + p.height / 2)},
    toast: {x: Math.round(Math.min(t.right - 24, p.right + 40)), y: Math.round(p.top + p.height / 2)},
    ink: label ? getComputedStyle(label).color : null, plateClass: plate.className};
});

const READ = async ({png, points}) => {
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const at = ({x, y}) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
  // The label's ink, resolved to sRGB by the canvas (it may come as color()).
  const ink = (css) => {
    if (!css) return null;
    context.fillStyle = '#000';
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  return points.map((point) => point.missing ? point : {...point, plateRgb: at(point.plate), toastRgb: at(point.toast), inkRgba: ink(point.ink)});
};

const luminance = ([r, g, b]) => {
  const c = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};
const over = ([r, g, b, a], base) => [r, g, b].map((v, i) => Math.round(v * (a / 255) + base[i] * (1 - a / 255)));
const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const failures = [];
const rows = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const loads = [];
    for (let load = 1; load <= 3; load += 1) {
      const tab = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
      await tab.waitForFunction((n) => document.querySelectorAll('sf-toast > .sf-toast .sf-toast-bottom .sf-button').length === n, STATUSES.length, {timeout: 20000});
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(400);
      const points = await tab.evaluate(POINTS, STATUSES);
      const png = (await tab.screenshot({fullPage: true})).toString('base64');
      const read = await tab.evaluate(READ, {png, points});
      if (errors.length) failures.push({case: `${theme} load ${load}: no page errors`, got: errors});
      loads.push(read.map((one) => one.missing ? one : ({status: one.status, plate: hex(one.plateRgb), toast: hex(one.toastRgb),
        plateToToast: contrast(one.plateRgb, one.toastRgb),
        labelOnPlate: one.inkRgba ? contrast(over(one.inkRgba, one.plateRgb), one.plateRgb) : null})));
      await tab.close();
    }
    const seen = new Set(loads.map((one) => JSON.stringify(one)));
    if (seen.size !== 1) failures.push({case: `${theme}: three loads agree`, got: loads});
    for (const one of loads[0]) rows.push({theme, ...one});
  }
} finally {
  await browser.close();
  server.close();
}

for (const row of rows) {
  if (row.missing) failures.push({case: `${row.theme} ${row.status}: a toast with an action is drawn`, got: row});
}
console.log('theme  status   plate    toast    plate:toast  label:plate');
for (const row of rows) {
  if (row.missing) continue;
  console.log(`${row.theme.padEnd(6)} ${row.status.padEnd(8)} ${row.plate}  ${row.toast}  ${String(row.plateToToast).padStart(6)}       ${String(row.labelOnPlate).padStart(6)}`);
}
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(rows, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('TOAST_ACTION_CONTRAST_OK');
