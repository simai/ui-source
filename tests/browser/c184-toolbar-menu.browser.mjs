#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright; C184_BROWSER=webkit|firefox another engine.)
//
// Owner decision C184 on the built bytes, loaded by the real Loader from its rule:
// - (1)-(3) sf-input-rich's toolbar through core's roving helper: one Tab stop,
//   End reaches the unavailable «Повторить» (dimmed, focusable, its reason as
//   title and description), ← from the first tool wraps to the last, Tab goes
//   to the text and Shift+Tab comes back to the tool left; in a right-to-left
//   page ← moves forward; sf-editor-inline's toolbar is one Tab stop too.
//   Since sf-input-rich 1.6.0 (owner decision C155) the text levels are one
//   menu button «Абзац ▾» first in the row and what does not fit leaves for ⋯,
//   so the row is levels, bold, italic, link, the lists, quote, undo, redo
//   (and ⋯ while something is out); the page waits until the element has laid
//   the row out;
// - (4) SF.menu.open: two lists share the page's one menu; it opens at a point
//   with its corner there and answers the row chosen;
//   sf-editor-overlay's action toolbar is one Tab stop, Home and End reach its ends;
// - (5) a list is one Tab stop; Shift+F10 and the menu key open the same menu
//   as «⋯», Escape and a choice put the focus back on the row.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = playwright[process.env.C184_BROWSER || 'chromium'];

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// A Russian page includes core/lang/ru.js before core, as a site does (owner
// decision C282: English is built in, Russian is a language file); the checks
// read the Russian words («Нечего повторять», «Действия: …») at once.
if (!existsSync(join(parts.core, 'lang', 'ru.js'))) throw new Error(`core/lang/ru.js not found under ${out}`);
const shell = (dir) => `<!doctype html><html lang="ru" dir="${dir}" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:16px">
<button id="before" type="button">до</button>
<sf-input-rich id="rich" label="Описание" value="&lt;p&gt;Текст&lt;/p&gt;"></sf-input-rich>
<button id="between" type="button">между</button>
<sf-list id="a" label="Письма"></sf-list>
<sf-list id="b" label="Шаблоны"></sf-list>
<p id="p1" data-sf-composition-id="p1">Текст <strong>абзаца</strong>.</p>
<sf-editor-inline id="ie"></sf-editor-inline>
<div id="canvas"><section data-sf-composition-id="root"><p data-sf-composition-id="p">Один</p><p data-sf-composition-id="q">Два</p></section></div>
<sf-editor-overlay id="ov" for="canvas"></sf-editor-overlay>
</body></html>`;

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const errors = [];

async function open(page, dir) {
  current = shell(dir);
  await page.goto(`${base}/probe`, {waitUntil: 'load'});
  await page.waitForFunction(() => customElements.get('sf-input-rich') && customElements.get('sf-list')
    && document.querySelector('#rich .sf-rich-text-toolbar[data-sf-row-laid] button[data-sf-tool="levels"]'), null, {timeout: 20000});
  await page.evaluate(() => {
    const actions = [{id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'delete', text: 'Удалить', icon: 'delete', destructive: true}];
    const a = document.getElementById('a');
    a.actions = actions;
    a.items = [{id: 'l1', text: 'Первое'}, {id: 'l2', text: 'Второе'}, {id: 'l3', text: 'Третье'}];
    const b = document.getElementById('b');
    b.actions = actions.slice(0, 1);
    b.items = [{id: 't1', text: 'Шаблон'}];
    window.applied = [];
    for (const list of [a, b]) list.addEventListener('sf-list-apply', (event) => window.applied.push({list: list.id, ...event.detail}));
  });
  await page.waitForFunction(() => document.querySelectorAll('#a .sf-list__row').length === 3 && document.querySelectorAll('#b .sf-list__row').length === 1);
  await page.waitForTimeout(300);
}

