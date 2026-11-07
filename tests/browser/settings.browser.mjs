#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-settings on the built bytes with the real Loader, at 1440 and 390 px,
// light and dark: the three looks inline (drill, rows, tiles), a popup opened
// from its trigger and the drill look at size 1. Measured: the panel is
// 280 px in every look; the rows are the menu's rung (32 px at 1/2, 40 px at
// 1, less on a phone where the ladder is tighter); a long name wraps and a
// long value ends in an ellipsis with the whole of it in title; the row
// glyphs are the on-surface or on-surface-variant role; the panel stays in
// the window. The keyboard: a popup opens on Enter with the focus on its
// first row, Down moves, Enter on a drilling choice opens its level, Escape
// goes back and then closes, the focus back on the trigger. A press writes
// the value and sends change then changed. No sideways scroll, no page
// errors. With a screenshot folder, each case is saved there as a PNG.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let page = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page' || path.startsWith('/page/')) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const READER = [
  {id: 'theme', type: 'choice', text: 'Тема', icon: 'contrast', value: 'system', options: [
    {id: 'system', text: 'Как в системе', icon: 'computer'}, {id: 'light', text: 'Светлая', icon: 'light_mode'}, {id: 'dark', text: 'Тёмная', icon: 'dark_mode'}]},
  {id: 'digest', type: 'choice', text: 'Как часто присылать сводку по задачам проекта', icon: 'mail', value: 'week', options: [
    {id: 'day', text: 'Каждый день утром'}, {id: 'week', text: 'Раз в неделю, в понедельник утром, со всеми задачами'}]},
  {id: 'sound', type: 'switch', text: 'Звук', icon: 'volume_up', value: true},
];
const TABLE = [
  {type: 'group', text: 'Вид таблицы', items: [
    {id: 'density', type: 'choice', text: 'Плотность', value: 'normal', options: [{id: 'compact', text: 'Плотно'}, {id: 'normal', text: 'Обычно'}]},
    {id: 'align', type: 'choice', text: 'Выравнивание', value: 'start', options: [
      {id: 'start', text: 'По левому краю', icon: 'format_align_left'}, {id: 'center', text: 'По центру', icon: 'format_align_center'}, {id: 'end', text: 'По правому краю', icon: 'format_align_right'}]},
    {id: 'wrap', type: 'switch', text: 'Переносить длинные строки таблицы целиком', value: false}]},
  {type: 'separator'},
  {id: 'scale', type: 'range', text: 'Масштаб', value: 100, min: 80, max: 140, step: 10, unit: '%'},
];
const QUICK = [
  {id: 'sound', type: 'switch', text: 'Звук', icon: 'volume_up', value: true, tile: true},
  {id: 'night', type: 'switch', text: 'Ночь', icon: 'dark_mode', value: false, tile: true},
  {id: 'alerts', type: 'switch', text: 'Сигналы', icon: 'notifications', value: true, tile: true},
  {id: 'theme', type: 'choice', text: 'Тема', icon: 'contrast', value: 'system', options: [
    {id: 'system', text: 'Авто', icon: 'computer'}, {id: 'light', text: 'Светлая', icon: 'light_mode'}, {id: 'dark', text: 'Тёмная', icon: 'dark_mode'}]},
  {id: 'scale', type: 'range', text: 'Масштаб', icon: 'format_size', value: 100, min: 80, max: 140, step: 10, unit: '%'},
];
const island = (items) => `<script type="application/json" data-sf-settings>${JSON.stringify({items}).replace(/</gu, '\\u003c')}</script>`;
const CASES = {
  drill: {look: 'drill', items: READER},
  rows: {look: 'rows', items: TABLE},
  tiles: {look: 'tiles', items: QUICK},
  popup: {look: 'drill', items: READER, popup: true},
  large: {look: 'rows', items: TABLE, size: '1'},
};

const shell = (name, theme) => {
  const {look, items, popup, size} = CASES[name];
  const trigger = popup ? '<sf-button-icon id="trigger" icon="tune" appearance="link" scheme="on-surface" size="1/2" aria-label="Настройки"></sf-button-icon>' : '';
  return `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface);font-family:var(--sf-font-family, system-ui)}main{padding:16px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;max-inline-size:100%;box-sizing:border-box}</style></head>
<body><main>
  <sf-settings id="settings" look="${look}"${size ? ` size="${size}"` : ''} label="Настройки">${trigger}${island(items)}</sf-settings>
  <p id="after">После панели</p>
</main></body></html>`;
};

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) < tolerance;
const browser = await chromium.launch();

