#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A bare sf-button-icon holds the box it draws, width and height, before its
// code (GB17A-1 held the height, GB17B-1 the width of a link: an
// <sf-button-icon href> in an auto-width table cell or a flex row was 0 wide
// until its code came, its neighbours moved 28-32 px sideways and a
// right-aligned sum column's edge 183 px at 1440). The gate's 24b case for
// button-icon holds the height only (a cycle's sr-only live text widens the
// drawn union by a pixel), so this is the width's case.
//
// The held page links core.css alone (no code); the drawn page loads the
// code. For every case -- sizes 1/3, 1/2, 1, 2, 3 and no size; heights low,
// high, highest for sizes 1, 2 and 3; a button and a link (href); in a block,
// a flex row, an auto-width table cell, a full-width table with a
// right-aligned sum column and a line of text; the public padding variables
// -- the held host box is the drawn control's box (within 0.5 px) and the
// neighbours stand where they stand drawn (the word after it, the sum
// column's right edge, the mark under the case). Then the drawn page loads
// with no layout shift. 1440 and 390 (a touch phone), light and dark, 3 loads.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const TOLERANCE = 0.5;
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const base = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';

const cases = [];
const bi = (attrs) => `<sf-button-icon icon="download" aria-label="Скачать счёт" ${attrs}></sf-button-icon>`;
const LINK = 'href="/files/invoice-1043.pdf" download="invoice-1043.pdf" appearance="ghost"';
for (const size of ['', '1/3', '1/2', '1', '2', '3']) {
  const sz = size ? `size="${size}"` : '';
  const id = size ? size.replace('/', '_') : 'none';
  for (const [kind, extra] of [['button', ''], ['link', LINK]]) {
    cases.push({id: `block-${kind}-${id}`, html: `<div class="c">${bi(`${sz} ${extra}`)}</div>`});
    cases.push({id: `flex-${kind}-${id}`, html: `<div class="c row"><span class="w">Счёт 1043</span>${bi(`${sz} ${extra}`)}<span class="w next">после</span></div>`});
    cases.push({id: `cell-${kind}-${id}`, html: `<table class="c t"><tr><td><span class="w">Счёт 1043</span></td><td>${bi(`${sz} ${extra}`)}</td><td><span class="w next">12 500 ₽</span></td></tr></table>`});
    cases.push({id: `text-${kind}-${id}`, html: `<p class="c"><span class="w">Счёт</span> ${bi(`${sz} ${extra}`)} <span class="w next">после</span></p>`});
  }
}
for (const size of ['1/2', '1']) {
  for (const [kind, extra] of [['button', ''], ['link', LINK]]) {
    cases.push({id: `fulltable-${kind}-${size.replace('/', '_')}`, html: `<table class="c t full"><tr><td><span class="w">Счёт 1043</span></td><td class="num"><span class="w next">12 500 ₽</span></td><td>${bi(`size="${size}" ${extra}`)}</td></tr></table>`});
  }
}
for (const size of ['1', '2', '3']) {
  for (const height of ['low', 'high', 'highest']) {
    for (const [kind, extra] of [['button', ''], ['link', LINK]]) {
      cases.push({id: `flex-${kind}-${size}-${height}`, html: `<div class="c row"><span class="w">Счёт</span>${bi(`size="${size}" height="${height}" ${extra}`)}<span class="w next">после</span></div>`});
    }
  }
}
for (const [kind, extra] of [['button', ''], ['link', LINK]]) {
  cases.push({id: `padvars-${kind}`, html: `<div class="c row pad"><span class="w">Счёт</span>${bi(`size="1" ${extra}`)}<span class="w next">после</span></div>`});
}

