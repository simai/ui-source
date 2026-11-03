#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Header navigation on the built bytes (owner decision by recommendation,
// 2026-11-01): sf-menu appearance navigation in sf-site-header
// navigation-align center, as Docara's header draws its sections. At 1440 px,
// in the light and the dark theme and at the bar's sizes 1/2 and 1, a row is
// the size 1 control height (40 px), space-1 (16 px) at its sides, the ui
// radius, no border, on-surface words, transparent at rest and the fill
// family's plate (--sf-surface-container-active, 24 %) on the current page;
// a pointer lays the state family's hover step over a row and leaves the
// current page's plate as it is; the nav stands at the bar's true centre and
// clear of the brand and the tools. At 390 px the bar is collapsed: the nav
// is not in the bar, the menu button opens it as a column of the same rows.
// The default (navigation-align start, appearance default) is unchanged: the
// nav right after the brand, framed rows.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = ({size, align, appearance}) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0">
<sf-header-site id="h" size="${size}"${align ? ` navigation-align="${align}"` : ''}>
  <a slot="brand" id="brand" href="/gallery/"><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg><span>SIMAI Effects</span></a>
  <sf-menu id="m" orientation="horizontal" collapse="none" current-from-location${appearance ? ` appearance="${appearance}"` : ''}>
    <nav aria-label="Разделы"><ul>
      <li><a href="/home/">simai.io</a></li>
      <li><a href="/gallery/">Галерея</a></li>
      <li><a href="/authors/">Авторам</a></li>
    </ul></nav>
  </sf-menu>
  <button slot="tools" id="tool" type="button">Тема</button>
</sf-header-site>
<main><p>Страница</p></main>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/gallery/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(Object.fromEntries(url.searchParams)));
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

const failures = [];
const seen = {};
// The fill family's 24 % step and the state family's 4 % step on the theme's
// neutral tone: neutral-50 in the light theme, neutral-90 in the dark.
const TONE = {light: '118, 119, 124', dark: '227, 226, 231'};
const transparent = (colour) => /rgba\(\d+, \d+, \d+, 0\)|transparent/u.test(colour);

const measure = (tab) => tab.evaluate(() => {
  const box = (node) => node?.getBoundingClientRect();
  const rows = [...document.querySelectorAll('#m ul.sf-menu > li > .sf-menu-element')];
  const current = rows.find((row) => row.matches('[aria-current="page"]'));
  const other = rows.find((row) => row !== current);
  const style = (row) => {
    if (!row) return null;
    const s = getComputedStyle(row);
    return {height: row.getBoundingClientRect().height, paddingStart: s.paddingInlineStart, paddingEnd: s.paddingInlineEnd, radius: s.borderTopLeftRadius,
      border: s.borderTopWidth, background: s.backgroundColor, color: s.color, size: s.fontSize, weight: s.fontWeight};
  };
  const row = box(document.querySelector('#h .sf-site-header-row'));
  const list = box(document.querySelector('#m ul.sf-menu'));
  const brand = box(document.querySelector('#brand'));
  const tool = box(document.querySelector('#tool'));
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;border-radius:var(--sf-radius--ui);color:var(--sf-on-surface)';
  document.body.append(probe);
  const tokens = {radius: getComputedStyle(probe).borderTopLeftRadius, onSurface: getComputedStyle(probe).color};
  probe.remove();
  return {collapsed: document.querySelector('#h').hasAttribute('data-collapsed'), rows: rows.length, current: style(current), other: style(other), tokens,
    rowCentre: row && row.left + row.width / 2, listCentre: list && list.left + list.width / 2, listLeft: list?.left, listRight: list?.right,
    brandRight: brand?.right, toolLeft: tool?.left, listShown: Boolean(list && list.width > 0)};
});

