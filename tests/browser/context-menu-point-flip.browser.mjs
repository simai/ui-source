#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-menu-context opened at the pointer (owner decision C164 (1), research
// control/research/2026-11-14-context-menu.md: "at the bottom edge it flips
// up, at the right edge it flips left"). A real right click on a row that
// fills the window, near each edge and corner, at 1440 and 390, LTR and RTL:
//  - the menu's corner is on the pointer: its start corner where it fits,
//    the other side of the pointer where it does not (left of it at the right
//    edge, right of it at the left edge in RTL, above it at the bottom edge);
//  - the menu is on screen and the page has no horizontal scroll;
//  - the focus is in the menu, and Escape gives it back to the row;
//  - a menu too wide for either side of the pointer stands --sf-space-1/2
//    (12px at 1440, 8px at 390: adaptive) from the window's edge;
//  - a menu opened at an element (the menu key, Shift+F10, a button) keeps its
//    placement: below the element, not flipped across it.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/context-menu/css/context-menu.css',
].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/menu-context/js/menu-context.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const VIEWS = [{width: 1440, height: 900}, {width: 390, height: 844}];
// Not the window padding (--sf-space-1/2: 12 at 1440, 8 at 390): a shift to
// the padding would land on the pointer by chance.
const EDGE = 30;
const failures = [];
const browser = await chromium.launch();

async function open(view, dir) {
  const context = await browser.newContext({viewport: view, deviceScaleFactor: 1});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => { if (!/Automatic publicPath/u.test(String(error))) errors.push(String(error)); });
  page.on('console', (message) => { if (message.type() === 'error' && !/Automatic publicPath/u.test(message.text())) errors.push(message.text()); });
  await page.setContent(
    `<!doctype html><html class="theme-light" lang="ru" dir="${dir}"><head><meta charset="utf-8"></head><body style="margin:0">`
    + '<div id="row" tabindex="0" style="position:fixed;inset:0">Строка</div>'
    + '<button id="keys" type="button" style="position:fixed;inset-inline-end:4px;top:200px">Действия</button>'
    + '<sf-menu-context id="menu" popup aria-label="Действия"></sf-menu-context></body></html>',
  );
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-menu-context'));
  await page.evaluate(() => {
    const menu = document.getElementById('menu');
    menu.entries = [
      {id: 'open', text: 'Открыть', icon: 'open_in_new'}, {id: 'rename', text: 'Переименовать', shortcut: 'f2'},
      {id: 'copy', text: 'Копировать ссылку'}, {id: 'move', text: 'Переместить в папку'},
      {type: 'separator'}, {id: 'delete', text: 'Удалить', icon: 'delete', danger: true},
    ];
    document.getElementById('row').addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const point = document.createElement('span');
      point.style.cssText = `position: fixed; left: ${event.clientX}px; top: ${event.clientY}px`;
      document.body.append(point);
      menu.addEventListener('sf-menu-context-closed', () => point.remove(), {once: true});
      menu.openFor(point, window.menuWidth ? {width: window.menuWidth} : {});
    });
  });
  return {context, page, errors};
}

const measure = (page) => page.evaluate(() => {
  const surface = document.querySelector('#menu > .sf-context-menu');
  const rect = surface.getBoundingClientRect();
  const scroller = document.scrollingElement;
  return {
    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
    width: document.documentElement.clientWidth, height: document.documentElement.clientHeight,
    hscroll: scroller.scrollWidth > scroller.clientWidth, side: surface.dataset.sfSide || '',
    focusIn: document.getElementById('menu').contains(document.activeElement),
  };
});

async function escape(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return page.evaluate(() => ({closed: !document.getElementById('menu').isOpen, focus: document.activeElement?.id || ''}));
}

