#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// sf-header-site 1.14.0 collapse="auto" with sf-menu 1.15.0 overflow="more",
// sf-button 1.18.0 shrink="icon" and sf-language 1.7.0 trigger="icon" on the
// built bytes (owner decisions C369-C372, 2026-11-19; DEV
// msg-d9c2e1640ee24748b154 item 1; study ui-control
// control/research/2026-11-19-docs-header variant Д). A Docara-like header --
// a 220 px brand, five sections, the search button «Поиск ⌘K», the language
// glyph and the settings glyph -- stands in a frame whose width the probe
// sets, as the study's frames did (the frame scrolls, so it has a classic
// scrollbar). Two pages: the home page (no current section, with the language
// button) and a section page (the last section current, no language button).
//
// - Sweep 360-1600 px step 8, both pages: no gap under 8 px between the boxes
//   of the header's parts (the brand, the shown sections' words, «Ещё», each
//   tool), no sideways scroll; the current section is in the row wherever the
//   nav is; from wide to narrow the states come in the C372 order (field,
//   glyph, sections one by one into «Ещё», menu button) and never back. The
//   study's reference widths (measured on Docara's own header, whose row
//   inset, gap and type steps differ) are compared change by change and
//   reported (--report, and the summary's study list).
// - Drag 1440 -> 360 -> 1440, one 8 px step per frame, sampled after every
//   paint: no painted frame with an overlap, and the state changes equal the
//   thresholds the sweep crossed on the same path (no intermediate state).
// - Keyboard at 1024: Tab goes brand, the shown sections, «Ещё», the tools;
//   Enter on «Ещё» opens it (aria-expanded true, aria-controls the panel),
//   Tab enters its links, Escape closes it and gives the focus back.
// - The glyphs: the shrunk search keeps its name and aria-keyshortcuts and
//   shows the tooltip «Поиск ⌘K»; the language glyph is a square named
//   «Язык: Русский» showing that tooltip.
// - sf-language trigger="link" (C381), light and dark, in lines of 14/20 and
//   16/24 with no page CSS: at rest, hover, keyboard focus and open the
//   trigger and its pseudo boxes are transparent, the glyph is one line high
//   on the trigger's left edge, 4 from the name, the words take their place's
//   size, no tooltip shows, the name is underlined on hover, focus and open
//   (never the glyph), the focus ring is 2px offset 2; choosing Deutsch shows
//   Deutsch and the host is as wide as its trigger.
// - Cold loads at 1440, 1024, 704 and 390, light and dark, three each: CLS 0
//   from the first paint, the console clean.
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

const SECTIONS = ['Руководство', 'Утилиты', 'Компоненты', 'Смарт-компоненты', 'Рецепты'];
const GAP = 8;
// The study's states (ui-control control/research/2026-11-19-docs-header
// data/more.txt, variant Д, search first): [from, to, state]. A state is
// «menu» or «<sections in the row>+<in «Ещё»>/<field|glyph>».
const STUDY = {
  home: [[360, 696, 'menu'], [704, 952, '2+3'], [960, 1120, '3+2'], [1128, 1128, '4+1'], [1136, 1280, '5+0/glyph'], [1288, 1600, '5+0/field']],
  section: [[360, 488, 'menu'], [496, 696, '1+4'], [704, 984, '3+2'], [992, 1080, '4+1'], [1088, 1216, '5+0/glyph'], [1224, 1600, '5+0/field']],
};

