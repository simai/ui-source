#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An icon a page inserts after start-up (<i class="sf-icon">) takes its size
// as every icon does: the ladder (--sf-icon-size-3, one step down under
// data-sf-density="compact"), or the page's own font-size on it. On a page
// with core.css and the icons sheet but no Loader nothing marks an icon
// sf-icon-loaded, and the sheet's rule for such icons set an important size,
// so a late icon in a compact row drew its glyph 24px in a 16px box
// (prototypes/menu-admin-2panel, 2026-11-09). With the Loader the late icon
// is marked and drawn at the same sizes. An icon written in the page draws
// at the same size in its first frame as before.
//
// Pages: with the Loader and without, light and dark, SF_PROBE_LOADS loads
// (default 3) each; the sheet is held back 100-600 ms at random.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css'),
  join(out, 'component', 'component', 'icons', 'css', 'icons.css')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const rows = `<div id="early-row"><i class="sf-icon" id="early">tune</i></div>
  <div id="normal" class="row"></div>
  <div id="compact" class="row" data-sf-density="compact"></div>`;
const late = `document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    for (const row of document.querySelectorAll('.row')) {
      row.insertAdjacentHTML('beforeend', '<i class="sf-icon late" aria-hidden="true">drag_indicator</i>'
        + '<i class="sf-icon own" aria-hidden="true">drag_indicator</i>'
        + '<span class="ladder" style="font-size: var(--sf-icon-size-3)">x</span>');
    }
  }, 50));
  // The first frame of the icon written in the page.
  requestAnimationFrame(() => { const i = document.getElementById('early'); window.__early = i && getComputedStyle(i).fontSize; });`;
const style = '<style>.row { display: flex; gap: 8px; } .row .own { font-size: 16px; inline-size: 16px; block-size: 16px; }</style>';
const page = (theme, loader) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/icons/css/icons.css">${style}
${loader ? `<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script>` : ''}
<script>${late}</script></head><body>${rows}</body></html>`;
const pages = {};
for (const theme of ['theme-light', 'theme-dark']) {
  pages[`/loader-${theme}.html`] = page(theme, true);
  pages[`/sheets-${theme}.html`] = page(theme, false);
}

const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
const server = createServer(async (request, response) => {
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
    const ext = file.slice(file.lastIndexOf('.'));
    if (ext === '.css') await new Promise((done) => setTimeout(done, rand(100, 600)));
    response.writeHead(200, {'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const LOADS = Number(process.env.SF_PROBE_LOADS || 3);
const failures = [];
const measured = {};
const browser = await chromium.launch();
try {
  for (const path of Object.keys(pages)) {
    measured[path] = [];
    for (let load = 0; load < LOADS; load += 1) {
      const context = await browser.newContext();
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(String(error)));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`${base}${path}`);
      await tab.waitForFunction(() => document.querySelectorAll('.row .late').length === 2, null, {timeout: 10000}).catch(() => {});
      await tab.waitForTimeout(1500);
      const result = await tab.evaluate(() => {
        const size = (node) => node ? getComputedStyle(node).fontSize : null;
        const box = (node) => node ? Math.round(node.getBoundingClientRect().width) : null;
        const row = (id) => {
          const el = document.getElementById(id);
          return {ladder: size(el.querySelector('.ladder')), late: size(el.querySelector('.late')), lateBox: box(el.querySelector('.late')),
            own: size(el.querySelector('.own')), ownBox: box(el.querySelector('.own')),
            marked: el.querySelector('.late')?.classList.contains('sf-icon-loaded') ?? null};
        };
        return {earlyFirstFrame: window.__early, early: size(document.getElementById('early')),
          normal: row('normal'), compact: row('compact')};
      });
      measured[path].push(result);
      const loader = path.startsWith('/loader');
      for (const id of ['normal', 'compact']) {
        const r = result[id];
        if (r.late !== r.ladder) failures.push({path, load, row: id, check: 'a late icon draws at the ladder size of its row', ...r});
        if (r.own !== '16px') failures.push({path, load, row: id, check: 'a late icon takes the page\'s font-size', ...r});
        if (loader && !r.marked) failures.push({path, load, row: id, check: 'the Loader marks a late icon', ...r});
      }
      if (result.compact.ladder === result.normal.ladder) failures.push({path, load, check: 'compact moves the ladder one step down', ...result});
      if (errors.length) failures.push({path, load, errors});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({measured, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}
