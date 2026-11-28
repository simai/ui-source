#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-settings 1.13.0 (group build 22; owner remark 2026-11-28 via DEV,
// msg-c13782cf26484519b8da): a choice's option carries swatch -- one CSS
// colour or {light, dark} -- drawn as a circle before its name. On the built
// bytes with the real Loader, by real presses, in the drill, rows and panel
// looks at 1440, 768 and 390, light and dark:
//
// - the circles stand where the options say: {light, dark} paints the
//   theme's colour, one colour paints itself, an icon with a swatch shows
//   the circle, an invalid swatch shows the option's icon (drill, rows) or
//   keeps the circle's place empty (panel);
// - each circle is decorative (aria-hidden) and the option keeps its name;
// - the ring is the outline hairline (--sf-outline-variant, 1 px);
// - geometry: the circle is the icon's place less a quarter step, square;
//   in the drill level it shares the icons' lead column (its centre on the
//   icon's); its centre is on the label's line centre; in the panel the
//   names of rows with and without a circle start on one line;
// - the theme switched while the popup is open repaints {light, dark} at
//   once and the popup stays open;
// - a press on an option chooses it (the value is its id);
// - no page errors, no 404, no sideways scroll.
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
const pages = new Map();
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages.has(path)) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages.get(path));
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

const BLUE = {light: '#2563eb', dark: '#93c5fd'};
const RGB = {'#2563eb': 'rgb(37, 99, 235)', '#93c5fd': 'rgb(147, 197, 253)', '#16a34a': 'rgb(22, 163, 74)', '#dc2626': 'rgb(220, 38, 38)'};
const OPTIONS = [
  {id: 'blue', text: 'Синий', swatch: BLUE},
  {id: 'green', text: 'Зелёный', swatch: '#16a34a'},
  {id: 'red', text: 'Красный', icon: 'palette', swatch: '#dc2626'},
  {id: 'odd', text: 'Другой', icon: 'help', swatch: 'red; background: url(x)'},
];
const ITEMS = [
  {id: 'theme', type: 'choice', text: 'Тема', value: 'light', options: [{id: 'light', text: 'Светлая', icon: 'light_mode'}, {id: 'dark', text: 'Тёмная', icon: 'dark_mode'}]},
  {id: 'accent', type: 'choice', text: 'Акцент', value: 'blue', options: OPTIONS},
];
const island = (items) => `<script type="application/json" data-sf-settings>${JSON.stringify({items}).replace(/</gu, '\\u003c')}</script>`;
const LOOKS = ['drill', 'rows', 'panel'];

const head = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface);font-family:var(--sf-font-family, system-ui)}main{padding:16px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;box-sizing:border-box}</style></head>`;
for (const look of LOOKS) {
  for (const theme of ['light', 'dark']) {
    pages.set(`/${look}-${theme}`, `${head(theme)}<body><main>
