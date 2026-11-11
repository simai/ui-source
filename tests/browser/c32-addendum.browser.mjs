#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [shots-dir] [loads]
//
// The addendum of 2026-11-09 to owner decision C32 (popup widths; ui-control
// control/docs-review/decisions.md row C32), through the real Loader, light
// and dark, 1280 and 390, normal and data-sf-density="compact" (the phone
// keeps the normal widths, C32),
// `loads` fresh loads each:
//   1. sf-profile-picker's panel is max(trigger, --sf-popup-panel-width):
//      320 normal, 288 compact, 320 on the phone, never wider than the
//      screen (it was as wide as its longest name: 238 / 214);
//   2. sf-settings' drilling panel is the menu's ceiling,
//      --sf-popup-menu-max-width: 288 normal, 256 compact, 288 on the phone
//      (it was a fixed 280); the public --sf-context-menu-inline-size still
//      sets it (20rem: 320);
//   3. a form's phone sheet is the screen's width up to 44rem (390 at 390);
//   4. a long choice in a select list -- sf-menu-context width list and
//      sf-dropdown's list -- wraps onto a second line and is not cut; a long
//      command in a menu keeps one line and ends in an ellipsis; the wrapped
//      choice keeps the one-line row's space above and below its text,
//      (row - line) / 2, so it is the one-line row plus a whole line (G1-a);
//   5. nothing scrolls sideways, and the console is clean.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

