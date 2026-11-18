#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-header-site 1.13.1 and sf-menu 1.14.4 on the built bytes (Docara
// msg-9c153555e30b4c1ba9cb item 1, 2026-11-18): navigation-align center with
// an sf-menu overflow more in the nav. The menu is as wide as the room it is
// given (contain: inline-size), so the nav's column minmax(0, max-content)
// was 0 and every item went to «Ещё» (Docara 3.18.0 at 1240 px: 557, 0, 557).
// The bar -- a logo and a title, seven or four sections, a search button with its
// word and a settings button, collapse md -- is swept from 900 to 1600 px in
// 20 px steps, start and center, in the light and the dark theme, three loads
// each. At every width:
// - the gaps between the brand's words, each shown section (or «Ещё») and the
//   first tool are >= 0, and the page does not scroll sideways;
// - items are in «Ещё» only when needed: none while the menu's whole row
//   (--sf-menu--row-size) fits the room it is given, and some once it does not;
// - centre moves to «Ещё» exactly as many items as start at the same width
//   (the same room between the brand and the tools), and while nothing is
//   moved its row stands at the bar's centre when the sides leave it room.
// The console stays clean.
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
const ALIGNS = ['start', 'center'];
const LOADS = 3;
// Seven sections never fit the widest bar (some always in «Ещё»); four fit
// from about 1100 px, so the sweep crosses from «Ещё» to the whole row.
const MENUS = {
  seven: ['Руководство', 'Утилиты', 'Компоненты', 'Смарт-компоненты', 'Рецепты', 'Примеры', 'Журнал'],
  four: ['Руководство', 'Утилиты', 'Компоненты', 'Рецепты'],
};
const logo = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="4"/></svg>';
const page = (theme, align, sections) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<sf-header-site id="h" collapse="md" navigation-align="${align}" label="Навигация" menu-label="Открыть навигацию" close-label="Закрыть навигацию">
<a slot="brand" href="/">${logo}<span class="brand-title">SIMAI Framework</span></a>
<sf-menu orientation="horizontal" overflow="more" appearance="navigation" aria-label="Главное"><ul>${sections.map((text, index) => `<li><a href="#s${index}"${index ? '' : ' aria-current="page"'}>${text}</a></li>`).join('')}</ul></sf-menu>
<sf-button slot="tools" size="1" appearance="outline" scheme="on-surface" icon-start="search" text="Поиск"></sf-button>
<sf-button-icon slot="tools" icon="settings" appearance="ghost" scheme="on-surface" size="1" aria-label="Настройки"></sf-button-icon>
</sf-header-site>
<main><p>Страница</p></main>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme'), url.searchParams.get('align'), MENUS[url.searchParams.get('menu')]));
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

