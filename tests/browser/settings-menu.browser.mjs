#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-settings-menu on the built bytes, with the real Loader and core.css:
//   - the popup opens from its trigger as a dialog in the top layer, focus on
//     the first row; a choice row drills in place (the same width, a listbox,
//     the chosen option focused), ArrowLeft goes back to the row, Escape on
//     the top level closes it and gives focus back to the trigger;
//   - a switch toggles in its row, inline, without leaving the level;
//   - long names wrap and long values end in an ellipsis with the whole text
//     in title, and the panel keeps its 280 px;
//   - geometry: a one-line row is the control height of the size, every
//     leading icon is the line's size and stands on its row's centre line and
//     on one axis with the others, the switch and the chevron too;
//   - rows: pills and the compact select (an sf-context-menu) change values;
//   - the panel's dimmed text role is the third elevation step's;
//   - first paint: from the first frame the panel has a box, its width never
//     moves while the code and the sheets arrive.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const island = (items) => `<script type="application/json" data-sf-settings>${JSON.stringify({items})}</script>`;
const THEME = {key: 'theme', type: 'choice', label: 'Тема', icon: 'contrast', value: 'system', default: 'system', options: [
  {value: 'system', label: 'Как в системе', icon: 'computer'}, {value: 'light', label: 'Светлая', icon: 'light_mode'}, {value: 'dark', label: 'Тёмная', icon: 'dark_mode'}]};
const DENSITY = {key: 'density', type: 'choice', label: 'Плотность', icon: 'density_medium', value: 'normal', options: [
  {value: 'compact', label: 'Плотно'}, {value: 'normal', label: 'Обычно'}, {value: 'loose', label: 'Свободно'}]};
const NOTIFY = {key: 'notify', type: 'boolean', label: 'Уведомления', icon: 'notifications', value: true, default: true};
const SOUND = {key: 'sound', type: 'boolean', label: 'Звук', icon: 'volume_up', value: false};
const LONG_VALUE = 'Қазақ тілі (Қазақстан Республикасы) — очень длинное значение';
const LONG = [
  THEME,
  {key: 'notify', type: 'boolean', label: 'Показывать уведомления о новых сообщениях в обсуждениях, на которые вы подписаны', icon: 'notifications', value: true},
  {key: 'lang', type: 'choice', label: 'Язык интерфейса и всех писем, которые вы получаете от сервиса', icon: 'translate', value: 'kk',
    options: [{value: 'ru', label: 'Русский'}, {value: 'kk', label: LONG_VALUE}]},
];
const ROWS = [
  {key: 'theme', type: 'choice', label: 'Тема', value: 'system', options: THEME.options},
  {key: 'follow', type: 'choice', label: 'Ответы', value: 'queue', options: [{value: 'queue', label: 'Очередь'}, {value: 'steer', label: 'Сразу'}]},
  {key: 'density', type: 'choice', label: 'Плотность', value: 'normal', options: DENSITY.options},
  {key: 'answers', type: 'choice', label: 'Ответы во время работы ассистента над задачей', value: 'queue', options: [{value: 'queue', label: 'Очередь'}, {value: 'steer', label: 'Сразу'}]},
  {...NOTIFY, icon: undefined},
];

const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';
// The icons from the distribution's own font: the probe asks no subset service.
window.SF_BOOT_CONFIG = {icons: {enabled: false}};
window.__frames = [];
(function watch() {
  const panel = document.querySelector('#inline-drill > .sf-settings-menu');
  if (panel) window.__frames.push({t: performance.now(), w: panel.getBoundingClientRect().width});
  if (window.__frames.length < 120) requestAnimationFrame(watch);
})();</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="padding:24px">
<sf-settings-menu id="pop"><button slot="trigger" id="trigger" type="button">Настройки</button>${island([THEME, DENSITY, {type: 'divider'}, NOTIFY, SOUND, {key: 'export', type: 'action', label: 'Экспорт', icon: 'download'}])}</sf-settings-menu>
<div style="display:flex;gap:24px;align-items:flex-start;margin-top:24px">
<sf-settings-menu id="inline-drill" inline resettable>${island([THEME, DENSITY, {type: 'divider'}, NOTIFY, SOUND])}</sf-settings-menu>
<sf-settings-menu id="long" inline>${island(LONG)}</sf-settings-menu>
<sf-settings-menu id="rows" inline template="rows" size="1">${island(ROWS)}</sf-settings-menu>
<sf-settings-menu id="tiles" inline>${island([{...THEME, tile: true}, {...DENSITY, tile: true}, {...SOUND, tile: true}, NOTIFY])}</sf-settings-menu>
</div>
<p id="outside">Страница</p>
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
const errors = [];
const ready = (tab) => tab.waitForFunction(() => customElements.get('sf-settings-menu')
  && ['#pop', '#inline-drill', '#long', '#rows', '#tiles'].every((s) => document.querySelector(`${s} > .sf-settings-menu`))
  && document.fonts.status === 'loaded', null, {timeout: 20000});
