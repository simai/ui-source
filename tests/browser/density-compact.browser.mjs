#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--shots <dir>]
//
// Density (owner decision C22, 2026-11-09), on the built bytes over the
// Loader, light and dark, desktop and phone widths, three loads each:
//
//   - in data-sf-density="compact" an unsized component is one step down:
//     box height, icon size and text size are each the next size's, or one
//     step of their ladder below normal (a part that keeps one step at every
//     size); inherited text is the compact body, 14 (buttons, icon buttons, input, dropdown,
//     list rows, context-menu rows, tabs, badge, switch, checkbox, segmented,
//     tag, pagination, navigation menu rows);
//   - an explicit size wins: compact with size = the default draws as the
//     normal page unsized;
//   - data-sf-density="normal" inside a compact region is the normal page;
//   - the ladder itself: compact control 32, icon 20, text 14 on desktop
//     (normal 40, 24, 16); a size 1/3 component stays 1/3 (the floor);
//   - the phone ladder (< 60rem) is not moved: compact = normal there.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? resolve(process.argv[shotsAt + 1]) : '';
if (shots) mkdirSync(shots, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const LOWER = {'1/3': '1/3', '1/2': '1/3', '1': '1/2', '2': '1', '3': '2'};
const items = JSON.stringify([{id: 'a', label: 'Главная', href: '#a', icon: 'home'}, {id: 'b', label: 'Заказы', href: '#b', icon: 'list'}]).replaceAll("'", '&#39;');
const entries = JSON.stringify([{id: 'e', text: 'Изменить', icon: 'edit'}, {id: 'c', text: 'Копировать', icon: 'content_copy'}]).replaceAll('"', '&quot;');
const tabs = JSON.stringify([{id: 'm', label: 'Основное'}, {id: 'd', label: 'Сделки'}]).replaceAll("'", '&#39;');
const segments = '<script type="application/json" data-sf-settings>{"items":[{"value":"d","label":"День"},{"value":"w","label":"Неделя"}]}</script>';

// [name, default size, markup with SIZE in place of the size attribute,
//  the box measured, the text measured]
const SUBJECTS = [
  ['button', '1', (size) => `<sf-button ${size} text="Кнопка" icon-start="add"></sf-button>`, '.sf-button', '.sf-button-text-container'],
  ['button-icon', '1', (size) => `<sf-button-icon ${size} icon="settings" aria-label="Настройки"></sf-button-icon>`, '.sf-icon-button', null],
  ['input', '1', (size) => `<sf-input ${size} name="q" placeholder="Поиск" icon-start="search"></sf-input>`, '.sf-input-field', 'input'],
  ['dropdown', '1', (size) => `<sf-dropdown ${size} name="town" placeholder="Город"><sf-list-item value="k" text="Казань"></sf-list-item></sf-dropdown>`, '.sf-input-field, .sf-dropdown-field, .sf-dropdown-trigger', null],
  ['list-item', '1', (size) => `<sf-list-item ${size} interactive text="Строка" icon="description"></sf-list-item>`, '.sf-list-item', '.sf-list-item-text, .sf-list-item-title'],
  ['menu-context', '1/2', (size) => `<sf-menu-context ${size} aria-label="Действия" entries="${entries}"></sf-menu-context>`, '[role="menuitem"]', '[role="menuitem"] .sf-context-menu-item-text, [role="menuitem"] span'],
  ['tabs', '1', (size) => `<sf-tabs ${size} aria-label="Карточка" items='${tabs}'></sf-tabs>`, '[role="tab"]', '[role="tab"]'],
  ['badge', '1/3', (size) => `<sf-badge ${size} text="12"></sf-badge>`, '.sf-badge', '.sf-badge'],
  ['switch', '1', (size) => `<sf-switch ${size} label="Включено"></sf-switch>`, '.sf-switch-track, .sf-switch', 'label, .sf-switch-label'],
  ['checkbox', '1', (size) => `<sf-checkbox ${size} label="Все строки"></sf-checkbox>`, '.sf-checkbox-box, .sf-checkbox-control, input[type="checkbox"]', 'label, .sf-checkbox-label'],
  ['segmented', '1', (size) => `<sf-segmented ${size} aria-label="Период" value="w">${segments}</sf-segmented>`, '.sf-button-group', '.sf-button-text-container'],
  ['tag', '1/2', (size) => `<sf-tag ${size} text="Новые"></sf-tag>`, '.sf-tag', '.sf-tag'],
  ['pagination', '1', (size) => `<sf-pagination ${size} aria-label="Страницы" current="2" total="90" page-size="10" top="false"></sf-pagination>`, '.sf-pagination button, .sf-pagination .sf-button', null],
];
const attr = (size) => (size ? `size="${size}"` : '');
const cell = (id, density, html) => `<div class="cell" id="${id}"${density ? ` data-sf-density="${density}"` : ''}>${html}</div>`;
const body = () => SUBJECTS.map(([name, size, markup]) => `<section class="row" data-name="${name}">
  ${cell(`${name}--normal`, '', markup(''))}
  ${cell(`${name}--lower`, '', markup(attr(LOWER[size])))}
  ${cell(`${name}--compact`, 'compact', markup(''))}
  ${cell(`${name}--explicit`, 'compact', markup(attr(size)))}
  ${cell(`${name}--explicit-lower`, 'compact', markup(attr(LOWER[size])))}
  <div class="cell" data-sf-density="compact"><div class="cell" id="${name}--back" data-sf-density="normal">${markup('')}</div></div>
</section>`).join('\n') + `
<section class="row" data-name="menu">
  <div class="cell" id="menu--normal" style="inline-size:240px"><sf-menu aria-label="Разделы" items='${items}'></sf-menu></div>
  <div class="cell" id="menu--compact" data-sf-density="compact" style="inline-size:240px"><sf-menu aria-label="Разделы" items='${items}'></sf-menu></div>
</section>
<section class="row" data-name="ladder">
  <div class="cell" id="ladder--normal"><i class="probe" style="block-size:var(--sf-ui-1--control-height)"></i><i class="icon" style="block-size:var(--sf-icon-size-3)"></i><span class="text" style="font-size:var(--sf-text-size-1)">Т</span><p class="body">Текст</p></div>
  <div class="cell" id="ladder--compact" data-sf-density="compact"><i class="probe" style="block-size:var(--sf-ui-1--control-height)"></i><i class="icon" style="block-size:var(--sf-icon-size-3)"></i><span class="text" style="font-size:var(--sf-text-size-1)">Т</span><p class="body">Текст</p></div>
</section>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><link rel="icon" href="data:,">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>body{margin:0;padding:8px;background:var(--sf-surface)}.row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin-block-end:8px}.cell{min-inline-size:120px}.probe,.icon{display:inline-block;inline-size:4px;background:red}</style>
<script src="/distr/core/js/core.js"></script></head><body>${body()}</body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path.startsWith('/page-')) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.includes('dark') ? 'dark' : 'light'));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const MEASURE = (subjects) => {
  const round = (value) => Math.round(value * 100) / 100;
  const pick = (root, selector) => (selector ? selector.split(',').map((one) => root.querySelector(one.trim())).find(Boolean) : null);
  const measure = (root, box, text) => {
    const target = pick(root, box);
    const icon = root.querySelector('.sf-icon');
    const words = pick(root, text) ?? target;
    return {
      h: target ? round(target.getBoundingClientRect().height) : null,
      icon: icon ? round(icon.getBoundingClientRect().height) : null,
      font: words ? round(parseFloat(getComputedStyle(words).fontSize)) : null,
    };
  };
  const result = {};
  for (const [name, , , box, text] of subjects) {
    result[name] = {};
    for (const cellId of ['normal', 'lower', 'compact', 'explicit', 'explicit-lower', 'back']) {
      const root = document.getElementById(`${name}--${cellId}`);
      result[name][cellId] = root ? measure(root, box, text) : null;
    }
  }
  const menuRows = (id) => Array.from(document.querySelectorAll(`#${id} a, #${id} [role="link"]`)).map((row) => ({h: round(row.getBoundingClientRect().height), icon: row.querySelector('.sf-icon') ? round(row.querySelector('.sf-icon').getBoundingClientRect().height) : null, font: round(parseFloat(getComputedStyle(row).fontSize))}));
  result.menu = {normal: menuRows('menu--normal')[0] ?? null, compact: menuRows('menu--compact')[0] ?? null};
  const ladder = (id) => {
    const root = document.getElementById(id);
    return {h: round(root.querySelector('.probe').getBoundingClientRect().height), icon: round(root.querySelector('.icon').getBoundingClientRect().height), font: round(parseFloat(getComputedStyle(root.querySelector('.text')).fontSize)), body: round(parseFloat(getComputedStyle(root.querySelector('.body')).fontSize))};
  };
  result.ladder = {normal: ladder('ladder--normal'), compact: ladder('ladder--compact')};
  return result;
};