const browser = await chromium.launch();
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const theme of ['light', 'dark']) {
    for (const size of ['1/2', '1']) {
      const key = `${theme}-${size}`;
      const tab = await browser.newPage({viewport: {width: 1440, height: 600}, colorScheme: theme});
      await tab.goto(`${origin}/gallery/?size=${encodeURIComponent(size)}&align=center&appearance=navigation`);
      await tab.waitForFunction(() => document.querySelector('#h > header.sf-site-header') && document.querySelector('#m ul.sf-menu [aria-current="page"]'), null, {timeout: 15000})
        .catch(() => failures.push(`${key}: the header or the menu's current page never drew`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(200);
      const wide = await measure(tab);
      seen[`${key}-1440`] = wide;
      const {current, other, tokens} = wide;
      if (wide.collapsed) failures.push(`${key}: the bar is collapsed at 1440`);
      if (!current || !other) failures.push(`${key}: no current row or no other row (${wide.rows} rows)`);
      else {
        for (const [name, row] of [['current', current], ['other', other]]) {
          if (Math.abs(row.height - 40) > 0.5) failures.push(`${key}: the ${name} row is ${row.height}px high, expected 40`);
          if (row.paddingStart !== '16px' || row.paddingEnd !== '16px') failures.push(`${key}: the ${name} row's padding is ${row.paddingStart} ${row.paddingEnd}, expected 16px 16px`);
          if (row.radius !== tokens.radius || row.radius !== '4px') failures.push(`${key}: the ${name} row's radius is ${row.radius}, expected the ui radius ${tokens.radius} (4px)`);
          if (row.border !== '0px') failures.push(`${key}: the ${name} row has a ${row.border} border`);
          if (row.color !== tokens.onSurface) failures.push(`${key}: the ${name} row's words are ${row.color}, expected on-surface ${tokens.onSurface}`);
          if (row.size !== '16px' || row.weight !== '400') failures.push(`${key}: the ${name} row's type is ${row.size}/${row.weight}, expected 16px/400`);
        }
        if (current.background !== `rgba(${TONE[theme]}, 0.24)`) failures.push(`${key}: the current page's plate is ${current.background}, expected rgba(${TONE[theme]}, 0.24)`);
        if (!transparent(other.background)) failures.push(`${key}: a row at rest is filled: ${other.background}`);
      }
      // The true centre, and clear of both sides.
      if (Math.abs(wide.listCentre - wide.rowCentre) > 1) failures.push(`${key}: the nav's centre is ${wide.listCentre}, the bar's ${wide.rowCentre}`);
      if (!(wide.listLeft > wide.brandRight) || !(wide.listRight < wide.toolLeft)) failures.push(`${key}: the nav overlaps the brand or the tools: ${JSON.stringify(wide)}`);
      // Hover: the state step on a row at rest; the current plate unchanged.
      const rest = tab.locator('#m ul.sf-menu > li > .sf-menu-element:not([aria-current])').first();
      await rest.hover();
      await tab.waitForTimeout(150);
      const hovered = await rest.evaluate((row) => getComputedStyle(row).backgroundColor);
      if (hovered !== `rgba(${TONE[theme]}, 0.04)`) failures.push(`${key}: a hovered row is ${hovered}, expected rgba(${TONE[theme]}, 0.04)`);
      const currentRow = tab.locator('#m ul.sf-menu > li > .sf-menu-element[aria-current="page"]');
      await currentRow.hover();
      await tab.waitForTimeout(150);
      const hoveredCurrent = await currentRow.evaluate((row) => getComputedStyle(row).backgroundColor);
      if (hoveredCurrent !== `rgba(${TONE[theme]}, 0.24)`) failures.push(`${key}: the hovered current page is ${hoveredCurrent}, expected its plate`);
      seen[`${key}-1440`].hover = {rest: hovered, current: hoveredCurrent};
      await tab.close();

      // 390: collapsed, the same rows as a column in the panel.
      const narrow = await browser.newPage({viewport: {width: 390, height: 800}, colorScheme: theme});
      await narrow.goto(`${origin}/gallery/?size=${encodeURIComponent(size)}&align=center&appearance=navigation`);
      await narrow.waitForFunction(() => document.querySelector('#h .sf-site-header-menu-button button') && document.querySelector('#m ul.sf-menu'), null, {timeout: 15000})
        .catch(() => failures.push(`${key}: 390: the menu button never drew`));
      await narrow.waitForTimeout(200);
      const closed = await measure(narrow);
      if (!closed.collapsed) failures.push(`${key}: 390: the bar is not collapsed`);
      if (closed.listShown) failures.push(`${key}: 390: the nav is still in the bar`);
      await narrow.locator('#h .sf-site-header-menu-button button').click();
      await narrow.waitForTimeout(400);
      const open = await measure(narrow);
      const orientation = await narrow.evaluate(() => document.querySelector('#m').getAttribute('orientation'));
      seen[`${key}-390`] = {closed: {collapsed: closed.collapsed, listShown: closed.listShown}, open: {orientation, current: open.current, other: open.other}};
      if (orientation !== 'vertical') failures.push(`${key}: 390: the menu is ${orientation} in the panel`);
      if (!open.current || open.current.border !== '0px' || open.current.background !== `rgba(${TONE[theme]}, 0.24)`) failures.push(`${key}: 390: the panel's current row is ${JSON.stringify(open.current)}`);
      if (!open.other || !transparent(open.other.background) || open.other.border !== '0px') failures.push(`${key}: 390: the panel's other row is ${JSON.stringify(open.other)}`);
      await narrow.close();
    }
  }

  // The default stays the 1.0 bar: the nav after the brand, framed rows.
  {
    const tab = await browser.newPage({viewport: {width: 1440, height: 600}});
    await tab.goto(`${origin}/gallery/?size=1%2F2`);
    await tab.waitForFunction(() => document.querySelector('#m ul.sf-menu [aria-current="page"]'), null, {timeout: 15000})
      .catch(() => failures.push('default: the menu never drew'));
    await tab.waitForTimeout(200);
    const start = await measure(tab);
    seen.default = {listLeft: start.listLeft, brandRight: start.brandRight, border: start.other?.border};
    if (!(start.listLeft - start.brandRight < 40)) failures.push(`default: the nav is not right after the brand: ${start.listLeft} vs ${start.brandRight}`);
    if (start.other?.border !== '1px') failures.push(`default: a default row's border is ${start.other?.border}, expected 1px`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