const active = (tab) => tab.evaluate(() => {
  const a = document.activeElement;
  return {key: a?.dataset?.sfKey ?? null, value: a?.dataset?.sfValue ?? null, role: a?.getAttribute('role') ?? null, id: a?.id || null,
    inPanel: Boolean(a?.closest('.sf-settings-menu')), menu: a?.closest('sf-settings-menu')?.id ?? null};
});

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1400, height: 900}});
  tab.on('pageerror', (error) => errors.push(String(error)));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await tab.goto(`http://127.0.0.1:${server.address().port}/page`);
  await ready(tab).catch(() => failures.push('the menus never drew'));
  await tab.waitForTimeout(400);

  // Pictures for a person to look at, when asked for (SF_SETTINGS_MENU_SHOTS=<folder>).
  const shots = process.env.SF_SETTINGS_MENU_SHOTS;
  const shot = (name) => (shots ? tab.screenshot({path: join(shots, `${name}.png`)}) : null);
  await shot('inline');

  // ── geometry ──────────────────────────────────────────────────────────
  seen.geometry = await tab.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;block-size:var(--sf-ui-1\\/2--control-height);inline-size:var(--sf-text-height-1\\/2)';
    document.body.append(probe);
    const control = probe.getBoundingClientRect().height;
    const line = probe.getBoundingClientRect().width;
    probe.style.cssText = 'position:absolute;visibility:hidden;block-size:var(--sf-ui-1--control-height)';
    const control1 = probe.getBoundingClientRect().height;
    probe.remove();
    const panel = document.querySelector('#inline-drill > .sf-settings-menu');
    const rows = Array.from(panel.querySelectorAll('.sf-settings-menu-row')).map((row) => {
      const r = row.getBoundingClientRect();
      const icon = row.querySelector('.sf-settings-menu-row-icon')?.getBoundingClientRect();
      const end = row.querySelector('.sf-settings-menu-switch .sf-switch-toggler, .sf-settings-menu-row-chevron')?.getBoundingClientRect();
      const name = row.querySelector('.sf-settings-menu-row-name')?.getBoundingClientRect();
      return {
        kind: row.className.match(/sf-settings-menu-row--(\w+)/)?.[1],
        height: r.height,
        iconSize: icon ? [icon.width, icon.height] : null,
        iconLeft: icon ? icon.left - r.left : null,
        iconOffset: icon ? (icon.top + icon.height / 2) - (r.top + r.height / 2) : null,
        endOffset: end ? (end.top + end.height / 2) - (r.top + r.height / 2) : null,
        nameLeft: name ? name.left - r.left : null,
      };
    });
    const style = getComputedStyle(panel);
    return {
      control, control1, line, width: panel.getBoundingClientRect().width, rows,
      variant: style.getPropertyValue('--sf-on-surface-variant').trim(),
      elevationVariant: getComputedStyle(document.documentElement).getPropertyValue('--sf-on-elevation-3--variant').trim(),
      background: style.backgroundColor,
      elevationSurface: (() => { const d = document.createElement('div'); d.style.background = 'var(--sf-elevation-3--surface)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })(),
    };
  });
  const g = seen.geometry;
  if (Math.abs(g.width - 280) > 0.5) failures.push(`inline panel is ${g.width}px wide, expected 280`);
  for (const row of g.rows) {
    if (row.kind === 'switch' && Math.abs(row.height - g.control) > 0.5) failures.push(`a switch row is ${row.height}px, the size 1/2 control height is ${g.control}`);
    if (row.iconSize && (Math.abs(row.iconSize[0] - g.line) > 0.5 || Math.abs(row.iconSize[1] - g.line) > 0.5)) failures.push(`a ${row.kind} row's icon is ${row.iconSize}, the line is ${g.line}`);
    if (row.iconOffset !== null && Math.abs(row.iconOffset) > 0.5) failures.push(`a ${row.kind} row's icon is ${row.iconOffset}px off the row's centre line`);
    if (row.endOffset !== null && Math.abs(row.endOffset) > 0.5) failures.push(`a ${row.kind} row's switch or chevron is ${row.endOffset}px off the centre line`);
  }
  const lefts = new Set(g.rows.filter((row) => row.iconLeft !== null).map((row) => row.iconLeft.toFixed(2)));
  if (lefts.size !== 1) failures.push(`the leading icons stand on ${lefts.size} axes: ${[...lefts]}`);
  const nameLefts = new Set(g.rows.filter((row) => row.nameLeft !== null).map((row) => row.nameLeft.toFixed(2)));
  if (nameLefts.size !== 1) failures.push(`the names start on ${nameLefts.size} lines: ${[...nameLefts]}`);
  if (g.variant !== g.elevationVariant) failures.push(`the panel's --sf-on-surface-variant is ${g.variant}, not the elevation 3 variant ${g.elevationVariant}`);
  if (g.background !== g.elevationSurface) failures.push(`the panel paints ${g.background}, not elevation 3 (${g.elevationSurface})`);

  // ── first paint: the inline panel's width never moved ──────────────────
  seen.frames = await tab.evaluate(() => {
    const widths = window.__frames.map((frame) => Math.round(frame.w * 100) / 100).filter((w) => w > 0);
    return {count: window.__frames.length, drawnFrom: window.__frames.findIndex((frame) => frame.w > 0), widths: [...new Set(widths)]};
  });
  if (seen.frames.widths.length !== 1 || Math.abs(seen.frames.widths[0] - 280) > 0.5) failures.push(`the inline panel's width moved while it drew: ${seen.frames.widths}`);

  // ── long texts ────────────────────────────────────────────────────────
  seen.long = await tab.evaluate((longValue) => {
    const panel = document.querySelector('#long > .sf-settings-menu');
    const value = panel.querySelector('[data-sf-key="lang"] .sf-settings-menu-row-value');
    const name = panel.querySelector('[data-sf-key="lang"] .sf-settings-menu-row-name');
    const switchName = panel.querySelector('.sf-settings-menu-row--switch .sf-settings-menu-row-name');
    const line = parseFloat(getComputedStyle(name).lineHeight);
    return {
      width: panel.getBoundingClientRect().width,
      ellipsis: value.scrollWidth > value.clientWidth && getComputedStyle(value).textOverflow === 'ellipsis',
      title: value.getAttribute('title') === longValue,
      nameLines: Math.round(name.getBoundingClientRect().height / line),
      switchNameLines: Math.round(switchName.getBoundingClientRect().height / line),
      noOverflow: panel.scrollWidth <= panel.clientWidth,
    };
  }, LONG_VALUE);
  const l = seen.long;
  if (Math.abs(l.width - 280) > 0.5) failures.push(`the long-text panel is ${l.width}px wide`);
  if (!l.ellipsis || !l.title) failures.push(`a long value is not cut with an ellipsis and its title: ${JSON.stringify(l)}`);
  if (l.nameLines < 2 || l.switchNameLines < 2) failures.push(`a long name does not wrap: ${JSON.stringify(l)}`);
  if (!l.noOverflow) failures.push('the long-text panel scrolls sideways');

  // ── an inline switch ─────────────────────────────────────────────────
  await tab.click('#inline-drill [data-sf-key="sound"] .sf-switch-toggler');
  await tab.waitForTimeout(200);
  seen.switch = await tab.evaluate(() => {
    const menu = document.querySelector('#inline-drill');
    const input = menu.querySelector('[data-sf-key="sound"] input');
    return {value: menu.values.sound, checked: input.checked, role: input.getAttribute('role'), level: menu.getAttribute('data-level')};
  });
  if (seen.switch.value !== true || !seen.switch.checked || seen.switch.role !== 'switch' || seen.switch.level) failures.push(`the inline switch did not toggle in place: ${JSON.stringify(seen.switch)}`);

  // ── the popup: open, drill, back, close ─────────────────────────────
  await tab.click('#trigger');
  await tab.waitForTimeout(300);
  seen.open = await tab.evaluate(() => {
    const panel = document.querySelector('#pop > .sf-settings-menu');
    const trigger = document.querySelector('#trigger');
    return {popover: panel.matches(':popover-open'), role: panel.getAttribute('role'), expanded: trigger.getAttribute('aria-expanded'),
      width: panel.getBoundingClientRect().width, below: panel.getBoundingClientRect().top >= trigger.getBoundingClientRect().bottom};
  });
  seen.openFocus = await active(tab);
  if (!seen.open.popover || seen.open.role !== 'dialog' || seen.open.expanded !== 'true') failures.push(`the popup did not open as a dialog: ${JSON.stringify(seen.open)}`);
  if (seen.openFocus.key !== 'theme') failures.push(`focus on open is ${JSON.stringify(seen.openFocus)}, expected the first row`);

  await shot('open');
  await tab.keyboard.press('ArrowDown');
  const down = await active(tab);
  await tab.keyboard.press('End');
  const end = await active(tab);
  await tab.keyboard.press('Home');
  const home = await active(tab);
  seen.keys = {down: down.key, end: end.key, home: home.key};
  if (down.key !== 'density' || end.key !== 'export' || home.key !== 'theme') failures.push(`arrow keys walk the rows wrong: ${JSON.stringify(seen.keys)}`);

  await tab.keyboard.press('ArrowRight');
  await tab.waitForTimeout(250);
  await shot('drill');
  seen.drill = {focus: await active(tab), ...(await tab.evaluate(() => {
    const menu = document.querySelector('#pop');
    const panel = menu.querySelector('.sf-settings-menu');
    return {level: menu.getAttribute('data-level'), width: panel.getBoundingClientRect().width, listbox: Boolean(panel.querySelector('[role=listbox]')),
      back: Boolean(panel.querySelector('.sf-settings-menu-back button')), checks: panel.querySelectorAll('.sf-settings-menu-option-check .sf-icon').length,
      // The back glyph stands on the options' icon axis; an option is a control high.
      backAxis: (() => {
        const glyph = panel.querySelector('.sf-settings-menu-back .sf-icon')?.getBoundingClientRect();
        const option = panel.querySelector('.sf-settings-menu-option .sf-settings-menu-row-icon')?.getBoundingClientRect();
        return glyph && option ? (glyph.left + glyph.width / 2) - (option.left + option.width / 2) : null;
      })(),
      optionHeights: [...new Set(Array.from(panel.querySelectorAll('.sf-settings-menu-option')).map((o) => o.getBoundingClientRect().height))],
      headHeight: panel.querySelector('.sf-settings-menu-level-head').getBoundingClientRect().height};
  }))};
  const d = seen.drill;
  if (d.level !== 'theme' || !d.listbox || !d.back || d.checks !== 1) failures.push(`the choice list did not open in place: ${JSON.stringify(d)}`);
  if (d.backAxis === null || Math.abs(d.backAxis) > 0.5) failures.push(`the back glyph is ${d.backAxis}px off the options' icon axis`);
  if (d.optionHeights.length !== 1 || Math.abs(d.optionHeights[0] - seen.geometry.control) > 0.5 || Math.abs(d.headHeight - seen.geometry.control) > 0.5) failures.push(`list rows ${d.optionHeights} and head ${d.headHeight}px, the control height is ${seen.geometry.control}`);
  if (Math.abs(d.width - seen.open.width) > 0.5) failures.push(`the panel changed width when it drilled in: ${seen.open.width} -> ${d.width}`);
  if (d.focus.role !== 'option' || d.focus.value !== 'system') failures.push(`focus in the list is ${JSON.stringify(d.focus)}, expected the chosen option`);

  await tab.keyboard.press('ArrowLeft');
  await tab.waitForTimeout(250);
  seen.back = {focus: await active(tab), level: await tab.evaluate(() => document.querySelector('#pop').getAttribute('data-level'))};
  if (seen.back.level || seen.back.focus.key !== 'theme') failures.push(`ArrowLeft did not go back to the row: ${JSON.stringify(seen.back)}`);

  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(250);
  await tab.keyboard.press('ArrowDown');
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(250);
  seen.pick = {value: await tab.evaluate(() => document.querySelector('#pop').values.theme), focus: await active(tab)};
  if (seen.pick.value !== 'light' || seen.pick.focus.key !== 'theme') failures.push(`choosing with the keyboard: ${JSON.stringify(seen.pick)}`);

  await tab.keyboard.press('ArrowRight');
  await tab.waitForTimeout(250);
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(250);
  seen.escapeBack = await tab.evaluate(() => ({level: document.querySelector('#pop').getAttribute('data-level'), open: document.querySelector('#pop').getAttribute('data-open')}));
  if (seen.escapeBack.level || seen.escapeBack.open !== 'true') failures.push(`Escape in a list did not just go back: ${JSON.stringify(seen.escapeBack)}`);
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(250);
  seen.closed = {focus: await active(tab), ...(await tab.evaluate(() => ({
    open: document.querySelector('#pop').getAttribute('data-open'),
    popover: document.querySelector('#pop > .sf-settings-menu').matches(':popover-open'),
    expanded: document.querySelector('#trigger').getAttribute('aria-expanded'),
    mark: document.documentElement.dataset.sfPopoverOpen ?? null,
  })))};
  if (seen.closed.open || seen.closed.popover || seen.closed.expanded !== 'false' || seen.closed.focus.id !== 'trigger' || seen.closed.mark) failures.push(`Escape did not close and return focus: ${JSON.stringify(seen.closed)}`);

  // ── rows: pills, a long name that drops its control, the compact select ─
  seen.rows = await tab.evaluate(() => {
    const panel = document.querySelector('#rows > .sf-settings-menu');
    const row = (key) => panel.querySelector(`[data-sf-key="${key}"]`);
    const box = (node) => node.getBoundingClientRect();
    const answers = row('answers');
    const name = box(answers.querySelector('.sf-settings-menu-row-text'));
    const pills = box(answers.querySelector('.sf-settings-menu-pills'));
    const short = row('follow');
    return {
      width: box(panel).width,
      themePills: row('theme').querySelectorAll('.sf-settings-menu-pill').length,
      followPills: short.querySelectorAll('.sf-settings-menu-pill').length,
      densitySelect: Boolean(row('density').querySelector('.sf-settings-menu-select')),
      shortSameLine: Math.abs(box(short.querySelector('.sf-settings-menu-row-text')).top - box(short).top) < 12
        && box(short.querySelector('.sf-settings-menu-pills')).top < box(short.querySelector('.sf-settings-menu-row-text')).bottom,
      dropped: pills.top >= name.bottom - 0.5 && Math.abs(pills.left - name.left) < 0.5,
      rowHeight: box(row('notify')).height,
      pillHeight: box(row('follow').querySelector('.sf-settings-menu-pill')).height,
      selectHeight: box(row('density').querySelector('.sf-settings-menu-select')).height,
    };
  });
  const r = seen.rows;
  if (r.themePills !== 3 || r.followPills !== 2 || !r.densitySelect) failures.push(`rows chose the wrong controls: ${JSON.stringify(r)}`);
  if (!r.dropped || !r.shortSameLine) failures.push(`a long name did not take the line with the control under it: ${JSON.stringify(r)}`);
  if (Math.abs(r.rowHeight - g.control1) > 0.5) failures.push(`a size 1 switch row is ${r.rowHeight}px, the control height is ${g.control1}`);
  await tab.click('#rows [data-sf-key="theme"] .sf-settings-menu-pill:nth-child(3)');
  await tab.waitForTimeout(150);
  await tab.click('#rows [data-sf-key="density"] .sf-settings-menu-select');
  await tab.waitForFunction(() => document.querySelector('body > sf-context-menu .sf-context-menu--open'), null, {timeout: 10000})
    .catch(() => failures.push('the compact select did not open its menu'));
  await tab.click('body > sf-context-menu .sf-context-menu-item:nth-of-type(3)').catch(() => failures.push('no third option in the select menu'));
  await tab.waitForTimeout(250);
  seen.rowsValues = await tab.evaluate(() => ({...document.querySelector('#rows').values, menus: document.querySelectorAll('body > sf-context-menu').length,
    label: document.querySelector('#rows [data-sf-key="density"] .sf-settings-menu-select-text').textContent}));
  if (seen.rowsValues.theme !== 'dark' || seen.rowsValues.density !== 'loose' || seen.rowsValues.label !== 'Свободно' || seen.rowsValues.menus !== 0) failures.push(`rows did not change: ${JSON.stringify(seen.rowsValues)}`);

  // ── tiles ─────────────────────────────────────────────────────────────
  await tab.click('#tiles .sf-settings-menu-tile[data-sf-key="theme"]');
  await tab.click('#tiles .sf-settings-menu-tile[data-sf-key="sound"]');
  await tab.waitForTimeout(200);
  seen.tiles = await tab.evaluate(() => {
    const menu = document.querySelector('#tiles');
    const tiles = Array.from(menu.querySelectorAll('.sf-settings-menu-tile'));
    return {count: tiles.length, values: menu.values, pressed: menu.querySelector('[data-sf-key="sound"]').getAttribute('aria-pressed'),
      oneRow: new Set(tiles.map((tile) => Math.round(tile.getBoundingClientRect().top))).size === 1};
  });
  if (seen.tiles.count !== 3 || !seen.tiles.oneRow || seen.tiles.values.theme !== 'light' || seen.tiles.values.sound !== true || seen.tiles.pressed !== 'true') failures.push(`tiles: ${JSON.stringify(seen.tiles)}`);

  if (errors.length) failures.push(`page errors: ${errors.slice(0, 5).join(' | ')}`);
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({seen, failures}, null, 2));
if (failures.length) {
  console.error(`settings-menu: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('settings-menu: ok');
