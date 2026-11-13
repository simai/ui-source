#!/usr/bin/env node
// Usage: PLAYWRIGHT_BROWSERS_PATH=… node this-file <build-output-root> [<output-dir>]
//
// Without an output dir the report and the screenshot go to a fresh folder in
// the system's temporary directory, named on stdout: the probe sweep
// (scripts/run-browser-probes.mjs) gives a probe the roots its own error names,
// and this one named none it knows, so a pair's sweep listed it as unknown
// (pair-next-3).
//
// A utility's base sheet stands before its breakpoint sheets, whatever order
// they arrive in (2026-11-10 composition review, P9; core.runtime 1.51.1).
// Each pass of the Loader asks for a utility's sheets base first, but a later
// pass appended its sheets after an earlier pass's: when md:grid-col-2 was
// seen in one pass and grid-col-1 in the next, the base sheet stood after the
// md sheet, grid-col-1 beat md:grid-col-2, and a section drew one column at
// 1440. The Loader now puts a sheet before the first sheet of the same
// utility whose point comes after its own.
//
// Timing-hostile: each scenario delays one of the two sheets (the base sheet,
// then the breakpoint sheet), and either has both classes in the first pass
// or brings the base class in a later pass, after the md sheet has arrived.
// Every frame from the moment both sheets apply must show two columns at
// 1440. Each scenario is loaded three times; the console must stay clean.
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required (usage: <build-output-root> [<output-dir>])');
const out = resolve(process.argv[2]);
const outputDir = process.argv[3] ? resolve(process.argv[3]) : mkdtempSync(join(tmpdir(), 'loader-utility-sheet-order-'));
mkdirSync(outputDir, {recursive: true});
const file = (path) => {
  const [product, ...rest] = path.split('/');
  const nested = join(out, product, product, ...rest);
  return existsSync(nested) ? nested : join(out, product, ...rest);
};
const BASE = /\/utility\/grid-template-columns\/default\/css\/default(?:\.min)?\.css/u;
const MD = /\/utility\/grid-template-columns\/md\/css\/md(?:\.min)?\.css/u;
const DELAY = 700;

