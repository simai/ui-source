#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-site-header on the built bytes, at a desktop and a phone width: wide, the
// brand, the nav and the tools stand in the bar and the menu button is not
// shown; at 375 px the nav and the actions leave the bar, the menu button opens
// them as a side panel (aria-expanded true), Escape closes it and gives focus
// back to the button. The bar is the page's one banner landmark and the nav
// keeps its aria-label.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<sf-site-header id="h">
  <a slot="brand" id="brand" href="/"><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10"/></svg><span>SIMAI</span></a>
  <nav aria-label="Разделы" id="nav">
    <a id="link-a" href="#framework">Framework</a>
    <a id="link-b" href="#docara" aria-current="page">Docara</a>
  </nav>
  <a slot="actions" id="action" href="#github">GitHub</a>
  <button slot="tools" id="tool" type="button">Тема</button>
</sf-site-header>
<main><p>Страница</p></main>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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
const shown = (tab, selector) => tab.evaluate((s) => {
  const node = document.querySelector(s);
  return Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
}, selector);
const MENU = '#h .sf-site-header-menu-button button';

const browser = await chromium.launch();
try {
  // Wide: one row, no menu button.
  {
    const tab = await browser.newPage({viewport: {width: 1280, height: 800}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/page`);
    await tab.waitForFunction(() => customElements.get('sf-site-header') && document.querySelector('#h > header.sf-site-header'), null, {timeout: 15000})
      .catch(() => failures.push('1280: the header never drew'));
    const wide = {
      brand: await shown(tab, '#brand'),
      nav: await shown(tab, '#link-a'),
      action: await shown(tab, '#action'),
      tools: await shown(tab, '#tool'),
      menu: await shown(tab, MENU),
      banners: await tab.evaluate(() => document.querySelectorAll('header').length),
      navLabel: await tab.evaluate(() => document.querySelector('#h nav')?.getAttribute('aria-label') ?? null),
      navCount: await tab.evaluate(() => document.querySelectorAll('#h nav').length),
      oneRow: await tab.evaluate(() => {
        const top = (s) => document.querySelector(s)?.getBoundingClientRect();
        const [b, l, t] = ['#brand', '#link-a', '#tool'].map(top);
        const centre = (r) => r.top + r.height / 2;
        return Boolean(b && l && t) && Math.abs(centre(b) - centre(l)) < 1 && Math.abs(centre(l) - centre(t)) < 1;
      }),
    };
    seen.wide = wide;
    if (!wide.brand || !wide.nav || !wide.action || !wide.tools) failures.push(`1280: brand, nav, action and tools are not all shown: ${JSON.stringify(wide)}`);
    if (wide.menu) failures.push('1280: the menu button is shown on a wide bar');
    if (!wide.oneRow) failures.push('1280: brand, nav and tools do not share one centre line');
    if (wide.banners !== 1) failures.push(`1280: ${wide.banners} <header> elements, expected the one banner`);
    if (wide.navLabel !== 'Разделы' || wide.navCount !== 1) failures.push(`1280: the nav is ${wide.navCount} element(s) labelled ${JSON.stringify(wide.navLabel)}`);
    await tab.close();
  }

  // Narrow: the panel.
  {
    const tab = await browser.newPage({viewport: {width: 375, height: 800}});
    await tab.goto(`http://127.0.0.1:${server.address().port}/page`);
    await tab.waitForFunction(() => customElements.get('sf-site-header') && document.querySelector('#h .sf-site-header-menu-button button'), null, {timeout: 15000})
      .catch(() => failures.push('375: the menu button never drew'));
    const closed = {
      brand: await shown(tab, '#brand'),
      tools: await shown(tab, '#tool'),
      nav: await shown(tab, '#link-a'),
      action: await shown(tab, '#action'),
      menu: await shown(tab, MENU),
      expanded: await tab.evaluate((s) => document.querySelector(s)?.getAttribute('aria-expanded') ?? null, MENU),
      controls: await tab.evaluate((s) => {
        const id = document.querySelector(s)?.getAttribute('aria-controls');
        return Boolean(id && document.getElementById(id)?.classList.contains('sf-site-header-panel'));
      }, MENU),
    };
    seen.narrowClosed = closed;
    if (!closed.brand || !closed.tools || !closed.menu) failures.push(`375: brand, tools and the menu button should be shown: ${JSON.stringify(closed)}`);
    if (closed.nav || closed.action) failures.push('375: the nav or the actions are still in the bar');
    if (closed.expanded !== 'false') failures.push(`375: aria-expanded is ${closed.expanded} before opening`);
    if (!closed.controls) failures.push('375: aria-controls does not name the panel');

    await tab.locator(MENU).click();
    await tab.waitForTimeout(300);
    const open = {
      expanded: await tab.evaluate((s) => document.querySelector(s)?.getAttribute('aria-expanded') ?? null, MENU),
      nav: await shown(tab, '#link-a'),
      action: await shown(tab, '#action'),
      dialog: await tab.evaluate(() => {
        const panel = document.querySelector('#h .sf-site-header-panel');
        return panel?.getAttribute('role') === 'dialog' && panel.getAttribute('aria-modal') === 'true';
      }),
      focus: await tab.evaluate(() => document.activeElement?.id ?? document.activeElement?.localName ?? null),
      navLabel: await tab.evaluate(() => document.querySelector('#h nav')?.getAttribute('aria-label') ?? null),
    };
    seen.narrowOpen = open;
    if (open.expanded !== 'true') failures.push(`375: aria-expanded is ${open.expanded} once open`);
    if (!open.nav || !open.action) failures.push('375: the open panel does not show the nav and the actions');
    if (!open.dialog) failures.push('375: the open panel is not a modal dialog');
    if (open.focus !== 'link-b') failures.push(`375: focus went to ${open.focus}, expected the current page's link`);
    if (open.navLabel !== 'Разделы') failures.push('375: the nav lost its aria-label in the panel');

    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(300);
    const after = {
      expanded: await tab.evaluate((s) => document.querySelector(s)?.getAttribute('aria-expanded') ?? null, MENU),
      nav: await shown(tab, '#link-a'),
      focusOnMenu: await tab.evaluate((s) => document.activeElement === document.querySelector(s), MENU),
      banners: await tab.evaluate(() => document.querySelectorAll('header').length),
    };
    seen.narrowAfterEscape = after;
    if (after.expanded !== 'false') failures.push(`375: aria-expanded is ${after.expanded} after Escape`);
    if (after.nav) failures.push('375: the panel is still shown after Escape');
    if (!after.focusOnMenu) failures.push('375: focus did not return to the menu button after Escape');
    if (after.banners !== 1) failures.push(`375: ${after.banners} <header> elements, expected the one banner`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
