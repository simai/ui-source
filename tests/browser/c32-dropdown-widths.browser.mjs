#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [screenshot folder] [loads] [--measure-only]
// Build output root is required: the directory holding core/, smart/,
// component/, utility/ (a build's out, or a distribution's distr/).
//
// Owner decision C32 (2026-11-09; research ui-control
// control/research/2026-11-09-dropdown-widths.md, prototype
// prototypes/view-presets.html): the popup widths by what a popup holds, on
// the built bytes with the real Loader, at desktop normal density (1280),
// desktop compact density (1280, data-sf-density="compact") and on a phone
// (390, with the compact attribute too: the phone keeps the normal widths),
// light and dark, `loads` fresh loads each (3 by default).
//
// Cases (the width of .sf-context-menu-content, or the list's box):
//   menu-short   sf-menu-context, three short commands: the menu's minimum
//   menu-long    long commands: the menu's maximum
//   list-narrow  width="list" from a 8rem trigger, long options: the list's step
//   list-wide    width="list" from a 25rem trigger, short options: the trigger
//   panel-narrow width="panel" (search + rows) from a 8rem trigger: the panel's step
//   panel-wide   width="panel" from a 25rem trigger: the trigger
//   tabs         a panel with tabs: the panel's step
//   form         width="form": the form's step; on the phone a sheet, the screen's width
//   form-wide    width="form-wide": the wide form's step; on the phone a sheet
//   dropdown-narrow / dropdown-wide  sf-dropdown at a 10rem / 26rem field
//   lookup-narrow / lookup-wide      sf-input-lookup at a 10rem / 26rem frame
// The list rule: at least the field, no wider than max(field, the list's step).
// Every popup stays inside the screen. The console stays clean.
//
// --measure-only records the numbers without asserting (the base pair's
// "before" column): the menus open without a kind there, as a page opened
// them before the kinds existed (content, the default). With a screenshot folder each case is saved as a PNG on
// the first load, and the numbers as numbers.json.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const MEASURE_ONLY = process.argv.includes('--measure-only');
if (!args[0]) throw new Error('Build output root is required');
const out = args[0];
const shots = args[1] || '';
const LOADS = Number(args[2]) || 3;
if (shots) mkdirSync(shots, {recursive: true});
// A build lays core/core, core/rule, component/component...; a distribution
// lays core, rule, component... side by side.
const built = existsSync(join(out, 'core', 'core'));
const parts = built
  ? {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')}
  : {core: join(out, 'core'), rule: join(out, 'rule'), component: join(out, 'component'), smart: join(out, 'smart'), utility: join(out, 'utility')};
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

const j = (value) => JSON.stringify(value).replace(/'/gu, '&#39;');
const SHORT = [{id: 'edit', text: 'Изменить', icon: 'edit'}, {id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'delete', text: 'Удалить', icon: 'delete', status: 'danger'}];
const LONG = [
  {id: 'a', text: 'Сделать личную копию этого представления для всей команды', icon: 'content_copy'},
  {id: 'b', text: 'По умолчанию для всех сотрудников отдела продаж и склада', icon: 'star'},
  {id: 'c', text: 'Удалить', icon: 'delete', status: 'danger'}];
const OPTIONS = [
  {id: 'o1', text: 'Ожидает подтверждения склада и оплаты покупателем', kind: 'radio', checked: true},
  {id: 'o2', text: 'Передан в службу доставки по договору', kind: 'radio'},
  {id: 'o3', text: 'Отменён', kind: 'radio'}];
const FEW = [{id: 's1', text: 'Новый', kind: 'radio', checked: true}, {id: 's2', text: 'В работе', kind: 'radio'}, {id: 's3', text: 'Готов', kind: 'radio'}];
const DD_LONG = [
  {value: 'a', text: 'Ожидает подтверждения склада и оплаты покупателем'},
  {value: 'b', text: 'Передан в службу доставки по договору'},
  {value: 'c', text: 'Отменён'}];
const DD_SHORT = [{value: 'a', text: 'Новый'}, {value: 'b', text: 'В работе'}, {value: 'c', text: 'Готов'}];
const LK_LONG = [
  {value: 'u1', label: 'Анна Петрова-Водкина, руководитель отдела продаж', caption: 'Москва'},
  {value: 'u2', label: 'Борис Иванов', caption: 'Разработка'},
  {value: 'u3', label: 'Вера Смирнова', caption: 'Поддержка'}];
const LK_SHORT = [{value: 'u1', label: 'Анна', caption: 'Дизайн'}, {value: 'u2', label: 'Борис', caption: 'Код'}];

const PANEL = `<div class="sf-context-menu-body" style="display:flex;flex-direction:column">
  <label class="sf-context-menu-search"><i class="sf-icon sf-context-menu-search-icon" aria-hidden="true">search</i><input class="sf-context-menu-search-input" placeholder="Найти представление" aria-label="Найти представление"></label>
  <button class="sf-context-menu-item" role="menuitem" type="button"><span class="sf-context-menu-item-label">Все заказы</span></button>
  <button class="sf-context-menu-item" role="menuitem" type="button"><span class="sf-context-menu-item-label">Мои отгрузки</span></button>
  <button class="sf-context-menu-item" role="menuitem" type="button"><span class="sf-context-menu-item-label">Просроченные</span></button>
</div>`;
const FORM = `<form class="c32-form"><sf-input label="Название" name="title" value="Мои отгрузки"></sf-input>
  <div class="c32-actions"><sf-button appearance="ghost" scheme="on-surface" text="Отмена"></sf-button><sf-button text="Создать"></sf-button></div></form>`;

const shell = (theme, density) => `<!doctype html><html lang="ru" class="theme-${theme}"${density === 'compact' ? ' data-sf-density="compact"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;align-items:flex-start;gap:var(--sf-space-1);padding:var(--sf-space-1);box-sizing:border-box;max-inline-size:100%}
.t{box-sizing:border-box;block-size:var(--sf-ui-1--control-height);padding-inline:var(--sf-space-1\\/2);border:var(--sf-px) solid var(--sf-outline-variant);border-radius:var(--sf-radius--ui);background:var(--sf-surface-1);color:inherit;font:inherit;text-align:start}
.t8{inline-size:var(--sf-f0);max-inline-size:100%}.t25{inline-size:min(100%,var(--sf-g6))}
.f10{inline-size:var(--sf-f0)}.f26{inline-size:min(100%,var(--sf-g6))}
.c32-form{display:flex;flex-direction:column;gap:var(--sf-space-1\\/2);padding:var(--sf-space-1\\/2)}
.c32-actions{display:flex;justify-content:flex-end;gap:var(--sf-space-1\\/3)}</style></head>
<body><main>
  <button class="t" id="t-menu" type="button">Ещё</button>
  <button class="t t8" id="t-narrow" type="button">Представления</button>
  <button class="t t25" id="t-wide" type="button">Заказы: все представления</button>
  <div class="f10"><sf-dropdown id="dd-narrow" label="Статус" name="s1" options='${j(DD_LONG)}'></sf-dropdown></div>
  <div class="f26"><sf-dropdown id="dd-wide" label="Статус" name="s2" options='${j(DD_SHORT)}'></sf-dropdown></div>
  <div class="f10"><sf-input-lookup id="lk-narrow" label="Сотрудник" name="u1" min-length="0"></sf-input-lookup></div>
  <div class="f26"><sf-input-lookup id="lk-wide" label="Сотрудник" name="u2" min-length="0"></sf-input-lookup></div>
</main>
<sf-menu-context id="m-short" popup aria-label="Действия" entries='${j(SHORT)}'></sf-menu-context>
<sf-menu-context id="m-long" popup aria-label="Действия" entries='${j(LONG)}'></sf-menu-context>
<sf-menu-context id="m-list" popup width="list" aria-label="Статус" entries='${j(OPTIONS)}'></sf-menu-context>
<sf-menu-context id="m-list-short" popup width="list" aria-label="Статус" entries='${j(FEW)}'></sf-menu-context>
<sf-menu-context id="m-panel" popup width="panel" role="dialog" aria-label="Представления"><div slot="content">${PANEL}</div></sf-menu-context>
<sf-menu-context id="m-tabs" popup tabs="Поля|Вид" closable role="dialog" aria-label="Настройки"><div slot="content">${PANEL}</div></sf-menu-context>
<sf-menu-context id="m-form" popup width="form" role="dialog" aria-label="Новое представление"><div slot="content">${FORM}</div></sf-menu-context>
<sf-menu-context id="m-form-wide" popup width="form-wide" role="dialog" aria-label="Новое представление"><div slot="content">${FORM}</div></sf-menu-context>
</body></html>`;

// [case, menu id, trigger id, openFor width] or a field for the lists.
const MENUS = [
  ['menu-short', 'm-short', 't-menu'], ['menu-long', 'm-long', 't-menu'],
  ['list-narrow', 'm-list', 't-narrow'], ['list-wide', 'm-list-short', 't-wide'],
  ['panel-narrow', 'm-panel', 't-narrow'], ['panel-wide', 'm-panel', 't-wide'],
  ['tabs', 'm-tabs', 't-narrow'], ['form', 'm-form', 't-narrow'], ['form-wide', 'm-form-wide', 't-narrow']];
const FIELDS = [['dropdown-narrow', 'dd-narrow'], ['dropdown-wide', 'dd-wide'], ['lookup-narrow', 'lk-narrow'], ['lookup-wide', 'lk-wide']];

// C32, in px (rem = 16): normal (desktop and phone) and compact (desktop).
const STEPS = {
  normal: {menuMin: 160, menuMax: 288, listMax: 320, panel: 320, form: 320, formWide: 384},
  compact: {menuMin: 144, menuMax: 256, listMax: 288, panel: 288, form: 288, formWide: 352},
};

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
const numbers = {};

async function open({width, theme, density}) {
  page = shell(theme, density);
  if (MEASURE_ONLY) page = page.replace(/ width="(?:list|panel|form|form-wide)"/gu, '');
  const context = await browser.newContext({viewport: {width, height: 900}, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce'});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => ['sf-menu-context', 'sf-dropdown', 'sf-input-lookup', 'sf-input', 'sf-button'].every((tag) => customElements.get(tag))
    && document.querySelectorAll('sf-menu-context .sf-context-menu').length === 8
    && document.querySelector('#dd-narrow .sf-dropdown-field') && document.querySelector('#lk-narrow .sf-lookup-frame'), null, {timeout: 20000});
  await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
  await tab.evaluate(() => document.fonts.ready);
  // A lookup's short list is a property (or the settings island).
  await tab.evaluate(([long, short]) => {
    document.getElementById('lk-narrow').options = long;
    document.getElementById('lk-wide').options = short;
  }, [LK_LONG, LK_SHORT]);
  await tab.waitForTimeout(300);
  return {tab, context, errors};
}

const frames = (tab) => tab.evaluate(() => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(settle))));

async function measureMenu(tab, menu, trigger) {
  await tab.evaluate(async ([menuId, triggerId]) => {
    const host = document.getElementById(menuId);
    await host.openFor(document.getElementById(triggerId), {focus: 'none'});
  }, [menu, trigger]);
  await frames(tab);
  await tab.waitForTimeout(150);
  return tab.evaluate(([menuId, triggerId]) => {
    const host = document.getElementById(menuId);
    const surface = host.querySelector(':scope > .sf-context-menu');
    const content = host.querySelector('.sf-context-menu-content');
    const r = (el) => el.getBoundingClientRect();
    const c = r(content); const s = r(surface); const t = r(document.getElementById(triggerId));
    return {
      width: Math.round(c.width * 10) / 10, surface: [s.left, s.top, s.width, s.height].map((v) => Math.round(v)),
      trigger: Math.round(t.width * 10) / 10, kind: content.getAttribute('data-sf-width') || '',
      sheet: surface.hasAttribute('data-sf-sheet'), viewport: [innerWidth, innerHeight],
      inside: s.left >= -0.5 && s.right <= document.documentElement.clientWidth + 0.5,
      triggerVar: getComputedStyle(surface).getPropertyValue('--sf-context-menu-trigger-inline-size').trim(),
      text: parseFloat(getComputedStyle(content).fontSize),
    };
  }, [menu, trigger]);
}

async function closeMenu(tab, menu) {
  await tab.evaluate((menuId) => document.getElementById(menuId).close({restoreFocus: false}), menu);
  await frames(tab);
}

async function measureField(tab, id) {
  await tab.evaluate((fieldId) => {
    const host = document.getElementById(fieldId);
    if (host.tagName === 'SF-DROPDOWN') host.openDropdown();
    else host.search('');
  }, id);
  await frames(tab);
  await tab.waitForTimeout(250);
  const value = await tab.evaluate((fieldId) => {
    const host = document.getElementById(fieldId);
    const lookup = host.tagName !== 'SF-DROPDOWN';
    const list = lookup ? host.querySelector('.sf-lookup-panel') : (host.__sfDropdownPortalList || host.querySelector('.sf-list'));
    const field = lookup ? host.querySelector('.sf-lookup-frame') : host.querySelector('.sf-dropdown-field');
    const l = list.getBoundingClientRect(); const f = field.getBoundingClientRect();
    return {width: Math.round(l.width * 10) / 10, field: Math.round(f.width * 10) / 10, shown: l.width > 0 && l.height > 0,
      inside: l.left >= -0.5 && l.right <= document.documentElement.clientWidth + 0.5};
  }, id);
  return value;
}

async function closeField(tab, id) {
  await tab.evaluate((fieldId) => {
    const host = document.getElementById(fieldId);
    if (host.tagName === 'SF-DROPDOWN') host.closeDropdown?.();
    else host.close();
  }, id);
  await tab.keyboard.press('Escape').catch(() => null);
  await frames(tab);
}

const scenes = [];
for (const theme of ['light', 'dark']) {
  scenes.push({theme, width: 1280, density: 'normal', label: 'normal'});
  scenes.push({theme, width: 1280, density: 'compact', label: 'compact'});
  scenes.push({theme, width: 390, density: 'compact', label: 'phone'});
}

for (const scene of scenes) {
  const steps = STEPS[scene.label === 'compact' ? 'compact' : 'normal'];
  for (let load = 1; load <= LOADS; load++) {
    const {tab, context, errors} = await open(scene);
    const key = `${scene.label}-${scene.theme}`;
    const tag = `${key} load ${load}`;
    const record = numbers[key] ||= {};
    for (const [name, menu, trigger] of MENUS) {
      const m = await measureMenu(tab, menu, trigger);
      if (load === 1) {
        record[name] = m;
        if (shots) await tab.screenshot({path: join(shots, `${key}-${name}.png`)});
      }
      if (!MEASURE_ONLY) {
        const screen = m.viewport[0];
        ok(`${tag} ${name}: inside the screen`, m.inside, JSON.stringify(m.surface));
        const want = {
          'menu-short': steps.menuMin, 'menu-long': steps.menuMax, 'list-narrow': steps.listMax, 'list-wide': m.trigger,
          'panel-narrow': steps.panel, 'panel-wide': Math.max(m.trigger, steps.panel), tabs: steps.panel,
          form: steps.form, 'form-wide': steps.formWide,
        }[name];
        const phoneSheet = scene.label === 'phone' && name.startsWith('form');
        if (phoneSheet) {
          ok(`${tag} ${name}: a sheet on the phone, the screen's width, at the bottom`, m.sheet && near(m.surface[2], screen) && m.surface[0] === 0
            && near(m.surface[1] + m.surface[3], m.viewport[1]), JSON.stringify(m));
        } else {
          const capped = Math.min(want, screen - 16);
          ok(`${tag} ${name}: ${m.width} = ${capped}`, near(m.width, capped), JSON.stringify(m));
          ok(`${tag} ${name}: not a sheet`, !m.sheet);
        }
        if (name.startsWith('list')) ok(`${tag} ${name}: at least the trigger`, m.width >= Math.min(m.trigger, screen - 16) - 1, `${m.width} vs ${m.trigger}`);
        if (['list-narrow', 'list-wide', 'panel-narrow', 'panel-wide', 'form', 'form-wide'].includes(name)) {
          ok(`${tag} ${name}: the trigger's width is published`, near(parseFloat(m.triggerVar), m.trigger, 0.6), m.triggerVar);
        }
      }
      await closeMenu(tab, menu);
    }
    for (const [name, id] of FIELDS) {
      const f = await measureField(tab, id);
      if (load === 1) {
        record[name] = f;
        if (shots) await tab.screenshot({path: join(shots, `${key}-${name}.png`)});
      }
      if (!MEASURE_ONLY) {
        ok(`${tag} ${name}: shown, inside the screen`, f.shown && f.inside, JSON.stringify(f));
        ok(`${tag} ${name}: at least the field (${f.width} >= ${f.field})`, f.width >= f.field - 0.6);
        ok(`${tag} ${name}: at most max(field, ${steps.listMax}) (${f.width})`, f.width <= Math.max(f.field, steps.listMax) + 0.6);
        if (name.endsWith('-narrow')) ok(`${tag} ${name}: long options widen it past the field (${f.width} > ${f.field})`, f.width > f.field + 8);
        if (name.endsWith('-wide')) ok(`${tag} ${name}: short options keep the field (${f.width} = ${f.field})`, near(f.width, f.field));
      }
      await closeField(tab, id);
    }
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (!MEASURE_ONLY) ok(`${tag}: no sideways scroll`, !overflow);
    ok(`${tag}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
server.close();
if (shots) writeFileSync(join(shots, 'numbers.json'), `${JSON.stringify(numbers, null, 2)}\n`);
const failed = results.filter((one) => !one.pass);
for (const one of failed) process.stdout.write(`FAIL ${one.name} ${one.detail}\n`);
process.stdout.write(`${MEASURE_ONLY ? 'measured' : 'C32_DROPDOWN_WIDTHS'} ${results.length - failed.length}/${results.length}\n`);
if (failed.length) process.exitCode = 1;
