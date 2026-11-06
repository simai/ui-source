#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-language on the built bytes with the real Loader, in sf-header-site's
// tools slot beside the theme switch, at 1440 and 390 px, light and dark:
// two languages (the segmented switch), five (the «translate» icon button and
// its menu, opened), twelve (the menu with search, opened) and Arabic chosen
// (rtl on <html>). Measured on the ladder: the switch is the height of
// sf-button of the same size and of the theme switch beside it (rung 1/2),
// the trigger an icon button of the rung's control height, the glyph the
// rung's icon, the menu's rows 32 px at 1/2 and 40 px at 1, every size of the
// ladder for the switch. The trigger's glyph is the on-surface role. The
// menu rows carry lang and English beside the native name; the search finds
// Deutsch by «нем», «German» and «de». No sideways scroll, no page errors.
// With a screenshot folder, each case is saved there as a PNG.
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

const TWELVE = 'ru en de fr es it pt tr pl uk ja ar';
const CASES = {
  two: {languages: 'ru en'},
  five: {languages: 'ru en de fr es', open: true},
  twelve: {languages: TWELVE, open: true},
  rtl: {languages: 'ru en ar', choose: 'ar'},
};

// Three named languages and the theme switch are wider than a phone's strip:
// a site gives the header's picker compact (codes) there, as docs.md says.
const shell = (name, theme, width) => {
  const {languages} = CASES[name];
  const compact = width < 600 && languages.split(' ').length > 2 ? ' compact' : '';
  return `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface);font-family:var(--sf-font-family, system-ui)}main{padding:16px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;max-inline-size:100%;box-sizing:border-box}</style></head>
<body><sf-header-site>
  <a slot="brand" href="/">SIMAI</a>
  <nav aria-label="Разделы"><a href="/framework/">Framework</a><a href="/docara/">Docara</a></nav>
  <sf-language id="picker" slot="tools" languages="${languages}" size="1/2"${compact}></sf-language>
  <sf-button-group id="theme" slot="tools" appearance="segmented" theme-switch size="1/2"></sf-button-group>
</sf-header-site>
<main>
  <sf-button id="ref-1-2" size="1/2" text="Кнопка"></sf-button>
  ${['1/3', '1/2', '1', '2', '3'].map((size) => `<div class="ladder-row" data-size="${size}" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><sf-language class="ladder" languages="ru en" size="${size}" apply="none"></sf-language><sf-button size="${size}" text="Русский"></sf-button><sf-language class="ladder-menu" languages="ru en de fr" size="${size}" apply="none"></sf-language></div>`).join('')}
</main></body></html>`;
};

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) < tolerance;
const browser = await chromium.launch();