const page = (pass) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <link rel="stylesheet" href="/distr/core/css/core.css">
  <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'sheet-order-${pass}', pluginListVersion: 'sheet-order-${pass}', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
  <style>.cell{min-block-size:var(--sf-space-4);background:var(--sf-surface-2);}</style></head><body>
  ${pass === 'later' ? '<div id="early" class="grid md:grid-col-2"><div class="cell">early</div><div class="cell">early</div></div>' : ''}
  <main id="host">${pass === 'same' ? section() : ''}</main>
  <script>
    ${pass === 'later' ? `
    // The base class comes in a later pass, once the md sheet applies.
    const md = () => [...document.styleSheets].some((sheet) => /grid-template-columns\\/md\\//.test(sheet.href || '') && sheet.cssRules.length);
    const wait = () => (md() ? document.getElementById('host').insertAdjacentHTML('beforeend', ${JSON.stringify(section())}) : requestAnimationFrame(wait));
    requestAnimationFrame(wait);` : ''}
  </script>
  <script src="/distr/core/js/core.js"></script></body></html>`;

function section() {
  return '<section id="probe" class="grid grid-col-1 md:grid-col-2 gap-3"><div class="cell">Первая колонка</div><div class="cell">Вторая колонка</div></section>';
}

const browser = await chromium.launch();
const failures = [];
const runs = [];
try {
  for (const pass of ['same', 'later']) {
    for (const delayed of ['base', 'breakpoint']) {
      for (let load = 1; load <= 3; load += 1) {
        const tab = await browser.newPage({viewport: {width: 1440, height: 600}});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
        tab.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`); });
        tab.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        // Every frame: the probe's columns, and which of the two sheets apply.
        await tab.addInitScript(() => {
          window.__frames = [];
          const applies = (pattern) => [...document.styleSheets].some((sheet) => {
            try { return pattern.test(sheet.href || '') && sheet.cssRules.length > 0; } catch { return false; }
          });
          const read = () => {
            const probe = document.getElementById('probe');
            if (probe) {
              const columns = getComputedStyle(probe).gridTemplateColumns.split(' ').filter(Boolean).length;
              window.__frames.push({columns, base: applies(/grid-template-columns\/default\//u), md: applies(/grid-template-columns\/md\//u)});
            }
            if (window.__frames.length < 240) requestAnimationFrame(read);
          };
          requestAnimationFrame(read);
        });
        await tab.route('http://probe.test/**', async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: page(pass)});
          if (url.pathname === '/favicon.ico') return route.fulfill({status: 204, body: ''});
          const target = file(url.pathname.replace(/^\/distr\//u, ''));
          if (!existsSync(target)) return route.fulfill({status: 404, body: ''});
          if ((delayed === 'base' && BASE.test(url.pathname)) || (delayed === 'breakpoint' && MD.test(url.pathname))) await new Promise((done) => setTimeout(done, DELAY));
          return route.fulfill({status: 200, contentType: target.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(target)});
        });
        await tab.goto('http://probe.test/');
        await tab.waitForFunction(() => window.__frames.length >= 240 || window.__frames.some((frame) => frame.base && frame.md), null, {timeout: 15000}).catch(() => {});
        await tab.waitForTimeout(DELAY + 400);
        const state = await tab.evaluate(() => ({
          frames: window.__frames,
          links: [...document.querySelectorAll('link[rel~="stylesheet"]')].map((link) => new URL(link.href).pathname).filter((path) => path.includes('grid-template-columns')),
          columns: getComputedStyle(document.getElementById('probe')).gridTemplateColumns.split(' ').filter(Boolean).length,
          width: Math.round(document.getElementById('probe').getBoundingClientRect().width),
        }));
        const both = state.frames.findIndex((frame) => frame.base && frame.md);
        const after = both < 0 ? [] : state.frames.slice(both);
        const wrong = after.filter((frame) => frame.columns !== 2).length;
        const baseIndex = state.links.findIndex((path) => BASE.test(path));
        const mdIndex = state.links.findIndex((path) => MD.test(path));
        const run = {pass, delayed, load, framesSeen: state.frames.length, framesAfterBoth: after.length, framesNotTwo: wrong, links: state.links, columns: state.columns, width: state.width, errors};
        runs.push(run);
        const label = `${pass} pass, ${delayed} delayed, load ${load}`;
        if (both < 0) failures.push({case: `${label}: both sheets apply`, run});
        if (wrong) failures.push({case: `${label}: every frame after both sheets apply has two columns`, run});
        if (state.columns !== 2) failures.push({case: `${label}: two columns at 1440 at the end`, run});
        if (!(baseIndex >= 0 && mdIndex >= 0 && baseIndex < mdIndex)) failures.push({case: `${label}: the base sheet stands before the md sheet`, run});
        if (errors.length) failures.push({case: `${label}: console clean`, run});
        if (load === 3 && pass === 'later' && delayed === 'base') await tab.screenshot({path: resolve(outputDir, 'grid-1440.png')});
        await tab.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`report: ${resolve(outputDir, 'loader-utility-sheet-order.json')}`);
writeFileSync(resolve(outputDir, 'loader-utility-sheet-order.json'), `${JSON.stringify({status: failures.length ? 'failed' : 'passed', failures, runs}, null, 2)}\n`);
console.log(JSON.stringify(runs.map(({pass, delayed, load, framesAfterBoth, framesNotTwo, columns, links}) => ({pass, delayed, load, framesAfterBoth, framesNotTwo, columns, order: links.map((path) => path.split('/').at(-1))}))));
if (failures.length) {
  console.error(JSON.stringify({failures: failures.map(({case: name}) => name)}, null, 1));
  process.exit(1);
}
console.log('LOADER_UTILITY_SHEET_ORDER_OK');