const logo = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="4"/></svg>';
const frame = (theme, kind) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};
window.__shifts=0;try{new PerformanceObserver((list)=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput)window.__shifts+=entry.value;}}).observe({type:'layout-shift',buffered:true});}catch(error){}</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.page-brand{display:inline-flex;align-items:center;gap:8px;inline-size:220px;color:inherit;text-decoration:none;font-weight:600}.page-body{min-block-size:200vh}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<sf-header-site id="h" collapse="auto" label="Навигация" menu-label="Открыть навигацию" close-label="Закрыть навигацию">
<a slot="brand" class="page-brand" href="#home">${logo}<span>SIMAI Framework</span></a>
<sf-menu orientation="horizontal" overflow="more" appearance="navigation" aria-label="Разделы"><ul>${SECTIONS.map((text, index) => `<li><a href="#s${index}"${kind === 'section' && index === SECTIONS.length - 1 ? ' aria-current="page"' : ''}>${text}</a></li>`).join('')}</ul></sf-menu>
<sf-button slot="tools" size="1" appearance="outline" scheme="on-surface" icon-start="search" text="Поиск" shortcut="mod+k" shrink="icon" aria-label="Открыть поиск по документации" aria-haspopup="dialog"></sf-button>
${kind === 'home' ? '<sf-language slot="tools" languages="ru en" trigger="icon" apply="none"></sf-language>' : ''}
<sf-button-icon slot="tools" icon="settings" appearance="ghost" scheme="on-surface" size="1" aria-label="Открыть настройки чтения"></sf-button-icon>
</sf-header-site>
<main class="page-body"><p>Страница</p></main>
</body></html>`;
// sf-language trigger="link" (owner decision C381, DEV msg-cfe379b5d6aa492c8ba6
// item 1 a): the sign-in screen's language beside a form, in a line of 14/20
// and in one of 16/24, without any page CSS for the trigger.
const linkPage = (theme) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<p class="text-1/2" id="small">Вход в панель · <sf-language id="l1" languages="ru en de" mode="menu" trigger="link" apply="none" label="Язык"></sf-language></p>
<p class="text-1" id="large"><sf-language id="l2" languages="ru en de" mode="menu" trigger="link" apply="none" label="Язык"></sf-language></p>
</body></html>`;

const host = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>body{margin:0}iframe{display:block;border:0;block-size:232px}</style></head>
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
    return response.end(frame(url.searchParams.get('theme'), url.searchParams.get('kind')));
  }
  if (path === '/link') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(linkPage(url.searchParams.get('theme')));
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
  response.writeHead(200, {'content-type': /^(text|application\/json)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const origin = `http://127.0.0.1:${server.address().port}`;

// In the frame: the header's parts and its state, as the study read them.
const READ = `window.__read = () => {
  const hdr = document.querySelector('header.sf-site-header');
  const box = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const menu = hdr.querySelector('.sf-site-header-menu-button > button');
  const menuOn = Boolean(menu && box(menu) && getComputedStyle(menu).display !== 'none');
  const seq = [];
  const brand = box(hdr.querySelector('.sf-site-header-brand a'));
  if (brand) seq.push({n: 'brand', l: brand.left, r: brand.right});
  let links = 0; let more = 0; let current = false;
  if (!menuOn) hdr.querySelectorAll('.sf-site-header-nav nav .sf-menu-element--level-1').forEach((a) => {
    const range = document.createRange(); range.selectNodeContents(a); const r = range.getBoundingClientRect();
    if (!r.width || r.top > 100) return;
    const text = (a.querySelector('.sf-menu-element-text') || a).textContent.trim();
    seq.push({n: text, l: r.left, r: r.right});
    if (a.hasAttribute('data-sf-menu-toggle')) more += 1; else links += 1;
    if (a.getAttribute('aria-current') === 'page' || a.querySelector('[aria-current="page"]')) current = true;
  });
  hdr.querySelectorAll('.sf-site-header-tools button').forEach((b) => { if (b.closest('sf-menu-context')) return; const r = box(b); if (r && r.top < 100) seq.push({n: b.getAttribute('aria-label') || '', l: r.left, r: r.right}); });
  seq.sort((a, b) => a.l - b.l);
  let min = 1e9; const bad = [];
  for (let i = 0; i + 1 < seq.length; i += 1) { const g = seq[i + 1].l - seq[i].r; if (g < min) min = g; if (g < ${GAP}) bad.push(seq[i].n + ' -> ' + seq[i + 1].n + ' ' + Math.round(g)); }
  const search = hdr.querySelector('.sf-site-header-tools sf-button[shrink="icon"]');
  const field = Boolean(search && search.getAttribute('data-shrunk') !== 'true');
  const hidden = hdr.querySelectorAll('.sf-site-header-nav nav > ul > li[hidden]:not(.sf-menu-item--more)').length;
  const state = menuOn ? 'menu' : links + '+' + hidden + (hidden ? '' : field ? '/field' : '/glyph');
  return {state, menuOn, links, more, hidden, field, current, min: Math.round(min), bad, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth};
};`;

const failures = [];
const report = {sweep: {}, study: {}, drag: {}, keys: {}, glyphs: {}, link: {}, loads: []};
const browser = await chromium.launch({headless: true, channel: process.env.SF_PROBE_CHANNEL || undefined, ignoreDefaultArgs: ['--hide-scrollbars']});

async function openHost(kind, theme = 'theme-light', width = 1440) {
  const page = await browser.newPage({viewport: {width: 1700, height: 400}});
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.goto(`${origin}/host`);
  await page.evaluate(([src, w]) => { const f = document.getElementById('f'); f.style.inlineSize = `${w}px`; f.src = src; }, [`/frame?theme=${theme}&kind=${kind}`, width]);
  const child = await (await page.$('#f')).contentFrame();
  await child.waitForFunction(() => document.querySelector('#h')?.getAttribute('data-fitted') === 'true' && document.fonts.status === 'loaded'
    && document.querySelector('#h nav.sf-smart-menu')
    // The icon font drawn: a glyph not yet in its font is its ligature's
    // words («keyboard_arrow_down»), many times wider than the glyph.
    && [...document.querySelectorAll('#h .sf-site-header-row sf-icon i')].every((i) => { const r = i.getBoundingClientRect(); return !r.width || r.width <= r.height + 1; }), null, {timeout: 20000});
  await child.evaluate(READ);
  await page.waitForTimeout(300);
  return {page, child, errors};
}
const setWidth = (page, width) => page.evaluate((w) => { document.getElementById('f').style.inlineSize = `${w}px`; }, width);
const settle = (child) => child.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 30)))));