const same = (a, b) => a && b && ['h', 'icon', 'font'].every((key) => a[key] === b[key]);
// One step below on the metric's own ladder (desktop px); the lowest stays.
const LADDERS = {h: [24, 32, 40, 48, 56], icon: [12, 14, 16, 20, 24, 28, 32, 36, 40], font: [12, 14, 16, 20, 24]};
const below = (key, value) => {
  const ladder = LADDERS[key];
  const at = ladder.indexOf(value);
  return at < 0 ? undefined : ladder[Math.max(0, at - 1)];
};
// Compact is one step down: the next size's drawing, or one step of the
// ladder where a part keeps one step at every size (a chevron, a menu row at
// its lowest size). Text a component does not size (it inherits the body)
// takes the compact body, 14.
const stepDown = (compact, normal, lower) => compact && normal && lower && ['h', 'icon', 'font'].every((key) =>
  compact[key] === lower[key]
  || (compact[key] !== null && compact[key] === below(key, normal[key]))
  || (key === 'font' && normal.font === lower.font && compact.font === 14));
const failures = [];
const report = {};
const consoleErrors = [];
const browser = await chromium.launch();
try {
  for (const [width, mode] of [[1280, 'desktop'], [375, 'phone']]) {
    for (const theme of ['light', 'dark']) {
      for (let load = 1; load <= 3; load += 1) {
        const context = await browser.newContext({viewport: {width, height: 900}});
        const tab = await context.newPage();
        tab.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`${mode}/${theme}/${load}: ${message.text()}`); });
        tab.on('pageerror', (error) => consoleErrors.push(`${mode}/${theme}/${load}: ${error.message}`));
        const {port} = server.address();
        await tab.goto(`http://127.0.0.1:${port}/page-${theme}`);
        await tab.waitForFunction(() => document.querySelectorAll('sf-pagination .sf-pagination, sf-tabs [role="tab"], sf-menu a').length >= 3, null, {timeout: 20000});
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(400);
        const data = await tab.evaluate(MEASURE, SUBJECTS.map(([name, size, , box, text]) => [name, size, null, box, text]));
        const label = `${mode}/${theme}/${load}`;
        if (load === 1) report[`${mode}/${theme}`] = data;
        if (shots && load === 1) await tab.screenshot({path: join(shots, `density-${mode}-${theme}.png`), fullPage: true});
        for (const [name] of SUBJECTS) {
          const row = data[name];
          if (mode === 'desktop') {
            if (!stepDown(row.compact, row.normal, row.lower)) failures.push(`${label} ${name}: compact ${JSON.stringify(row.compact)} is not one step below ${JSON.stringify(row.normal)} (next size ${JSON.stringify(row.lower)})`);
            if (row.normal.h > 24 && !(row.compact.h < row.normal.h)) failures.push(`${label} ${name}: compact did not move (${row.compact.h} vs ${row.normal.h})`);
            if (!same(row.explicit, row.normal)) failures.push(`${label} ${name}: explicit size in compact ${JSON.stringify(row.explicit)} is not the normal ${JSON.stringify(row.normal)}`);
            if (!same(row['explicit-lower'], row.lower)) failures.push(`${label} ${name}: explicit lower size in compact ${JSON.stringify(row['explicit-lower'])} is not ${JSON.stringify(row.lower)}`);
          } else if (!same(row.compact, row.normal)) {
            failures.push(`${label} ${name}: the phone ladder moved in compact ${JSON.stringify(row.compact)} vs ${JSON.stringify(row.normal)}`);
          }
          if (!same(row.back, row.normal)) failures.push(`${label} ${name}: density normal inside compact ${JSON.stringify(row.back)} is not normal ${JSON.stringify(row.normal)}`);
          if (row.normal?.h === null) failures.push(`${label} ${name}: nothing measured`);
        }
        const {ladder, menu} = data;
        if (mode === 'desktop') {
          const want = {normal: {h: 40, icon: 24, font: 16, body: 16}, compact: {h: 32, icon: 20, font: 14, body: 14}};
          for (const key of ['normal', 'compact']) {
            if (JSON.stringify(ladder[key]) !== JSON.stringify(want[key])) failures.push(`${label} ladder ${key}: ${JSON.stringify(ladder[key])}, want ${JSON.stringify(want[key])}`);
          }
          if (menu.normal?.h !== 40 || menu.compact?.h !== 32) failures.push(`${label} menu rows: normal ${menu.normal?.h}, compact ${menu.compact?.h}; want 40 and 32`);
        } else if (JSON.stringify(ladder.normal) !== JSON.stringify(ladder.compact)) {
          failures.push(`${label} phone ladder moved: ${JSON.stringify(ladder)}`);
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (consoleErrors.length) failures.push(...consoleErrors.map((line) => `console: ${line}`));
console.log(JSON.stringify({report, failures}, null, 1));
if (failures.length && !reportOnly) {
  console.error(`density-compact: ${failures.length} failure(s)`);
  process.exitCode = 1;
}
