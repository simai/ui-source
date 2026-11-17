#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--loads 3]
//
// sf-menu-context 1.27.0 (queue db8793a2): `for` reaches areas inside a
// shadow root -- a view's own table -- measured on the built bytes, at 1440
// and at 390, each load fresh:
//   (A) a table in an open shadow root, given as the property
//       (menu.for = [table]), the menu in the document:
//       the right button opens it at the pointer for the row it was pressed
//       on and keeps the browser's menu away; the menu key and Shift+F10 on
//       a focused row open it under the row's start; Escape gives the focus
//       back to the row inside the root; Shift and a link keep the browser's
//       menu; a selected row acts on every selected row of the table;
//   (B) the menu in the same shadow root as its table, for="<id>": the id is
//       found in the menu's own root;
//   (C) the document's own list (for="<id>") opens as before, once per press:
//       one open request for one right button.
// The console stays clean: no error and no warning on any load.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loadsAt = process.argv.indexOf('--loads');
const LOADS = loadsAt > 0 ? Number(process.argv[loadsAt + 1]) : 3;
const styles = [
  'core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/context-menu/css/context-menu.css',
].map((p) => join(out, p));
// The Russian words, as a Russian site lays them before core (C282, group build 10).
const modules = [
  'core/core/lang/ru.js', 'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/menu-context/js/menu-context.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const ROWS = ['Отчёт за ноябрь.pdf', 'Договор поставки.docx', 'Смета 2027.xlsx', 'Фото склада.jpg'];

const rowsHtml = (prefix) => ROWS.map((name, at) => `<tr tabindex="-1" aria-selected="false" data-name="${name}" data-row="${prefix}${at}"><td style="block-size:40px;padding-inline:8px">${at === 0 ? `<a href="#x">${name}</a>` : name}</td><td style="inline-size:120px">${at + 1} МБ</td></tr>`).join('');

async function open(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const consoleSaid = [];
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) consoleSaid.push(`${message.type()}: ${message.text()}`); });
  // addScriptTag lays the bundles without a src: webpack's automatic publicPath
  // complains then, as in context-menu-object.browser.mjs; nothing else is let through.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) consoleSaid.push(`pageerror: ${error.message}`); });
  await page.setContent(`<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:16px">
    <x-view id="view-a"></x-view>
    <x-view id="view-b" own-menu></x-view>
    <ul id="files" role="listbox" aria-label="Файлы" style="list-style:none;margin:0;padding:0;max-inline-size:600px">
      ${ROWS.map((name, at) => `<li role="option" tabindex="${at ? -1 : 0}" aria-selected="false" data-name="${name}" style="display:flex;align-items:center;block-size:40px;padding-inline:8px">${name}</li>`).join('')}
    </ul>
    <sf-menu-context id="m" popup aria-label="Действия с файлом"></sf-menu-context>
    <sf-menu-context id="d" popup for="files" aria-label="Действия с файлом"></sf-menu-context>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({path});
  // A view that draws its own table in an open shadow root, as sf-view does
  // when the host slots none; with own-menu its row menu stands in the root.
  await page.evaluate(({a, b}) => {
    customElements.define('x-view', class extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({mode: 'open'});
        const own = this.hasAttribute('own-menu');
        root.innerHTML = `<style>table{border-collapse:collapse;inline-size:100%;max-inline-size:600px}tr[aria-selected="true"]{background:#eef}</style>
          <table id="rows" class="table" aria-label="Файлы"><tbody>${own ? b : a}</tbody></table>
          ${own ? '<sf-menu-context id="own" popup for="rows" aria-label="Действия с файлом"></sf-menu-context>' : ''}`;
      }
    });
  }, {a: rowsHtml('a'), b: rowsHtml('b')});
  for (const path of modules) await page.addScriptTag(path.endsWith('/lang/ru.js') ? {path} : {path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-menu-context'));
  await page.evaluate(() => {
    window.__log = []; window.__ctx = [];
    addEventListener('contextmenu', (event) => window.__ctx.push(event.defaultPrevented));
    const listen = (menu, name) => menu.addEventListener('sf-menu-context-open', (event) => {
      const {target, targets} = event.detail;
      window.__log.push({menu: name, target: target?.dataset?.row ?? target?.dataset?.name ?? target?.localName ?? null, targets: targets.length});
      menu.entries = [{type: 'heading', text: targets.length > 1 ? '' : target?.dataset.name ?? ''}, {id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'delete', text: 'Удалить', icon: 'delete', danger: true}];
    });
    const menu = document.getElementById('m');
    menu.for = [document.getElementById('view-a').shadowRoot.getElementById('rows')];
    listen(menu, 'm');
    listen(document.getElementById('view-b').shadowRoot.getElementById('own'), 'own');
    listen(document.getElementById('d'), 'd');
  });
  await sleep(250);
  return {context, page, consoleSaid};
}

const state = (page) => page.evaluate(() => {
  const deep = () => { let at = document.activeElement; while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement; return at; };
  const menu = document.getElementById('m');
  const own = document.getElementById('view-b').shadowRoot.getElementById('own');
  const box = (one) => { const content = one.querySelector(':scope > .sf-context-menu .sf-context-menu-content'); const r = content?.getBoundingClientRect(); return r && {left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width)}; };
  const active = deep();
  return {
    open: menu.isOpen, ownOpen: own.isOpen, docOpen: document.getElementById('d').isOpen,
    box: box(menu), sheet: menu.querySelector(':scope > .sf-context-menu')?.hasAttribute('data-sf-sheet') ?? false,
    active: active?.dataset?.row ?? active?.dataset?.name ?? active?.localName,
    focusInMenu: menu.contains(document.activeElement),
    targets: menu.targets.map((row) => row.dataset.row),
    selected: [...document.getElementById('view-a').shadowRoot.querySelectorAll('tbody tr')].map((row) => (row.getAttribute('aria-selected') === 'true' ? 1 : 0)).join(''),
    prevented: window.__ctx.at(-1) ?? null, log: window.__log.slice(),
  };
});
const rowBox = (page, view, at) => page.locator(`#${view} >> tbody tr`).nth(at).boundingBox();
const escape = async (page) => { await page.keyboard.press('Escape'); await sleep(200); };
const focusRow = (page, view, at) => page.evaluate(({view, at}) => document.getElementById(view).shadowRoot.querySelectorAll('tbody tr')[at].focus(), {view, at});

const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']}).catch(() => chromium.launch({headless: true}));
try {
  for (const width of [1440, 390]) {
    for (let load = 1; load <= LOADS; load++) {
      const tag = `${width}#${load}`;
      const {context, page, consoleSaid} = await open(browser, {viewport: {width, height: width > 400 ? 900 : 844}});
      const seen = {tag};
      // (A) the right button on row 2 of the shadow table
      let box = await rowBox(page, 'view-a', 1);
      const point = {x: Math.round(box.x + Math.min(200, box.width / 2)), y: Math.round(box.y + box.height / 2)};
      await page.mouse.click(point.x, point.y, {button: 'right'}); await sleep(300);
      let now = await state(page);
      seen.right = {open: now.open, prevented: now.prevented, corner: now.box && {x: now.box.left, y: now.box.top}, point, last: now.log.at(-1)};
      check(`${tag} (A) the right button opens the menu`, now.open, seen.right);
      check(`${tag} (A) the browser menu is kept away`, now.prevented === true, seen.right);
      check(`${tag} (A) the open request names the shadow row`, now.log.at(-1)?.menu === 'm' && now.log.at(-1)?.target === 'a1', seen.right);
      check(`${tag} (A) one open request for one press`, now.log.filter((one) => one.menu === 'm').length === 1, {log: now.log});
      if (!now.sheet) check(`${tag} (A) the corner is at the pointer`, now.box?.left === point.x && now.box?.top === point.y, seen.right);
      await escape(page); now = await state(page);
      seen.rightBack = now.active;
      check(`${tag} (A) Escape gives the focus back to the row in the root`, !now.open && now.active === 'a1', {active: now.active});
      // (A) the menu key and Shift+F10 on a focused row
      await focusRow(page, 'view-a', 2); await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page);
      box = await rowBox(page, 'view-a', 2);
      seen.menuKey = {open: now.open, box: now.box, row: {x: Math.round(box.x), bottom: Math.round(box.y + box.height)}, last: now.log.at(-1), focusInMenu: now.focusInMenu};
      check(`${tag} (A) the menu key opens it for the row`, now.open && now.log.at(-1)?.target === 'a2', seen.menuKey);
      if (!now.sheet) check(`${tag} (A) the menu key opens it under the row's start`, now.box?.left === Math.round(box.x) && now.box?.top === Math.round(box.y + box.height), seen.menuKey);
      check(`${tag} (A) the focus is in the menu`, now.focusInMenu, seen.menuKey);
      await escape(page); now = await state(page);
      seen.menuKeyBack = now.active;
      check(`${tag} (A) after the menu key the focus comes back to the row`, !now.open && now.active === 'a2', {active: now.active});
      await focusRow(page, 'view-a', 3); await page.keyboard.press('Shift+F10'); await sleep(300); now = await state(page);
      seen.shiftF10 = {open: now.open, last: now.log.at(-1)};
      check(`${tag} (A) Shift+F10 opens it for the row`, now.open && now.log.at(-1)?.target === 'a3', seen.shiftF10);
      await escape(page); now = await state(page);
      seen.shiftF10Back = now.active;
      check(`${tag} (A) after Shift+F10 the focus comes back to the row`, !now.open && now.active === 'a3', {active: now.active});
      // (A) a link and Shift keep the browser's menu
      const link = await page.locator('#view-a >> a').boundingBox();
      await page.mouse.click(link.x + 4, link.y + 4, {button: 'right'}); await sleep(200); now = await state(page);
      check(`${tag} (A) a link keeps the browser menu`, !now.open && now.prevented === false, {open: now.open, prevented: now.prevented});
      await page.keyboard.down('Shift'); await page.mouse.click(point.x, point.y, {button: 'right'}); await page.keyboard.up('Shift'); await sleep(200); now = await state(page);
      check(`${tag} (A) Shift keeps the browser menu`, !now.open && now.prevented === false, {open: now.open, prevented: now.prevented});
      // (A) the rows the earlier presses selected alone are cleared, then a
      // selection of two inside the root
      await page.evaluate(() => { const rows = document.getElementById('view-a').shadowRoot.querySelectorAll('tbody tr'); rows.forEach((row) => row.setAttribute('aria-selected', 'false')); rows[1].setAttribute('aria-selected', 'true'); rows[2].setAttribute('aria-selected', 'true'); });
      box = await rowBox(page, 'view-a', 2); await page.mouse.click(box.x + 40, box.y + box.height / 2, {button: 'right'}); await sleep(300); now = await state(page);
      seen.selection = {targets: now.targets, last: now.log.at(-1)};
      check(`${tag} (A) a selected row acts on every selected row`, now.open && now.log.at(-1)?.targets === 2 && now.targets.join() === 'a1,a2', seen.selection);
      await escape(page);
      // (B) the menu in the table's own root, for="rows"
      box = await rowBox(page, 'view-b', 1); await page.mouse.click(box.x + 40, box.y + box.height / 2, {button: 'right'}); await sleep(300); now = await state(page);
      seen.ownRoot = {open: now.ownOpen, last: now.log.at(-1)};
      check(`${tag} (B) for="rows" is found in the menu's own root`, now.ownOpen && now.log.at(-1)?.menu === 'own' && now.log.at(-1)?.target === 'b1', seen.ownRoot);
      await escape(page); now = await state(page);
      check(`${tag} (B) Escape gives the focus back to the row`, !now.ownOpen && now.active === 'b1', {active: now.active});
      // (C) the document's own list, as before
      const before = (await state(page)).log.length;
      box = await page.locator('#files li').nth(1).boundingBox(); await page.mouse.click(box.x + 40, box.y + box.height / 2, {button: 'right'}); await sleep(300); now = await state(page);
      seen.document = {open: now.docOpen, log: now.log.slice(before)};
      check(`${tag} (C) the document's list opens its menu once`, now.docOpen && now.log.length === before + 1 && now.log.at(-1)?.menu === 'd' && now.log.at(-1)?.target === ROWS[1], seen.document);
      await escape(page); now = await state(page);
      check(`${tag} (C) Escape gives the focus back to the list row`, now.active === ROWS[1], {active: now.active});
      seen.console = consoleSaid.slice();
      check(`${tag} the console is clean`, consoleSaid.length === 0, {console: consoleSaid});
      evidence.push(seen);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 40), count: failures.length}, null, 1)); process.exit(1); }
console.log('CONTEXT_MENU_SHADOW_AREAS_OK');