const expected = (kind, width) => STUDY[kind].find(([from, to]) => width >= from && width <= to)?.[2] ?? '?';

try {
  // Sweep and drag, both pages.
  for (const kind of ['home', 'section']) {
    const {page, child, errors} = await openHost(kind);
    const rows = [];
    for (let width = 360; width <= 1600; width += 8) {
      await setWidth(page, width);
      await settle(child);
      rows.push({width, ...(await child.evaluate(() => window.__read()))});
    }
    report.sweep[kind] = rows;
    for (const row of rows) {
      if (row.bad.length) failures.push(`${kind} sweep at ${row.width}: gap under ${GAP} px: ${row.bad.join('; ')}`);
      if (row.sideways > 0) failures.push(`${kind} sweep at ${row.width}: the page scrolls sideways by ${row.sideways}`);
      if (kind === 'section' && !row.menuOn && !row.current) failures.push(`section sweep at ${row.width}: the current section is not in the row`);
    }
    // The order of giving way (C372): from wide to narrow the field, then the
    // glyph, then the sections one by one into «Ещё», then the menu button --
    // never back. As a rank: field 0, glyph 1, k sections shown 2 + (5 - k),
    // menu 8; it never falls as the bar narrows.
    const rank = (state) => (state === 'menu' ? 8 : state.endsWith('/field') ? 0 : state.endsWith('/glyph') ? 1 : 2 + Number(state.split('+')[1]));
    for (let index = 1; index < rows.length; index += 1) {
      const [narrow, wide] = [rows[index - 1], rows[index]];
      if (rank(narrow.state) < rank(wide.state)) failures.push(`${kind} sweep: ${narrow.state} at ${narrow.width} is further than ${wide.state} at ${wide.width} (C372 order)`);
      if (/\/field$/u.test(narrow.state) && !/^5\+0/u.test(narrow.state)) failures.push(`${kind} sweep at ${narrow.width}: a section left while the search is a field (C372 order)`);
    }
    // The study's reference widths (Docara's own header, its row inset, gap
    // and type steps; here the Framework bar): each change of state compared,
    // within one step, and reported.
    const studyAt = (width) => expected(kind, width);
    report.study[kind] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const [a, b] = [rows[index - 1], rows[index]];
      if (a.state === b.state) continue;
      const near = [b.width - 8, b.width, b.width + 8].some((w) => studyAt(w) === b.state) && [a.width - 8, a.width, a.width + 8].some((w) => studyAt(w) === a.state);
      report.study[kind].push(`${a.state} ${a.width} -> ${b.state} ${b.width}: ${near ? 'within one step' : `study ${studyAt(a.width)} -> ${studyAt(b.width)}`}`);
    }
    // Drag: one width per frame, every painted frame sampled.
    await setWidth(page, 1440);
    await settle(child);
    await child.evaluate(() => {
      window.__drag = {frames: 0, overlap: 0, changes: 0, sig: window.__read().state, on: true, seen: []};
      const sample = () => { const r = window.__read(); window.__drag.frames += 1; if (r.bad.length) window.__drag.overlap += 1; if (r.state !== window.__drag.sig) { window.__drag.changes += 1; window.__drag.sig = r.state; window.__drag.seen.push(r.state); } };
      (function loop() { if (!window.__drag.on) return; requestAnimationFrame(() => { setTimeout(sample, 0); loop(); }); })();
    });
    const path = [];
    for (let w = 1440; w >= 360; w -= 8) path.push(w);
    for (let w = 368; w <= 1440; w += 8) path.push(w);
    await page.evaluate(async (widths) => {
      const f = document.getElementById('f');
      for (const w of widths) { f.style.inlineSize = `${w}px`; await new Promise((r) => requestAnimationFrame(r)); }
    }, path);
    await page.waitForTimeout(800);
    const drag = await child.evaluate(() => { window.__drag.on = false; return window.__drag; });
    const byWidth = new Map(rows.map((row) => [row.width, row.state]));
    let crossed = 0;
    for (let index = 1; index < path.length; index += 1) if (byWidth.get(path[index]) !== byWidth.get(path[index - 1])) crossed += 1;
    report.drag[kind] = {steps: path.length, frames: drag.frames, overlapFrames: drag.overlap, stateChanges: drag.changes, thresholdsCrossed: crossed};
    if (drag.overlap) failures.push(`${kind} drag: ${drag.overlap} of ${drag.frames} painted frames with an overlap`);
    if (drag.changes !== crossed) failures.push(`${kind} drag: ${drag.changes} state changes for ${crossed} thresholds crossed (${drag.seen.join(', ')})`);
    if (errors.length) failures.push(`${kind} sweep/drag console: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // Keyboard at 1024, both pages.
  for (const kind of ['home', 'section']) {
    const {page, child, errors} = await openHost(kind, 'theme-light', 1024);
    await settle(child);
    const describe = () => child.evaluate(() => {
      const a = document.activeElement;
      if (!a || !a.closest('header.sf-site-header')) return null;
      const t = a.querySelector('.sf-menu-element-text');
      return (a.getAttribute('aria-label') || (t || a).textContent.trim()).replace(/\s+/gu, ' ') + (a.hasAttribute('data-sf-menu-toggle') ? ' [more]' : '');
    });
    await child.focus('.sf-site-header-brand a');
    const order = [await describe()];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const d = await describe();
      if (!d) break;
      order.push(d);
    }
    const state = await child.evaluate(() => window.__read());
    const result = {order, state: state.state};
    const moreAt = order.findIndex((d) => d.endsWith('[more]'));
    const firstTool = order.findIndex((d) => d.startsWith('Открыть поиск'));
    if (moreAt < 0) failures.push(`${kind} keys at 1024: «Ещё» is not in the Tab order (${order.join(' > ')})`);
    if (order[0] !== 'SIMAI Framework') failures.push(`${kind} keys: the brand is not first`);
    if (moreAt > 0 && (moreAt !== state.links + 1 || firstTool !== moreAt + 1)) failures.push(`${kind} keys at 1024: order ${order.join(' > ')}`);
    if (moreAt > 0) {
      await child.focus('[data-sf-menu-toggle="@more"]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      result.afterEnter = await child.evaluate(() => {
        const t = document.querySelector('[data-sf-menu-toggle="@more"]');
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        return {expanded: t.getAttribute('aria-expanded'), role: t.getAttribute('role') || t.localName, panel: Boolean(panel && panel.getBoundingClientRect().height),
          links: panel ? [...panel.querySelectorAll('a')].map((a) => a.textContent.trim()) : []};
      });
      await page.keyboard.press('Tab');
      result.tabIntoPanel = await describe();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      result.afterEscape = await child.evaluate(() => {
        const t = document.querySelector('[data-sf-menu-toggle="@more"]');
        return {expanded: t.getAttribute('aria-expanded'), focusBack: document.activeElement === t};
      });
      if (result.afterEnter.expanded !== 'true' || !result.afterEnter.panel || result.afterEnter.role !== 'button') failures.push(`${kind} keys: Enter on «Ещё» ${JSON.stringify(result.afterEnter)}`);
      if (!result.afterEnter.links.includes(result.tabIntoPanel)) failures.push(`${kind} keys: Tab from «Ещё» went to ${result.tabIntoPanel}, not into its panel`);
      if (result.afterEscape.expanded !== 'false' || !result.afterEscape.focusBack) failures.push(`${kind} keys: Escape ${JSON.stringify(result.afterEscape)}`);
    }
    report.keys[kind] = result;
    if (errors.length) failures.push(`${kind} keys console: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // The glyphs at 1200 on the home page: the search shrunk, the language glyph.
  {
    const {page, child, errors} = await openHost('home', 'theme-light', 1200);
    await settle(child);
    const before = await child.evaluate(() => {
      const search = document.querySelector('sf-button[shrink="icon"] > .sf-button');
      const language = document.querySelector('sf-language sf-button-icon > button');
      const s = search.getBoundingClientRect(); const l = language.getBoundingClientRect();
      return {shrunk: search.parentElement.getAttribute('data-shrunk'), name: search.getAttribute('aria-label'), keys: search.getAttribute('aria-keyshortcuts'),
        look: search.className.includes('sf-button--ghost') ? 'ghost' : search.className, search: [Math.round(s.width), Math.round(s.height)],
        language: [Math.round(l.width), Math.round(l.height)], languageName: language.getAttribute('aria-label')};
    });
    const tipOf = async (selector) => {
      try {
        await child.hover(selector, {timeout: 3000});
      } catch (error) {
        return `not reachable: ${error.message.split('\n').find((line) => /intercepts/u.test(line))?.trim() || error.message.split('\n')[0]}`;
      }
      await page.waitForTimeout(900);
      return child.evaluate((sel) => {
        const button = document.querySelector(sel);
        const tip = button && document.getElementById(button.getAttribute('data-tooltip') || '');
        return tip && !tip.hidden && tip.getBoundingClientRect().height ? tip.textContent.trim() : '';
      }, selector);
    };
    before.searchTip = await tipOf('sf-button[shrink="icon"] > .sf-button');
    await page.mouse.move(5, 380);
    await page.waitForTimeout(400);
    before.languageTip = await tipOf('sf-language sf-button-icon > button');
    report.glyphs = before;
    if (before.shrunk !== 'true') failures.push(`glyphs at 1200: the search is not shrunk (${before.shrunk})`);
    if (before.name !== 'Открыть поиск по документации' || !before.keys) failures.push(`glyphs: the shrunk search lost its name or keys (${before.name}, ${before.keys})`);
    if (before.look !== 'ghost') failures.push(`glyphs: the shrunk search is not ghost (${before.look})`);
    if (Math.abs(before.search[0] - before.search[1]) > 0.5) failures.push(`glyphs: the shrunk search is not square (${before.search})`);
    if (Math.abs(before.language[0] - before.language[1]) > 0.5 || before.language[1] !== before.search[1]) failures.push(`glyphs: the language glyph is not a square of the bar's step (${before.language})`);
    if (before.languageName !== 'Язык: Русский') failures.push(`glyphs: the language glyph is named ${before.languageName}`);
    if (!/^Поиск (⌘K|Ctrl\+K)$/u.test(before.searchTip)) failures.push(`glyphs: the search tooltip says «${before.searchTip}»`);
    if (before.languageTip !== 'Язык: Русский') failures.push(`glyphs: the language tooltip says «${before.languageTip}»`);
    if (errors.length) failures.push(`glyphs console: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // sf-language trigger="link" (C381): rest, hover, keyboard focus, open, a choice.
  for (const theme of ['theme-light', 'theme-dark']) {
    const page = await browser.newPage({viewport: {width: 1440, height: 700}});
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    await page.goto(`${origin}/link?theme=${theme}`);
    await page.waitForFunction(() => document.querySelector('#l2 button.sf-language-link sf-icon i') && document.fonts.status === 'loaded', null, {timeout: 20000});
    await page.waitForTimeout(400);
    const look = (id) => page.evaluate((sel) => {
      const host = document.querySelector(sel);
      const b = host.querySelector('button.sf-language-link');
      // sf-icon is its glyph (display: contents): the box is the glyph's.
      const icon = b.querySelector('sf-icon');
      const glyph = [icon.querySelector('i, svg, .sf-icon'), icon].find((element) => element && element.getBoundingClientRect().width) || icon;
      const words = b.querySelector('.sf-link-content');
      const cs = getComputedStyle(b);
      const fills = [cs.backgroundColor, getComputedStyle(b, '::before').backgroundColor, getComputedStyle(b, '::after').backgroundColor];
      const tips = [...document.querySelectorAll('.sf-tooltip')].filter((t) => !t.hidden && t.getBoundingClientRect().height && getComputedStyle(t).visibility !== 'hidden' && Number(getComputedStyle(t).opacity) > 0).length;
      const r = b.getBoundingClientRect(); const g = glyph.getBoundingClientRect(); const w = words.getBoundingClientRect();
      const p = getComputedStyle(host.parentElement);
      return {fills, transparent: fills.every((c) => c === 'transparent' || /^rgba\(.*,\s*0\)$/u.test(c)), glyphLeft: Math.round((g.left - r.left) * 10) / 10,
        glyph: [Math.round(g.width), Math.round(g.height)], line: parseFloat(p.lineHeight), font: [cs.fontSize, p.fontSize], gap: Math.round((w.left - g.right) * 10) / 10,
        underline: getComputedStyle(words).textDecorationLine, glyphLine: getComputedStyle(glyph).textDecorationLine, text: words.textContent.trim(), name: b.getAttribute('aria-label'),
        popup: b.getAttribute('aria-haspopup'), expanded: b.getAttribute('aria-expanded'), outline: [cs.outlineStyle, cs.outlineWidth, cs.outlineOffset],
        // Drawn, the host is its parts (display: contents): its box is the trigger.
        hostWidth: getComputedStyle(host).display === 'contents' ? Math.round(r.width * 10) / 10 : Math.round(host.getBoundingClientRect().width * 10) / 10,
        content: Math.round((g.width + (w.left - g.right) + w.width) * 10) / 10, width: Math.round(r.width * 10) / 10, tips, ink: cs.color};
    }, id);
    const states = {};
    states.rest = await look('#l1');
    await page.hover('#l1 button.sf-language-link');
    await page.waitForTimeout(700);
    states.hover = await look('#l1');
    await page.mouse.move(5, 650);
    await page.focus('#l1 button.sf-language-link');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    states.focus = await look('#l2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    states.open = await look('#l2');
    let picked = false;
    for (const element of await page.$$('[role="menuitemradio"]')) {
      if ((await element.textContent()).includes('Deutsch') && await element.isVisible()) {
        await element.click();
        picked = true;
        break;
      }
    }
    await page.waitForTimeout(500);
    states.chosen = await look('#l2');
    report.link[theme] = states;
    const label = (state) => `link ${theme} ${state}`;
    for (const [state, v] of Object.entries(states)) {
      if (!v.transparent) failures.push(`${label(state)}: a fill ${v.fills.join(' / ')}`);
      if (Math.abs(v.glyphLeft) > 0.5) failures.push(`${label(state)}: the glyph stands ${v.glyphLeft} from the trigger's left edge`);
      if (Math.abs(v.glyph[1] - v.line) > 0.5 || v.glyph[0] !== v.glyph[1]) failures.push(`${label(state)}: the glyph ${v.glyph} is not one line (${v.line})`);
      if (Math.abs(v.gap - 4) > 0.5) failures.push(`${label(state)}: the glyph stands ${v.gap} from the name, not 4`);
      if (v.font[0] !== v.font[1]) failures.push(`${label(state)}: the words are ${v.font[0]}, their place ${v.font[1]}`);
      if (v.tips) failures.push(`${label(state)}: ${v.tips} tooltip(s) shown`);
      if (v.glyphLine !== 'none') failures.push(`${label(state)}: the glyph is underlined`);
      if (v.popup !== 'menu' || !/^Язык: /u.test(v.name)) failures.push(`${label(state)}: name ${v.name}, haspopup ${v.popup}`);
    }
    if (states.rest.underline !== 'none') failures.push(`link ${theme}: the name is underlined at rest`);
    for (const state of ['hover', 'focus', 'open']) if (states[state].underline !== 'underline') failures.push(`link ${theme} ${state}: no line under the name`);
    if (states.focus.outline[0] === 'none' || states.focus.outline[1] !== '2px' || states.focus.outline[2] !== '2px') failures.push(`link ${theme} focus: ring ${states.focus.outline}`);
    if (states.open.expanded !== 'true') failures.push(`link ${theme} open: aria-expanded ${states.open.expanded}`);
    if (states.rest.text !== 'Русский') failures.push(`link ${theme}: the trigger says ${states.rest.text}`);
    if (!picked || states.chosen.text !== 'Deutsch' || states.chosen.name !== 'Язык: Deutsch') failures.push(`link ${theme}: after choosing Deutsch the trigger says ${states.chosen.text} (${states.chosen.name})`);
    if (Math.abs(states.chosen.hostWidth - states.chosen.width) > 0.5 || Math.abs(states.chosen.width - states.chosen.content) > 0.5 || states.chosen.width === states.focus.width) failures.push(`link ${theme}: the host (${states.chosen.hostWidth}) does not follow the name (${states.chosen.width}, was ${states.focus.width})`);
    if (errors.length) failures.push(`link ${theme} console: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }

  // Cold loads: CLS from the first paint, the console.
  for (const theme of ['theme-light', 'theme-dark']) for (const width of [1440, 1024, 704, 390]) for (let load = 1; load <= 3; load += 1) {
    const {page, child, errors} = await openHost('home', theme, width);
    await page.waitForTimeout(600);
    const shifts = await child.evaluate(() => window.__shifts);
    const state = await child.evaluate(() => window.__read());
    report.loads.push({theme, width, load, cls: shifts, state: state.state, min: state.min});
    if (shifts > 0) failures.push(`load ${theme} ${width} #${load}: CLS ${shifts}`);
    if (state.bad.length) failures.push(`load ${theme} ${width} #${load}: ${state.bad.join('; ')}`);
    if (errors.length) failures.push(`load ${theme} ${width} #${load}: ${errors.join(' | ').slice(0, 300)}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const ranges = (rows) => {
  const out = [];
  for (const row of rows) {
    const last = out.at(-1);
    if (last && last.state === row.state) last.to = row.width;
    else out.push({from: row.width, to: row.width, state: row.state});
  }
  return out.map((r) => `${r.from}-${r.to} ${r.state}`);
};
const summary = {sweep: Object.fromEntries(Object.entries(report.sweep).map(([kind, rows]) => [kind, {states: ranges(rows), minGap: Math.min(...rows.map((row) => row.min))}])),
  study: report.study, drag: report.drag, keys: report.keys, glyphs: report.glyphs, link: report.link,
  loads: {count: report.loads.length, maxCls: Math.max(...report.loads.map((row) => row.cls)), states: [...new Set(report.loads.map((row) => `${row.width} ${row.state}`))]}};
console.log(JSON.stringify(reportOnly ? report : summary, null, 1));
if (reportOnly) process.exit(0);
if (failures.length) {
  console.error(failures.slice(0, 60).join('\n'));
  process.exit(1);
}
console.log('HEADER_SITE_COLLAPSE_AUTO_OK');
