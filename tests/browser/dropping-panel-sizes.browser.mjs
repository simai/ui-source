#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// One dropping panel, two sizes (owner, 2026-10-14). Measured on the built
// bytes:
// - sf-context-menu rows are as tall as a field of the menu's size: 32px at
//   1/2 (the default), 40px at size="1"; a submenu takes its parent's size;
// - width="trigger" opens the menu exactly as wide as the control;
// - a slotted footer stands under the rows, its two buttons sharing the width;
// - an sf-dropdown grid at 1/2 has cells as tall as a size-1/2 field and a
//   supplied trigger's grid is as wide as its columns, not 18rem;
// - a size-1 skeleton bar is 16px tall in a 24px line, and three lines are
//   72px tall.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css',
  'component/component/context-menu/css/context-menu.css',
  'component/component/dropdown/css/dropdown.css',
  'component/component/buttons/css/buttons.css',
  'component/component/skeleton/css/skeleton.css',
];
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icon/js/icon.js',
  'smart/smart/button/js/button.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/context-menu/js/context-menu.js',
];
const absent = [...styles, ...modules].filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`${absent.length} build asset(s) not found under ${out}: ${absent.join(', ')}`);

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 800}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ru"><body></body></html>'});
    const path = join(out, url.pathname);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  // The Loader fetches what a page lacks from the published distribution; here
  // it is served the candidate's bytes, or the published sheets would be the
  // ones measured.
  await page.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
    const tail = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '');
    const [product, ...rest] = tail.split('/');
    const path = join(out, product, product, ...rest);
    if (!existsSync(path)) return route.fulfill({status: 404, body: ''});
    return route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)});
  });
  await page.goto(`${origin}/`);
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"><body style="margin:40px">
    <button id="small" type="button" style="width:90px">Ещё</button>
    <sf-context-menu id="menu-small" popup aria-label="Малое"></sf-context-menu>
    <button id="large" type="button" style="width:90px;margin-left:300px">Ещё</button>
    <sf-context-menu id="menu-large" popup size="1" aria-label="Большое"></sf-context-menu>
    <button id="wide" type="button" style="width:256px;margin-left:600px">Сайт</button>
    <sf-context-menu id="menu-wide" popup width="trigger" aria-label="Сайты"></sf-context-menu>
    <div style="height:300px"></div>
    <button id="panel-trigger" type="button" style="width:90px">Окно</button>
    <sf-context-menu id="panel" popup aria-label="Окно">
      <div slot="content" class="sf-context-menu-body"><p style="margin:0">Строка</p></div>
      <sf-button slot="footer" size="1/2" appearance="outline" scheme="on-surface" text="Сбросить"></sf-button>
      <sf-button slot="footer" size="1/2" text="Применить"></sf-button>
    </sf-context-menu>
    <div id="skeleton" class="sf-skeleton" style="width:200px">
      <div class="sf-skeleton-text sf-skeleton-text--size-1"></div>
      <div class="sf-skeleton-text sf-skeleton-text--size-1"></div>
      <div class="sf-skeleton-text sf-skeleton-text--size-1"></div>
    </div>
  </body></html>`);
  for (const path of styles) await page.addStyleTag({url: `${origin}/${path}`}).catch(() => {});
  // Core takes its distr from its own script URL when sfPath is unset
  // (simai/ui-source#8); here that is the build output's core/ root, not a
  // distr, so the page names the distr this probe routes.
  await page.evaluate(() => { window.sfPath = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/'; });
  for (const path of modules) await page.addScriptTag({url: `${origin}/${path}`, type: 'module'});
  await page.waitForFunction(() => customElements.get('sf-context-menu') && customElements.get('sf-dropdown'), null, {timeout: 8000});

  const entries = [
    {id: 'a', text: 'Переименовать', icon: 'edit'},
    {id: 'b', text: 'Безопасность учётной записи очень длинная строка', icon: 'shield', submenu: [{id: 'c', text: 'Подпункт'}]},
  ];
  const measured = await page.evaluate(async (list) => {
    const open = async (menuId, triggerId) => {
      const menu = document.getElementById(menuId);
      menu.entries = list;
      await menu.openFor(document.getElementById(triggerId), {focus: 'none'});
      await new Promise((done) => setTimeout(done, 120));
      const row = menu.querySelector('.sf-context-menu-item').getBoundingClientRect();
      const surface = menu.querySelector('.sf-context-menu-content').getBoundingClientRect();
      return {row: row.height, width: surface.width, menu};
    };
    const small = await open('menu-small', 'small');
    const sub = await small.menu.openSubmenu(small.menu.querySelectorAll('.sf-context-menu-item')[1],
      list[1], {focus: 'none'});
    await new Promise((done) => setTimeout(done, 120));
    const subRow = sub.querySelector('.sf-context-menu-item').getBoundingClientRect().height;
    small.menu.close({restoreFocus: false});
    const large = await open('menu-large', 'large');
    const largeSub = await large.menu.openSubmenu(large.menu.querySelectorAll('.sf-context-menu-item')[1],
      list[1], {focus: 'none'});
    await new Promise((done) => setTimeout(done, 120));
    const largeSubRow = largeSub.querySelector('.sf-context-menu-item').getBoundingClientRect().height;
    large.menu.close({restoreFocus: false});
    const wide = await open('menu-wide', 'wide');
    const label = wide.menu.querySelectorAll('.sf-context-menu-item-label')[1];
    const truncated = label.scrollWidth > label.clientWidth;
    wide.menu.close({restoreFocus: false});
    const widthAfterClose = (() => {
      const content = wide.menu.querySelector('.sf-context-menu-content');
      return content.style.getPropertyValue('inline-size');
    })();

    const panel = document.getElementById('panel');
    await panel.openFor(document.getElementById('panel-trigger'), {focus: 'none'});
    await new Promise((done) => setTimeout(done, 150));
    const footer = panel.querySelector('.sf-context-menu-footer');
    const content = panel.querySelector('.sf-context-menu-content').getBoundingClientRect();
    const buttons = [...(footer?.children ?? [])].map((button) => button.getBoundingClientRect().width);
    const footerBox = footer?.getBoundingClientRect();
    panel.close({restoreFocus: false});

    const lines = [...document.querySelectorAll('#skeleton .sf-skeleton-text')].map((bar) => bar.getBoundingClientRect().height);
    const block = document.getElementById('skeleton').getBoundingClientRect().height;
    return {
      small: small.row, smallSub: subRow, large: large.row, largeSub: largeSubRow,
      wide: wide.width, truncated, widthAfterClose,
      footer: footer ? {buttons, bottomGap: content.bottom - footerBox.bottom, rows: footer.children.length} : null,
      skeleton: {lines, block},
    };
  }, entries);

  // The grid of a size-1/2 dropdown with a supplied trigger.
  const grid = await page.evaluate(async () => {
    const dropdown = document.createElement('sf-dropdown');
    dropdown.setAttribute('size', '1/2');
    dropdown.setAttribute('layout', 'grid');
    dropdown.setAttribute('columns', '6');
    dropdown.setAttribute('aria-label', 'Иконка');
    dropdown.options = Array.from({length: 18}, (_, at) => ({kind: 'icon', icon: 'folder', text: `i${at}`, value: `i${at}`, ariaLabel: `i${at}`}));
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.slot = 'trigger';
    trigger.textContent = '▣';
    dropdown.append(trigger);
    document.body.append(dropdown);
    await new Promise((done) => setTimeout(done, 300));
    trigger.click();
    await new Promise((done) => setTimeout(done, 300));
    const list = document.querySelector('.sf-list:not([hidden]) .sf-list-container--grid')?.closest('.sf-list');
    const cell = list?.querySelector('.sf-list-item')?.getBoundingClientRect();
    return list ? {width: list.getBoundingClientRect().width, cell: cell?.height} : null;
  });

  console.log(JSON.stringify({measured, grid}, null, 1));
  if (Math.round(measured.small) !== 32) note({case: 'menu at 1/2', row: measured.small, expected: 32});
  if (Math.round(measured.smallSub) !== 32) note({case: 'submenu of a 1/2 menu', row: measured.smallSub, expected: 32});
  if (Math.round(measured.large) !== 40) note({case: 'menu at 1', row: measured.large, expected: 40});
  if (Math.round(measured.largeSub) !== 40) note({case: 'submenu of a size-1 menu', row: measured.largeSub, expected: 40});
  if (Math.abs(measured.wide - 256) > 1) note({case: 'width="trigger"', width: measured.wide, expected: 256});
  if (!measured.truncated) note({case: 'width="trigger"', expected: 'a long line ends in an ellipsis'});
  if (measured.widthAfterClose) note({case: 'width="trigger"', expected: 'closing gives the width back'});
  if (!measured.footer || measured.footer.rows !== 2 || Math.abs(measured.footer.buttons[0] - measured.footer.buttons[1]) > 1) {
    note({case: 'footer', footer: measured.footer, expected: 'two buttons sharing the width'});
  }
  if (measured.footer && Math.abs(measured.footer.bottomGap) > 1.5) note({case: 'footer', gap: measured.footer.bottomGap, expected: 'at the panel bottom'});
  if (measured.skeleton.lines.some((height) => Math.round(height) !== 16) || Math.round(measured.skeleton.block) !== 72) {
    note({case: 'skeleton at 1', skeleton: measured.skeleton, expected: '16px bars, three 24px lines = 72px'});
  }
  if (!grid) note({case: 'grid', expected: 'the grid opens'});
  else {
    if (Math.round(grid.cell) !== 32) note({case: 'grid at 1/2', cell: grid.cell, expected: 32});
    if (grid.width > 6 * 32 + 40) note({case: 'grid at 1/2', width: grid.width, expected: 'as wide as six 32px columns'});
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('DROPPING_PANEL_SIZES_OK');