const body = `<main id="stage">${cases.map((one) => `<section data-case="${one.id}">${one.html}<div class="mark">·</div></section>`).join('\n')}</main>`;
const pageCss = `.c{margin:0}.row{display:flex;gap:8px;align-items:center}.t{border-collapse:collapse}.t td{padding:4px 8px;border:1px solid}
.w{display:inline-block;inline-size:6rem;white-space:nowrap;overflow:hidden}.full{inline-size:100%}.num{text-align:right}.pad{--sf-icon-button-padding-block:2px;--sf-icon-button-padding-inline:10px}section{padding:4px 0}`;
const html = (theme, code) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${base}core/css/core.css">
  <style>${pageCss}</style>
  ${code ? `<script>window.sfPath='${base}';</script><script src="${base}core/lang/ru.js"></script><script type="module" src="${base}core/js/core.js"></script>` : ''}
  <script>window.__cls = 0; new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value; }).observe({type: 'layout-shift', buffered: true});</script>
  </head><body style="margin:16px">${body}</body></html>`;

// One reading per case: the control's box (the host before its code, the
// drawn button or link after: the host is display: contents then), the
// neighbour's left edge and right edge, the mark's top.
const read = () => [...document.querySelectorAll('section[data-case]')].map((section) => {
  const host = section.querySelector('sf-button-icon');
  const control = host.matches(':defined') ? host.querySelector(':scope > button, :scope > a') : host;
  const box = control ? control.getBoundingClientRect() : null;
  const next = section.querySelector('.next')?.getBoundingClientRect() ?? null;
  const mark = section.querySelector('.mark').getBoundingClientRect();
  const round = (n) => Math.round(n * 100) / 100;
  return {id: section.dataset.case, defined: host.matches(':defined'),
    box: box && [box.x, box.y, box.width, box.height].map(round),
    next: next && [next.left, next.right].map(round), mark: round(mark.top)};
});

// The text faces load on use (unicode ranges): both pages read once the
// words' faces came; the words around the control stand in boxes of a fixed
// width as well, so a load that set them in the metric fallback (Inter
// Fallback, 1-3 px narrower on these words, seen once in 24 loads) does not
// move the control.
const faces = async () => {
  await document.fonts.load('400 1rem "Inter Variable"', 'Счёт 1043 после 12 500 ₽ ·');
  await document.fonts.ready;
};

const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
let compared = 0;
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    for (let load = 1; load <= 3; load += 1) {
      const view = `${width} ${theme} load ${load}`;
      const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 768, hasTouch: width < 768});
      await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8',
        body: html(theme, !route.request().url().endsWith('/held'))}));
      await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
        const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
        return serve(route, join(out, product, product, ...rest));
      });
      const page = await context.newPage();
      const said = [];
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) said.push(message.text()); });
      page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));

      await page.goto('http://probe.test/held');
      await page.evaluate(faces);
      const held = await page.evaluate(read);

      await page.goto('http://probe.test/drawn');
      await page.waitForFunction(() => [...document.querySelectorAll('sf-button-icon')].every((host) => host.matches(':defined') && host.querySelector(':scope > button, :scope > a')), null, {timeout: 20000});
      await page.evaluate(faces);
      await page.waitForTimeout(500);
      const drawn = await page.evaluate(read);
      const cls = await page.evaluate(() => window.__cls);

      for (const after of drawn) {
        const before = held.find((one) => one.id === after.id);
        compared += 1;
        if (!before?.box || !after.box) { failures.push({view, id: after.id, name: 'a box before and after the code', before: before?.box, after: after.box}); continue; }
        const off = (a, b) => Math.abs(a - b) > TOLERANCE;
        const problems = [];
        if (off(before.box[2], after.box[2])) problems.push(`width ${before.box[2]} -> ${after.box[2]}`);
        if (off(before.box[3], after.box[3])) problems.push(`height ${before.box[3]} -> ${after.box[3]}`);
        if (off(before.box[0], after.box[0]) || off(before.box[1], after.box[1])) problems.push(`place ${before.box.slice(0, 2)} -> ${after.box.slice(0, 2)}`);
        if (before.next && after.next && (off(before.next[0], after.next[0]) || off(before.next[1], after.next[1]))) problems.push(`neighbour ${before.next} -> ${after.next}`);
        if (off(before.mark, after.mark)) problems.push(`mark under it ${before.mark} -> ${after.mark}`);
        if (problems.length) failures.push({view, id: after.id, name: 'the bare icon button holds the box it draws', problems});
      }
      if (cls > 0) failures.push({view, name: 'nothing shifts while the icon buttons draw', cls});
      if (said.length) failures.push({view, name: 'console', said});
      console.log(JSON.stringify({view, cases: drawn.length, cls}));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`button-icon bare box: ${failures.length} failure(s) of ${compared} compared`);
  process.exit(1);
}
console.log(`button-icon bare box: pass, ${compared} case loads compared (${cases.length} cases x 4 views x 3 loads)`);
