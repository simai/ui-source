#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
//
// sf-header-site 1.17.0 collapse="lg" fit and sf-language 1.8.0 shrink="code"
// on the built bytes (group build 20 D; owner remark: «Наборы» hidden at 1440
// in the docs header, msg-11e805f8; Docara msg-6be3107d). A Docara-like
// header -- a 220 px brand, the six Russian sections of the docs in a wrapper
// (as Docara writes them), a tools wrapper with the search «Поиск ⌘K»
// shrink="icon", sf-language shrink="code" and the settings glyph -- stands in
// a frame whose width the probe sets.
//
// - fit, 1440: all six sections in the row, no «Ещё»; the search shrunk to
//   its glyph and the language left whole (the fewest tools give way).
// - fit, sweep 960-1600 step 16 (the step and up): no gap under 8 px between
//   the parts, no sideways scroll; from wide to narrow the states come in the
//   C372 order (tools one by one, then sections into «Ещё») and never back.
// - fit, below the step (944, 900, 768, 704, 390): the menu button stands in
//   the bar; a real click opens the panel with every section; Escape closes it.
// - the language shrunk (a frame width where both tools give way): its
//   translate glyph is not drawn, the code and the arrow are; it is one
//   glyph narrower; its name stays «Язык: Русский»; a real click opens its
//   menu; data-shrunk off draws the glyph again (both states asserted).
// - without fit (collapse lg, the same tools): at 1440 no tool shrinks and
//   no data-shrunk is set (1.16.0 unchanged).
// - cold loads at 1440, 1024, 768 and 390, light and dark, `loads` each: CLS
//   within 0.015, the console clean.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = Number(process.argv[3] || 3);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const SECTIONS = ['Руководство', 'Утилиты', 'Компоненты', 'Смарт-компоненты', 'Наборы', 'Рецепты'];
const GAP = 8;
const SHIFT_BUDGET = 0.015;