<sf-settings id="s" look="${look}" label="Настройки чтения"><sf-button-icon id="open" icon="tune" aria-label="Настройки чтения"></sf-button-icon>${island(ITEMS)}</sf-settings>
<p>После</p></main>
<script>window.__changed=[];document.addEventListener('sf-settings-changed',(e)=>window.__changed.push(e.detail));</script></body></html>`);
  }
}

if (process.env.PROBE_SERVE_ONLY) {
  console.log(`serving ${base}/<look>-<theme>: ${[...pages.keys()].join(' ')}`);
  await new Promise(() => {});
}

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

async function newTab({width, theme}) {
  const context = await browser.newContext({viewport: {width, height: 900}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  return {context, tab, errors};
}

async function load(tab, url) {
  await tab.goto(url);
  await tab.waitForFunction(() => customElements.get('sf-settings') && document.querySelector('#open button'), null, {timeout: 30000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
}

// The option rows of the accent choice as each look draws them: the menu's
// (drill level rows, rows-look quiet options) anywhere in the document (a
// popup may stand in a portal), or the panel's rows.
const COLLECT = (look) => {
  const visible = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const box = (el) => { const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2}; };
  const names = {blue: 'Синий', green: 'Зелёный', red: 'Красный', odd: 'Другой'};
  const rows = {};
  if (look === 'panel') {
    for (const id of Object.keys(names)) {
      const main = document.querySelector(`#s .sf-settings-row-main[data-sf-setting="accent"][data-sf-option="${id}"]`);
      if (!visible(main)) continue;
      const swatch = main.querySelector('.sf-settings-row-swatch');
      const place = main.querySelector('.sf-settings-row-swatch-place');
      const label = main.querySelector('.sf-settings-row-label');
      rows[id] = {name: label.textContent.trim(), role: main.getAttribute('role'), checked: main.getAttribute('aria-checked'),
        swatch: swatch && {box: box(swatch), hidden: swatch.getAttribute('aria-hidden'), bg: getComputedStyle(swatch).backgroundColor, ring: getComputedStyle(swatch).borderTopColor, ringWidth: getComputedStyle(swatch).borderTopWidth, styleAttr: swatch.getAttribute('style') || ''},
        place: place && box(place), icon: Boolean(main.querySelector('.sf-icon')),
        label: box(label), lineHeight: parseFloat(getComputedStyle(label).lineHeight)};
    }
    const panel = document.querySelector('#s .sf-settings-panel');
    const ref = document.createElement('span');
    ref.style.cssText = 'position:absolute;border:1px solid var(--sf-outline-variant);inline-size:var(--sf-settings-panel--line);block-size:var(--sf-space-1\\/4)';
    panel.append(ref);
    const refs = {ring: getComputedStyle(ref).borderTopColor, line: ref.getBoundingClientRect().width - 2, quarter: ref.getBoundingClientRect().height - 2};
    ref.remove();
    return {rows, refs};
  }
  const items = [...document.querySelectorAll('.sf-context-menu-item')].filter(visible);
  for (const [id, name] of Object.entries(names)) {
    const row = items.find((el) => (el.getAttribute('aria-label') ?? '').trim() === name || el.querySelector('.sf-context-menu-item-label')?.textContent.trim() === name);
    if (!row) continue;
    const swatch = row.querySelector('.sf-context-menu-item-swatch');
    const icon = row.querySelector('.sf-icon');
    const label = row.querySelector('.sf-context-menu-item-label');
    rows[id] = {name: (label?.textContent ?? row.getAttribute('aria-label') ?? '').trim(), role: row.getAttribute('role'), checked: row.getAttribute('aria-checked'),
      tooltip: row.dataset.tooltip ? document.getElementById(row.dataset.tooltip)?.textContent.trim() ?? '' : '',
      swatch: swatch && {box: box(swatch), hidden: swatch.getAttribute('aria-hidden'), bg: getComputedStyle(swatch).backgroundColor, ring: getComputedStyle(swatch).borderTopColor, ringWidth: getComputedStyle(swatch).borderTopWidth, styleAttr: swatch.getAttribute('style') || ''},
      icon: icon && {box: box(icon), text: icon.textContent.trim()},
      label: label && box(label), lineHeight: label ? parseFloat(getComputedStyle(label).lineHeight) : null, row: box(row)};
  }
  // The theme row's icons: the icon place the circles stand beside (rows look).
  const themeIcons = items.filter((el) => ['Светлая', 'Тёмная'].includes((el.getAttribute('aria-label') ?? '').trim())).map((el) => el.querySelector('.sf-icon')).filter(Boolean).map(box);
  const menu = items[0]?.closest('.sf-context-menu') ?? items[0]?.parentElement;
  const ref = document.createElement('span');
  ref.style.cssText = 'position:absolute;border:1px solid var(--sf-outline-variant);inline-size:var(--sf-context-menu--line);block-size:var(--sf-space-1\\/4)';
  (menu ?? document.body).append(ref);
  const refs = {ring: getComputedStyle(ref).borderTopColor, line: ref.getBoundingClientRect().width - 2, quarter: ref.getBoundingClientRect().height - 2};
  ref.remove();
  return {rows, refs, themeIcons};
};

const openState = () => {
  const s = document.getElementById('s');
  const panel = s.querySelector('.sf-settings-panel');
  if (panel) return !panel.hidden && panel.getBoundingClientRect().width > 0;
  return [...document.querySelectorAll('.sf-context-menu-item')].some((el) => el.getClientRects().length > 0);
};

// Opens the popup by a press on the trigger; the drill look then presses the accent row.
async function open(tab, look) {
  await tab.click('#open button');
  await tab.waitForFunction(openState, null, {timeout: 15000});
  await tab.waitForTimeout(400);
  if (look === 'drill') {
    const row = tab.locator('.sf-context-menu-item', {hasText: 'Акцент'}).filter({visible: true}).first();
    await row.click();
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-context-menu-item')].some((el) => el.getClientRects().length > 0 && el.textContent.includes('Зелёный')), null, {timeout: 10000});
    await tab.waitForTimeout(400);
  }
}

