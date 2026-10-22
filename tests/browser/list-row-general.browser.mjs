#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-list-item as a general list row (simai/ui-source#18 and #29, ui-mail F3
// and P-14), served through the loader:
//   - geometry, at 1440px and 390px, light and dark, sizes 1/3, 1/2, 1, 2 and
//     3: a one-line row is exactly the control height of its size (the
//     sf-button of that size); a two-line row is the control height plus one
//     line of the step below; the title keeps the one-line row's text;
//   - states: hover, selected and plain rows have three different fills, in
//     both themes;
//   - an sf-sortable list of rows: one Tab stop for the whole list; ArrowDown,
//     ArrowUp, Home and End move the focus between rows; a pinned row has no
//     handle and is not an item of the list, and its text starts where the
//     other rows' text does;
//   - keyboard reordering is unaffected: Space picks the focused row up, the
//     arrows move it (the focus stays), Space drops it, and the list says so in
//     sf-sortable-intent; a drag by the handle says so too;
//   - an interactive row: a click or Enter sends sf-list-item-activate with
//     its value; a click on an action in its trailing slot does not.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'),
  smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const BELOW = {'1/3': '1/3', '1/2': '1/3', 1: '1/2', 2: '1', 3: '2'};

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:16px">
<section id="geometry" style="inline-size:560px">
${SIZES.map((size) => `<div data-size="${size}" style="display:flex;gap:8px;align-items:flex-start;margin-block-end:8px">
  <div style="flex:1;min-inline-size:0">
    <div data-list><sf-list-item data-one interactive size="${size}" kind="icon" icon="mail" text="Письмо" value="one-${size}"></sf-list-item></div>
    <div data-list><sf-list-item data-two interactive size="${size}" kind="icon" icon="mail" text="Письмо" supporting="Вчера, 3 блока" value="two-${size}"></sf-list-item></div>
  </div>
  <sf-button size="${size}" text="Кнопка"></sf-button>
</div>`).join('\n')}
</section>
<section id="states" data-list style="inline-size:320px">
  <sf-list-item data-state="plain" interactive size="1/2" text="Обычная" value="plain"></sf-list-item>
  <sf-list-item data-state="hover" interactive size="1/2" text="Под указателем" value="hover"></sf-list-item>
  <sf-list-item data-state="selected" interactive selected size="1/2" text="Выбранная" value="selected"></sf-list-item>
</section>
<button id="before" type="button">До списка</button>
<sf-sortable id="blocks" group="blocks" label="Блоки" style="inline-size:320px">
  <sf-list-item pinned interactive size="1/2" text="Параметры письма" value="settings"></sf-list-item>
  <sf-list-item sortable-item="a" interactive size="1/2" text="Заголовок" supporting="Привет" value="a"></sf-list-item>
  <sf-list-item sortable-item="b" interactive size="1/2" text="Текст" supporting="Абзац" value="b"></sf-list-item>
  <sf-list-item sortable-item="c" interactive size="1/2" text="Кнопка" supporting="Купить" value="c"></sf-list-item>
  <sf-list-item sortable-item="d" interactive size="1/2" text="Подвал" value="d">
    <button slot="trailing" type="button" tabindex="-1" data-action>Ещё</button>
  </sf-list-item>