const args = process.argv.slice(2);
if (!args[0]) throw new Error('Build output root is required');
const out = args[0];
const shots = args[1] || '';
const LOADS = Number(args[2]) || 3;
if (shots) mkdirSync(shots, {recursive: true});
const built = existsSync(join(out, 'core', 'core'));
const parts = built
  ? {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')}
  : {core: join(out, 'core'), rule: join(out, 'rule'), component: join(out, 'component'), smart: join(out, 'smart'), utility: join(out, 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
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

const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
const PROFILES = [{id: 'regular', label: 'Обычный', shared: true, builtin: true}, {id: 'editors', label: 'Редакторы', shared: true}, {id: 'mine', label: 'Мой', shared: false}];
const SETTINGS = {items: [
  {id: 'theme', type: 'choice', text: 'Тема', icon: 'contrast', value: 'system', options: [{id: 'system', text: 'Как в системе'}, {id: 'light', text: 'Светлая'}, {id: 'dark', text: 'Тёмная'}]},
  {id: 'mentions', type: 'switch', text: 'Уведомлять, когда меня упоминают', icon: 'alternate_email', value: true},
]};
const LONG = [
  {id: 'a', text: 'Сделать личную копию этого представления для всей команды отдела', icon: 'content_copy'},
  {id: 'b', text: 'Удалить', icon: 'delete', status: 'danger'}];
const OPTIONS = [
  {id: 'o1', text: 'Ожидает подтверждения склада и оплаты покупателем по счёту', kind: 'radio', checked: true},
  {id: 'o2', text: 'Отменён', kind: 'radio'}];
const DD_LONG = [{value: 'a', text: 'Ожидает подтверждения склада и оплаты покупателем по счёту'}, {value: 'b', text: 'Отменён'}];
const FORM = '<form style="display:flex;flex-direction:column;gap:var(--sf-space-1\\/2);padding:var(--sf-space-1\\/2)"><sf-input label="Название" name="title" value="Мои отгрузки"></sf-input></form>';

const shell = (theme, density) => `<!doctype html><html lang="ru" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;align-items:flex-start;gap:var(--sf-space-1);padding:var(--sf-space-1);box-sizing:border-box;max-inline-size:100%}
.t{box-sizing:border-box;block-size:var(--sf-ui-1--control-height);inline-size:var(--sf-f0);padding-inline:var(--sf-space-1\\/2);border:var(--sf-px) solid var(--sf-outline-variant);border-radius:var(--sf-radius--ui);background:var(--sf-surface-1);color:inherit;font:inherit;text-align:start}</style></head>
<body><main>
  <div style="inline-size:var(--sf-e6)"><sf-profile-picker id="pp" label="Профиль"></sf-profile-picker></div>
  <sf-settings id="drill" look="drill" label="Настройки чтения"><script type="application/json" data-sf-settings>${JSON.stringify(SETTINGS)}</script></sf-settings>
  <sf-settings id="drill-set" look="drill" label="Настройки чтения" style="--sf-context-menu-inline-size: var(--sf-g0)"><script type="application/json" data-sf-settings>${JSON.stringify(SETTINGS)}</script></sf-settings>
  <div style="inline-size:var(--sf-f0)"><sf-dropdown id="dd" label="Статус" name="s" options='${j(DD_LONG)}'></sf-dropdown></div>
  <button class="t" id="t-menu" type="button">Ещё</button>
</main>
<sf-menu-context id="m-long" popup aria-label="Действия" entries='${j(LONG)}'></sf-menu-context>
<sf-menu-context id="m-list" popup width="list" aria-label="Статус" entries='${j(OPTIONS)}'></sf-menu-context>
<sf-menu-context id="m-form" popup width="form" role="dialog" aria-label="Новое представление"><div slot="content">${FORM}</div></sf-menu-context>
</body></html>`;

const EXPECT = {
  normal: {picker: 320, drill: 288},
  compact: {picker: 288, drill: 256},
  phone: {picker: 320, drill: 288},
  'phone-compact': {picker: 320, drill: 288},
};
const results = [];
const numbers = {};
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const frames = (tab) => tab.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle))));
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [scene, width, density] of [['normal', 1280, 'normal'], ['compact', 1280, 'compact'], ['phone', 390, 'normal'], ['phone-compact', 390, 'compact']]) {
      for (let load = 1; load <= LOADS; load++) {
        const name = `${scene}-${theme}-${load}`;
        page = shell(theme, density);
        // The phone is a phone: a coarse pointer, whose rows are the touch target.
        const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 500, hasTouch: width < 500, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
        const tab = await context.newPage();
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
        tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
        await tab.goto(`${base}/page`);
        await tab.waitForFunction(() => ['sf-menu-context', 'sf-profile-picker', 'sf-settings'].every((tag) => customElements.get(tag))
          && document.querySelector('#pp .sf-profile-picker-trigger') && document.querySelector('#drill .sf-context-menu-content')
          && document.querySelectorAll('sf-menu-context .sf-context-menu').length >= 3, null, {timeout: 20000})
          .catch(() => errors.push('the page never drew'));
        await tab.evaluate((profiles) => { const p = document.getElementById('pp'); p.profiles = profiles; p.setAttribute('current', 'regular'); }, PROFILES);
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(300);
        const m = {};
        // 1. The profile picker.
        await tab.click('#pp .sf-profile-picker-trigger');
        await frames(tab);
        await tab.waitForTimeout(200);
        m.picker = await tab.evaluate(() => Math.round(document.querySelector('#pp .sf-profile-picker-panel').getBoundingClientRect().width * 100) / 100);
        m.trigger = await tab.evaluate(() => Math.round(document.querySelector('#pp .sf-profile-picker-trigger').getBoundingClientRect().width));
        if (shots && load === 1) await tab.screenshot({path: join(shots, `${scene}-${theme}-picker.png`)});
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(100);
        // 2. The drilling settings panel.
        m.drill = await tab.evaluate(() => Math.round(document.querySelector('#drill .sf-context-menu-content').getBoundingClientRect().width * 100) / 100);
        m.drillSet = await tab.evaluate(() => Math.round(document.querySelector('#drill-set .sf-context-menu-content').getBoundingClientRect().width * 100) / 100);
        // sf-dropdown's list: a long option wraps.
        await tab.click('#dd .sf-dropdown-field');
        await frames(tab);
        await tab.waitForTimeout(250);
        m.dropdown = await tab.evaluate(() => {
          const option = Array.from(document.querySelectorAll('.sf-list [role="option"]')).find((node) => /Ожидает/u.test(node.textContent) && node.getBoundingClientRect().height > 0);
          if (!option) return null;
          const text = option.querySelector('.sf-list-item-container') ?? option;
          const style = getComputedStyle(text);
          return {height: Math.round(text.getBoundingClientRect().height), line: parseFloat(style.lineHeight), cut: text.scrollWidth > text.clientWidth + 1};
        });
        if (shots && load === 1) await tab.screenshot({path: join(shots, `${scene}-${theme}-dropdown.png`)});
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(100);
        // 4. A long command in a menu, a long choice in a list.
        const row = async (menu) => {
          await tab.evaluate(async (id) => document.getElementById(id).openFor(document.getElementById('t-menu'), {focus: 'none'}), menu);
          await frames(tab);
          await tab.waitForTimeout(150);
          const seen = await tab.evaluate((id) => {
            const host = document.getElementById(id);
            const label = host.querySelector('.sf-context-menu-item-label');
            const item = label.closest('.sf-context-menu-item');
            const line = parseFloat(getComputedStyle(label).lineHeight);
            // The space above and below the text of each row (G1-a).
            const inset = (row) => {
              const box = row.getBoundingClientRect();
              const text = row.querySelector('.sf-context-menu-item-label').getBoundingClientRect();
              return {top: Math.round((text.top - box.top) * 100) / 100, bottom: Math.round((box.bottom - text.bottom) * 100) / 100, height: Math.round(box.height * 100) / 100};
            };
            const rows = Array.from(host.querySelectorAll('.sf-context-menu-item'));
            return {height: Math.round(label.getBoundingClientRect().height), line, cut: label.scrollWidth > label.clientWidth + 1,
              ellipsis: getComputedStyle(label).textOverflow, rowHeight: Math.round(item.getBoundingClientRect().height),
              width: Math.round(host.querySelector('.sf-context-menu-content').getBoundingClientRect().width),
              first: inset(rows[0]), one: rows[1] ? inset(rows[1]) : null};
          }, menu);
          if (shots && load === 1) await tab.screenshot({path: join(shots, `${scene}-${theme}-${menu}.png`)});
          await tab.evaluate((id) => document.getElementById(id).close({restoreFocus: false, ask: false}), menu);
          await tab.waitForTimeout(100);
          return seen;
        };
        m.menu = await row('m-long');
        m.list = await row('m-list');
        // 3. The form: a sheet on the phone.
        await tab.evaluate(async () => document.getElementById('m-form').openFor(document.getElementById('t-menu')));
        await frames(tab);
        await tab.waitForTimeout(200);
        m.form = await tab.evaluate(() => {
          const surface = document.querySelector('#m-form .sf-context-menu');
          return {sheet: surface.hasAttribute('data-sf-sheet'), width: Math.round(surface.getBoundingClientRect().width),
            maxWidth: getComputedStyle(surface).maxInlineSize};
        });
        if (shots && load === 1 && scene === 'phone') await tab.screenshot({path: join(shots, `${scene}-${theme}-form-sheet.png`)});
        await tab.evaluate(() => document.getElementById('m-form').close({restoreFocus: false, ask: false}));
        m.sideways = await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        await context.close();
        numbers[name] = m;

        const want = EXPECT[scene];
        ok(`${name} profile picker ${m.picker} = ${want.picker}`, near(m.picker, Math.max(want.picker, m.trigger)));
        ok(`${name} profile picker within the screen (${m.picker} <= ${width})`, m.picker <= width);
        ok(`${name} drilling settings ${m.drill} = ${want.drill}`, near(m.drill, want.drill));
        ok(`${name} drilling settings with --sf-context-menu-inline-size 20rem: ${m.drillSet} = 320`, near(m.drillSet, 320));
        ok(`${name} sf-dropdown: a long option wraps (${m.dropdown?.height}/${m.dropdown?.line}, cut ${m.dropdown?.cut})`, m.dropdown && m.dropdown.height >= 2 * m.dropdown.line - 1 && !m.dropdown.cut);
        ok(`${name} menu: a long command keeps one line with an ellipsis (${m.menu.height}/${m.menu.line}, cut ${m.menu.cut})`, m.menu.height <= m.menu.line + 1 && m.menu.cut && m.menu.ellipsis === 'ellipsis');
        ok(`${name} list: a long choice wraps, not cut (${m.list.height}/${m.list.line}, cut ${m.list.cut})`, m.list.height >= 2 * m.list.line - 1 && !m.list.cut);
        {
          const wrapped = m.list.first;
          const one = m.list.one;
          const lines = Math.round(m.list.height / m.list.line);
          ok(`${name} list: the wrapped choice keeps the one-line row's space (${wrapped.top}/${wrapped.bottom} = ${one.top}/${one.bottom}), row ${wrapped.height} = ${one.height} + ${lines - 1} x ${m.list.line}`,
            near(wrapped.top, one.top, 0.5) && near(wrapped.bottom, one.bottom, 0.5) && near(wrapped.height, one.height + (lines - 1) * m.list.line, 0.5));
        }
        if (width < 704) ok(`${name} form sheet ${m.form.width} at ${width}, max ${m.form.maxWidth}`, m.form.sheet && near(m.form.width, Math.min(width, 704)) && ['44rem', '704px'].includes(m.form.maxWidth));
        else ok(`${name} form anchored`, !m.form.sheet);
        ok(`${name} nothing scrolls sideways`, !m.sideways);
        ok(`${name} console clean`, errors.length === 0, errors.join(' | '));
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((result) => !result.pass);
for (const result of failed) console.error(`FAIL ${result.name} ${result.detail}`);
const first = (scene) => numbers[`${scene}-light-1`];
for (const scene of ['normal', 'compact', 'phone', 'phone-compact']) {
  const m = first(scene);
  if (m) console.log(`${scene}: picker ${m.picker}, drill ${m.drill}, drill set ${m.drillSet}, dropdown option ${m.dropdown?.height}/${m.dropdown?.line}, menu row ${m.menu.rowHeight} (label ${m.menu.height}, cut ${m.menu.cut}), list row ${m.list.rowHeight} (label ${m.list.height}, cut ${m.list.cut}), list ${m.list.width}, form ${m.form.sheet ? 'sheet ' : ''}${m.form.width}`);
}
console.log(`${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);
console.log('PASS c32-addendum');