const near = (a, b, d = 0.75) => a !== null && b !== null && Math.abs(a - b) <= d;

function check(label, look, theme, m) {
  const {rows, refs} = m;
  const want = {blue: RGB[theme === 'dark' ? BLUE.dark : BLUE.light], green: RGB['#16a34a'], red: RGB['#dc2626']};
  ok(`${label}: four options drawn`, Object.keys(rows).length === 4, JSON.stringify(Object.keys(rows)));
  for (const id of ['blue', 'green', 'red']) {
    const row = rows[id];
    ok(`${label}: ${id} draws its circle in ${theme === 'dark' && id === 'blue' ? 'the dark' : 'its'} colour`, row?.swatch && row.swatch.bg === want[id], JSON.stringify(row?.swatch));
    ok(`${label}: ${id}'s circle is decorative, the option keeps its name`, row?.swatch?.hidden === 'true' && row.name, JSON.stringify({name: row?.name, hidden: row?.swatch?.hidden}));
    ok(`${label}: ${id}'s ring is the outline hairline`, row?.swatch && row.swatch.ring === refs.ring && row.swatch.ringWidth === '1px', JSON.stringify({ring: row?.swatch?.ring, want: refs.ring, width: row?.swatch?.ringWidth}));
    const size = refs.line - refs.quarter;
    ok(`${label}: ${id}'s circle is the icon place less a quarter step (${size}), square`, row?.swatch && near(row.swatch.box.w, size, 0.5) && near(row.swatch.box.h, size, 0.5), JSON.stringify({box: row?.swatch?.box, refs}));
    if (row?.label) ok(`${label}: ${id}'s circle stands on the label's line (centres)`, row.swatch && near(row.swatch.box.cy, row.label.y + row.lineHeight / 2), JSON.stringify({swatch: row.swatch?.box, label: row.label, line: row.lineHeight}));
    if (look !== 'panel') ok(`${label}: ${id}'s colour is set on the circle as a custom property (no other declaration)`, row?.swatch && /^--sf-context-menu-swatch: [^;]+;?$/u.test(row.swatch.styleAttr.trim()), row?.swatch?.styleAttr);
    else ok(`${label}: ${id}'s colour is set on the circle as a custom property (no other declaration)`, row?.swatch && /^--sf-settings-row--swatch: [^;]+;?$/u.test(row.swatch.styleAttr.trim()), row?.swatch?.styleAttr);
  }
  if (look === 'panel') {
    ok(`${label}: red (icon and swatch) shows the circle, no icon`, rows.red?.swatch && !rows.red.icon, JSON.stringify(rows.red));
    ok(`${label}: odd (an invalid swatch) draws no circle and keeps its place`, rows.odd && !rows.odd.swatch && rows.odd.place && near(rows.odd.place.w, refs.line - refs.quarter, 0.5), JSON.stringify(rows.odd));
    const starts = Object.values(rows).map((row) => Math.round(row.label.x * 2) / 2);
    ok(`${label}: the names start on one line`, new Set(starts).size === 1, JSON.stringify(starts));
  } else {
    ok(`${label}: red (icon and swatch) shows the circle, no icon`, rows.red?.swatch && !rows.red.icon, JSON.stringify(rows.red));
    ok(`${label}: odd (an invalid swatch) shows its icon, no circle`, rows.odd && !rows.odd.swatch && rows.odd.icon?.text === 'help', JSON.stringify(rows.odd));
    if (look === 'drill') {
      ok(`${label}: the circles share the icons' lead column (centre on the icon's)`, ['blue', 'green', 'red'].every((id) => near(rows[id]?.swatch?.box.cx, rows.odd?.icon?.box.cx)), JSON.stringify(['blue', 'green', 'red', 'odd'].map((id) => rows[id]?.swatch?.box.cx ?? rows[id]?.icon?.box.cx)));
      ok(`${label}: the names start on one line`, new Set(Object.values(rows).map((row) => Math.round(row.label.x * 2) / 2)).size === 1, JSON.stringify(Object.values(rows).map((row) => row.label?.x)));
      ok(`${label}: the circle and the icon stand on the same line centre`, near(rows.blue?.swatch?.box.cy - rows.blue?.row.cy, rows.odd?.icon?.box.cy - rows.odd?.row.cy), JSON.stringify({blue: rows.blue?.swatch?.box, odd: rows.odd?.icon?.box}));
    } else {
      // rows: the circle alone in a quiet option; its name is the option's label and its tooltip.
      ok(`${label}: each quiet option names itself (aria-label and tooltip)`, ['blue', 'green', 'red'].every((id) => rows[id]?.name && rows[id]?.tooltip === rows[id].name), JSON.stringify(['blue', 'green', 'red'].map((id) => [rows[id]?.name, rows[id]?.tooltip])));
      const icon = m.themeIcons[0];
      ok(`${label}: the circle's centre is on the theme icons' centre line of its row (option centres)`, ['blue', 'green', 'red'].every((id) => near(rows[id].swatch.box.cy, rows[id].row.cy) && near(rows.odd.icon.box.cy, rows.odd.row.cy)), JSON.stringify({blue: rows.blue?.swatch?.box, row: rows.blue?.row, icon}));
      ok(`${label}: the circle is the theme icon's place less a quarter step`, icon && near(rows.blue.swatch.box.w, icon.w - refs.quarter, 0.5), JSON.stringify({icon, swatch: rows.blue?.swatch?.box}));
    }
  }
  ok(`${label}: the chosen option is blue`, rows.blue?.checked === 'true', JSON.stringify(rows.blue?.checked));
}

