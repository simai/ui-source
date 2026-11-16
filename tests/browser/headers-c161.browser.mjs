#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Owner decision C161 on the built bytes, 1440 and 390, three loads:
// sf-header-page places its main (filled) action last (3), ends with the tabs
// slot the header's gap below the line, their line its edge (5), and is sticky
// only on request, raised with its path folded while content runs under it
// (7); a collapsed sf-header-site keeps search and profile in the bar and puts
// the theme switch into the panel's settings group, and Tab stays in the open
// panel past the switch's segments (8).
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const note = (detail) => failures.push(detail);
const types = {js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', woff2: 'font/woff2'};
const page404 = new Set();

// One page of the probe over the built bytes: <body> markup, the core, nothing else.
async function open(browser, body, viewport = {width: 1200, height: 800}) {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
        <link rel="stylesheet" href="/distr/core/css/core.css">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'probe', pluginListVersion: 'probe', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
        <body style="margin:0">${body}<script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = product === 'rule' ? join(out, 'core', 'rule', ...rest) : join(out, product, product, ...rest);
    if (existsSync(file) && statSync(file).isFile()) return route.fulfill({status: 200, contentType: types[file.split('.').pop()] || 'application/octet-stream', body: readFileSync(file)});
    page404.add(url.pathname);
    return route.fulfill({status: 404, body: ''});
  });
  page.errors = errors;
  await page.goto('http://probe.test/');
  return page;
}
const defined = (page, tags) => page.waitForFunction((list) => list.every((tag) => customElements.get(tag)), tags, {timeout: 15000});


const browser = await chromium.launch();
const PAGE = `<sf-header-site id="site" collapse="lg">
  <a slot="brand" href="#">SIMAI Framework</a>
  <nav aria-label="Разделы"><a href="#a">Каталог</a><a href="#b">Решения</a></nav>
  <sf-button-icon slot="tools" id="t-search" icon="search" appearance="ghost" scheme="on-surface" aria-label="Поиск"></sf-button-icon>
  <sf-segmented slot="tools" id="t-theme" theme-switch aria-label="Тема"></sf-segmented>
  <sf-avatar slot="tools" id="t-avatar" text="АБ" aria-label="Анна Белова"></sf-avatar>
</sf-header-site>
<main style="padding:16px">
  <sf-header-page id="order" heading="Заказы"><sf-button slot="actions" icon-start="add" text="Создать"></sf-button><sf-button slot="actions" appearance="outline" text="Импорт"></sf-button><sf-button slot="actions" appearance="outline" text="Экспорт"></sf-button></sf-header-page>
  <sf-header-page id="tabs" heading="Каталог"><sf-button slot="actions" text="Создать"></sf-button><sf-tabs slot="tabs" type="underline" items='[{"id":"all","label":"Все","current":true},{"id":"draft","label":"Черновики"}]'></sf-tabs></sf-header-page>
  <div id="area" style="block-size:300px;overflow:auto"><sf-header-page id="sticky" sticky heading="Список"><nav slot="path" aria-label="Путь"><a href="#">Магазин</a></nav><sf-button slot="actions" text="Создать"></sf-button></sf-header-page>${'<p style="block-size:40px;margin:0">Строка</p>'.repeat(30)}</div>
</main>`;
try {
  for (let load = 1; load <= 3; load++) {
    for (const width of [1440, 390]) {
      const page = await open(browser, PAGE, {width, height: 800});
      await defined(page, ['sf-header-page', 'sf-header-site', 'sf-button', 'sf-tabs', 'sf-segmented']);
      await page.waitForTimeout(800);
      const got = await page.evaluate(() => {
        const box = (e) => { while (e && getComputedStyle(e).display === 'contents') e = e.firstElementChild; return e?.getBoundingClientRect(); };
        const order = [...document.querySelectorAll('#order .sf-page-header-actions > sf-button')].map((b) => b.getAttribute('text'));
        const line = document.querySelector('#tabs .sf-page-header-line').getBoundingClientRect();
        const strip = document.querySelector('#tabs .sf-tabs-top-container').getBoundingClientRect();
        const header = document.querySelector('#tabs > .sf-page-header').getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(document.querySelector('#tabs > .sf-page-header')).rowGap);
        const tools = [...document.querySelectorAll('#site .sf-site-header-tools > *')].map((e) => e.id);
        const settings = [...document.querySelectorAll('#site .sf-site-header-settings [theme-switch]')].map((e) => e.id);
        return {order, tabsGap: Math.round(strip.top - line.bottom), gap, edge: Math.round(header.bottom - strip.bottom), tools, settings, sticky: getComputedStyle(document.querySelector('#sticky > .sf-page-header')).position, defaultSticky: getComputedStyle(document.querySelector('#order > .sf-page-header')).position};
      });
      const narrow = width < 960;
      // C161 (3): the main action last, the outlined ones before it in the page's order.
      if (narrow ? got.order.at(-1) !== 'Создать' : got.order.join() !== 'Импорт,Экспорт,Создать') note({load, width, case: 'main action last', got: got.order});
      // C161 (5): the tabs end the header the header's gap below the line, their line its edge.
      if (got.tabsGap !== got.gap || got.edge !== 0) note({load, width, case: 'tabs slot', got});
      // C161 (7): sticky on request only.
      if (got.sticky !== 'sticky' || got.defaultSticky !== 'static') note({load, width, case: 'sticky setting', got});
      // C161 (8): a collapsed bar keeps search and profile; the theme stands in the panel's settings.
      if (narrow ? (got.tools.join() !== 't-search,t-avatar' || got.settings.join() !== 't-theme') : (got.tools.join() !== 't-search,t-theme,t-avatar' || got.settings.length)) note({load, width, case: 'settings tools', got});
      await page.evaluate(() => { document.querySelector('#area').scrollTop = 200; });
      await page.waitForTimeout(300);
      const scrolled = await page.evaluate(() => ({on: document.querySelector('#sticky').getAttribute('data-scrolled'), path: document.querySelector('#sticky .sf-page-header-path').getClientRects().length, top: Math.round(document.querySelector('#sticky > .sf-page-header').getBoundingClientRect().top - document.querySelector('#area').getBoundingClientRect().top)}));
      if (scrolled.on !== 'true' || scrolled.path !== 0 || scrolled.top !== 0) note({load, width, case: 'sticky scrolled: raised, path folded, at the top', scrolled});
      if (narrow) {
        // Tab stays in the open panel: the theme switch's other segments are no stops.
        await page.evaluate(() => document.querySelector('#site .sf-site-header-menu-button button').focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
        const stops = [];
        for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); stops.push(await page.evaluate(() => Boolean(document.activeElement?.closest('.sf-site-header-panel')))); }
        if (stops.includes(false)) note({load, width, case: 'Tab stays in the panel', stops});
      }
      if (page.errors.length) note({load, width, case: 'console clean', errors: page.errors});
      console.log(JSON.stringify({load, width, ...got, scrolled}));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures, missing: [...page404]}, null, 1)); process.exit(1); }
console.log('HEADERS_C161_OK');
