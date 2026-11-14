#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-theme-generator on a narrow screen (2026-11-09). At a 390px viewport the
// generator stood 17px wider than its column and the page scrolled sideways.
// This probe lays the generator into a page column (16px gutters) at every
// width from 320 to 1440 -- and in a card inside it, the way a documentation
// example frames it --, in both themes and at every size, with and without
// the product's own swatches, and asks two things of the built bytes: nothing
// inside the generator reaches past the generator's own box, and the page has
// no horizontal scroll. Each width is loaded three times and the console must
// stay clean.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/inputs/css/inputs.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'smart/smart/input/css/input.css',
  'smart/smart/input-color/css/input-color.css', 'smart/smart/theme-generator/css/theme-generator.css'];
const modules = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button-icon/js/button-icon.js', 'smart/smart/button/js/button.js', 'smart/smart/input/js/input.js',
  'smart/smart/input-color/js/input-color.js', 'smart/smart/theme-generator/js/theme-generator.js'];
const absent = modules.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build module(s) not found under ${out}: ${absent.join(', ')}`);

const WIDTHS = [320, 360, 375, 390, 414, 480, 600, 768, 1024, 1280, 1440];
const THEMES = ['theme-light', 'theme-dark'];
const LOADS = 3;
const SWATCHES = '#2e7d32|Лес, #c62828|Кирпич, #6a1b9a|Слива';

const failures = [];
const report = [];
const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      for (let load = 1; load <= LOADS; load += 1) {
        const page = await browser.newPage({viewport: {width, height: 900}});
        const consoleErrors = [];
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', (error) => consoleErrors.push(String(error)));
        const origin = 'http://probe.test';
        const serve = (path, route) => (existsSync(path)
          ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
          : route.fulfill({status: 404, body: ''}));
        await page.route(`${origin}/**`, (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
          if (url.pathname === '/favicon.ico') return route.fulfill({status: 204, body: ''});
          return serve(join(out, url.pathname), route);
        });
        await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
          const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
          const [product, ...rest] = tail.split('/');
          return serve(join(out, product, product, ...rest), route);
        });
        await page.goto(`${origin}/`);
        await page.setContent(`<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body style="margin:0"><main style="padding-inline:16px">
            ${['page', 'card'].map((layout) => `<div data-layout="${layout}" style="padding-inline:${layout === 'card' ? '32px' : '0'}">
            ${['1/2', '1', '2'].map((size) => `
              <sf-theme-generator data-case="plain-${size}" size="${size}"></sf-theme-generator>
              <sf-theme-generator data-case="swatches-${size}" size="${size}" swatches="${SWATCHES}"></sf-theme-generator>
              <sf-theme-generator data-case="open-${size}" size="${size}" value="#2e7d32" swatches="${SWATCHES}"></sf-theme-generator>`).join('')}
            </div>`).join('')}
          </main></body></html>`);
        for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`});
        await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
        for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
        await page.waitForFunction(() => [...document.querySelectorAll('sf-theme-generator')].every((host) =>
          host.querySelector('[data-palette="primary"] [data-tone="40"]') && host.querySelector('sf-input-color .sf-color-trigger')
          && host.querySelector('sf-button > button')), null, {timeout: 10000});
        // Every <details> open, so the fine-tuning fields are measured too.
        await page.evaluate(() => document.querySelectorAll('sf-theme-generator details').forEach((node) => { node.open = true; }));
        await page.waitForTimeout(300);
        const measured = await page.evaluate(() => {
          const doc = document.documentElement;
          // The host is display: contents (no box of its own), so the bound is
          // the column it is laid into: the content box of its parent -- the
          // page column (16px gutters) or a card inside it (32px more each
          // side, as a documentation example frames it).
          const cases = [...document.querySelectorAll('sf-theme-generator')].map((host) => {
            const column = host.parentElement;
            const outer = column.getBoundingClientRect();
            const pad = getComputedStyle(column);
            const box = {left: outer.left + parseFloat(pad.paddingLeft), right: outer.right - parseFloat(pad.paddingRight)};
            let worst = null;
            for (const node of host.querySelectorAll('*')) {
              const rect = node.getBoundingClientRect();
              if (!rect.width && !rect.height) continue;
              const past = Math.max(rect.right - box.right, box.left - rect.left);
              if (past > 0.5 && (!worst || past > worst.past)) {
                worst = {past: Math.round(past * 10) / 10, node: `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/u).join('.')}` : ''}`};
              }
            }
            return {case: `${column.dataset.layout}/${host.dataset.case}`, width: Math.round(host.querySelector('.sf-theme-generator').getBoundingClientRect().width), worst};
          });
          return {scroll: doc.scrollWidth - doc.clientWidth, cases};
        });
        const bad = measured.cases.filter((entry) => entry.worst);
        report.push({theme, width, load, scroll: measured.scroll, overflowing: bad, consoleErrors});
        if (measured.scroll > 0) failures.push(`${theme} ${width}px load ${load}: page scrolls ${measured.scroll}px sideways`);
        for (const entry of bad) failures.push(`${theme} ${width}px load ${load}: ${entry.case} — ${entry.worst.node} reaches ${entry.worst.past}px past the generator`);
        for (const error of consoleErrors) failures.push(`${theme} ${width}px load ${load}: console error: ${error}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

const summary = WIDTHS.map((width) => {
  const rows = report.filter((row) => row.width === width);
  return `${width}px: page scroll max ${Math.max(...rows.map((row) => row.scroll))}px, overflowing cases ${Math.max(...rows.map((row) => row.overflowing.length))}`;
});
console.log(summary.join('\n'));
if (process.env.PROBE_JSON) console.log(JSON.stringify(report, null, 1));
if (failures.length) {
  console.error(`FAIL theme-generator-narrow: ${failures.length} finding(s)\n${[...new Set(failures)].slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log(`PASS theme-generator-narrow: ${WIDTHS.length} widths × ${THEMES.length} themes × ${LOADS} loads, 18 cases each (9 in the page column, 9 in a card); no overflow, no sideways scroll, console clean`);