async function open(name, {width, theme}) {
  page = shell(name, theme);
  const context = await browser.newContext({viewport: {width, height: 760}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-settings') && customElements.get('sf-menu-context') && document.querySelector('#settings[data-look] sf-menu-context .sf-context-menu-content'), null, {timeout: 20000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(400);
  return {tab, context, errors};
}

// A row is a control of the menu's rung (owner C05, R029).
const rung = (size) => `(() => { const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;block-size:var(--sf-ui-${size.replace('/', '\\\\/')}--control-height)'; document.body.append(probe); const h = parseFloat(getComputedStyle(probe).blockSize); probe.remove(); return h; })()`;
// A role's colour where the glyphs stand: inside the panel, whose surface
// may give the roles values of its own (a raised surface in the dark theme).
const colour = (variable) => `(() => { const probe = document.createElement('span'); probe.style.color = 'var(${variable})'; document.querySelector('#settings .sf-context-menu-content').append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; })()`;

const MEASURE = () => {
  const r = (el) => el.getBoundingClientRect();
  const el = document.querySelector('#settings');
  const content = el.querySelector('.sf-context-menu-content');
  // A row: a command-shaped row or a value row (a choice or a range row is a
  // block of its own), not an option or a tile; one line of label.
  const rows = [...el.querySelectorAll('.sf-context-menu-item:not(.sf-context-menu-choice-option):not(.sf-context-menu-tile), .sf-context-menu-value-row')];
  const plain = rows.filter((row) => {
    const label = row.querySelector('.sf-context-menu-item-label');
    return label && !row.querySelector('.sf-context-menu-item-under, .sf-context-menu-item-caption') && r(label).height < parseFloat(getComputedStyle(label).lineHeight) * 1.5;
  });
  // The glyphs at rest: the rows', the options' and the tiles' that are not
  // chosen (a chosen option or a tile that is on takes the selected state's
  // ink, the menu's).
  const glyphs = [...el.querySelectorAll('.sf-context-menu-item:not(.sf-context-menu-tile--on):not([aria-checked="true"]) .sf-icon')].map((icon) => getComputedStyle(icon).color);
  const withIcons = Boolean(el.querySelector('.sf-context-menu-item .sf-icon'));
  const under = el.querySelector('.sf-context-menu-item-under');
  const longLabel = [...el.querySelectorAll('.sf-context-menu-item-label')].find((label) => label.textContent.length > 30);
  return {
    look: el.getAttribute('data-look'), width: content && r(content).width, left: content && r(content).left, right: content && r(content).right,
    heights: [...new Set(plain.map((row) => Math.round(r(row).height * 10) / 10))],
    glyphs: [...new Set(glyphs)], withIcons,
    under: under && {cut: under.scrollWidth > under.clientWidth + 0.5, title: under.getAttribute('title'), text: under.textContent.trim()},
    wrapped: longLabel ? longLabel.getClientRects().length > 1 || r(longLabel).height > parseFloat(getComputedStyle(longLabel).lineHeight) * 1.5 : null,
    tiles: el.querySelectorAll('.sf-context-menu-tile').length, drillHead: Boolean(el.querySelector('.sf-context-menu-drill-head')),
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
};

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    for (const name of Object.keys(CASES)) {
      const label = `${name} ${width} ${theme}`;
      const {tab, context, errors} = await open(name, {width, theme});
      const {popup, size = '1/2'} = CASES[name];
      if (popup) {
        const closed = await tab.evaluate(() => { const button = document.querySelector('#trigger button'); const menu = document.querySelector('#settings sf-menu-context'); return {haspopup: button.getAttribute('aria-haspopup'), expanded: button.getAttribute('aria-expanded'), shown: menu.querySelector('.sf-context-menu').getBoundingClientRect().height}; });
        ok(`${label}: closed, the trigger says it opens a menu and the panel takes no room`, closed.haspopup === 'menu' && closed.expanded === 'false' && closed.shown === 0, JSON.stringify(closed));
        await tab.focus('#trigger button');
        await tab.keyboard.press('Enter');
        await tab.waitForTimeout(400);
        const opened = await tab.evaluate(() => { const menu = document.querySelector('#settings sf-menu-context'); const first = menu.querySelector('.sf-context-menu-item'); return {open: menu.isOpen, expanded: document.querySelector('#trigger button').getAttribute('aria-expanded'), focus: document.activeElement === first}; });
        ok(`${label}: Enter on the trigger opens the panel, the focus on its first row`, opened.open && opened.expanded === 'true' && opened.focus, JSON.stringify(opened));
      }
      const m = await tab.evaluate(MEASURE);
      const row = await tab.evaluate(rung(size));
      ok(`${label}: the look is ${CASES[name].look}`, m.look === CASES[name].look, m.look);
      ok(`${label}: the panel is 280 px and stays in the window`, near(m.width, 280) && m.left >= -0.5 && m.right <= width + 0.5 && !m.overflow, JSON.stringify({width: m.width, left: m.left, right: m.right, overflow: m.overflow}));
      ok(`${label}: one-line rows are the menu's rung ${size} (${row} px)`, m.heights.length === 1 && near(m.heights[0], row) && (width < 600 || near(row, size === '1' ? 40 : 32)), JSON.stringify({heights: m.heights, row}));
      const roles = await tab.evaluate(`[${colour('--sf-on-surface')}, ${colour('--sf-on-surface-variant')}]`);
      ok(`${label}: the glyphs are the on-surface or on-surface-variant role`, m.withIcons === (m.glyphs.length > 0) && m.glyphs.every((one) => roles.includes(one)), JSON.stringify({glyphs: m.glyphs, roles}));
      if (CASES[name].look === 'drill') {
        ok(`${label}: a long name wraps to a second line`, m.wrapped === true, JSON.stringify(m));
        const digest = await tab.evaluate(() => { const under = [...document.querySelectorAll('#settings .sf-context-menu-item-under')].find((one) => one.textContent.includes('Раз в неделю')); return under && {cut: under.scrollWidth > under.clientWidth + 0.5, title: under.getAttribute('title')}; });
        ok(`${label}: the long value ends in an ellipsis, whole in its title`, digest?.cut && digest.title === 'Раз в неделю, в понедельник утром, со всеми задачами', JSON.stringify(digest));
      }
      if (CASES[name].look === 'tiles') ok(`${label}: three tiles on top`, m.tiles === 3, String(m.tiles));
      if (shots) await tab.screenshot({path: join(shots, `settings-${name}-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: 560}});

      // The keyboard and a change, once per case on the desktop light run.
      if (width === 1440 && theme === 'light') {
        await tab.evaluate(() => { window.__events = []; for (const verb of ['change', 'changed']) document.querySelector('#settings').addEventListener(`sf-settings-${verb}`, (event) => window.__events.push([verb, event.detail.id, event.detail.value])); });
        if (!popup) await tab.focus('#settings .sf-context-menu-item');
        if (CASES[name].look === 'drill') {
          await tab.keyboard.press('Enter');
          await tab.waitForTimeout(300);
          const level = await tab.evaluate(() => ({head: Boolean(document.querySelector('#settings .sf-context-menu-drill-head')), focus: document.activeElement?.getAttribute('role'), rows: document.querySelectorAll('#settings [role="menuitemradio"]').length}));
          ok(`${label}: Enter on a drilling choice opens its level, the focus on an option`, level.head && level.focus === 'menuitemradio' && level.rows === 3, JSON.stringify(level));
          await tab.keyboard.press('End');
          await tab.keyboard.press('Enter');
          await tab.waitForTimeout(300);
          const chose = await tab.evaluate(() => ({events: window.__events, value: document.querySelector('#settings').values.theme}));
          ok(`${label}: End and Enter choose Тёмная: change then changed, the item holds it`, JSON.stringify(chose.events) === JSON.stringify([['change', 'theme', 'dark'], ['changed', 'theme', 'dark']]) && chose.value === 'dark', JSON.stringify(chose));
          // Back on the top level whether or not the choice went back itself.
          if (await tab.evaluate(() => Boolean(document.querySelector('#settings .sf-context-menu-drill-head')))) await tab.keyboard.press('Escape');
          await tab.waitForTimeout(200);
          const back = await tab.evaluate(() => ({head: Boolean(document.querySelector('#settings .sf-context-menu-drill-head')), under: document.querySelector('#settings .sf-context-menu-item-under')?.textContent.trim()}));
          ok(`${label}: back on the top level the row shows Тёмная under its name`, !back.head && back.under === 'Тёмная', JSON.stringify(back));
        } else {
          const switchRow = await tab.evaluate(() => { const rows = [...document.querySelectorAll('#settings .sf-context-menu-item')]; return rows.findIndex((one) => one.getAttribute('role') === 'menuitemcheckbox'); });
          for (let i = 0; i < switchRow; i += 1) await tab.keyboard.press('ArrowDown');
          const focused = await tab.evaluate(() => document.activeElement?.getAttribute('role'));
          await tab.keyboard.press('Space');
          await tab.waitForTimeout(300);
          const turned = await tab.evaluate(() => ({events: window.__events}));
          ok(`${label}: the arrows reach the first switch, Space turns it: change then changed`, focused === 'menuitemcheckbox' && turned.events.length === 2 && turned.events[0][0] === 'change' && turned.events[1][0] === 'changed', JSON.stringify({focused, turned}));
        }
        if (popup) {
          await tab.keyboard.press('Escape');
          await tab.waitForTimeout(300);
          const closed = await tab.evaluate(() => ({open: document.querySelector('#settings sf-menu-context').isOpen, focus: document.activeElement === document.querySelector('#trigger button')}));
          ok(`${label}: Escape on the top level closes the popup, the focus back on the trigger`, !closed.open && closed.focus, JSON.stringify(closed));
        }
      }
      ok(`${label}: no page errors`, !errors.length, errors.join(' | '));
      await context.close();
    }
  }
}

await browser.close();
server.close();
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
