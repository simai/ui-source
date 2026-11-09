#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-header-site 1.7.2 on the built bytes: a collapsed bar fits its width. At
// 320, 360, 375, 390 and 414 px, in the light and the dark theme, three loads
// each, a bar whose brand and tools are wider than the phone (a Docara-like
// brand -- a logo and a title -- and three tools: a search button with its
// word, a language button and a settings button) does not scroll the page
// sideways: the brand gives way, the tools stay whole and inside the bar, and
// the brand ends before the tools. Two brand shapes: the link itself in the
// slot, and a wrapper holding the link (the shape Docara writes). The title's
// ellipsis is the page's own CSS, as a site writes it. At 1280 (wide) the
// brand keeps its full width: nothing changes on the wide bar.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const WIDTHS = [320, 360, 375, 390, 414];
const THEMES = ['theme-light', 'theme-dark'];
const LOADS = 3;
const SHAPES = ['link', 'wrapper'];

const logo = '<svg class="logo" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg>';
const title = '<span class="title">SIMAI Framework</span>';
const brand = (shape) => shape === 'link'
  ? `<a slot="brand" class="brand" href="/">${logo}${title}</a>`
  : `<div slot="brand" class="brand-wrap"><a class="brand" href="/">${logo}${title}</a></div>`;
const tools = `<div slot="tools" class="tools">
  <sf-button appearance="outline" scheme="on-surface" icon-start="search" text="Поиск" aria-label="Поиск"></sf-button>
  <sf-button-icon appearance="ghost" scheme="on-surface" icon="translate" aria-label="Язык"></sf-button-icon>
  <sf-button-icon appearance="ghost" scheme="on-surface" icon="settings" aria-label="Настройки"></sf-button-icon>
</div>`;

// The page's own brand CSS, as a site writes it: the title closes to an
// ellipsis. System values only.
const page = (theme, shape) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>
.brand{display:flex;align-items:center;gap:var(--sf-space-1\\/2);min-inline-size:0}
.logo{flex:none;block-size:var(--sf-c8);inline-size:var(--sf-c8)}
.title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:var(--sf-font-weight-bold)}
.tools{display:flex;align-items:center;gap:var(--sf-space-1\\/3)}
</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<sf-header-site id="h" collapse="md">
  ${brand(shape)}
  <nav aria-label="Разделы"><a href="#framework">Framework</a> <a href="#docara">Docara</a></nav>
  ${tools}
</sf-header-site>
<main><p>Страница</p></main>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme'), url.searchParams.get('shape')));
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

const measure = (tab) => tab.evaluate(() => {
  const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
  const row = document.querySelector('#h .sf-site-header-row');
  const rowRect = row.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(row).paddingInlineEnd);
  const brandBox = rect('#h .sf-site-header-brand');
  const toolsBox = rect('#h .sf-site-header-tools');
  const toolButtons = [...document.querySelectorAll('#h .tools button')].map((b) => b.getBoundingClientRect().width);
  const titleNode = document.querySelector('#h .title');
  return {
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    rowRight: rowRect.right - pad,
    brand: {left: brandBox.left, right: brandBox.right, width: brandBox.width},
    tools: {left: toolsBox.left, right: toolsBox.right, width: toolsBox.width},
    toolButtons,
    title: {scroll: titleNode.scrollWidth, client: titleNode.clientWidth},
    menuShown: Boolean(document.querySelector('#h .sf-site-header-menu-button button')?.getClientRects().length),
  };
});

const failures = [];
const seen = [];
const browser = await chromium.launch();
try {
  const open = async (width, theme, shape) => {
    const tab = await browser.newPage({viewport: {width, height: 800}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(String(error)));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`http://127.0.0.1:${server.address().port}/page?theme=${theme}&shape=${shape}`);
    await tab.waitForFunction(() => customElements.get('sf-header-site') && document.querySelector('#h .sf-site-header-tools button'), null, {timeout: 15000})
      .catch(() => failures.push(`${width} ${theme} ${shape}: the header never drew`));
    await tab.evaluate(() => document.fonts?.ready);
    await tab.waitForTimeout(150);
    return {tab, errors};
  };

  // The wide bar: the brand at its own width.
  for (const shape of SHAPES) {
    const {tab, errors} = await open(1280, 'theme-light', shape);
    const m = await measure(tab);
    seen.push({width: 1280, theme: 'theme-light', shape, ...m});
    if (m.title.scroll > m.title.client) failures.push(`1280 ${shape}: the wide brand's title is cut (${m.title.client} of ${m.title.scroll})`);
    if (m.scrollWidth > m.viewport) failures.push(`1280 ${shape}: the page scrolls sideways (${m.scrollWidth} > ${m.viewport})`);
    if (errors.length) failures.push(`1280 ${shape}: console errors ${JSON.stringify(errors)}`);
    await tab.close();
  }

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      for (const shape of SHAPES) {
        for (let load = 1; load <= LOADS; load += 1) {
          const {tab, errors} = await open(width, theme, shape);
          const m = await measure(tab);
          seen.push({width, theme, shape, load, ...m});
          const at = `${width} ${theme} ${shape} load ${load}`;
          if (!m.menuShown) failures.push(`${at}: the bar is not collapsed`);
          if (m.scrollWidth > m.viewport) failures.push(`${at}: the page scrolls sideways (${m.scrollWidth} > ${m.viewport})`);
          if (m.tools.right > m.rowRight + 0.5) failures.push(`${at}: the tools end at ${m.tools.right}, past the bar's inner edge ${m.rowRight}`);
          if (m.brand.right > m.tools.left + 0.5) failures.push(`${at}: the brand (right ${m.brand.right}) runs into the tools (left ${m.tools.left})`);
          if (m.brand.width <= 0) failures.push(`${at}: the brand is gone`);
          if (m.toolButtons.length !== 3) failures.push(`${at}: ${m.toolButtons.length} tool buttons, expected 3`);
          if (errors.length) failures.push(`${at}: console errors ${JSON.stringify(errors)}`);
          await tab.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = reportOnly ? 0 : (failures.length ? 1 : 0);
