#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// Headings do not follow density (owner decision C44, 2026-11-10): h1-h6, the
// page header title, the empty-state title, the drawer, card and modal titles
// keep the C21 ladder in a compact region, whether data-sf-density="compact"
// stands on <html> or on a container. Each placement is drawn on its own page
// and measured against the page without density, at 1440 and 390, light and
// dark, three loads each; the body text of the region does move (16 -> 14 on
// the desktop), so the region is known to be compact. The console stays clean.
// A question window (size="question", C39) stands beside the plain one: its
// title rule is scoped to the question size, so the plain title is the
// heading-3 step (24 on the desktop) in compact too, and the question title
// keeps its 20 (pair next 2, dispatcher).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const body = (placement) => `<main id="region"${placement === 'container' ? ' data-sf-density="compact"' : ''}>
  <h1 data-k="h1">Заголовок 1</h1><h2 data-k="h2">Заголовок 2</h2><h3 data-k="h3">Заголовок 3</h3>
  <h4 data-k="h4">Заголовок 4</h4><h5 data-k="h5">Заголовок 5</h5><h6 data-k="h6">Заголовок 6</h6>
  <p data-k="text">Обычный текст абзаца.</p>
  <sf-header-page heading="Каталог решений" count="448"></sf-header-page>
  <sf-empty-state data-k="empty-1" kind="nothing-found" size="1" heading-level="3"></sf-empty-state>
  <sf-empty-state data-k="empty-1-2" kind="nothing-found" size="1/2" heading-level="3"></sf-empty-state>
  <sf-empty-state data-k="empty-2" kind="nothing-found" size="2" heading-level="3"></sf-empty-state>
  <div class="sf-card" data-k="card"><h3>Заголовок карточки</h3><p>Текст карточки.</p></div>
  <sf-drawer open heading="Фильтры" placement="right"><p>Содержимое панели</p></sf-drawer>
  <sf-modal open heading="Подтверждение"><div slot="content"><p>Сохранить?</p></div></sf-modal>
  <sf-modal open size="question" heading="Удалить файл?"><div slot="content"><p>Файл нельзя будет вернуть.</p></div></sf-modal>
</main>`;

const page = (placement, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"${placement === 'html' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>body{margin:0;padding:8px;background:var(--sf-surface)}</style>
<script src="/distr/core/js/core.js"></script></head><body>${body(placement)}</body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('placement'), url.searchParams.get('theme')));
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

const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const text = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return `${round(parseFloat(style.fontSize))}/${round(parseFloat(style.lineHeight))}`;
  };
  const at = (selector) => document.querySelector(selector);
  return {
    h1: text(at('[data-k="h1"]')), h2: text(at('[data-k="h2"]')), h3: text(at('[data-k="h3"]')),
    h4: text(at('[data-k="h4"]')), h5: text(at('[data-k="h5"]')), h6: text(at('[data-k="h6"]')),
    page: text(at('sf-header-page .sf-page-header-heading')),
    'empty-1': text(at('[data-k="empty-1"] .sf-empty-state-title')),
    'empty-1/2': text(at('[data-k="empty-1-2"] .sf-empty-state-title')),
    'empty-2': text(at('[data-k="empty-2"] .sf-empty-state-title')),
    card: text(at('[data-k="card"] > h3')),
    drawer: text(at('.sf-drawer-title')),
    modal: text([...document.querySelectorAll('.sf-modal-title')].find((title) => !title.closest('.sf-modal--size-question'))),
    'modal-question': text(document.querySelector('.sf-modal--size-question .sf-modal-title')),
    body: text(at('[data-k="text"]')),
  };
};

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'page', 'empty-1', 'empty-1/2', 'empty-2', 'card', 'drawer', 'modal', 'modal-question'];
// The desktop steps (C21): a window's title is heading 3, a question
// window's heading 4; both in every placement.
const DESKTOP_SIZE = {modal: 24, 'modal-question': 20};
const failures = [];
const report = {};
const consoleErrors = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      for (const placement of ['none', 'html', 'container']) {
        for (let load = 1; load <= 3; load += 1) {
          const context = await browser.newContext({viewport: {width, height: 900}});
          const tab = await context.newPage();
          const tag = `${width}/${theme}/${placement}/${load}`;
          tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) consoleErrors.push(`${tag}: ${message.text()}`); });
          tab.on('pageerror', (error) => consoleErrors.push(`${tag}: ${error.message}`));
          tab.on('requestfailed', (request) => consoleErrors.push(`${tag}: failed ${request.url()}`));
          await tab.goto(`http://127.0.0.1:${server.address().port}/page?placement=${placement}&theme=${theme}`);
          await tab.waitForFunction(() => document.querySelector('sf-header-page .sf-page-header-heading') && document.querySelector('.sf-drawer-title')
            && document.querySelector('[data-k="empty-2"] .sf-empty-state-title') && document.querySelectorAll('.sf-modal-title').length === 2
            && document.querySelector('.sf-modal--size-question .sf-modal-title'), null, {timeout: 20000});
          await tab.evaluate(() => document.fonts.ready);
          await tab.waitForTimeout(300);
          (report[`${width}/${theme}/${placement}`] ||= []).push(await tab.evaluate(MEASURE));
          await context.close();
        }
      }
      const key = (placement) => `${width}/${theme}/${placement}`;
      for (const placement of ['none', 'html', 'container']) {
        const runs = report[key(placement)];
        if (runs.some((run) => JSON.stringify(run) !== JSON.stringify(runs[0]))) failures.push({check: 'three loads agree', at: key(placement), runs});
      }
      if (width === 1440) {
        for (const placement of ['none', 'html', 'container']) {
          const [run] = report[key(placement)];
          for (const [name, size] of Object.entries(DESKTOP_SIZE)) {
            if (parseFloat(run[name]) !== size) failures.push({check: `${name} title is ${size}px`, at: key(placement), got: run[name]});
          }
        }
      }
      const [normal] = report[key('none')];
      for (const placement of ['html', 'container']) {
        const [compact] = report[key(placement)];
        for (const name of HEADINGS) {
          if (compact[name] !== normal[name]) failures.push({check: `${name} keeps its normal size in compact (${placement})`, at: key(placement), normal: normal[name], compact: compact[name]});
        }
        // The region is compact: the desktop body text moves 16 -> 14; the
        // phone ladder already is the dense one (C36).
        const moved = width >= 960 ? compact.body !== normal.body : compact.body === normal.body;
        if (!moved) failures.push({check: 'the region is compact (body text)', at: key(placement), normal: normal.body, compact: compact.body});
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (consoleErrors.length) failures.push({check: 'console clean', errors: consoleErrors.slice(0, 20)});
const table = Object.fromEntries(Object.entries(report).map(([key, runs]) => [key, runs[0]]));
console.log(JSON.stringify(table, null, 1));
if (failures.length) {
  console.error(JSON.stringify({failures: failures.slice(0, 40), total: failures.length}, null, 1));
  if (!reportOnly) process.exit(1);
}
console.log('HEADINGS_DENSITY_OK');