try {
  for (const view of VIEWS) for (const dir of ['ltr', 'rtl']) {
    const {context, page, errors} = await open(view, dir);
    const rtl = dir === 'rtl';
    const {width: w, height: h} = view;
    const points = {
      'top-left': [EDGE, EDGE], 'top-right': [w - EDGE, EDGE], 'bottom-left': [EDGE, h - EDGE], 'bottom-right': [w - EDGE, h - EDGE],
      'right-middle': [w - EDGE, h / 2], 'left-middle': [EDGE, h / 2], 'bottom-middle': [w / 2, h - EDGE], middle: [w / 2, h / 3],
    };
    for (const [name, [x, y]] of Object.entries(points)) {
      const label = `${w} ${dir} ${name}`;
      await page.mouse.click(x, y, {button: 'right'});
      await page.waitForTimeout(200);
      const m = await measure(page);
      const back = await escape(page);
      // The start side where there is room: the reading direction's start
      // corner on the pointer; across the pointer near the far edge.
      const xEdge = x > w / 2 + 1 ? 'right' : x < w / 2 - 1 ? 'left' : (rtl ? 'right' : 'left');
      const yEdge = y > h / 2 ? 'bottom' : 'top';
      const dx = (xEdge === 'left' ? m.left : m.right) - x;
      const dy = (yEdge === 'top' ? m.top : m.bottom) - y;
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) failures.push({case: label, want: `menu ${yEdge}-${xEdge} corner on the pointer`, dx, dy, rect: [m.left, m.top, m.right, m.bottom]});
      if (m.left < 0 || m.top < 0 || m.right > m.width || m.bottom > m.height) failures.push({case: label, want: 'menu on screen', rect: [m.left, m.top, m.right, m.bottom]});
      if (m.hscroll) failures.push({case: label, want: 'no horizontal scroll'});
      if (!m.focusIn) failures.push({case: label, want: 'focus in the menu'});
      if (!back.closed || back.focus !== 'row') failures.push({case: label, want: 'Escape closes and gives the focus back to the row', back});
    }
    // Too wide for either side: shifted to --sf-space-1/2 from an edge.
    {
      const label = `${w} ${dir} too wide at the middle`;
      await page.evaluate((length) => { window.menuWidth = length; }, `${Math.round(w * 0.75)}px`);
      await page.mouse.click(w / 2, 100, {button: 'right'});
      await page.waitForTimeout(200);
      const m = await measure(page);
      await escape(page);
      await page.evaluate(() => { window.menuWidth = undefined; });
      const inset = Math.min(m.left, m.width - m.right);
      const padding = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.inlineSize = 'var(--sf-space-1\\/2)';
        document.body.append(probe);
        const value = probe.getBoundingClientRect().width;
        probe.remove();
        return value;
      });
      if (!(padding > 0) || Math.abs(inset - padding) >= 1 || m.left < 0 || m.right > m.width) failures.push({case: label, want: 'an edge --sf-space-1/2 from the window', padding, inset, rect: [m.left, m.right]});
      if (Math.abs(m.top - 100) >= 1) failures.push({case: label, want: 'top on the pointer', top: m.top});
      if (m.hscroll) failures.push({case: label, want: 'no horizontal scroll'});
    }
    // Opened at an element near the inline end: below it, shifted, not flipped.
    {
      const label = `${w} ${dir} opened at a button`;
      await page.focus('#keys');
      await page.evaluate(() => document.getElementById('menu').openFor(document.getElementById('keys')));
      await page.waitForTimeout(200);
      const m = await measure(page);
      const button = await page.evaluate(() => document.getElementById('keys').getBoundingClientRect().toJSON());
      const back = await escape(page);
      if (m.side !== 'block-end' || m.top < button.bottom) failures.push({case: label, want: 'below the button', side: m.side, top: m.top, buttonBottom: button.bottom});
      if (m.left < 0 || m.right > m.width || m.hscroll) failures.push({case: label, want: 'on screen, no horizontal scroll', rect: [m.left, m.right]});
      if (back.focus !== 'keys') failures.push({case: label, want: 'Escape gives the focus back to the button', back});
    }
    if (errors.length) failures.push({case: `${w} ${dir} console`, errors: errors.slice(0, 3)});
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  throw new Error(`${failures.length} point menu placement check(s) failed`);
}
process.stdout.write('Context menu at a point: PASS — the corner on the pointer, flipped across it at the right (RTL: left) and bottom edges, on screen, no horizontal scroll, focus in and back on Escape; too wide for either side: --sf-space-1/2 from the edge; opened at a button: below it, not flipped; 1440 and 390, LTR and RTL\n');
