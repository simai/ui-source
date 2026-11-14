#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The menu of an object (owner decision C164, 2026-11-14), measured on the
// built bytes. A list of four rows bound by `for`, each with its «⋯»:
//   (1) the right button opens the menu with its corner exactly at the pointer
//       and keeps the browser's menu away; the menu key and Shift+F10 open it
//       under the row's start; a link and Shift keep the browser's menu; RTL
//       puts the menu's start corner (its right edge) at the pointer; Escape
//       gives the focus back to the row;
//   (2) «⋯» shows the same list as the right button;
//   (3) on a selected row it acts on every selected row («Выбрано 2»), on an
//       unselected row it selects that row alone first;
//   (4) a disabled row is in the arrows' walk, aria-disabled, and Enter on it
//       chooses nothing;
//   (5) «Удалить», given second, is drawn last after a line, in the error ink;
//   (6) on a 390 touch phone a long press opens the sheet at the bottom, the
//       screen's width, rows at least 44; a short tap and a moved finger open
//       nothing; «⋯» opens the same sheet.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/context-menu/css/context-menu.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button-icon/js/button-icon.js',
  'smart/smart/menu-context/js/menu-context.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const ROWS = ['Отчёт за ноябрь.pdf', 'Договор поставки.docx', 'Смета 2027.xlsx', 'Фото склада.jpg'];