const focus = (page) => page.evaluate(() => {
  const element = document.activeElement;
  return {tool: element?.dataset?.sfTool ?? null, row: element?.closest?.('.sf-list__row')?.dataset.id ?? null,
    list: element?.closest?.('sf-list')?.id ?? null, editor: element?.classList?.contains('sf-rich-text-editor') ?? false,
    inMenu: Boolean(element?.closest?.('sf-menu-context')), title: element?.getAttribute?.('title') ?? null,
    description: element?.getAttribute?.('aria-description') ?? null, disabled: element?.getAttribute?.('aria-disabled') ?? null};
});
const menu = (page) => page.evaluate(() => {
  const menus = [...document.querySelectorAll('sf-menu-context')];
  const open = menus.find((one) => one.isOpen);
  return {count: menus.length, open: Boolean(open), shared: Boolean(open?.hasAttribute('data-sf-menu-shared')), label: open?.getAttribute('aria-label') ?? null,
    entries: (open?.entries ?? []).map((entry) => entry.id)};
});

const browser = await engine.launch();
try {
  const page = await browser.newPage({viewport: {width: 1000, height: 900}});
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, 'ltr');

  // (1)-(3) the rich text toolbar.
  const row = await page.evaluate(() => {
    const tools = [...document.querySelectorAll('#rich button.sf-rich-text-tool')];
    return {stops: tools.filter((b) => b.tabIndex >= 0).length,
      shown: tools.filter((b) => !b.closest('.sf-rich-text-out') && !b.classList.contains('sf-rich-text-out')).map((b) => b.dataset.sfTool)};
  });
  check('the toolbar is one Tab stop', row.stops === 1, {got: row});
  check('the row shows every tool at this width, the levels first', row.shown.join() === 'levels,bold,italic,link,bulleted-list,numbered-list,quote,undo,redo', {got: row});
  await page.focus('#before');
  await page.keyboard.press('Tab');
  check('Tab enters on the first tool', (await focus(page)).tool === 'levels', {got: await focus(page)});
  await page.keyboard.press('End');
  const end = await focus(page);
  check('End reaches the unavailable «Повторить», with its reason', end.tool === 'redo' && end.disabled === 'true' && end.title === 'Нечего повторять' && end.description === 'Нечего повторять', {got: end});
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowLeft');
  check('← from the first tool wraps to the last', (await focus(page)).tool === 'redo', {got: await focus(page)});
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  check('Tab goes to the text', (await focus(page)).editor, {got: await focus(page)});
  await page.keyboard.press('Shift+Tab');
  check('Shift+Tab comes back to the tool left', (await focus(page)).tool === 'italic', {got: await focus(page)});

  // (5) a list: one Tab stop; Shift+F10, Escape; the menu key; «⋯» and a choice.
  await page.focus('#between');
  await page.keyboard.press('Tab');
  check('Tab enters the list on its first row', (await focus(page)).row === 'l1', {got: await focus(page)});
  await page.keyboard.press('ArrowDown');
  check('↓ moves to the next row', (await focus(page)).row === 'l2', {got: await focus(page)});
  await page.keyboard.press('Shift+F10');
  await page.waitForTimeout(400);
  const shift = await menu(page);
  check('Shift+F10 opens the page\'s one menu with the row\'s actions', shift.open && shift.shared && shift.count === 1 && shift.entries.join() === 'action:copy,action:delete' && shift.label === 'Действия: Второе', {got: shift});
  check('the focus is in the menu', (await focus(page)).inMenu, {got: await focus(page)});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape puts the focus back on the row', (await focus(page)).row === 'l2' && !(await menu(page)).open, {got: await focus(page)});
  await page.keyboard.press('ContextMenu');
  await page.waitForTimeout(400);
  const key = await menu(page);
  check('the menu key opens the same menu', key.open && key.entries.join() === 'action:copy,action:delete', {got: key});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.click('#b .sf-list__row[data-id="t1"] .sf-list__actions');
  await page.waitForTimeout(400);
  const dots = await menu(page);
  check('«⋯» of the second list opens the same one menu', dots.open && dots.count === 1 && dots.entries.join() === 'action:copy', {got: dots});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const applied = await page.evaluate(() => window.applied);
  check('a choice says apply for its row', applied.length === 1 && applied[0].list === 'b' && applied[0].ids.join() === 't1' && applied[0].action === 'copy', {got: applied});
  check('after a choice the focus is on the row', (await focus(page)).row === 't1', {got: await focus(page)});

  // (4) SF.menu.open at a point.
  const point = await page.evaluate(async () => {
    const answer = SF.menu.open({x: 120, y: 240, entries: [{id: 'one', text: 'Первое'}, {id: 'two', text: 'Второе'}], label: 'Точка'});
    await new Promise((done) => setTimeout(done, 400));
    const shared = document.querySelector('[data-sf-menu-shared]');
    const rect = shared.querySelector('.sf-context-menu').getBoundingClientRect();
    [...shared.querySelectorAll('[role="menuitem"]')][1].click();
    const choice = await answer;
    return {x: Math.round(rect.left), y: Math.round(rect.top), label: shared.getAttribute('aria-label'), id: choice?.id ?? null, menus: document.querySelectorAll('sf-menu-context').length};
  });
  check('SF.menu.open at a point: the corner there, the row chosen answered', point.x === 120 && point.y === 240 && point.label === 'Точка' && point.id === 'two' && point.menus === 1, {got: point});

  // sf-editor-inline's toolbar is one Tab stop.
  const inline = await page.evaluate(async () => {
    await customElements.whenDefined('sf-editor-inline');
    await document.getElementById('ie').edit(document.getElementById('p1'), {nodeId: 'p1', label: 'Абзац'});
    await new Promise((done) => setTimeout(done, 200));
    // The buttons stand in groups (C141 (4), C172); ⋯ at the row's end is
    // .sf-inline-editor-out (display: none, out of the walk) while every group
    // fits, so it is no Tab stop. The row itself shows on a selection.
    const buttons = [...document.querySelectorAll('.sf-inline-editor-toolbar button')].filter((b) => !b.closest('.sf-inline-editor-out'));
    return {buttons: buttons.length, stops: buttons.filter((b) => b.tabIndex >= 0).length};
  });
  check('sf-editor-inline: the toolbar is one Tab stop', inline.buttons > 1 && inline.stops === 1, {got: inline});

  // sf-editor-overlay's action toolbar: one Tab stop, Home and End.
  const overlay = await page.evaluate(async () => {
    await customElements.whenDefined('sf-editor-overlay');
    const o = document.getElementById('ov');
    o.setDocument({schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout', root: {id: 'root', type: 'layout.section', slots: {default: [{id: 'p', type: 'content.paragraph'}, {id: 'q', type: 'content.paragraph'}]}}}, {describe: (node) => ({label: node.id})});
    o.actions = [{id: 'up', label: 'Выше', icon: 'arrow_upward'}, {id: 'down', label: 'Ниже', icon: 'arrow_downward'}, {id: 'remove', label: 'Удалить', icon: 'delete'}];
    o.select('p');
    await new Promise((done) => setTimeout(done, 800));
    const buttons = [...o.querySelectorAll('.sf-composition-overlay-toolbar button[data-action]')];
    buttons.find((b) => b.tabIndex >= 0)?.focus();
    return {buttons: buttons.length, stops: buttons.filter((b) => b.tabIndex >= 0).length, hidden: o.querySelector('.sf-composition-overlay-toolbar').hidden};
  });
  check('sf-editor-overlay: the action toolbar is one Tab stop', overlay.buttons === 3 && overlay.stops === 1 && !overlay.hidden, {got: overlay});
  const action = () => page.evaluate(() => document.activeElement?.dataset?.action ?? null);
  await page.keyboard.press('End');
  const last = await action();
  await page.keyboard.press('Home');
  const first = await action();
  check('sf-editor-overlay: End and Home reach the ends', last === 'remove' && first === 'up', {got: {last, first}});

  // Right to left: ← moves forward.
  await open(page, 'rtl');
  await page.focus('#before');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowLeft');
  check('right to left: ← moves to the next tool', (await focus(page)).tool === 'bold', {got: await focus(page)});

  check('no page errors', errors.length === 0, {got: errors});
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('C184_OK');
