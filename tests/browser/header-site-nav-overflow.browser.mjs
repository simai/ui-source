#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-header-site 1.13.0 on the built bytes (F-1, docs header 2026-11-18): a
// wide bar whose nav needs more room than the row leaves it gives way instead
// of drawing the nav over the brand and the tools. The docs' header as Docara
// writes it -- a brand of a logo and a title, a static class menu of five
// sections in the nav (ul.sf-menu--horizontal), a search button with its word,
// a language menu and a settings button, collapse xl -- is swept from 1000 to
// 1600 px in 20 px steps, in the light and the dark theme, three loads each.
// At every width either the bar is collapsed (the menu button shows, the nav
// is out of the row) or the gaps between the brand's words, each section's
// box (a link, or the menu's «Ещё» button: the range of its words would hold
// its closed list) and the first tool are all >= 0. The bar is not collapsed at 1600, and
// a bar whose nav is an sf-menu with overflow more is never collapsed by the
// fit (its menu gives way itself: data-nav-overflow stays off).
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

const THEMES = ['theme-light', 'theme-dark'];
const LOADS = 3;
const SECTIONS = ['Руководство', 'Утилиты', 'Компоненты', 'Смарт-компоненты', 'Рецепты'];
const logo = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="4"/></svg>';
const navs = {
  static: `<div class="flex items-cross-center gap-2 min-w-0"><nav aria-label="Главное"><ul class="sf-menu sf-menu--horizontal flex items-cross-center gap-1/3">${SECTIONS.map((text, index) => `<li class="sf-menu-item"><a class="sf-menu-element h-d0 flex items-cross-center radius-1 p-inline-1" href="#s${index}"${index ? '' : ' aria-current="page"'}><span class="sf-menu-element-text">${text}</span></a></li>`).join('')}</ul></nav></div>`,
  menu: `<sf-menu orientation="horizontal" overflow="more" appearance="navigation" aria-label="Главное"><ul>${SECTIONS.map((text, index) => `<li><a href="#s${index}"${index ? '' : ' aria-current="page"'}>${text}</a></li>`).join('')}</ul></sf-menu>`,
};
const page = (theme, nav) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<sf-header-site id="h" collapse="xl" sticky label="Навигация" menu-label="Открыть навигацию" close-label="Закрыть навигацию">
<a slot="brand" href="/">${logo}<span class="brand-title">SIMAI Framework</span></a>
${navs[nav]}
<sf-button slot="tools" size="1" appearance="outline" scheme="on-surface" icon-start="search" text="Поиск"></sf-button>
<sf-language slot="tools" mode="menu" size="1" value="ru" label="Язык"><script type="application/json" data-sf-settings>{"items":[{"code":"ru","label":"Русский","href":"#ru"},{"code":"en","label":"English","href":"#en"}]}</script></sf-language>
<sf-button-icon slot="tools" icon="settings" appearance="ghost" scheme="on-surface" size="1" aria-label="Настройки"></sf-button-icon>
</sf-header-site>
<main><p>Страница</p></main>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme'), url.searchParams.get('nav')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = [];
const browser = await chromium.launch();
try {
  for (const nav of ['static', 'menu']) {
    for (const theme of THEMES) {
      for (let load = 1; load <= LOADS; load += 1) {
        const page = await browser.newPage({viewport: {width: 1000, height: 600}});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(`${origin}/page?theme=${theme}&nav=${nav}`);
        await page.waitForFunction(() => document.querySelector('#h')?.hasAttribute('data-sf-started') && document.fonts.status === 'loaded', null, {timeout: 15000});
        await page.waitForTimeout(400);
        const rows = [];
        for (let width = 1000; width <= 1600; width += 20) {
          await page.setViewportSize({width, height: 600});
          await page.waitForTimeout(250);
          rows.push(await page.evaluate((width) => {
            const host = document.querySelector('#h');
            const bar = host.querySelector(':scope > .sf-site-header');
            const shown = (element) => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0 && box.top < 90 && getComputedStyle(element).visibility !== 'hidden';
            };
            const words = (element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              const box = range.getBoundingClientRect();
              return [box.left, box.right];
            };
            const menuButton = bar.querySelector('.sf-site-header-menu-button button');
            const collapsed = Boolean(menuButton && shown(menuButton));
            const nav = bar.querySelector('.sf-site-header-nav');
            const links = collapsed ? [] : [...nav.querySelectorAll('a, button')].filter(shown).filter((link) => link.textContent.trim());
            const tool = [...bar.querySelectorAll('.sf-site-header-tools button')].find(shown);
            const items = [['brand', ...words(bar.querySelector('.brand-title'))], ...links.map((link) => [link.textContent.trim().slice(0, 16), link.getBoundingClientRect().left, link.getBoundingClientRect().right])];
            if (tool) items.push(['tools', tool.getBoundingClientRect().left, tool.getBoundingClientRect().right]);
            let min = Infinity;
            let at = '';
            for (let index = 0; index + 1 < items.length; index += 1) {
              const gap = items[index + 1][1] - items[index][2];
              if (gap < min) {
                min = gap;
                at = `${items[index][0]} -> ${items[index + 1][0]}`;
              }
            }
            return {width, collapsed, fit: host.getAttribute('data-nav-overflow') === 'true', links: links.length, min: Math.round(min * 10) / 10, at, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth};
          }, width));
        }
        await page.close();
        report.push({nav, theme, load, rows});
        const tag = `${nav} ${theme} load ${load}`;
        for (const row of rows) {
          if (!row.collapsed && row.min < 0) failures.push(`${tag}: at ${row.width} the nav overlaps (${row.at} ${row.min})`);
          if (row.scroll > 0) failures.push(`${tag}: at ${row.width} the page scrolls sideways by ${row.scroll}`);
        }
        if (rows.at(-1).collapsed) failures.push(`${tag}: the bar is collapsed at 1600`);
        if (nav === 'menu' && rows.some((row) => row.fit)) failures.push(`${tag}: an sf-menu nav was collapsed by the fit`);
        if (errors.length) failures.push(`${tag}: ${errors.join(' | ').slice(0, 300)}`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const summary = report.map(({nav, theme, load, rows}) => ({nav, theme, load,
  collapsed: rows.filter((row) => row.collapsed).map((row) => row.width),
  fit: rows.filter((row) => row.fit).map((row) => row.width),
  minGap: Math.min(...rows.filter((row) => !row.collapsed).map((row) => row.min))}));
console.log(JSON.stringify(summary));
if (reportOnly) process.exit(0);
if (failures.length) {
  console.error(failures.slice(0, 40).join('\n'));
  process.exit(1);
}
console.log('HEADER_SITE_NAV_OVERFLOW_OK');