const logo = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="4"/></svg>';
const frame = (theme, fit) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};
window.__shifts=0;try{new PerformanceObserver((list)=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput)window.__shifts+=entry.value;}}).observe({type:'layout-shift',buffered:true});}catch(error){}</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.page-brand{display:inline-flex;align-items:center;gap:8px;inline-size:220px;color:inherit;text-decoration:none;font-weight:600}.page-body{min-block-size:200vh}.page-tools{display:flex;align-items:center;gap:8px}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<sf-header-site id="h" collapse="lg"${fit ? ' fit' : ''} label="Навигация" menu-label="Открыть навигацию" close-label="Закрыть навигацию">
<a slot="brand" class="page-brand" href="#home">${logo}<span>SIMAI Framework</span></a>
<div class="page-nav"><sf-menu orientation="horizontal" overflow="more" appearance="navigation" collapse="none"><nav aria-label="Главное"><ul>${SECTIONS.map((text, index) => `<li><a href="#s${index}">${text}</a></li>`).join('')}</ul></nav></sf-menu></div>
<div slot="tools" class="page-tools">
<sf-button id="search" size="1" appearance="outline" scheme="on-surface" icon-start="search" text="Поиск" shortcut="mod+k" shrink="icon" aria-label="Открыть поиск по документации" aria-haspopup="dialog"></sf-button>
<sf-language id="lang" languages="ru en" mode="menu" size="1" value="ru" apply="none" shrink="code" label="Язык"></sf-language>
<sf-button-icon size="1" icon="settings" appearance="ghost" scheme="on-surface" aria-label="Открыть настройки чтения"></sf-button-icon>
</div>
</sf-header-site>
<main class="page-body"><p>Страница</p></main>
</body></html>`;
const host = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>body{margin:0}iframe{display:block;border:0;block-size:600px}</style></head>
<body><iframe id="f"></iframe></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/favicon.ico') {
    response.writeHead(204);
    return response.end();
  }
  if (path === '/frame') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(frame(url.searchParams.get('theme'), url.searchParams.get('fit') !== '0'));
  }
  if (path === '/host') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(host);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// In the frame: the parts shown in the bar, the gaps between them, the state.
const READ = `window.__read = () => {
  const host = document.getElementById('h');
  const hdr = host.querySelector('header.sf-site-header');
  const box = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const menu = hdr.querySelector('.sf-site-header-menu-button > button');
  const menuOn = Boolean(menu && box(menu) && getComputedStyle(menu).display !== 'none');
  const seq = [];
  const brand = box(hdr.querySelector('.sf-site-header-brand a'));
  if (brand) seq.push({n: 'brand', l: brand.left, r: brand.right});
  const shown = [];
  let more = false;
  if (!menuOn) hdr.querySelectorAll('.sf-site-header-nav nav .sf-menu-element--level-1').forEach((a) => {
    const range = document.createRange(); range.selectNodeContents(a); const r = range.getBoundingClientRect();
    if (!r.width || r.top > 100) return;
    const text = (a.querySelector('.sf-menu-element-text') || a).textContent.trim();
    seq.push({n: text, l: r.left, r: r.right});
    if (a.hasAttribute('data-sf-menu-toggle')) more = true; else shown.push(text);
  });
  hdr.querySelectorAll('.sf-site-header-tools button').forEach((b) => { if (b.closest('sf-menu-context')) return; const r = box(b); if (r && r.top < 100) seq.push({n: b.getAttribute('aria-label') || '', l: r.left, r: r.right}); });
  seq.sort((a, b) => a.l - b.l);
  const bad = [];
  for (let i = 0; i + 1 < seq.length; i += 1) { const g = seq[i + 1].l - seq[i].r; if (g < ${GAP}) bad.push(seq[i].n + ' -> ' + seq[i + 1].n + ' ' + Math.round(g)); }
  const search = document.getElementById('search');
  const lang = document.getElementById('lang');
  const shrunk = (search.getAttribute('data-shrunk') === 'true' ? 1 : 0) + (lang.getAttribute('data-shrunk') === 'true' ? 1 : 0);
  const state = menuOn ? 'menu' : shown.length + (more ? '+more' : '') + '/' + shrunk;
  return {state, menuOn, shown, more, shrunk, searchShrunk: search.getAttribute('data-shrunk') === 'true', langShrunk: lang.getAttribute('data-shrunk') === 'true', bad, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth};
};`;

const failures = [];
const report = {wide: null, sweep: [], below: [], language: {}, nofit: null, loads: []};
const browser = await chromium.launch({headless: true, ignoreDefaultArgs: ['--hide-scrollbars']});

async function openHost({theme = 'theme-light', width = 1440, fit = true} = {}) {
  const page = await browser.newPage({viewport: {width: 1700, height: 700}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.goto(`${origin}/host`);
  await page.evaluate(([src, w]) => { const f = document.getElementById('f'); f.style.inlineSize = `${w}px`; f.src = src; }, [`/frame?theme=${theme}&fit=${fit ? 1 : 0}`, width]);
  const child = await (await page.$('#f')).contentFrame();
  await child.waitForFunction(() => document.fonts.status === 'loaded' && document.querySelector('#h nav.sf-smart-menu')
    && document.querySelector('#lang .sf-language-parts > sf-button > button > sf-icon')
    && [...document.querySelectorAll('#h .sf-site-header-row :is(sf-icon i, .sf-icon)')].every((i) => {
      const box = i.getBoundingClientRect();
      if (!box.width) return true;
      const range = document.createRange();
      range.selectNodeContents(i);
      return range.getBoundingClientRect().width <= box.height + 1;
    }), null, {timeout: 20000});
  await child.evaluate(READ);
  await page.waitForTimeout(400);
  return {page, child, errors};
}
const setWidth = (page, width) => page.evaluate((w) => { document.getElementById('f').style.inlineSize = `${w}px`; }, width);
const settle = (child) => child.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)))));
const rank = (state) => {
  if (state === 'menu') return 1e6;
  const [, shown, more, shrunk] = state.match(/^(\d+)(\+more)?\/(\d+)$/u) ?? [];
  return (6 - Number(shown)) * 10 + Number(shrunk) + (more ? 5 : 0);
};

try {
  // 1440 and the sweep from the step up.
  {
    const {page, child, errors} = await openHost();
    const wide = await child.evaluate(() => window.__read());
    report.wide = wide;
    if (wide.shown.length !== 6 || wide.more) failures.push(`fit 1440: ${wide.shown.length} sections in the row${wide.more ? ' and «Ещё»' : ''} (${wide.shown.join(', ')})`);
    if (!wide.searchShrunk || wide.langShrunk) failures.push(`fit 1440: search shrunk ${wide.searchShrunk}, language shrunk ${wide.langShrunk} (want the search alone)`);
    if (wide.bad.length || wide.sideways) failures.push(`fit 1440: ${wide.bad.join('; ')} sideways ${wide.sideways}`);
    let last = -1;
    for (let width = 1600; width >= 960; width -= 16) {
      await setWidth(page, width);
      await settle(child);
      const row = await child.evaluate(() => window.__read());
      report.sweep.push({width, state: row.state});
      if (row.bad.length) failures.push(`fit sweep ${width}: ${row.bad.join('; ')}`);
      if (row.sideways) failures.push(`fit sweep ${width}: sideways ${row.sideways}`);
      if (row.state === 'menu') failures.push(`fit sweep ${width}: the menu button above the step`);
      if (rank(row.state) < last) failures.push(`fit sweep ${width}: ${row.state} comes back after a narrower state`);
      last = Math.max(last, rank(row.state));
    }
    if (errors.length) failures.push(`fit sweep: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // Below the step: the menu button and its panel, by real clicks.
  for (const width of [944, 900, 768, 704, 390]) {
    const {page, child, errors} = await openHost({width});
    const row = await child.evaluate(() => window.__read());
    let sections = 0;
    let closed = false;
    if (row.menuOn) {
      const button = await child.$('#h .sf-site-header-menu-button > button');
      await button.click();
      await child.waitForFunction(() => document.getElementById('h').getAttribute('data-open') === 'true', null, {timeout: 5000}).catch(() => {});
      await settle(child);
      sections = await child.evaluate((names) => new Set([...document.querySelectorAll('#h .sf-site-header-panel a')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.trim()).filter((t) => names.includes(t))).size, SECTIONS);
      await child.press('body', 'Escape');
      await settle(child);
      closed = await child.evaluate(() => document.getElementById('h').getAttribute('data-open') !== 'true');
    }
    report.below.push({width, menu: row.menuOn, sections, closed});
    if (!row.menuOn) failures.push(`fit ${width}: no menu button below the step (${row.state})`);
    else if (sections !== 6) failures.push(`fit ${width}: the panel lists ${sections} of 6 sections`);
    if (row.menuOn && !closed) failures.push(`fit ${width}: Escape did not close the panel`);
    if (row.sideways) failures.push(`fit ${width}: sideways ${row.sideways}`);
    if (errors.length) failures.push(`fit ${width}: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // The language shrunk: find a width where both tools give way.
  {
    const {page, child, errors} = await openHost();
    let width = 1440;
    let row = await child.evaluate(() => window.__read());
    while (!row.langShrunk && width > 960) {
      width -= 8;
      await setWidth(page, width);
      await settle(child);
      row = await child.evaluate(() => window.__read());
    }
    const look = () => child.evaluate(() => {
      const lang = document.getElementById('lang');
      const button = lang.querySelector('.sf-language-parts > sf-button > button');
      const icons = [...button.querySelectorAll(':scope > sf-icon')];
      const shown = (el) => Boolean(el && el.getBoundingClientRect().width && getComputedStyle(el).display !== 'none');
      const code = button.querySelector('.sf-language-code');
      return {shrunk: lang.getAttribute('data-shrunk') === 'true', width: Math.round(button.getBoundingClientRect().width * 10) / 10,
        glyph: shown(icons[0]) ? icons[0].getAttribute('icon') : null, arrow: shown(icons.at(-1)) ? icons.at(-1).getAttribute('icon') : null,
        glyphWidth: Math.round((icons[0]?.getBoundingClientRect().width || 0) * 10) / 10, code: shown(code) ? code.textContent.trim().slice(0, 2) : null,
        name: button.getAttribute('aria-label')};
    });
    const shrunk = await look();
    report.language.width = width;
    report.language.shrunk = shrunk;
    if (!shrunk.shrunk) failures.push('language: no width from 1440 to 960 shrinks it');
    else {
      if (shrunk.glyph || shrunk.arrow !== 'expand_more' || shrunk.code !== 'RU') failures.push(`language shrunk: glyph ${shrunk.glyph}, arrow ${shrunk.arrow}, code ${shrunk.code}`);
      if (shrunk.name !== 'Язык: Русский') failures.push(`language shrunk: name «${shrunk.name}»`);
      // A real click opens the menu.
      await (await child.$('#lang .sf-language-parts > sf-button > button')).click();
      await settle(child);
      const open = await child.evaluate(() => Boolean([...document.querySelectorAll('#lang [role="menu"]')].some((m) => m.getBoundingClientRect().height > 0)));
      report.language.opens = open;
      if (!open) failures.push('language shrunk: a click did not open its menu');
      await child.press('body', 'Escape');
      await settle(child);
      // Off: the glyph comes back and the trigger is one glyph wider.
      await child.evaluate(() => document.getElementById('lang').removeAttribute('data-shrunk'));
      await settle(child);
      const whole = await look();
      report.language.whole = whole;
      if (whole.glyph !== 'translate' || whole.arrow !== 'expand_more' || whole.code !== 'RU') failures.push(`language whole: glyph ${whole.glyph}, arrow ${whole.arrow}, code ${whole.code}`);
      if (Math.abs(whole.width - shrunk.width - whole.glyphWidth) > 0.6) failures.push(`language: whole ${whole.width} - shrunk ${shrunk.width} is not the glyph ${whole.glyphWidth}`);
    }
    if (errors.length) failures.push(`language: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // Without fit: 1.16.0 unchanged.
  {
    const {page, child, errors} = await openHost({fit: false});
    const row = await child.evaluate(() => window.__read());
    report.nofit = row.state;
    if (row.shrunk) failures.push(`no fit 1440: ${row.shrunk} tools shrunk`);
    if (row.bad.length) failures.push(`no fit 1440: ${row.bad.join('; ')}`);
    if (errors.length) failures.push(`no fit: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // Cold loads.
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const width of [1440, 1024, 768, 390]) {
      for (let load = 0; load < LOADS; load += 1) {
        const {page, child, errors} = await openHost({theme, width});
        const shifts = await child.evaluate(() => window.__shifts);
        const row = await child.evaluate(() => window.__read());
        report.loads.push({theme, width, load, cls: Math.round(shifts * 10000) / 10000, state: row.state});
        if (shifts > SHIFT_BUDGET) failures.push(`load ${theme} ${width} #${load}: CLS ${shifts}`);
        if (row.bad.length) failures.push(`load ${theme} ${width} #${load}: ${row.bad.join('; ')}`);
        if (errors.length) failures.push(`load ${theme} ${width} #${load}: ${errors.join(' | ').slice(0, 300)}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const ranges = [];
for (const row of report.sweep) {
  const last = ranges.at(-1);
  if (last && last.state === row.state) last.to = row.width;
  else ranges.push({from: row.width, to: row.width, state: row.state});
}
console.log(JSON.stringify({wide: report.wide?.state, sweep: ranges.map((r) => `${r.from}-${r.to} ${r.state}`), below: report.below, language: report.language, nofit: report.nofit,
  loads: {count: report.loads.length, maxCls: Math.max(...report.loads.map((row) => row.cls)), states: [...new Set(report.loads.map((row) => `${row.width} ${row.state}`))]}}, null, 1));
if (failures.length) {
  console.error(failures.slice(0, 60).join('\n'));
  process.exit(1);
}
console.log('HEADER_SITE_FIT_GB20_OK');
