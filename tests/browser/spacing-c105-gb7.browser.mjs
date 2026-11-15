#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> writes spacing-c105-gb7.json (every measure of
//        every load).
//        SF_RELOADS=<n> loads each page n times (3 by default).
//        SF_PORT=<port> serves on that port (any free one by default).
//        SF_EXPECT=0 only measures (for a build without the fix).
//
// C105 H5 (DEV recipes list-bottom and brand-theme, 2026-11-15), drawn by the
// real Framework over the Loader from the built bytes, at 1440 and 390 (touch),
// light and dark, normal and compact density, Russian and English pages:
//
//   (1) sf-pagination: every two neighbouring controls of the row (the edge
//       buttons, the page field, the page numbers, the place words) stand
//       --sf-space-1/3 apart (8; 4 in the compact density of a desktop), in each of the
//       appearances field, numbers, arrows and cursor;
//   (2) sf-input-color: the value and the reset beside it in the frame stand
//       --sf-space-1/3 apart, at sizes 1 and 1/2, in the field and the brand
//       variant;
//   (3) the brand field's reset is named «Вернуть цвет SIMAI» / «Restore SIMAI
//       colour»; the field's keeps «Вернуть унаследованный» / «Use the
//       inherited colour»;
//   no console error, no failed request, no horizontal scroll on any load.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const reloads = Math.max(1, Number(process.env.SF_RELOADS || 3));
const expect = process.env.SF_EXPECT !== '0';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};

const page = ({lang, theme, density}) => `<!doctype html><html lang="${lang}" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>C105 H5 pagination and colour</title>
<script>window.SF_BOOT_CONFIG={theme:false,preloader:{enabled:false}};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface-page);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:24px;min-inline-size:0}#unit{inline-size:var(--sf-space-1\\/3);block-size:1px}</style></head><body><main>
<div id="unit"></div>
<sf-pagination id="pg-field-12" appearance="field" size="1/2" total="340" page-size="20" current="1" show-page-size="false"></sf-pagination>
<sf-pagination id="pg-field-1" appearance="field" total="240" page-size="20" current="5" show-page-size="false"></sf-pagination>
<sf-pagination id="pg-field-estimate" appearance="field" size="1/2" total="12000" total-exact="false" can-count page-size="20" current="3" show-page-size="false"></sf-pagination>
<sf-pagination id="pg-numbers" appearance="numbers" total="240" page-size="20" current="5"></sf-pagination>
<sf-pagination id="pg-arrows" appearance="arrows" total="240" page-size="20" current="3"></sf-pagination>
<sf-pagination id="pg-cursor" appearance="cursor" total="240" page-size="20" current="3"></sf-pagination>
<sf-input-color id="c-field" label="Цвет" value="#1a7f37" clearable></sf-input-color>
<sf-input-color id="c-field-12" label="Цвет" size="1/2" value="#1a7f37" clearable></sf-input-color>
<sf-input-color id="c-brand" variant="brand" label="Фирменный цвет" value="#0b57d0" clearable></sf-input-color>
<sf-input-color id="c-brand-12" variant="brand" size="1/2" label="Фирменный цвет" value="#0b57d0" clearable></sf-input-color>
</main></body></html>`;

const WORDS = {
  ru: {field: 'Вернуть унаследованный', brand: 'Вернуть цвет SIMAI'},
  en: {field: 'Use the inherited colour', brand: 'Restore SIMAI colour'},
};

