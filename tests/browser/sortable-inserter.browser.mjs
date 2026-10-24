#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-sortable's insertion point and its inserter (simai/ui-source#21): the "+"
// is reachable by keyboard and does not trap it, the inserter filters, chooses
// with arrows and Enter and closes on Escape as the innermost layer only, the
// choice reports the place it was opened for, the host creates the item -- and
// a list without inserter items, and dragging in one with them, are what they
// were. The "+" is measured against the ladder (rung 1/3).
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css',
  'component/component/icons/css/icons.css',
  'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/context-menu/css/context-menu.css',
  'smart/smart/sortable/css/sortable.css',
];
const modules = [
  'core/core/js/core.js',
  'smart/smart/sortable/js/sortable.js',
  'smart/smart/context-menu/js/context-menu.js',
];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const observations = {};
const errors = [];
const check = (value, name, details = null) => { if (!value) failures.push({name, details}); };

const ITEMS = [
  {type: 'heading', label: 'Содержимое'},
  {value: 'heading', label: 'Заголовок', icon: 'title'},
  {value: 'text', label: 'Текст', icon: 'notes', keywords: 'абзац'},
  {value: 'button', label: 'Кнопка', icon: 'smart_button', caption: 'Ссылка в виде кнопки'},
  {value: 'refused', label: 'Отказ', icon: 'block'},
];

const page_ = (width) => '<!doctype html><html lang="ru"><body style="margin:40px">'
  + '<button id="before" type="button">До</button>'
  + '<sf-sortable id="plain" group="plain" label="Обычный">'
  + ['А', 'Б', 'В'].map((text, at) => `<div data-sf-sortable-item="p${at}" style="height:40px;border:1px solid #888;margin:0 0 8px">`
    + `<span data-sf-sortable-handle>⠿</span> ${text}</div>`).join('')
  + '</sf-sortable>'
  + `<div id="panel" style="max-width:${width}px">`
  + `<sf-sortable id="list" group="rows" label="Письмо" inserter-items='${JSON.stringify(ITEMS)}'>`
  + ['Первая', 'Вторая', 'Третья', 'Четвёртая'].map((text, at) => `<div data-sf-sortable-item="r${at}" style="height:40px;border:1px solid #888;margin:0 0 8px">`
    + `<span data-sf-sortable-handle>⠿</span> ${text}</div>`).join('')
  + '</sf-sortable></div>'
  + '<button id="after" type="button">После</button>'
  + '</body></html>';