</sf-sortable>
<button id="after" type="button">После списка</button>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/light' || path === '/dark') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const open = async (browser, theme, width) => {
  const tab = await browser.newPage({viewport: {width, height: 1400}});
  tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: `${theme} ${width}: page error`, said: error.message}); });
  await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
  await tab.waitForFunction(() => document.querySelectorAll('sf-list-item > .sf-list-item').length === 18
    && document.querySelectorAll('sf-button button').length === 5
    && document.querySelector('#blocks')?.getAttribute('data-sf-sortable') === 'connected', null, {timeout: 20000});
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  return tab;
};

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const tab = await open(browser, theme, width);
      const geometry = await tab.evaluate((below) => {
        const lineOf = (size) => {
          const probe = document.createElement('span');
          probe.style.blockSize = `var(--sf-text-height-${size.replace('/', '\\/')})`;
          probe.style.display = 'block';
          document.body.append(probe);
          const height = probe.getBoundingClientRect().height;
          probe.remove();
          return height;
        };
        return [...document.querySelectorAll('#geometry [data-size]')].map((group) => {
          const size = group.dataset.size;
          const one = group.querySelector('[data-one] > .sf-list-item');
          const two = group.querySelector('[data-two] > .sf-list-item');
          const button = group.querySelector('sf-button button').getBoundingClientRect().height;
          const font = (element) => [parseFloat(getComputedStyle(element).fontSize), parseFloat(getComputedStyle(element).lineHeight)];
          return {size, button, one: one.getBoundingClientRect().height, two: two.getBoundingClientRect().height,
            below: lineOf(below[size]), oneText: font(one.querySelector('.sf-list-item-container')),
            twoTitle: font(two.querySelector('.sf-list-item-title')), supporting: font(two.querySelector('.sf-list-item-supporting'))};
        });
      }, BELOW);
      evidence[`${theme} ${width}`] = geometry.map(({size, button, one, two}) => ({size, button, one, two}));
      for (const row of geometry) {
        const at = `${theme} ${width}px size ${row.size}`;
        check(`${at}: a one-line row is the control height`, near(row.one, row.button), row);
        check(`${at}: a two-line row is the control height and a line of the step below`, near(row.two, row.button + row.below), row);
        check(`${at}: the title of a two-line row keeps the row's text`, row.twoTitle[0] === row.oneText[0] && row.twoTitle[1] === row.oneText[1], row);
        check(`${at}: the supporting line is a line of the step below`, near(row.supporting[1], row.below), row);
      }

      if (width === 1440) {
        await tab.hover('[data-state="hover"] > .sf-list-item');
        await tab.waitForTimeout(250);
        const fills = await tab.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-state]')]
          .map((host) => [host.dataset.state, getComputedStyle(host.querySelector('.sf-list-item')).backgroundColor])));
        evidence[`${theme} fills`] = fills;
        check(`${theme}: hover, selected and plain rows have three different fills`, new Set(Object.values(fills)).size === 3, fills);
      }
      await tab.close();
    }
  }

  // The sortable list, by keyboard and by pointer.
  const tab = await open(browser, 'light', 1440);
  const list = await tab.evaluate(() => {
    const rows = [...document.querySelectorAll('#blocks sf-list-item > .sf-list-item')];
    return rows.map((row) => ({value: row.parentElement.getAttribute('value'), tabindex: row.getAttribute('tabindex'),
      item: row.getAttribute('data-sf-sortable-item'), handle: Boolean(row.querySelector('[data-sf-sortable-handle]')),
      slot: row.querySelector('.sf-list-item-handle')?.getBoundingClientRect().width ?? null,
      text: row.querySelector('.sf-list-item-title, .sf-list-item-container').getBoundingClientRect().left}));
  });
  evidence.list = list;
  const pinned = list.find((row) => row.value === 'settings');
  check('one Tab stop for the whole list', list.filter((row) => row.tabindex === '0').length === 1 && list.every((row) => row.tabindex !== null), list);
  check('the pinned row has no handle and is not an item of the list', !pinned.handle && pinned.item === null, pinned);
  check('the other rows are items with a handle', list.filter((row) => row.value !== 'settings').every((row) => row.handle && row.item === row.value), list);
  check('the pinned row keeps the handle slot, so the text columns line up', list.every((row) => near(row.text, pinned.text, 0.5) && near(row.slot, pinned.slot)), list);

  const focused = () => tab.evaluate(() => document.activeElement?.closest('sf-list-item')?.getAttribute('value') ?? document.activeElement?.id ?? null);
  await tab.focus('#before');
  await tab.keyboard.press('Tab');
  const first = await focused();
  await tab.keyboard.press('ArrowDown');
  const second = await focused();
  await tab.keyboard.press('End');
  const last = await focused();
  await tab.keyboard.press('ArrowUp');
  const up = await focused();
  await tab.keyboard.press('Home');
  const home = await focused();
  await tab.keyboard.press('ArrowDown');
  await tab.keyboard.press('Tab');
  const leaving = await focused();
  await tab.keyboard.press('Shift+Tab');
  const back = await focused();
  evidence.keyboard = {first, second, last, up, home, leaving, back};
  check('Tab enters the list on its first row', first === 'settings', {first});
  check('ArrowDown moves to the next row', second === 'a', {second});
  check('End moves to the last row', last === 'd', {last});
  check('ArrowUp moves to the row above', up === 'c', {up});
  check('Home moves to the first row', home === 'settings', {home});
  check('Tab leaves the list from any row: one stop', leaving === 'after', {leaving});
  check('Shift+Tab comes back to the row that had the focus', back === 'a', {back});

  // Keyboard reorder: b one place down.
  await tab.evaluate(() => {
    window.intents = [];
    window.activated = [];
    document.addEventListener('sf-sortable-intent', (event) => window.intents.push(event.detail));
    document.addEventListener('sf-list-item-activate', (event) => window.activated.push(event.detail.value));
  });
  await tab.keyboard.press('ArrowDown');
  await tab.keyboard.press(' ');
  await tab.waitForTimeout(100);
  await tab.keyboard.press('ArrowDown');
  const during = await focused();
  await tab.keyboard.press(' ');
  await tab.waitForTimeout(200);
  const keyboardIntent = await tab.evaluate(() => window.intents.at(-1) ?? null);
  evidence.keyboardIntent = keyboardIntent;
  check('the arrows move the picked row, not the focus', during === 'b', {during});
  check('Space, ArrowDown, Space reorders the row by keyboard', keyboardIntent?.item === 'b' && keyboardIntent?.index === 2, {keyboardIntent});
  check('picking up by keyboard does not activate the row', !(await tab.evaluate(() => window.activated.length)), {});

  // Pointer drag by the handle: a below c.
  await tab.hover('[sortable-item="a"] > .sf-list-item');
  const handle = await tab.locator('[sortable-item="a"] [data-sf-sortable-handle]').boundingBox();
  const target = await tab.locator('[sortable-item="c"] > .sf-list-item').boundingBox();
  await tab.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await tab.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await tab.mouse.move(handle.x + handle.width / 2, handle.y + (target.y + target.height * 0.8 - handle.y) * step / 12);
  }
  await tab.mouse.up();
  await tab.waitForTimeout(200);
  const pointerIntent = await tab.evaluate(() => window.intents.at(-1) ?? null);
  evidence.pointerIntent = pointerIntent;
  check('a drag by the handle reorders the row', pointerIntent?.item === 'a' && pointerIntent?.index === 2, {pointerIntent});

  // Activation.
  await tab.evaluate(() => { window.activated = []; });
  await tab.click('[data-state="plain"] .sf-list-item-container');
  await tab.click('[sortable-item="d"] [data-action]');
  await tab.focus('[data-state="hover"] > .sf-list-item');
  await tab.keyboard.press('Enter');
  const activated = await tab.evaluate(() => window.activated);
  evidence.activated = activated;
  check('a click and Enter activate a row; its trailing action does not', JSON.stringify(activated) === JSON.stringify(['plain', 'hover']), {activated});
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 30), count: failures.length}, null, 1)); process.exit(1); }
console.log('LIST_ROW_GENERAL_OK');