const failed = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  if (url.pathname === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page({lang: url.searchParams.get('lang'), theme: url.searchParams.get('theme'), density: url.searchParams.get('density')}));
  }
  const match = decodeURIComponent(url.pathname).match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    failed.push(url.pathname);
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(Number(process.env.SF_PORT || 0), '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// Every gap between two neighbouring boxes of a pagination row and of a colour frame.
const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const boxOf = (element) => {
    // display: contents hosts and items: the first descendant that has a box.
    let node = element;
    while (node && getComputedStyle(node).display === 'contents') node = node.firstElementChild;
    if (!node) return null;
    const inner = node.matches('sf-button-icon, sf-button') ? node.querySelector('button, a') || node : node;
    const rect = inner.getBoundingClientRect();
    return rect.width > 0 ? {rect, name: inner.getAttribute('aria-label') || inner.textContent.trim().slice(0, 24)} : null;
  };
  const row = (container) => {
    const items = [];
    const walk = (parent) => {
      for (const child of parent.children) {
        if (getComputedStyle(child).display === 'contents' && !child.matches('sf-button-icon, sf-button')) walk(child);
        else {
          const box = boxOf(child);
          if (box) items.push(box);
        }
      }
    };
    walk(container);
    items.sort((a, b) => a.rect.left - b.rect.left);
    const gaps = [];
    for (let i = 1; i < items.length; i += 1) gaps.push({a: items[i - 1].name, b: items[i].name, gap: round(items[i].rect.left - items[i - 1].rect.right)});
    return gaps;
  };
  const unit = round(document.getElementById('unit').getBoundingClientRect().width);
  const pagination = {};
  for (const element of document.querySelectorAll('sf-pagination')) {
    const list = element.querySelector('.sf-pagination-list');
    pagination[element.id] = list ? row(list) : null;
  }
  const colour = {};
  for (const element of document.querySelectorAll('sf-input-color')) {
    const frame = element.querySelector('.sf-color-frame');
    const trigger = frame?.querySelector('.sf-color-trigger');
    const clear = frame?.querySelector('[data-action="clear"]');
    const button = clear?.querySelector('button') || clear;
    colour[element.id] = trigger && button ? {gap: round(button.getBoundingClientRect().left - trigger.getBoundingClientRect().right), word: button.getAttribute('aria-label') || clear.getAttribute('aria-label'), title: button.getAttribute('title') || clear.getAttribute('title')} : null;
  }
  return {unit, pagination, colour, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth};
};

const browser = await chromium.launch();
const loads = [];
const problems = [];
for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark']) {
    for (const density of ['normal', 'compact']) {
      for (const lang of ['ru', 'en']) {
        if (lang === 'en' && (theme === 'dark' || density === 'compact')) continue;
        for (let load = 1; load <= reloads; load += 1) {
          const context = await browser.newContext(width === 390
            ? {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce'}
            : {viewport: {width: 1440, height: 900}, colorScheme: theme, reducedMotion: 'reduce'});
          const tab = await context.newPage();
          const errors = [];
          tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
          tab.on('console', (message) => { if (message.type() === 'error') errors.push(`console ${message.text()}`); });
          tab.on('requestfailed', (request) => errors.push(`requestfailed ${request.url()}`));
          await tab.goto(`${origin}/?lang=${lang}&theme=${theme}&density=${density}`, {waitUntil: 'load'});
          await tab.waitForFunction(() => [...document.querySelectorAll('sf-pagination, sf-input-color')].every((element) => element.querySelector('.sf-pagination-list, .sf-pagination-more, .sf-color-frame')), null, {timeout: 20000});
          await tab.evaluate(() => document.fonts.ready);
          await tab.waitForTimeout(600);
          const measure = await tab.evaluate(MEASURE);
          const view = `${width} ${theme} ${density} ${lang} #${load}`;
          loads.push({view, width, theme, density, lang, load, errors, ...measure});
          if (errors.length) problems.push(`${view}: ${errors.join('; ')}`);
          if (measure.overflow > 0) problems.push(`${view}: horizontal scroll ${measure.overflow}`);
          if (expect) {
            for (const [id, gaps] of Object.entries(measure.pagination)) {
              if (!gaps?.length) { problems.push(`${view}: ${id} drew no row`); continue; }
              for (const {a, b, gap} of gaps) if (Math.abs(gap - measure.unit) > 0.5) problems.push(`${view}: ${id} «${a}» -> «${b}» ${gap}, H5 wants ${measure.unit}`);
            }
            for (const [id, reading] of Object.entries(measure.colour)) {
              if (!reading) { problems.push(`${view}: ${id} drew no reset`); continue; }
              if (Math.abs(reading.gap - measure.unit) > 0.5) problems.push(`${view}: ${id} value -> reset ${reading.gap}, H5 wants ${measure.unit}`);
              const want = WORDS[lang][id.startsWith('c-brand') ? 'brand' : 'field'];
              if (reading.word !== want || reading.title !== want) problems.push(`${view}: ${id} reset says «${reading.word}» / «${reading.title}», wants «${want}»`);
            }
          }
          await context.close();
        }
      }
    }
  }
}
await browser.close();
server.close();
if (failed.length) problems.push(`not served: ${[...new Set(failed)].join(', ')}`);
if (evidence) writeFileSync(join(evidence, 'spacing-c105-gb7.json'), `${JSON.stringify({loads, problems}, null, 1)}\n`);
console.log(`${loads.length} loads, ${problems.length} problem(s)`);
for (const problem of problems.slice(0, 40)) console.log(`  ${problem}`);
process.exit(problems.length ? 1 : 0);