async function open(name, {width, theme}) {
  page = shell(name, theme, width);
  const context = await browser.newContext({viewport: {width, height: 760}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-language') && document.querySelector('#picker[data-look]'), null, {timeout: 20000});
  await tab.waitForFunction(() => [...document.querySelectorAll('sf-language sf-button-group, sf-language sf-button-icon, sf-button')].every((el) => el.querySelector('button, a')), null, {timeout: 10000}).catch(() => null);
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(500);
  return {tab, context, errors};
}

const LADDER = (rung) => {
  const r = rung.replace('/', '\\/');
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;inline-size:var(--sf-ui-${r}--control-height);block-size:var(--sf-text-height-${r})`;
  document.body.append(probe);
  const s = getComputedStyle(probe);
  const value = {control: parseFloat(s.inlineSize), line: parseFloat(s.blockSize)};
  probe.remove();
  return value;
};

const rgb = (text) => text.match(/[\d.]+/gu).slice(0, 3).map(Number).join(',');

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    for (const name of Object.keys(CASES)) {
      const label = `${name} ${width} ${theme}`;
      const {tab, context, errors} = await open(name, {width, theme});
      const ladder = await tab.evaluate(LADDER, '1/2');
      const look = await tab.evaluate(() => document.querySelector('#picker').getAttribute('data-look'));
      ok(`${label}: the look follows the count`, look === {two: 'inline', five: 'menu', twelve: 'search', rtl: 'inline'}[name], look);

      if (look === 'inline') {
        const g = await tab.evaluate(() => {
          const r = (el) => el.getBoundingClientRect();
          const track = document.querySelector('#picker .sf-button-group');
          const theme = document.querySelector('#theme .sf-button-group');
          const segments = [...document.querySelectorAll('#picker button[role="radio"]')];
          return {track: r(track).height, theme: r(theme).height, top: r(track).top, themeTop: r(theme).top, themeRight: r(theme).right, overflow: document.documentElement.scrollWidth > innerWidth,
            segments: segments.map((b) => ({h: r(b).height, lang: b.lang, text: b.textContent.trim(), name: b.getAttribute('aria-label')}))};
        });
        ok(`${label}: the switch is the theme switch's height in the tools slot, on its line`, near(g.track, g.theme) && near(g.top, g.themeTop, 1), JSON.stringify(g));
        ok(`${label}: the switch is the rung's control height`, near(g.track, ladder.control), JSON.stringify({track: g.track, ladder}));
        ok(`${label}: each segment carries its language`, g.segments.every((s) => s.lang && s.text), JSON.stringify(g.segments));
        ok(`${label}: the header holds the picker and the theme switch whole, no sideways scroll`, !g.overflow && g.themeRight <= width + 0.5, JSON.stringify({overflow: g.overflow, themeRight: g.themeRight}));
        if (width < 600 && g.segments.length > 2) ok(`${label}: compact shows codes, each named by the language in itself`, g.segments.every((s) => /^[A-Z-]+$/u.test(s.text) && s.name && s.name !== s.text), JSON.stringify(g.segments));
      } else {
        const g = await tab.evaluate(() => {
          const r = (el) => el.getBoundingClientRect();
          const button = document.querySelector('#picker sf-button-icon button');
          const icon = button.querySelector('sf-icon, .sf-icon, i');
          const theme = document.querySelector('#theme .sf-button-group');
          const root = getComputedStyle(document.documentElement);
          return {
            h: r(button).height, w: r(button).width, mid: r(button).top + r(button).height / 2, themeMid: r(theme).top + r(theme).height / 2,
            glyph: icon?.textContent.trim(), ink: getComputedStyle(icon ?? button).color, onSurface: root.getPropertyValue('--sf-on-surface').trim(),
            name: button.getAttribute('aria-label'),
          };
        });
        ok(`${label}: the trigger is an icon button of the rung's control height, on the theme switch's centre`, near(g.h, ladder.control) && near(g.w, ladder.control) && near(g.mid, g.themeMid, 1), JSON.stringify(g));
        ok(`${label}: the glyph is «translate» in the on-surface role, named «Язык: Русский»`, g.glyph === 'translate' && g.name === 'Язык: Русский', JSON.stringify(g));
        const onSurface = await tab.evaluate(() => { const probe = document.createElement('span'); probe.style.color = 'var(--sf-on-surface)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; });
        ok(`${label}: the glyph's colour is --sf-on-surface`, rgb(g.ink) === rgb(onSurface), `${g.ink} vs ${onSurface}`);
        await tab.click('#picker sf-button-icon button');
        await tab.waitForTimeout(500);
        const m = await tab.evaluate(() => {
          const r = (el) => el.getBoundingClientRect();
          const rows = [...document.querySelectorAll('#picker sf-menu-context [role="menuitemradio"]')];
          const de = rows.find((row) => row.lang === 'de');
          const surface = document.querySelector('#picker sf-menu-context .sf-context-menu');
          const field = document.querySelector('#picker .sf-context-menu-search-input');
          return {
            count: rows.length, heights: [...new Set(rows.map((row) => Math.round(r(row).height * 10) / 10))],
            de: de && {label: de.querySelector('.sf-context-menu-item-label')?.textContent.trim(), value: de.querySelector('.sf-context-menu-item-value')?.textContent.trim()},
            langs: rows.every((row) => row.lang), checked: rows.filter((row) => row.getAttribute('aria-checked') === 'true').map((row) => row.lang),
            panel: surface && r(surface), search: Boolean(field), focusOnField: document.activeElement === field,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const rows = name === 'twelve' ? 12 : 5;
        ok(`${label}: the menu opens with a row per language, each in its language, Russian checked`, m.count === rows && m.langs && m.checked.join() === 'ru', JSON.stringify(m));
        ok(`${label}: a row is the native name with English beside it`, m.de?.label === 'Deutsch' && m.de?.value === 'German', JSON.stringify(m.de));
        // The menu's own rung (sf-menu-context size 1/2): a row is the rung's
        // line and its block inset twice -- 32 px wide, less on a phone where
        // the ladder is tighter.
        const row = await tab.evaluate(() => {
          const probe = document.createElement('div');
          probe.style.cssText = 'position:absolute;block-size:calc(var(--sf-text-height-1\\/2) + 2 * var(--sf-ui-1\\/2--space-y))';
          document.body.append(probe);
          const h = parseFloat(getComputedStyle(probe).blockSize);
          probe.remove();
          return h;
        });
        ok(`${label}: the menu's rows are one height, the menu's rung 1/2 (${row} px)`, m.heights.length === 1 && near(m.heights[0], row) && (width < 600 || near(row, 32)), JSON.stringify({heights: m.heights, row}));
        ok(`${label}: the menu stays in the window`, m.panel && m.panel.left >= -0.5 && m.panel.right <= width + 0.5 && !m.overflow, JSON.stringify(m.panel));
        if (name === 'twelve') {
          ok(`${label}: the search field takes focus`, m.search && m.focusOnField, JSON.stringify(m));
          const found = [];
          for (const query of ['нем', 'German', 'de']) {
            await tab.fill('#picker .sf-context-menu-search-input', query);
            await tab.waitForTimeout(150);
            found.push(await tab.evaluate(() => [...document.querySelectorAll('#picker sf-menu-context [role="menuitemradio"]')].map((row) => row.lang).join(' ')));
          }
          ok(`${label}: «нем», «German» and «de» find Deutsch alone`, found.every((one) => one === 'de'), JSON.stringify(found));
          await tab.fill('#picker .sf-context-menu-search-input', '');
          await tab.waitForTimeout(150);
        } else {
          ok(`${label}: five languages have no search`, !m.search, '');
        }
      }
      if (shots) await tab.screenshot({path: join(shots, `language-${name}-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: look === 'inline' ? 140 : 560}});

      if (name === 'rtl') {
        await tab.click('#picker button[role="radio"][lang="ar"]');
        await tab.waitForTimeout(400);
        const a = await tab.evaluate(() => ({lang: document.documentElement.lang, dir: document.documentElement.dir, current: window.SF.language.current(), overflow: document.documentElement.scrollWidth > innerWidth,
          order: (() => { const r = (el) => el.getBoundingClientRect(); const b = [...document.querySelectorAll('#picker button[role="radio"]')]; return b.map((x) => [x.lang, Math.round(r(x).left)]); })()}));
        ok(`${label}: Arabic is applied: lang ar, dir rtl, SF.language ar, the switch runs right to left`, a.lang === 'ar' && a.dir === 'rtl' && a.current === 'ar' && a.order[0][1] > a.order[2][1] && !a.overflow, JSON.stringify(a));
        if (shots) await tab.screenshot({path: join(shots, `language-rtl-applied-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: 140}});
      }

      if (name === 'two' && width === 1440 && theme === 'light') {
        // The ladder: every size of the switch is sf-button's height of the same size, and so is the trigger.
        const sizes = await tab.evaluate(() => ['1/3', '1/2', '1', '2', '3'].map((size) => {
          const r = (el) => el?.getBoundingClientRect();
          const row = document.querySelector(`.ladder-row[data-size="${size}"]`);
          const group = row.querySelector('sf-language.ladder .sf-button-group');
          const button = row.querySelector(':scope > sf-button button');
          const trigger = row.querySelector('sf-language.ladder-menu sf-button-icon button');
          return {size, group: r(group)?.height, button: r(button)?.height, trigger: r(trigger)?.height, triggerWidth: r(trigger)?.width};
        }));
        ok(`ladder: the switch and the trigger are sf-button's height at every size`, sizes.every((s) => near(s.group, s.button) && near(s.trigger, s.button) && near(s.triggerWidth, s.button)), JSON.stringify(sizes));
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