const measure = (width) => {
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
  const navBox = bar.querySelector('.sf-site-header-nav');
  const nav = bar.querySelector('nav.sf-smart-menu');
  const list = nav?.querySelector(':scope > ul.sf-menu');
  const tops = list ? [...list.children].filter((li) => !li.classList.contains('sf-menu-item--more')) : [];
  const hidden = tops.filter((li) => li.hidden).length;
  const more = list?.querySelector(':scope > .sf-menu-item--more');
  const moreShown = Boolean(more && !more.hidden && shown(more));
  const sections = collapsed ? [] : [...tops.filter((li) => !li.hidden), ...(moreShown ? [more] : [])].map((li) => {
    const box = li.getBoundingClientRect();
    return [li.textContent.trim().slice(0, 16), box.left, box.right];
  });
  const tool = [...bar.querySelectorAll('.sf-site-header-tools button')].find(shown);
  const brand = words(bar.querySelector('.brand-title'));
  const items = [['brand', ...brand], ...sections];
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
  const rowSize = Number.parseFloat(nav?.style.getPropertyValue('--sf-menu--row-size')) || 0;
  const navWidth = nav ? nav.getBoundingClientRect().width : 0;
  const barBox = bar.getBoundingClientRect();
  const brandBox = bar.querySelector('.sf-site-header-brand').getBoundingClientRect();
  const toolsBox = bar.querySelector('.sf-site-header-tools').getBoundingClientRect();
  const shownRow = sections.length ? [sections[0][1], sections.at(-1)[2]] : [0, 0];
  const navCols = getComputedStyle(bar.querySelector('.sf-site-header-row')).gridTemplateColumns;
  return {
    width,
    collapsed,
    hidden,
    moreShown,
    rowSize,
    navWidth: Math.round(navWidth * 10) / 10,
    navBox: Math.round(navBox.getBoundingClientRect().width * 10) / 10,
    columns: navCols,
    min: Math.round(min * 10) / 10,
    at,
    // How far the shown row's centre is from the bar's, and whether the sides
    // leave the whole row room at the true centre.
    offCentre: Math.round(((shownRow[0] + shownRow[1]) / 2 - (barBox.left + barBox.right) / 2) * 10) / 10,
    centreRoom: Math.min(barBox.width / 2 - (brandBox.right - barBox.left), barBox.width / 2 - (barBox.right - toolsBox.left)) * 2,
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

const failures = [];
const report = [];
const browser = await chromium.launch({headless: true, channel: process.env.SF_PROBE_CHANNEL || undefined, ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const [menu, sections] of Object.entries(MENUS)) for (const theme of THEMES) {
    for (let load = 1; load <= LOADS; load += 1) {
      const byAlign = {};
      for (const align of ALIGNS) {
        const page = await browser.newPage({viewport: {width: 900, height: 600}});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
        await page.goto(`${origin}/page?theme=${theme}&align=${align}&menu=${menu}`);
        await page.waitForFunction(() => document.querySelector('#h')?.hasAttribute('data-sf-started') && document.fonts.status === 'loaded', null, {timeout: 15000});
        await page.waitForTimeout(400);
        const rows = [];
        for (let width = 900; width <= 1600; width += 20) {
          await page.setViewportSize({width, height: 600});
          await page.waitForTimeout(250);
          rows.push(await page.evaluate(measure, width));
        }
        await page.close();
        byAlign[align] = rows;
        report.push({menu, align, theme, load, rows});
        const tag = `${menu} ${align} ${theme} load ${load}`;
        for (const row of rows) {
          if (row.collapsed) failures.push(`${tag}: at ${row.width} the bar is collapsed (collapse md)`);
          if (row.min < 0) failures.push(`${tag}: at ${row.width} the row overlaps (${row.at} ${row.min})`);
          if (row.scroll > 0) failures.push(`${tag}: at ${row.width} the page scrolls sideways by ${row.scroll}`);
          if (!row.rowSize) failures.push(`${tag}: at ${row.width} the menu published no --sf-menu--row-size`);
          if (row.hidden && row.navWidth >= row.rowSize) failures.push(`${tag}: at ${row.width} ${row.hidden} items in «Ещё» though the row (${row.rowSize}) fits the nav (${row.navWidth})`);
          if (!row.hidden && row.navWidth + 0.5 < row.rowSize) failures.push(`${tag}: at ${row.width} no item in «Ещё» though the row (${row.rowSize}) is wider than the nav (${row.navWidth})`);
          if (row.hidden === sections.length) failures.push(`${tag}: at ${row.width} every item is in «Ещё»`);
          if (align === 'center' && !row.hidden && row.centreRoom >= row.rowSize + 2 && Math.abs(row.offCentre) > 1) failures.push(`${tag}: at ${row.width} the row stands ${row.offCentre} px off the bar's centre`);
        }
        if (errors.length) failures.push(`${tag}: ${errors.join(' | ').slice(0, 300)}`);
      }
      byAlign.center.forEach((row, index) => {
        const start = byAlign.start[index];
        if (row.hidden !== start.hidden) failures.push(`${menu} ${theme} load ${load}: at ${row.width} centre moves ${row.hidden} items to «Ещё», start ${start.hidden}`);
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

const summary = report.map(({menu, align, theme, load, rows}) => ({menu, align, theme, load,
  hiddenFrom: rows.filter((row) => row.hidden).map((row) => row.width).at(-1) ?? null,
  allShownFrom: rows.find((row) => !row.hidden)?.width ?? null,
  minGap: Math.min(...rows.map((row) => row.min)),
  maxOffCentre: Math.max(...rows.filter((row) => !row.hidden).map((row) => Math.abs(row.offCentre)), 0)}));
console.log(JSON.stringify(reportOnly ? report : summary));
if (reportOnly) process.exit(0);
if (failures.length) {
  console.error(failures.slice(0, 40).join('\n'));
  process.exit(1);
}
console.log('HEADER_SITE_NAV_CENTER_MORE_OK');
