#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-alert-bar on the built bytes with the real Loader, above a mock admin
// header, at 1440 and 390 px, light and dark: one warning, three items (the
// danger colour, «‹ 1 из 3 ›» wide, two lines narrow) and a minimized danger
// bar. Measured on the ladder (rung 1/2): the text the rung's line, the icon
// that line, every button the rung's control height, the bar's block inset
// (H − L) / 2 and its inline inset the rung's space-x; wide, the icon, the
// text and the buttons on one centre; narrow, the icon, the text's first line
// and the close on one line with the actions under the text, no arrows and
// «Все 3» at the end; the strip the control height of the rung below. The
// fills are the theme's status roles with their on- ink, at least 4.5:1, and
// the list of all opens under the bar. No sideways scroll, no page errors.
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
  if (path === '/page') {
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

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const ITEMS = {
  backup: {id: 'backup', level: 'warning', text: 'Последняя копия demo-owned.test не удалась.', source: 'Сайт demo-owned.test', time: minutesAgo(330), action: {label: 'Открыть копии', href: '#backups'}, acknowledge: {label: 'Отметить, что видели'}},
  swap: {id: 'swap', level: 'warning', text: 'Подкачка занята на 92%: серверу не хватает памяти, сайты замедляются.', source: 'Сервер', time: minutesAgo(5), action: {label: 'Посмотреть память', href: '#memory'}, acknowledge: {label: 'Отметить, что видели'}},
  disk: {id: 'disk', level: 'danger', text: 'Диск заполнен на 98%: сайты перестанут сохранять файлы и базы.', source: 'Сервер', time: minutesAgo(2), action: {label: 'Освободить место', href: '#disk'}},
  update: {id: 'update', level: 'info', text: 'Доступна новая версия панели 0.3.1.', source: 'Обновление', action: {label: 'Посмотреть', href: '#update'}},
};
const CASES = {
  one: {items: [ITEMS.backup]},
  three: {items: [ITEMS.swap, ITEMS.update, ITEMS.disk]},
  minimized: {items: [ITEMS.disk, ITEMS.swap, ITEMS.backup], minimized: true},
};

// A mock admin: the bar spans the page above the header.
const shell = (name, theme) => {
  const {items, minimized} = CASES[name];
  return `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface);color:var(--sf-on-surface);font-family:var(--sf-font-family, system-ui)}.mock-header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--sf-outline-variant);background:var(--sf-surface-1)}.mock-main{padding:16px}.mock-card{padding:16px;border:1px solid var(--sf-outline-variant);border-radius:12px;background:var(--sf-surface-1)}</style></head>
<body><sf-alert-bar id="bar"${minimized ? ' minimized' : ''}><script type="application/json" data-sf-settings>${JSON.stringify({items})}</script></sf-alert-bar>
<header class="mock-header"><b>Larena Panel</b><span>› Сайты</span></header>
<main class="mock-main"><h2>Сайты</h2><div class="mock-card">demo-owned.test · demo-php.test · demo-static.test</div></main></body></html>`;
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
  await tab.waitForFunction(() => customElements.get('sf-alert-bar') && document.querySelector('#bar .sf-alert-bar'), null, {timeout: 20000});
  // The buttons and the icon font draw after the bar.
  await tab.waitForFunction(() => [...document.querySelectorAll('#bar sf-button, #bar sf-button-icon, #bar sf-badge')].every((el) => el.querySelector('button, a, .sf-badge')), null, {timeout: 10000}).catch(() => null);
  // The icon subset is fetched again once the bar has drawn its glyphs:
  // wait for that request to settle, then for the font.
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  // The bar's own glyph must be in the font that draws it.
  await tab.waitForFunction(() => {
    const icon = document.querySelector('#bar .sf-alert-bar-icon');
    if (!icon) return true;
    const style = getComputedStyle(icon);
    return document.fonts.check(`${style.fontSize} ${style.fontFamily}`, icon.textContent.trim());
  }, null, {timeout: 10000}).catch(() => null);
  await tab.waitForTimeout(600);
  return {tab, context, errors};
}

// The ladder of a rung, measured from its tokens.
const LADDER = (rung) => {
  const r = rung.replace('/', '\\/');
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;inline-size:var(--sf-ui-${r}--control-height);block-size:var(--sf-text-height-${r});padding-inline:var(--sf-ui-${r}--space-x);column-gap:var(--sf-ui-${r}--text-space-x)`;
  document.body.append(probe);
  const s = getComputedStyle(probe);
  const value = {control: parseFloat(s.inlineSize), line: parseFloat(s.blockSize), spaceX: parseFloat(s.paddingLeft), textSpaceX: parseFloat(s.columnGap)};
  probe.remove();
  return value;
};

// WCAG contrast of two rgb() colours.
const CONTRAST = ([a, b]) => {
  const lum = (text) => {
    const [r, g, bl] = text.match(/[\d.]+/gu).slice(0, 3).map(Number).map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    for (const name of ['one', 'three', 'minimized']) {
      const label = `${name} ${width} ${theme}`;
      const {tab, context, errors} = await open(name, {width, theme});
      const ladder = await tab.evaluate(LADDER, '1/2');
      const below = await tab.evaluate(LADDER, '1/3');
      const g = await tab.evaluate(() => {
        const host = document.querySelector('#bar');
        const r = (el) => el?.getBoundingClientRect();
        const row = host.querySelector('.sf-alert-bar-row');
        const strip = host.querySelector('.sf-alert-bar-strip');
        const surface = row ?? strip;
        const s = getComputedStyle(surface);
        const icon = surface.querySelector('.sf-alert-bar-icon');
        const message = host.querySelector('.sf-alert-bar-message');
        const controls = [...host.querySelectorAll('.sf-alert-bar-row :is(sf-button, sf-button-icon) > :is(button, a)')].filter((el) => el.getClientRects().length);
        const header = document.querySelector('.mock-header');
        return {
          level: host.getAttribute('data-level'),
          fill: s.backgroundColor, ink: s.color,
          bar: r(surface), header: r(header),
          padTop: parseFloat(s.paddingTop), padLeft: parseFloat(s.paddingLeft),
          icon: icon && [r(icon).width, r(icon).height, r(icon).top + r(icon).height / 2],
          line: message ? parseFloat(getComputedStyle(message).lineHeight) : null,
          messageTop: message ? r(message).top : null,
          controls: controls.map((el) => ({cls: el.closest('sf-button, sf-button-icon').className, h: r(el).height, mid: r(el).top + r(el).height / 2, top: r(el).top, left: r(el).left, right: r(el).right})),
          pager: host.querySelector('.sf-alert-bar-pager') ? getComputedStyle(host.querySelector('.sf-alert-bar-pager')).display : null,
          position: host.querySelector('.sf-alert-bar-position')?.textContent.trim() ?? null,
          text: host.querySelector('.sf-alert-bar-text') && r(host.querySelector('.sf-alert-bar-text')),
          actions: host.querySelector('.sf-alert-bar-actions') && r(host.querySelector('.sf-alert-bar-actions')),
          stripText: strip?.textContent.replace(/\s+/gu, ' ').trim() ?? null,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      ok(`${label}: no sideways scroll, the bar spans the page above the header`, !g.overflow && near(g.bar.width, width, 1) && g.bar.bottom <= g.header.top + 0.5, JSON.stringify({bar: g.bar, header: g.header}));
      const contrast = CONTRAST([g.fill, g.ink]);
      ok(`${label}: the fill is the level's status role, its ink at least 4.5:1`, g.level === (name === 'one' ? 'warning' : 'danger') && contrast >= 4.5, `${g.level} ${g.fill} on ${g.ink}: ${contrast.toFixed(2)}`);
      if (name === 'minimized') {
        ok(`${label}: the strip is the control height of the rung below, with the count`, near(g.bar.height, below.control) && g.stripText.includes('Важных уведомлений: 3'), JSON.stringify({h: g.bar.height, below, text: g.stripText}));
      } else {
        ok(`${label}: the text is the rung's line, the icon that line`, near(g.line, ladder.line) && near(g.icon[0], ladder.line) && near(g.icon[1], ladder.line), JSON.stringify({line: g.line, icon: g.icon, ladder}));
        ok(`${label}: every button the rung's control height`, g.controls.length > 0 && g.controls.every((c) => near(c.h, ladder.control)), JSON.stringify(g.controls.map((c) => c.h)));
        ok(`${label}: the block inset (H − L) / 2, the inline inset the rung's space-x`, near(g.padTop, (ladder.control - ladder.line) / 2) && near(g.padLeft, ladder.spaceX), JSON.stringify({padTop: g.padTop, padLeft: g.padLeft, ladder}));
        if (width >= 600) {
          const centre = g.icon[2];
          ok(`${label}: wide, one row: icon, text and buttons on one centre`, near(g.bar.height, ladder.control + (ladder.control - ladder.line), 1) && g.controls.every((c) => near(c.mid, centre, 1)), JSON.stringify({h: g.bar.height, centre, mids: g.controls.map((c) => c.mid)}));
          if (name === 'three') ok(`${label}: wide, «‹ 1 из 3 ›» is drawn`, g.pager !== 'none' && g.position === '1 из 3', `${g.pager} ${g.position}`);
        } else {
          const end = g.controls.find((c) => /sf-alert-bar-(close|minimize)/u.test(c.cls));
          const all = g.controls.find((c) => /sf-alert-bar-all/u.test(c.cls));
          ok(`${label}: narrow, icon, text and close on the first line, the actions under the text`, end && near(end.mid, g.icon[2], 1) && g.actions.top >= g.text.bottom - 0.5 && near(g.messageTop + ladder.line / 2, g.icon[2], 1), JSON.stringify({end, icon: g.icon, text: g.text, actions: g.actions, messageTop: g.messageTop}));
          if (name === 'three') ok(`${label}: narrow, no arrows, «Все 3» at the line's end`, g.pager === 'none' && all && near(all.right, g.bar.right - g.padLeft, 1), JSON.stringify({pager: g.pager, all, bar: g.bar}));
        }
      }
      if (shots) await tab.screenshot({path: join(shots, `alert-bar-${name}-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: 260}});
      if (name === 'three') {
        await tab.click('#bar .sf-alert-bar-all :is(button, a)');
        await tab.waitForTimeout(300);
        const list = await tab.evaluate(() => {
          const element = document.querySelector('#bar .sf-alert-bar-list');
          const items = [...(element?.querySelectorAll(':scope > li') ?? [])];
          return {count: items.length, levels: items.map((li) => li.dataset.level), top: element?.getBoundingClientRect().top, bar: document.querySelector('#bar .sf-alert-bar-row').getBoundingClientRect().bottom, overflow: document.documentElement.scrollWidth > innerWidth};
        });
        ok(`${label}: «Все 3» opens the list under the bar, danger first`, list.count === 3 && list.levels.join(',') === 'danger,warning,info' && near(list.top, list.bar, 1) && !list.overflow, JSON.stringify(list));
        if (shots) await tab.screenshot({path: join(shots, `alert-bar-three-list-${width}-${theme}.png`), clip: {x: 0, y: 0, width, height: width < 600 ? 640 : 420}});
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