const browser = await chromium.launch();
try {
  for (const width of [800, 390]) {
    const page = await browser.newPage({viewport: {width: width === 390 ? 390 : 1000, height: 900}});
    page.on('pageerror', (error) => errors.push(error.message));
    // The loader asks its own base for what the page names; this probe serves
    // the assets it links and nothing else, so those requests are not defects.
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/u.test(message.text())) errors.push(message.text()); });
    const origin = 'http://probe.test';
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ru"><body></body></html>'});
      const path = join(out, url.pathname);
      if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
      return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
    });
    await page.goto(`${origin}/`);
    await page.setContent(page_(width === 390 ? 310 : 600));
    for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
    for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
    await page.waitForFunction(() => customElements.get('sf-sortable') && customElements.get('sf-context-menu'), null, {timeout: 8000});
    await page.evaluate(() => {
      window.intents = [];
      window.inserts = [];
      window.outerEscapes = 0;
      let next = 0;
      // A record panel around the list: it closes on Escape unless a surface
      // is open (the Framework's open-surface mark).
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !document.documentElement.dataset.sfPopoverOpen) window.outerEscapes += 1;
      }, true);
      document.addEventListener('sf-sortable-intent', (event) => window.intents.push(event.detail));
      document.addEventListener('sf-sortable-insert', (event) => {
        window.inserts.push({...event.detail, cancelable: event.cancelable});
        if (event.detail.item === 'refused') { event.preventDefault(); return; }
        const list = event.target;
        const items = [...list.querySelectorAll('[data-sf-sortable-item]')];
        const element = document.createElement('div');
        element.dataset.sfSortableItem = `n${next++}`;
        element.style.cssText = 'height:40px;border:1px solid #888;margin:0 0 8px';
        element.textContent = event.detail.item;
        if (items[event.detail.index]) items[event.detail.index].before(element);
        else if (items.length) items.at(-1).after(element);
        else list.prepend(element);
      });
    });
    await page.waitForTimeout(150);
    const tag = width === 390 ? 'narrow' : 'desktop';
    const order = (id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} [data-sf-sortable-item]`)].map((item) => item.dataset.sfSortableItem), id);
    const active = () => page.evaluate(() => {
      const element = document.activeElement;
      return element?.dataset?.sfSortableItem || element?.id || (element?.classList?.contains('sf-sortable-insert-button') ? 'insert' : element?.className || element?.tagName);
    });
    const insertState = () => page.evaluate(() => {
      const control = document.querySelector('#list .sf-sortable-insert');
      return control ? {index: Number(control.dataset.index), shown: control.hasAttribute('data-shown') || control.matches(':focus-within'),
        label: control.querySelector('button').getAttribute('aria-label')} : null;
    });
    const menuOpen = () => page.evaluate(() => [...document.querySelectorAll('sf-context-menu')].some((menu) => menu.isOpen));

    // 1. A list without inserter items is the list it was.
    const plain = await page.evaluate(() => ({
      control: document.querySelectorAll('#plain .sf-sortable-insert').length,
      marked: document.getElementById('plain').hasAttribute('data-sf-sortable-inserter'),
      position: getComputedStyle(document.getElementById('plain')).position,
      instructions: document.querySelector('#plain .sf-sortable-live[id]')?.textContent,
    }));
    check(plain.control === 0 && !plain.marked && plain.position === 'static', `${tag}: a list without inserter items draws no insertion point`, plain);
    check(!/Плюс/u.test(plain.instructions || ''), `${tag}: its row instructions are unchanged`, plain.instructions);
    const handle = page.locator('#plain [data-sf-sortable-item="p0"] [data-sf-sortable-handle]');
    const from = await handle.boundingBox();
    const target = await page.locator('#plain [data-sf-sortable-item="p2"]').boundingBox();
    await page.mouse.move(from.x + 4, from.y + 4);
    await page.mouse.down();
    await page.mouse.move(from.x + 4, from.y + 20, {steps: 3});
    await page.mouse.move(from.x + 4, target.y + target.height - 4, {steps: 8});
    await page.mouse.up();
    await page.waitForTimeout(100);
    let intents = await page.evaluate(() => window.intents);
    check(intents.at(-1)?.item === 'p0' && intents.at(-1)?.index === 2, `${tag}: drag reorder in a plain list`, intents.at(-1));

    // 2. Geometry: the "+" is the 1/3 rung, its glyph the 1/3 line, on the gap.
    await page.locator('#list [data-sf-sortable-item="r0"]').focus();
    const geometry = await page.evaluate(() => {
      const control = document.querySelector('#list .sf-sortable-insert');
      const button = control.querySelector('button');
      const glyph = button.querySelector('.sf-icon');
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;block-size:var(--sf-ui-1\\/3--control-height);inline-size:var(--sf-text-height-1\\/3)';
      document.body.append(probe);
      const rung = probe.getBoundingClientRect();
      probe.remove();
      const box = button.getBoundingClientRect();
      const icon = glyph.getBoundingClientRect();
      const r0 = document.querySelector('#list [data-sf-sortable-item="r0"]').getBoundingClientRect();
      const r1 = document.querySelector('#list [data-sf-sortable-item="r1"]').getBoundingClientRect();
      const list = document.getElementById('list').getBoundingClientRect();
      return {height: box.height, width: box.width, rung: rung.height, icon: icon.height, iconWidth: icon.width, line: rung.width,
        centerY: box.top + box.height / 2, gap: (r0.bottom + r1.top) / 2, centerX: box.left + box.width / 2, listCenter: list.left + list.width / 2,
        shown: control.hasAttribute('data-shown'), index: Number(control.dataset.index)};
    });
    observations[`${tag}-geometry`] = geometry;
    check(geometry.shown && geometry.index === 1, `${tag}: a focused row shows the place after it`, geometry);
    check(Math.abs(geometry.height - geometry.rung) < 0.01 && Math.abs(geometry.width - geometry.rung) < 0.01, `${tag}: the "+" is the 1/3 control height, square`, geometry);
    check(Math.abs(geometry.icon - geometry.line) < 0.01 && Math.abs(geometry.iconWidth - geometry.line) < 0.01, `${tag}: its glyph is the 1/3 text line`, geometry);
    check(Math.abs(geometry.centerY - geometry.gap) < 0.51 && Math.abs(geometry.centerX - geometry.listCenter) < 0.51, `${tag}: the "+" stands on the middle of the gap`, geometry);
    const colour = await page.evaluate(() => {
      const glyph = document.querySelector('#list .sf-sortable-insert .sf-icon');
      const probe = document.createElement('i');
      probe.style.color = 'var(--sf-on-surface)';
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return {actual: getComputedStyle(glyph).color, expected};
    });
    check(colour.actual === colour.expected, `${tag}: the glyph takes the on-surface role`, colour);

    // 3. Keyboard: the point is the list's last tab stop and traps nothing.
    await page.locator('#list [data-sf-sortable-item="r3"]').focus();
    await page.keyboard.press('Tab');
    let state = await insertState();
    check(await active() === 'insert' && state.shown && state.index === 4, `${tag}: Tab from the last row reaches the insertion point, after the last row`, {active: await active(), state});
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    state = await insertState();
    check(state.index === 2 && /позиция 3 из 5/u.test(state.label), `${tag}: arrows walk the places and the point says which`, state);
    await page.keyboard.press('Home');
    state = await insertState();
    check(state.index === 0, `${tag}: Home is the place before the first`, state);
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Tab');
    check(await active() === 'r3', `${tag}: Shift+Tab returns to the last row`, await active());
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    check(await active() === 'after', `${tag}: Tab from the point leaves the list`, await active());

    // 4. Open from the point, filter, choose with arrows and Enter.
    await page.locator('#list .sf-sortable-insert-button').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.classList?.contains('sf-context-menu-search-input'), null, {timeout: 4000}).catch(() => {});
    check(await menuOpen(), `${tag}: Enter on the point opens the inserter, the search focused`, await active());
    await page.keyboard.type('кноп');
    await page.waitForTimeout(80);
    const filtered = await page.evaluate(() => [...document.querySelectorAll('sf-context-menu .sf-context-menu-item')].filter((row) => row.getClientRects().length).map((row) => row.querySelector('.sf-context-menu-item-label')?.textContent.trim()));
    check(JSON.stringify(filtered) === '["Кнопка"]', `${tag}: typing filters the kinds locally`, filtered);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    let inserts = await page.evaluate(() => window.inserts);
    check(JSON.stringify(inserts.at(-1)) === JSON.stringify({index: 0, item: 'button', to: 'list', cancelable: true}), `${tag}: the choice reports the place it was opened for`, inserts.at(-1));
    check(JSON.stringify(await order('list')) === '["n0","r0","r1","r2","r3"]', `${tag}: the host created the item at that index`, await order('list'));
    check(!(await menuOpen()) && await active() === 'insert', `${tag}: the inserter closes and focus returns to the point`, await active());
    state = await insertState();
    check(state.index === 1, `${tag}: the next insert goes after the one just made`, state);

    // Enter in the search takes the first row left.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.classList?.contains('sf-context-menu-search-input'), null, {timeout: 4000}).catch(() => {});
    await page.keyboard.type('абзац');
    await page.waitForTimeout(80);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    inserts = await page.evaluate(() => window.inserts);
    check(inserts.at(-1)?.item === 'text' && inserts.at(-1)?.index === 1, `${tag}: Enter in the search chooses the first match`, inserts.at(-1));

    // A refusal keeps the inserter open.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.classList?.contains('sf-context-menu-search-input'), null, {timeout: 4000}).catch(() => {});
    await page.keyboard.type('отказ');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const refusedOrder = await order('list');
    check(await menuOpen() && refusedOrder.length === 6, `${tag}: a cancelled insert leaves the inserter open and the list as it was`, refusedOrder);

    // 5. Escape closes the inserter only: the panel around stays.
    const outerBefore = await page.evaluate(() => window.outerEscapes);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    check(!(await menuOpen()) && await page.evaluate(() => window.outerEscapes) === outerBefore, `${tag}: Escape closes the inserter and nothing behind it`, {outer: await page.evaluate(() => window.outerEscapes)});
    check(await active() === 'insert', `${tag}: and returns focus to the point`, await active());

    // 6. "+" on a focused row opens the inserter for the place after it.
    await page.locator('#list [data-sf-sortable-item="r1"]').focus();
    await page.keyboard.press('+');
    await page.waitForFunction(() => document.activeElement?.classList?.contains('sf-context-menu-search-input'), null, {timeout: 4000}).catch(() => {});
    check(await menuOpen(), `${tag}: + on a row opens the inserter`, await active());
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    inserts = await page.evaluate(() => window.inserts);
    const rowOrder = await order('list');
    check(inserts.at(-1)?.item === 'heading' && rowOrder[inserts.at(-1).index - 1] === 'r1', `${tag}: + inserts after the row it was pressed on`, {insert: inserts.at(-1), rowOrder});
    check(await active() === 'r1', `${tag}: focus returns to the row`, await active());
    const instructions = await page.evaluate(() => document.querySelector('#list .sf-sortable-live[id]')?.textContent);
    check(/Плюс — вставить после/u.test(instructions), `${tag}: the row instructions name the + key`, instructions);

    // 7. Pointer: hover near a gap shows the point there; a click opens it.
    await page.locator('#before').focus();
    const r2 = await page.locator('#list [data-sf-sortable-item="r2"]').boundingBox();
    await page.mouse.move(r2.x + 20, r2.y + 40);
    await page.mouse.move(r2.x + 20, r2.y + 30);
    await page.mouse.move(r2.x + 20, r2.y - 4, {steps: 3});
    state = await insertState();
    const r2Index = (await order('list')).indexOf('r2');
    check(state.shown && state.index === r2Index, `${tag}: the pointer near a gap shows the point there`, {state, r2Index});
    await page.mouse.move(r2.x + 20, r2.y + 20, {steps: 2});
    state = await insertState();
    check(!state.shown, `${tag}: the middle of a row shows nothing`, state);
    await page.mouse.move(r2.x + 20, r2.y - 4, {steps: 2});
    const plus = await page.locator('#list .sf-sortable-insert-button').boundingBox();
    await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2, {steps: 2});
    await page.mouse.click(plus.x + plus.width / 2, plus.y + plus.height / 2);
    await page.waitForTimeout(250);
    check(await menuOpen(), `${tag}: a click on the point opens the inserter`, null);
    await page.locator('sf-context-menu .sf-context-menu-item', {hasText: 'Заголовок'}).first().click();
    await page.waitForTimeout(150);
    inserts = await page.evaluate(() => window.inserts);
    check(inserts.at(-1)?.index === r2Index && inserts.at(-1)?.item === 'heading', `${tag}: a pointer choice inserts at the hovered gap`, inserts.at(-1));

    // 8. Dragging in a list with an inserter is undisturbed; the point is gone meanwhile.
    const listOrder = await order('list');
    const first = page.locator(`#list [data-sf-sortable-item="${listOrder[0]}"] [data-sf-sortable-handle]`);
    const dragFrom = (await first.count()) ? await first.boundingBox() : await page.locator(`#list [data-sf-sortable-item="${listOrder[0]}"]`).boundingBox();
    const dragTo = await page.locator(`#list [data-sf-sortable-item="${listOrder[2]}"]`).boundingBox();
    await page.mouse.move(dragFrom.x + 4, dragFrom.y + 4);
    await page.mouse.down();
    await page.mouse.move(dragFrom.x + 4, dragFrom.y + 20, {steps: 3});
    await page.mouse.move(dragFrom.x + 4, dragTo.y + dragTo.height - 4, {steps: 8});
    const during = await page.evaluate(() => getComputedStyle(document.querySelector('#list .sf-sortable-insert')).display);
    await page.mouse.up();
    await page.waitForTimeout(150);
    intents = await page.evaluate(() => window.intents);
    check(during === 'none', `${tag}: the point is hidden while dragging`, during);
    check(intents.at(-1)?.item === listOrder[0] && intents.at(-1)?.to === 'list' && intents.at(-1)?.index === 2, `${tag}: drag reorder in a list with an inserter`, intents.at(-1));

    // 9. A host redraw that appends items after the point puts it back last.
    await page.evaluate(() => {
      const list = document.getElementById('list');
      const items = [...list.querySelectorAll('[data-sf-sortable-item]')];
      for (const item of items) item.remove();
      list.append(...items.reverse());
    });
    await page.waitForTimeout(80);
    const last = await page.evaluate(() => {
      const list = document.getElementById('list');
      const control = list.querySelector('.sf-sortable-insert');
      const items = [...list.querySelectorAll('[data-sf-sortable-item]')];
      return Boolean(control) && Boolean(control.compareDocumentPosition(items.at(-1)) & Node.DOCUMENT_POSITION_PRECEDING);
    });
    check(last, `${tag}: after a host redraw the point is still after the last item`, last);

    // 10. Turning the inserter off removes it; on again brings it back.
    const toggled = await page.evaluate(() => {
      const list = document.getElementById('list');
      list.inserterItems = [];
      const off = list.querySelectorAll('.sf-sortable-insert').length;
      list.inserterItems = [{value: 'x', label: 'X'}];
      const on = list.querySelectorAll('.sf-sortable-insert').length;
      return {off, on};
    });
    check(toggled.off === 0 && toggled.on === 1, `${tag}: the inserterItems property turns it off and on`, toggled);

    const overflow = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, viewport: innerWidth}));
    check(overflow.scroll <= overflow.viewport, `${tag}: nothing overflows`, overflow);
    await page.close();
  }
} finally {
  await browser.close();
}

const result = {status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== 'passed') process.exitCode = 1;
