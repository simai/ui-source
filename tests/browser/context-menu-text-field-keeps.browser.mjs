#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--loads 3] [--json <file>]
//
// sf-menu-context 1.27.3 (ui-control control/evidence/2026-11-19-view-shadow-menu):
// only a text field keeps the browser's own menu at an object of an area;
// a checkbox does not. Measured on the built bytes with the real sf-checkbox,
// at 1440 and 390, light and dark, each load fresh, in two tables of the
// same rows: one in the document (for="<id>") and one in an open shadow root
// (menu.for = [table]). In each table:
//   - the menu key on the row's native selection checkbox opens the row's
//     menu under the row, and Escape gives the focus back to the checkbox;
//   - Shift+F10 on the row's sf-checkbox opens it;
//   - the menu key on a role=checkbox mark opens it;
//   - the right button on the native checkbox opens it at the pointer and
//     keeps the browser's menu away; the checkbox is not toggled;
//   - the menu key and the right button in the row's text input keep the
//     browser's menu (no menu, the contextmenu event not prevented), and in
//     its textarea;
//   - a plain cell: the menu key opens it (unchanged).
// The console stays clean: no error and no warning on any load.
import {resolve, join} from 'node:path';
import {existsSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const option = (name, fallback) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : fallback; };
const LOADS = Number(option('--loads', 3));
const JSON_OUT = option('--json', null);
const styles = [
  'core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/context-menu/css/context-menu.css',
  'component/component/checkbox/css/checkbox.css',
].map((p) => join(out, p));
const modules = [
  'core/core/lang/ru.js', 'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/checkbox/js/checkbox.js', 'smart/smart/menu-context/js/menu-context.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); return pass; };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const ROWS = ['Отчёт за ноябрь.pdf', 'Договор поставки.docx', 'Смета 2027.xlsx', 'Фото склада.jpg'];

// Row 0: a native checkbox; row 1: sf-checkbox; row 2: a role=checkbox mark;
// row 3: a text input and a textarea. Every row has a plain name cell.
const rowsHtml = (prefix) => ROWS.map((name, at) => {
  const mark = at === 0 ? `<input type="checkbox" class="mark" aria-label="Выбрать ${name}">`
    : at === 1 ? `<sf-checkbox class="mark" aria-label="Выбрать ${name}"></sf-checkbox>`
      : at === 2 ? `<span class="mark" role="checkbox" tabindex="0" aria-checked="false" aria-label="Выбрать ${name}">□</span>`
        : '<input type="text" class="text" aria-label="Название" value="Фото"><textarea class="area" aria-label="Заметка" rows="1">склад</textarea>';
  return `<tr tabindex="-1" aria-selected="false" data-name="${name}" data-row="${prefix}${at}"><td class="cell-mark">${mark}</td><td class="cell-name" style="block-size:40px;padding-inline:8px">${name}</td></tr>`;
}).join('');

async function open(browser, {width, theme}) {
  const context = await browser.newContext({viewport: {width, height: width > 400 ? 900 : 844}, colorScheme: theme});
  const page = await context.newPage();
  const consoleSaid = [];
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) consoleSaid.push(`${message.type()}: ${message.text()}`); });
  // addScriptTag lays the bundles without a src: webpack's automatic publicPath
  // complains then, as in context-menu-object.browser.mjs; nothing else is let through.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) consoleSaid.push(`pageerror: ${error.message}`); });
  await page.setContent(`<!doctype html><html class="theme-${theme}" lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:16px;background:var(--sf-surface)">
    <table id="doc-rows" aria-label="Файлы" style="border-collapse:collapse;inline-size:100%;max-inline-size:600px"><tbody>${rowsHtml('d')}</tbody></table>
    <x-view id="view"></x-view>
    <sf-menu-context id="dm" popup for="doc-rows" aria-label="Действия с файлом"></sf-menu-context>
    <sf-menu-context id="sm" popup aria-label="Действия с файлом"></sf-menu-context>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({path});
  await page.evaluate(({rows, sheets}) => {
    customElements.define('x-view', class extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({mode: 'open'});
        // The shadow table reads the same sheets, as a view's own root does.
        root.innerHTML = `${sheets.map((css) => `<style>${css}</style>`).join('')}<style>table{border-collapse:collapse;inline-size:100%;max-inline-size:600px;margin-block-start:16px}</style>
          <table id="rows" aria-label="Файлы"><tbody>${rows}</tbody></table>`;
      }
    });
  }, {rows: rowsHtml('s'), sheets: await page.evaluate(() => [...document.querySelectorAll('style')].map((one) => one.textContent))});
  for (const path of modules) await page.addScriptTag(path.endsWith('/lang/ru.js') ? {path} : {path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-menu-context') && customElements.get('sf-checkbox'));
  await page.waitForFunction(() => [document, document.getElementById('view').shadowRoot].every((root) => root.querySelector('sf-checkbox input[type="checkbox"]')), null, {timeout: 10000});
  await page.evaluate(() => {
    window.__log = []; window.__ctx = [];
    addEventListener('contextmenu', (event) => window.__ctx.push(event.defaultPrevented));
    const listen = (menu, name) => menu.addEventListener('sf-menu-context-open', (event) => {
      const {target, targets} = event.detail;
      window.__log.push({menu: name, target: target?.dataset?.row ?? null, targets: targets.length});
      menu.entries = [{type: 'heading', text: target?.dataset?.name ?? ''}, {id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'delete', text: 'Удалить', icon: 'delete', danger: true}];
    });
    const sm = document.getElementById('sm');
    sm.for = [document.getElementById('view').shadowRoot.getElementById('rows')];
    listen(document.getElementById('dm'), 'dm');
    listen(sm, 'sm');
  });
  await sleep(250);
  return {context, page, consoleSaid};
}

// Where each table lives: the document, or the x-view's shadow root.
const TABLES = [
  {name: 'document', menu: 'dm', prefix: 'd'},
  {name: 'shadow', menu: 'sm', prefix: 's'},
];
const inRoot = (table) => (table.name === 'document' ? 'document' : 'document.getElementById("view").shadowRoot');

const state = (page, table) => page.evaluate((rootExpr) => {
  // eslint-disable-next-line no-new-func
  const root = new Function(`return ${rootExpr}`)();
  const deep = () => { let at = document.activeElement; while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement; return at; };
  const menus = ['dm', 'sm'].map((id) => document.getElementById(id));
  const openMenu = menus.find((one) => one.isOpen);
  const content = openMenu?.querySelector(':scope > .sf-context-menu .sf-context-menu-content');
  const r = content?.getBoundingClientRect();
  const active = deep();
  return {
    open: openMenu?.id ?? null,
    sheet: openMenu?.querySelector(':scope > .sf-context-menu')?.hasAttribute('data-sf-sheet') ?? false,
    box: r ? {left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width)} : null,
    active: active ? `${active.closest('tr')?.dataset.row ?? '-'}:${active.localName}${active.type ? `[${active.type}]` : ''}${active.getAttribute('role') ? `[role=${active.getAttribute('role')}]` : ''}` : null,
    checked: root.querySelector('tr input[type="checkbox"].mark')?.checked ?? null,
    prevented: window.__ctx.at(-1) ?? null, ctxCount: window.__ctx.length, log: window.__log.slice(),
  };
}, inRoot(table));
const escape = async (page) => { await page.keyboard.press('Escape'); await sleep(200); };
const focusIn = (page, table, selector) => page.evaluate(({rootExpr, selector}) => {
  // eslint-disable-next-line no-new-func
  const root = new Function(`return ${rootExpr}`)();
  const node = root.querySelector(selector);
  node.focus();
  let at = document.activeElement; while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  return at === node;
}, {rootExpr: inRoot(table), selector});
const locate = (page, table, selector) => (table.name === 'document' ? page.locator(`#doc-rows ${selector}`) : page.locator(`#view >> ${selector}`)).first();

const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']}).catch(() => chromium.launch({headless: true}));
let runs = 0;
let passedRuns = 0;
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      for (let load = 1; load <= LOADS; load++) {
        const tag = `${width} ${theme} #${load}`;
        const before = failures.length;
        const {context, page, consoleSaid} = await open(browser, {width, theme});
        const seen = {tag, width, theme, load, tables: {}};
        for (const table of TABLES) {
          const t = {};
          const name = `${tag} ${table.name}`;
          const rowOf = (at) => `${table.prefix}${at}`;
          let now;
          // The menu key on the native checkbox of row 0.
          t.nativeFocused = await focusIn(page, table, 'tr[data-row$="0"] input[type="checkbox"]');
          await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page, table);
          const row0 = await locate(page, table, 'tbody tr').boundingBox();
          t.menuKeyCheckbox = {open: now.open, last: now.log.at(-1), box: now.box, row: {x: Math.round(row0.x), bottom: Math.round(row0.y + row0.height)}, sheet: now.sheet};
          check(`${name}: the menu key on a row's checkbox opens the row's menu`, now.open === table.menu && now.log.at(-1)?.target === rowOf(0), t.menuKeyCheckbox);
          if (now.open && !now.sheet) check(`${name}: under the row's start`, now.box?.left === t.menuKeyCheckbox.row.x && now.box?.top === t.menuKeyCheckbox.row.bottom, t.menuKeyCheckbox);
          await escape(page); now = await state(page, table);
          t.menuKeyCheckboxBack = now.active;
          if (t.menuKeyCheckbox.open) check(`${name}: Escape gives the focus back to the checkbox`, !now.open && now.active === `${rowOf(0)}:input[checkbox]`, {active: now.active});
          // Shift+F10 on sf-checkbox's own input, row 1.
          t.sfFocused = await focusIn(page, table, 'tr[data-row$="1"] sf-checkbox input[type="checkbox"]');
          await page.keyboard.press('Shift+F10'); await sleep(300); now = await state(page, table);
          t.shiftF10SfCheckbox = {open: now.open, last: now.log.at(-1)};
          check(`${name}: Shift+F10 on sf-checkbox opens the row's menu`, now.open === table.menu && now.log.at(-1)?.target === rowOf(1), t.shiftF10SfCheckbox);
          await escape(page);
          // The menu key on a role=checkbox mark, row 2.
          t.roleFocused = await focusIn(page, table, 'tr[data-row$="2"] [role="checkbox"]');
          await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page, table);
          t.menuKeyRoleCheckbox = {open: now.open, last: now.log.at(-1)};
          check(`${name}: the menu key on role=checkbox opens the row's menu`, now.open === table.menu && now.log.at(-1)?.target === rowOf(2), t.menuKeyRoleCheckbox);
          await escape(page);
          // The right button on the native checkbox, row 0.
          const box = await locate(page, table, 'tr[data-row$="0"] input[type="checkbox"]').boundingBox();
          const point = {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)};
          const checkedBefore = (await state(page, table)).checked;
          await page.mouse.click(point.x, point.y, {button: 'right'}); await sleep(300); now = await state(page, table);
          t.rightCheckbox = {open: now.open, prevented: now.prevented, corner: now.box && {x: now.box.left, y: now.box.top}, point, last: now.log.at(-1), checkedBefore, checked: now.checked};
          check(`${name}: the right button on a row's checkbox opens the row's menu`, now.open === table.menu && now.log.at(-1)?.target === rowOf(0), t.rightCheckbox);
          check(`${name}: and keeps the browser's menu away`, now.prevented === true, t.rightCheckbox);
          check(`${name}: the checkbox is not toggled`, now.checked === checkedBefore, t.rightCheckbox);
          if (now.open && !now.sheet) check(`${name}: the corner is at the pointer`, now.box?.left === point.x && now.box?.top === point.y, t.rightCheckbox);
          await escape(page);
          // The text input and the textarea of row 3 keep the browser's menu.
          for (const [key, selector] of [['textInput', 'tr[data-row$="3"] input.text'], ['textarea', 'tr[data-row$="3"] textarea']]) {
            const logBefore = (await state(page, table)).log.length;
            const ctxBefore = (await state(page, table)).ctxCount;
            t[`${key}Focused`] = await focusIn(page, table, selector);
            await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page, table);
            t[`${key}MenuKey`] = {open: now.open, newOpens: now.log.length - logBefore, contextmenu: now.ctxCount - ctxBefore, prevented: now.ctxCount > ctxBefore ? now.prevented : null};
            check(`${name}: the menu key in a ${key} keeps the browser's menu`, !now.open && now.log.length === logBefore && (now.ctxCount === ctxBefore || now.prevented === false), t[`${key}MenuKey`]);
            if (now.open) await escape(page);
            const field = await locate(page, table, selector).boundingBox();
            await page.mouse.click(Math.round(field.x + 6), Math.round(field.y + field.height / 2), {button: 'right'}); await sleep(250); now = await state(page, table);
            t[`${key}Right`] = {open: now.open, prevented: now.prevented, newOpens: now.log.length - logBefore};
            check(`${name}: the right button in a ${key} keeps the browser's menu`, !now.open && now.prevented === false && now.log.length === logBefore, t[`${key}Right`]);
            if (now.open) await escape(page);
          }
          // A plain cell of row 3: the menu key opens the menu as before.
          await page.evaluate((rootExpr) => {
            // eslint-disable-next-line no-new-func
            new Function(`return ${rootExpr}`)().querySelector('tr[data-row$="3"]').focus();
          }, inRoot(table));
          await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page, table);
          t.menuKeyRow = {open: now.open, last: now.log.at(-1)};
          check(`${name}: the menu key on a focused row opens its menu`, now.open === table.menu && now.log.at(-1)?.target === rowOf(3), t.menuKeyRow);
          await escape(page);
          seen.tables[table.name] = t;
        }
        seen.console = consoleSaid.slice();
        check(`${tag}: the console is clean`, consoleSaid.length === 0, {console: consoleSaid});
        seen.pass = failures.length === before;
        runs += 1; if (seen.pass) passedRuns += 1;
        evidence.push(seen);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const summary = {runs, passedRuns, failures: failures.length};
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({summary, evidence, failures}, null, 1));
console.log(JSON.stringify(summary));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 40), count: failures.length}, null, 1)); process.exit(1); }