async function open(browser, options, dir = 'ltr') {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  await page.setContent(`<!doctype html><html class="theme-light" lang="ru" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:16px">
    <ul id="files" role="listbox" aria-label="Файлы" aria-multiselectable="true" style="list-style:none;margin:0;padding:0;max-inline-size:600px">
      ${ROWS.map((name, at) => `<li role="option" tabindex="${at ? -1 : 0}" aria-selected="false" data-name="${name}" style="display:flex;align-items:center;block-size:40px;padding-inline:8px"><span style="flex:1">${at ? name : `<a href="#x">${name}</a>`}</span><sf-button-icon class="more" icon="more_horiz" appearance="ghost" aria-label="Ещё: ${name}"></sf-button-icon></li>`).join('')}
    </ul>
    <sf-menu-context id="m" popup for="files" aria-label="Действия с файлом"></sf-menu-context>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-menu-context'));
  await page.evaluate(() => {
    const menu = document.getElementById('m');
    window.__log = []; window.__ctx = [];
    addEventListener('contextmenu', (event) => window.__ctx.push(event.defaultPrevented));
    menu.addEventListener('sf-menu-context-open', (event) => {
      const {targets} = event.detail;
      window.__log.push({open: targets.length});
      menu.entries = targets.length > 1
        ? [{id: 'copy', text: 'Копировать', icon: 'content_copy'}, {id: 'delete', text: 'Удалить', icon: 'delete', danger: true}, {id: 'zip', text: 'Скачать архивом', icon: 'folder_zip'}]
        : [{type: 'heading', text: targets[0]?.dataset.name ?? ''}, {id: 'open', text: 'Открыть', icon: 'open_in_new'},
          {id: 'delete', text: 'Удалить', icon: 'delete', danger: true}, {id: 'rename', text: 'Переименовать', icon: 'edit'},
          {id: 'paste', text: 'Вставить', icon: 'content_paste', disabled: true, caption: 'Буфер обмена пуст'}, {id: 'share', text: 'Поделиться', icon: 'share'}];
    });
    menu.addEventListener('sf-menu-context-select', (event) => window.__log.push({select: event.detail.id}));
    document.getElementById('files').addEventListener('click', (event) => {
      const more = event.target.closest('.more');
      if (more) menu.toggleFor(more.querySelector('button') ?? more);
    });
  });
  await sleep(200);
  return {context, page};
}

const state = (page) => page.evaluate(() => {
  const menu = document.getElementById('m'); const surface = menu.querySelector(':scope > .sf-context-menu');
  const content = surface?.querySelector('.sf-context-menu-content'); const box = content?.getBoundingClientRect();
  const parts = content ? [...content.querySelectorAll('.sf-context-menu-item, .sf-context-menu-separator, .sf-context-menu-heading')] : [];
  return {
    open: menu.isOpen, sheet: surface?.hasAttribute('data-sf-sheet') ?? false,
    box: box && {left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), width: Math.round(box.width)},
    parts: parts.map((node) => ({kind: node.classList.contains('sf-context-menu-separator') ? 'line' : node.classList.contains('sf-context-menu-heading') ? 'heading' : 'row',
      text: (node.querySelector('.sf-context-menu-item-label')?.textContent ?? node.textContent).trim(), disabled: node.getAttribute('aria-disabled'),
      color: getComputedStyle(node).color, height: node.getBoundingClientRect().height})),
    active: document.activeElement?.dataset?.name ?? document.activeElement?.localName,
    selected: [...document.querySelectorAll('#files li')].map((row) => (row.getAttribute('aria-selected') === 'true' ? 1 : 0)).join(''),
    prevented: window.__ctx.at(-1) ?? null, log: window.__log.slice(),
  };
});
const ink = (page, token) => page.evaluate((token) => { const node = document.createElement('i'); node.style.color = `var(${token})`; document.body.append(node); const color = getComputedStyle(node).color; node.remove(); return color; }, token);
const row = (page, at) => page.locator('#files li').nth(at).boundingBox();
const escape = async (page) => { await page.keyboard.press('Escape'); await sleep(200); };

const browser = await chromium.launch();
try {
  {
    const {context, page} = await open(browser, {viewport: {width: 1440, height: 900}});
    // (1) the right button at a point of row 2
    let box = await row(page, 1); const point = {x: Math.round(box.x + 200), y: Math.round(box.y + box.height / 2)};
    await page.mouse.click(point.x, point.y, {button: 'right'}); await sleep(300);
    let now = await state(page);
    const right = now.parts.map((part) => part.text);
    evidence.right = {point, corner: now.box && {x: now.box.left, y: now.box.top}};
    check('(1) the right button opens the menu', now.open);
    check('(1) the browser menu is kept away', now.prevented === true);
    check('(1) the corner is at the pointer', now.box?.left === point.x && now.box?.top === point.y, evidence.right);
    await escape(page); now = await state(page);
    check('(1) Escape gives the focus back to the row', now.active === ROWS[1], {active: now.active});
    // (2) «⋯» of the same row: the same list
    await page.locator('#files li').nth(1).locator('.more').click(); await sleep(300); now = await state(page);
    check('(2) «⋯» shows the same list', JSON.stringify(now.parts.map((part) => part.text)) === JSON.stringify(right), {right, more: now.parts.map((part) => part.text)});
    // (4) the arrows walk through the disabled row; Enter on it chooses nothing
    const walk = [];
    for (let step = 0; step < 6; step++) { walk.push(await page.evaluate(() => document.activeElement.querySelector?.('.sf-context-menu-item-label')?.textContent.trim() ?? '')); await page.keyboard.press('ArrowDown'); }
    evidence.walk = walk;
    check('(4) the disabled row is in the walk', walk.includes('Вставить'), {walk});
    for (let step = 0; step < 8 && await page.evaluate(() => document.activeElement.querySelector?.('.sf-context-menu-item-label')?.textContent.trim()) !== 'Вставить'; step++) await page.keyboard.press('ArrowDown');
    const before = (await state(page)).log.length;
    await page.keyboard.press('Enter'); await sleep(200); now = await state(page);
    check('(4) Enter on a disabled row chooses nothing and keeps the menu', now.log.length === before && now.open, {log: now.log});
    const dimmed = now.parts.find((part) => part.text === 'Вставить');
    check('(4) the disabled row is aria-disabled in the disabled ink', dimmed?.disabled === 'true' && dimmed?.color === await ink(page, '--sf-on-surface-disabled'), dimmed);
    // (5) «Удалить» last after a line
    const last = now.parts.at(-1), line = now.parts.at(-2);
    evidence.order = now.parts.map((part) => (part.kind === 'line' ? '—' : part.text));
    check('(5) «Удалить» is last, after a line, in the error ink', last?.text === 'Удалить' && line?.kind === 'line' && last?.color === await ink(page, '--sf-error'), {order: evidence.order});
    await escape(page);
    // (1) the menu key and Shift+F10 under the row's start
    await page.focus('#files li:nth-child(3)'); await page.keyboard.press('ContextMenu'); await sleep(300); now = await state(page); box = await row(page, 2);
    check('(1) the menu key opens it under the row\'s start', now.open && now.box?.left === Math.round(box.x) && now.box?.top === Math.round(box.y + box.height), {box: now.box, row: box});
    await escape(page);
    await page.focus('#files li:nth-child(3)'); await page.keyboard.press('Shift+F10'); await sleep(300); now = await state(page);
    check('(1) Shift+F10 opens it', now.open); await escape(page);
    // (1) a link and Shift keep the browser's menu
    const link = await page.locator('#files a').boundingBox();
    await page.mouse.click(link.x + 4, link.y + 4, {button: 'right'}); await sleep(200); now = await state(page);
    check('(1) a link keeps the browser menu', !now.open && now.prevented === false);
    await page.keyboard.down('Shift'); await page.mouse.click(point.x, point.y, {button: 'right'}); await page.keyboard.up('Shift'); await sleep(200); now = await state(page);
    check('(1) Shift keeps the browser menu', !now.open && now.prevented === false);
    // (3) a selection
    await page.evaluate(() => { const rows = document.querySelectorAll('#files li'); rows[1].setAttribute('aria-selected', 'true'); rows[2].setAttribute('aria-selected', 'true'); });
    box = await row(page, 2); await page.mouse.click(box.x + 200, box.y + box.height / 2, {button: 'right'}); await sleep(300); now = await state(page);
    evidence.selection = {first: now.parts[0]?.text, selected: now.selected, opened: now.log.at(-1)};
    check('(3) a selected row: «Выбрано 2» on every selected row', now.parts[0]?.kind === 'heading' && now.parts[0]?.text === 'Выбрано 2' && now.log.at(-1)?.open === 2 && now.selected === '0110', evidence.selection);
    check('(5) on a selection too «Удалить» is last after a line', now.parts.at(-1)?.text === 'Удалить' && now.parts.at(-2)?.kind === 'line', {order: now.parts.map((part) => part.text)});
    await escape(page);
    box = await row(page, 3); await page.mouse.click(box.x + 200, box.y + box.height / 2, {button: 'right'}); await sleep(300); now = await state(page);
    check('(3) an unselected row is selected alone first', now.selected === '0001' && now.parts[0]?.text === ROWS[3], {selected: now.selected, first: now.parts[0]});
    await escape(page);
    await context.close();
  }
  {
    // (1) RTL: the menu's start corner (its right edge) at the pointer
    const {context, page} = await open(browser, {viewport: {width: 1440, height: 900}}, 'rtl');
    const box = await row(page, 1); const point = {x: Math.round(box.x + box.width - 200), y: Math.round(box.y + box.height / 2)};
    await page.mouse.click(point.x, point.y, {button: 'right'}); await sleep(300); const now = await state(page);
    check('(1) RTL: the start corner at the pointer', now.open && now.box?.right === point.x && now.box?.top === point.y, {point, box: now.box});
    await context.close();
  }
  {
    // (6) a touch phone
    const {context, page} = await open(browser, {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    const cdp = await context.newCDPSession(page);
    const box = await row(page, 1); const at = {x: Math.round(box.x + 100), y: Math.round(box.y + box.height / 2)};
    const touch = async (moves, hold) => {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [at]});
      for (const move of moves) { await sleep(80); await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [move]}); }
      await sleep(hold);
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await sleep(400);
    };
    await touch([], 120); check('(6) a short tap opens nothing', !(await state(page)).open);
    await touch([{x: at.x, y: at.y + 30}], 600); check('(6) a moved finger opens nothing', !(await state(page)).open);
    await touch([], 700); let now = await state(page);
    const first = now.parts.find((part) => part.kind === 'row');
    evidence.sheet = {box: now.box, first};
    check('(6) a long press opens the sheet at the bottom, the screen\'s width', now.open && now.sheet && now.box?.width === 390 && now.box?.bottom === 844, evidence.sheet);
    check('(6) the sheet\'s rows are at least 44', first && first.height >= 44, first);
    check('(6) the sheet is headed by the object', now.parts[0]?.kind === 'heading' && now.parts[0]?.text === ROWS[1]);
    await page.evaluate(() => document.getElementById('m').close()); await sleep(200);
    await page.locator('#files li').nth(2).locator('.more').click(); await sleep(400); now = await state(page);
    check('(6) «⋯» on a phone opens the same sheet', now.open && now.sheet);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('CONTEXT_MENU_OBJECT_OK');