for (const width of [1440, 768, 390]) {
  for (const theme of ['light', 'dark']) {
    for (const look of LOOKS) {
      const label = `${look} ${width} ${theme}`;
      const {context, tab, errors} = await newTab({width, theme});
      try {
        await load(tab, `${base}/${look}-${theme}`);
        await open(tab, look);
        const m = await tab.evaluate(COLLECT, look);
        check(label, look, theme, m);
        if (shots && (width !== 768)) await tab.screenshot({path: join(shots, `${look}-${width}-${theme}.png`)});
        // The theme switched while open: {light, dark} repaints, the popup stays.
        const other = theme === 'light' ? 'dark' : 'light';
        await tab.evaluate((t) => { document.documentElement.classList.remove('theme-light', 'theme-dark'); document.documentElement.classList.add(`theme-${t}`); }, other);
        await tab.waitForTimeout(200);
        const after = await tab.evaluate(COLLECT, look);
        const still = await tab.evaluate(openState);
        ok(`${label}: switched to ${other} while open, blue repaints at once (${RGB[BLUE[other]]}) and the popup stays open`, still && after.rows.blue?.swatch?.bg === RGB[BLUE[other]], JSON.stringify({still, bg: after.rows.blue?.swatch?.bg}));
        ok(`${label}: switched to ${other}, the ring follows the outline hairline`, after.rows.blue?.swatch?.ring === after.refs.ring, JSON.stringify({ring: after.rows.blue?.swatch?.ring, want: after.refs.ring}));
        await tab.evaluate((t) => { document.documentElement.classList.remove('theme-light', 'theme-dark'); document.documentElement.classList.add(`theme-${t}`); }, theme);
        await tab.waitForTimeout(200);
        // A real press on green chooses it.
        if (look === 'panel') await tab.click('#s .sf-settings-row-main[data-sf-setting="accent"][data-sf-option="green"]');
        else if (look === 'rows') await tab.locator('.sf-context-menu-choice-option[aria-label="Зелёный"]').filter({visible: true}).first().click();
        else await tab.locator('.sf-context-menu-item', {hasText: 'Зелёный'}).filter({visible: true}).first().click();
        await tab.waitForTimeout(400);
        const chosen = await tab.evaluate(() => ({value: document.getElementById('s').values?.accent, changed: window.__changed.map((d) => d && (d.value ?? d.id))}));
        ok(`${label}: a press on green chooses it (value green, changed sent)`, chosen.value === 'green' && chosen.changed.length >= 1, JSON.stringify(chosen));
        const sideways = await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        ok(`${label}: no sideways scroll`, !sideways);
        ok(`${label}: no page errors, no 404`, !errors.length, errors.join(' | '));
      } catch (error) {
        ok(`${label}: the case ran to its end`, false, error.message.split('\n')[0]);
      }
      await context.close();
    }
  }
}

await browser.close();
server.close();
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
