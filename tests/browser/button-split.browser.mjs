#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [result.json]
//
// sf-button's split and menu button (sf-button 1.15.0, owner decision C119)
// and the danger outline's border (C118), on a build output. A static UTF-8
// page links core.css and the buttons, icon-buttons and context-menu sheets
// and is measured only after every sheet has loaded, the fonts are ready and
// every sf-button and sf-button-icon has drawn; 1440 and 390, light and dark,
// three loads each in fresh contexts, normal and compact density.
// Wants: both parts of a split button at the plain button's ladder height,
// the arrow square and as tall as an sf-button-icon of the size, a 1 px seam
// (the page between filled parts, one shared border between outlined ones),
// inner corners square; Tab reaches the label part then the arrow; ArrowDown,
// Enter and Space on the arrow open the menu on its first row, ArrowUp on its
// last, Escape returns focus to the arrow; a chosen row sends
// sf-button-select, the label part sf-button-press; the danger outline's
// border is red at 64 % and the primary and on-surface outlines grey; no
// console message, no failed request.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const jsonFile = process.argv[3];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const LOOKS = {main: 'appearance="default" scheme="primary"', regular: 'appearance="outline" scheme="on-surface"'};
const MENU = `menu='[{"id":"section","text":"Раздел","icon":"folder"},{"id":"import","text":"Импорт из файла","icon":"upload_file"}]'`;
const row = (density) => SIZES.flatMap((size) => Object.entries(LOOKS).map(([look, attrs]) => `<div class="row">
<i class="cell" data-k="split|${density}|${look}|${size}|default"><sf-button ${attrs} size="${size}" text="Добавить элемент" icon-start="add" split ${MENU}></sf-button></i>
<i class="cell" data-k="ref|${density}|${look}|${size}|default"><sf-button ${attrs} size="${size}" text="Добавить элемент" icon-start="add"></sf-button></i>
<i class="cell" data-k="refi|${density}|${look}|${size}|default"><sf-button-icon ${attrs} size="${size}" icon="expand_more" aria-label="Ещё"></sf-button-icon></i>
</div>`)).join('\n') + ['low', 'high'].map((height) => `<div class="row">
<i class="cell" data-k="split|${density}|main|1|${height}"><sf-button ${LOOKS.main} height="${height}" text="Добавить элемент" split ${MENU}></sf-button></i>
<i class="cell" data-k="ref|${density}|main|1|${height}"><sf-button ${LOOKS.main} height="${height}" text="Добавить элемент"></sf-button></i>
</div>`).join('\n') + `<div class="row">
<i class="cell" data-k="split|${density}|main|page|default"><sf-button ${LOOKS.main} text="Добавить элемент" split ${MENU}></sf-button></i>
<i class="cell" data-k="ref|${density}|main|page|default"><sf-button ${LOOKS.main} text="Добавить элемент"></sf-button></i>
<i class="cell" data-k="split|${density}|regular|page|default"><sf-button ${LOOKS.regular} text="Добавить секцию" split ${MENU}></sf-button></i>
<i class="cell" data-k="ref|${density}|regular|page|default"><sf-button ${LOOKS.regular} text="Добавить секцию"></sf-button></i>
</div>`;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/buttons/css/buttons.css">
<link rel="stylesheet" href="/distr/component/icon-buttons/css/icon-buttons.css">
<link rel="stylesheet" href="/distr/component/context-menu/css/context-menu.css">
<style>.zone{display:flex;flex-direction:column;gap:12px;margin:16px}.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.cell{display:contents}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
<section class="zone" id="normal">${row('normal')}</section>
<section class="zone" id="compact" data-sf-density="compact">${row('compact')}</section>
<section class="zone" id="kbd">
<sf-button id="before" text="До" appearance="ghost" scheme="on-surface"></sf-button>
<sf-button id="k-split" text="Добавить элемент" icon-start="add" split ${MENU}></sf-button>
<sf-button id="k-menu" text="Добавить" appearance="outline" scheme="on-surface" menu='[{"id":"section","text":"Раздел"},{"id":"divider","text":"Разделитель"},{"id":"heading","text":"Заголовок"},{"id":"link","text":"Ссылка"}]'></sf-button>
<sf-button id="k-full" text="Добавить элемент" split full-width ${MENU}></sf-button>
</section>
<section class="zone" id="c118"><div class="row">
<i class="cell" data-b="smart|button|danger"><sf-button appearance="outline" status="danger" text="Удалить"></sf-button></i>
<i class="cell" data-b="smart|button|primary"><sf-button appearance="outline" scheme="primary" text="Подробнее"></sf-button></i>
<i class="cell" data-b="smart|button|on-surface"><sf-button appearance="outline" scheme="on-surface" text="Экспорт"></sf-button></i>
<i class="cell" data-b="smart|button|danger-disabled"><sf-button appearance="outline" status="danger" text="Удалить" disabled></sf-button></i>
<i class="cell" data-b="smart|icon|danger"><sf-button-icon appearance="outline" status="danger" icon="delete" aria-label="Удалить"></sf-button-icon></i>
<i class="cell" data-b="smart|icon|primary"><sf-button-icon appearance="outline" scheme="primary" icon="edit" aria-label="Править"></sf-button-icon></i>
<i class="cell" data-b="smart|icon|on-surface"><sf-button-icon appearance="outline" scheme="on-surface" icon="edit" aria-label="Править"></sf-button-icon></i>
<button data-b="class|button|danger" type="button" class="sf-button sf-button--size-1 sf-button--outline sf-button--danger flex items-cross-center"><span class="sf-button-text-container">Удалить</span></button>
<button data-b="class|button|primary" type="button" class="sf-button sf-button--size-1 sf-button--outline sf-button--primary flex items-cross-center"><span class="sf-button-text-container">Подробнее</span></button>
<button data-b="class|icon|danger" type="button" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--icon sf-icon-button--outline sf-icon-button--danger flex items-cross-center" aria-label="Удалить"><i class="sf-icon" aria-hidden="true">delete</i></button>
<span data-k="class-split" class="sf-button-split"><button type="button" class="sf-button sf-button--size-1 sf-button--default sf-button--primary flex items-cross-center"><span class="sf-button-text-container">Сохранить</span></button><button type="button" class="sf-icon-button sf-icon-button--size-1 sf-icon-button--icon sf-icon-button--default sf-icon-button--primary flex items-cross-center" aria-haspopup="menu" aria-expanded="false" aria-label="Другие варианты: Сохранить"><i class="sf-icon" aria-hidden="true">expand_more</i></button></span>
</div></section>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}/`;

const MEASURE = () => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return {x: +r.left.toFixed(2), r: +r.right.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2)}; };
  const cs = (el) => getComputedStyle(el);
  const geo = [];
  for (const cell of document.querySelectorAll('i.cell[data-k], span[data-k]')) {
    const host = cell.matches('span') ? cell : cell.firstElementChild; const key = cell.dataset.k;
    const [kind, density, look, size, height] = key.split('|');
    if (key === 'class-split') {
      const [main, arrow] = host.children;
      geo.push({key: 'class-split', main: rect(main), arrow: rect(arrow), seam: +(arrow.getBoundingClientRect().left - main.getBoundingClientRect().right).toFixed(2)});
      continue;
    }
    if (kind === 'split') {
      const wrap = host.querySelector(':scope > .sf-button-split');
      const main = wrap?.querySelector(':scope > .sf-button');
      const arrow = wrap?.querySelector(':scope > sf-button-icon > .sf-icon-button');
      if (!main || !arrow) { geo.push({key: key, missing: true}); continue; }
      const m = cs(main); const a = cs(arrow);
      geo.push({key: key, kind, density, look, size, height, main: rect(main), arrow: rect(arrow),
        seam: +(arrow.getBoundingClientRect().left - main.getBoundingClientRect().right).toFixed(2),
        mainBorder: [m.borderInlineEndWidth, m.borderTopWidth], arrowBorder: [a.borderInlineStartWidth, a.borderTopWidth],
        mainRadius: [m.borderStartEndRadius, m.borderEndEndRadius, m.borderStartStartRadius], arrowRadius: [a.borderStartStartRadius, a.borderEndStartRadius, a.borderStartEndRadius],
        arrowIcon: (() => { const i = arrow.querySelector('.sf-icon') ?? arrow.querySelector('sf-icon'); const b = i && (i.matches('.sf-icon') ? i : i.firstElementChild ?? i); return b ? rect(b) : null; })(),
        arrowLabel: arrow.getAttribute('aria-label'), haspopup: arrow.getAttribute('aria-haspopup'), expanded: arrow.getAttribute('aria-expanded'),
        mainHaspopup: main.getAttribute('aria-haspopup')});
    } else {
      const el = host.querySelector('.sf-button, .sf-icon-button');
      geo.push(el ? {key: key, kind, density, look, size, height, box: rect(el)} : {key: key, missing: true, html: host.outerHTML.slice(0, 300)});
    }
  }
  const c = new OffscreenCanvas(1, 1).getContext('2d', {willReadFrequently: true});
  const rgba = (css) => { c.clearRect(0, 0, 1, 1); c.fillStyle = '#000'; c.fillStyle = css; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; };
  const page = rgba(getComputedStyle(document.body).backgroundColor);
  const borders = [...document.querySelectorAll('i.cell[data-b], button[data-b]')].map((cell) => {
    const host = cell.matches('button') ? cell : cell.firstElementChild; const bkey = cell.dataset.b;
    const el = host.matches('button') ? host : host.querySelector('.sf-button, .sf-icon-button');
    if (!el) return {key: bkey, missing: true};
    return {key: bkey, border: cs(el).borderTopColor, borderWidth: cs(el).borderTopWidth, rgba: rgba(cs(el).borderTopColor), label: cs(el.querySelector('.sf-button-text-container, .sf-icon') ?? el).color};
  });
  return {geo, borders, page};
};

const lum = ([r, g, b]) => { const f = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const over = ([r, g, b, a], baseRgb) => [r, g, b].map((v, i) => Math.round(v * (a / 255) + baseRgb[i] * (1 - a / 255)));

const browser = await chromium.launch();
const runs = [];
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (let load = 1; load <= 3; load += 1) {
  const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme});
  const p = await context.newPage();
  const consoleLines = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleLines.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`));
  const failed = [];
  p.on('requestfailed', (r) => failed.push(r.url()));
  p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?theme=${theme}`, {waitUntil: 'load'});
  await p.waitForFunction(() => [...document.styleSheets].every((s) => { try { return s.cssRules.length >= 0; } catch { return false; } })
    && document.fonts.status === 'loaded'
    && [...document.querySelectorAll('sf-button')].every((h) => h.querySelector('.sf-button'))
    && [...document.querySelectorAll('sf-button-icon')].every((h) => h.querySelector('.sf-icon-button'))
    && document.querySelectorAll('sf-button[split] sf-menu-context').length > 0
    && customElements.get('sf-menu-context') && customElements.get('sf-button-icon'), null, {timeout: 20000});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const m = await p.evaluate(MEASURE);
  const borders = m.borders.map((b) => (b.missing ? b : {...b, page: m.page, contrast: ratio(over(b.rgba, m.page), m.page), onWhite: ratio(over(b.rgba, theme === 'light' ? [255, 255, 255] : m.page), theme === 'light' ? [255, 255, 255] : m.page)}));

  // Keyboard on the split button and the menu button.
  const kb = {};
  const active = () => p.evaluate(() => {
    const a = document.activeElement;
    const host = a?.closest('sf-button, sf-menu-context, sf-button-icon, .sf-context-menu');
    return {tag: a?.localName, cls: a?.className?.toString().slice(0, 60), label: a?.getAttribute('aria-label') || a?.textContent?.trim().slice(0, 30), inMenu: Boolean(a?.closest('.sf-context-menu')), role: a?.getAttribute('role'), host: host?.id || host?.localName};
  });
  const state = (id) => p.evaluate((hid) => {
    const host = document.getElementById(hid);
    const arrow = host.querySelector('.sf-button-split-arrow button') ?? host.querySelector('.sf-button');
    const surface = host.querySelector('sf-menu-context .sf-context-menu') ?? document.querySelector('.sf-context-menu--open');
    return {expanded: arrow.getAttribute('aria-expanded'), open: Boolean(document.querySelector('.sf-context-menu.sf-context-menu--open'))};
  }, id);
  await p.evaluate(() => {
    window.__ev = [];
    for (const id of ['k-split', 'k-menu']) {
      const h = document.getElementById(id);
      h.addEventListener('sf-button-press', () => window.__ev.push(`${id}:press`));
      h.addEventListener('sf-button-select', (e) => window.__ev.push(`${id}:select:${e.detail.id}`));
    }
    document.querySelector('#before .sf-button').focus();
  });
  await p.keyboard.press('Tab'); kb.tab1 = await active();
  await p.keyboard.press('Tab'); kb.tab2 = await active();
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250); kb.arrowDown = {...await active(), ...await state('k-split')};
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); kb.escape1 = {...await active(), ...await state('k-split')};
  await p.keyboard.press('Enter'); await p.waitForTimeout(250); kb.enter = {...await active(), ...await state('k-split')};
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); kb.escape2 = {...await active(), ...await state('k-split')};
  await p.keyboard.press('Space'); await p.waitForTimeout(250); kb.space = {...await active(), ...await state('k-split')};
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(250); kb.select = {...await active(), ...await state('k-split')};
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(250); kb.arrowUp = {...await active(), ...await state('k-split')};
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.press('Shift+Tab'); kb.backToMain = await active();
  await p.keyboard.press('Enter'); await p.waitForTimeout(150); kb.mainEnter = await state('k-split');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); kb.tabMenuButton = await active();
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250); kb.menuButtonDown = {...await active(), ...await state('k-menu')};
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); kb.menuButtonEsc = {...await active(), ...await state('k-menu')};
  await p.keyboard.press('Enter'); await p.waitForTimeout(250); kb.menuButtonEnter = {...await active(), ...await state('k-menu')};
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // Pointer: the arrow opens, the label part presses.
  await p.click('#k-split .sf-button-split-arrow button'); await p.waitForTimeout(250); kb.clickArrow = await state('k-split');
  const menuBox = await p.evaluate(() => { const s = document.querySelector('.sf-context-menu--open'); const a = document.querySelector('#k-split .sf-button-split-arrow button'); const r = s.getBoundingClientRect(); const q = a.getBoundingClientRect(); return {menuRight: +r.right.toFixed(1), arrowRight: +q.right.toFixed(1), menuTop: +r.top.toFixed(1), arrowBottom: +q.bottom.toFixed(1)}; });
  kb.menuBox = menuBox;
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#k-split .sf-button-split > .sf-button'); await p.waitForTimeout(150); kb.clickMain = await state('k-split');
  kb.events = await p.evaluate(() => window.__ev);
  kb.fullWidth = await p.evaluate(() => { const w = document.querySelector('#k-full .sf-button-split'); const z = document.getElementById('kbd'); return {wrap: +w.getBoundingClientRect().width.toFixed(1), zone: +z.getBoundingClientRect().width.toFixed(1)}; });
  kb.hscroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  runs.push({width, theme, load, geo: m.geo, borders, kb, console: consoleLines, failed});
  await context.close();
}
await browser.close();
server.close();
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(runs, null, 1));

const problems = [];
const near = (a, b) => Math.abs(a - b) < 0.01;
for (const r of runs) {
  const tag = `${r.width}/${r.theme}/${r.load}`;
  const geo = Object.fromEntries(r.geo.map((g) => [g.key, g]));
  for (const g of r.geo) {
    if (g.missing) { problems.push(`${tag} ${g.key}: not drawn`); continue; }
    if (g.kind !== 'split') continue;
    const [, density, look, size, height] = g.key.split('|');
    const ref = geo[`ref|${density}|${look}|${size}|${height}`];
    const refi = geo[`refi|${density}|${look}|${size}|${height}`];
    if (!near(g.main.h, g.arrow.h) || !near(g.arrow.h, g.arrow.w) || !ref || !near(ref.box.h, g.main.h)) problems.push(`${tag} ${g.key}: heights ${g.main.h} / ${g.arrow.h}x${g.arrow.w}, plain ${ref?.box.h}`);
    if (refi && !near(refi.box.h, g.arrow.h)) problems.push(`${tag} ${g.key}: arrow ${g.arrow.h}, icon button ${refi.box.h}`);
    if (!near(g.seam, look === 'main' ? 1 : -1)) problems.push(`${tag} ${g.key}: seam ${g.seam}`);
    if ([g.mainRadius[0], g.mainRadius[1], g.arrowRadius[0], g.arrowRadius[1]].some((v) => v !== '0px')) problems.push(`${tag} ${g.key}: inner corners ${g.mainRadius} ${g.arrowRadius}`);
    if (g.haspopup !== 'menu' || !String(g.arrowLabel).startsWith('Другие варианты')) problems.push(`${tag} ${g.key}: arrow ${g.haspopup} «${g.arrowLabel}»`);
  }
  const kb = r.kb;
  const arrowFocused = (s) => String(s.label).startsWith('Другие варианты') && !s.open && s.expanded === 'false';
  const want = {
    tab1: kb.tab1.host === 'k-split' && kb.tab1.cls.includes('sf-button--default'),
    tab2: String(kb.tab2.label).startsWith('Другие варианты'),
    arrowDown: kb.arrowDown.inMenu && kb.arrowDown.expanded === 'true' && kb.arrowDown.label.includes('folder'),
    escape1: arrowFocused(kb.escape1), enter: kb.enter.inMenu && kb.enter.open, escape2: arrowFocused(kb.escape2),
    space: kb.space.inMenu && kb.space.open, select: arrowFocused(kb.select),
    arrowUp: kb.arrowUp.inMenu && kb.arrowUp.label.includes('upload_file'),
    backToMain: kb.backToMain.host === 'k-split' && kb.backToMain.cls.includes('sf-button--default'),
    mainEnter: !kb.mainEnter.open, tabMenuButton: kb.tabMenuButton.host === 'k-menu',
    menuButtonDown: kb.menuButtonDown.inMenu && kb.menuButtonDown.expanded === 'true',
    menuButtonEsc: kb.menuButtonEsc.host === 'k-menu' && !kb.menuButtonEsc.open && kb.menuButtonEsc.expanded === 'false',
    menuButtonEnter: kb.menuButtonEnter.inMenu, clickArrow: kb.clickArrow.open,
    menuEndAligned: Math.abs(kb.menuBox.menuRight - kb.menuBox.arrowRight) < 1 && kb.menuBox.menuTop >= kb.menuBox.arrowBottom,
    clickMain: !kb.clickMain.open,
    events: JSON.stringify(kb.events) === JSON.stringify(['k-split:select:import', 'k-split:press', 'k-split:press']),
    fullWidth: Math.abs(kb.fullWidth.wrap - kb.fullWidth.zone) < 1, noHorizontalScroll: !kb.hscroll,
  };
  for (const [name, ok] of Object.entries(want)) if (!ok) problems.push(`${tag} keyboard ${name}: ${JSON.stringify(kb[name] ?? null)}`);
  for (const b of r.borders) {
    if (b.missing) { problems.push(`${tag} ${b.key}: not drawn`); continue; }
    const red = b.key.endsWith('|danger');
    if (red && !(b.rgba[0] > b.rgba[1] && b.rgba[3] === 163 && b.contrast >= 3)) problems.push(`${tag} ${b.key}: border ${b.border} ${b.contrast}`);
    const grey = r.borders.find((one) => one.key === 'smart|button|on-surface')?.border;
    if (!red && !b.key.endsWith('disabled') && b.border !== grey) problems.push(`${tag} ${b.key}: border ${b.border}, not the shared grey ${grey}`);
  }
  for (const line of [...r.console, ...r.failed]) problems.push(`${tag} ${line}`);
}
console.log(JSON.stringify({runs: runs.length, problems}, null, 2));
if (problems.length) process.exitCode = 1;
