#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Enter in the search field of sf-menu-context chooses the first row the query
// left, as a combobox does (simai/ui-source#72): before, the field kept every
// key but Escape, Tab and ArrowDown, so "type Pict, press Enter" did nothing in
// a block picker and the person had to press ArrowDown first. Driven as a
// person types, in an opened menu and in a drilling panel the page placed:
// - a query that leaves one row: Enter selects it (select with its id), the
//   menu closes, and the keydown reaches the page taken (defaultPrevented);
// - a query that leaves several: the first is chosen;
// - a query that leaves none: nothing is chosen and the menu stays open;
// - a row whose submenu searches: Enter opens the submenu, nothing is selected;
// - a word still being composed (an input method): the field's Enter, nothing chosen;
// - a placed drilling panel: Enter chooses its first row too.
// ArrowDown still walks from the field to the rows.
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

const ENTRIES = [
  {id: 'heading', text: 'Заголовок'},
  {id: 'paragraph', text: 'Абзац'},
  {id: 'picture', text: 'Картинка'},
  {id: 'picture-text', text: 'Картинка с текстом'},
  {id: 'more', text: 'Ещё блоки', search: true, submenu: [{id: 'quote', text: 'Цитата'}, {id: 'code', text: 'Код'}]},
];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

async function page(theme) {
  const one = await browser.newPage({viewport: {width: 900, height: 700}});
  const errors = [];
  const foreign = (text) => /Automatic publicPath/u.test(text);
  one.on('pageerror', (error) => { if (!foreign(String(error))) errors.push(String(error)); });
  one.on('console', (message) => { if (message.type() === 'error' && !foreign(message.text())) errors.push(message.text()); });
  await one.setContent(
    `<!doctype html><html class="theme-${theme}" lang="ru"><head><meta charset="utf-8"></head><body style="margin:0;padding:40px">`
    + '<button id="trigger" type="button">+</button>'
    + '<sf-menu-context id="menu" popup aria-label="Блок"></sf-menu-context>'
    + '<div style="width:280px;margin-top:320px"><sf-menu-context id="placed" submenu="drill" aria-label="Настройки"></sf-menu-context></div>'
    + '</body></html>',
  );
  for (const path of styles) await one.addStyleTag({path}).catch(() => {});
  for (const path of modules) await one.addScriptTag({path, type: 'module'}).catch(() => {});
  await one.waitForFunction(() => customElements.get('sf-menu-context'));
  await one.evaluate((entries) => {
    window.log = [];
    for (const id of ['menu', 'placed']) {
      const menu = document.getElementById(id);
      menu.search = {placeholder: 'Найти'};
      menu.entries = entries;
      menu.addEventListener('sf-menu-context-select', (event) => window.log.push({menu: id, select: event.detail?.id ?? event.detail?.entry?.id ?? null}));
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') window.log.push({enterTaken: event.defaultPrevented});
    });
  }, ENTRIES);
  await one.waitForTimeout(100);
  return {page: one, errors};
}

const STATE = `(() => {
  const menu = document.getElementById('menu');
  const field = menu.querySelector('.sf-context-menu-search-input');
  return {
    open: menu.isOpen,
    focused: Boolean(field) && document.activeElement === field,
    active: document.activeElement?.textContent?.trim() ?? null,
    rows: [...menu.querySelectorAll(':scope > .sf-context-menu .sf-context-menu-item')].filter((row) => row.getClientRects().length).map((row) => row.textContent.trim()),
    submenu: Boolean(document.querySelector('sf-menu-context:not(#menu):not(#placed)')?.isOpen),
    log: window.log.splice(0),
  };
})()`;
const state = (p) => p.evaluate(STATE);

async function open(p) {
  await p.evaluate(() => {
    const menu = document.getElementById('menu');
    if (menu.isOpen) menu.close({restoreFocus: false});
    window.log = [];
  });
  await p.waitForTimeout(50);
  await p.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await p.waitForTimeout(120);
}

const selected = (log) => log.filter((entry) => 'select' in entry).map((entry) => entry.select);
const evidence = {};
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 2; load += 1) {
      const {page: p, errors} = await page(theme);
      const at = `${theme} #${load}`;

      // 1. One row left: Enter chooses it and the menu closes.
      await open(p);
      await p.keyboard.type('Абз');
      await p.waitForTimeout(80);
      const before = await state(p);
      if (!before.focused || before.rows.join('|') !== 'Абзац') note({case: `a query leaves one row (${at})`, got: before});
      await p.keyboard.press('Enter');
      await p.waitForTimeout(120);
      const one = await state(p);
      if (selected(one.log).join('|') !== 'paragraph') note({case: `Enter selects the one row left (${at})`, got: one});
      if (one.open) note({case: `the menu closes after Enter chose a row (${at})`, got: one});
      if (!one.log.some((entry) => entry.enterTaken === true)) note({case: `the Enter that chose a row reaches the page taken (${at})`, got: one});
      if (theme === 'light' && load === 1) evidence.oneRow = {before, after: one};

      // 2. Several rows left: the first is chosen.
      await open(p);
      await p.keyboard.type('Карт');
      await p.waitForTimeout(80);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(120);
      const several = await state(p);
      if (selected(several.log).join('|') !== 'picture') note({case: `Enter chooses the first of several rows (${at})`, got: several});

      // 3. No row left: nothing is chosen, the menu stays open on its field.
      await open(p);
      await p.keyboard.type('zzz');
      await p.waitForTimeout(80);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(120);
      const none = await state(p);
      if (selected(none.log).length || !none.open || !none.focused) note({case: `Enter with no row left does nothing (${at})`, got: none});
      if (none.log.some((entry) => entry.enterTaken === true)) note({case: `Enter with no row left is not taken (${at})`, got: none});

      // 4. The first row left opens a submenu: Enter opens it, nothing is selected.
      await open(p);
      await p.keyboard.type('Ещё');
      await p.waitForTimeout(80);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(200);
      const sub = await state(p);
      if (selected(sub.log).length || !sub.submenu) note({case: `Enter on a submenu row opens the submenu (${at})`, got: sub});

      // 5. A word being composed: the field's Enter.
      await open(p);
      await p.keyboard.type('Абз');
      await p.waitForTimeout(80);
      await p.evaluate(() => {
        const field = document.querySelector('#menu .sf-context-menu-search-input');
        field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', isComposing: true, bubbles: true, cancelable: true}));
      });
      await p.waitForTimeout(120);
      const composing = await state(p);
      if (selected(composing.log).length || !composing.open) note({case: `Enter while composing chooses nothing (${at})`, got: composing});

      // 6. ArrowDown still walks from the field to the first row.
      await p.keyboard.press('ArrowDown');
      const walked = await state(p);
      if (walked.active !== 'Абзац') note({case: `↓ still goes from the field to the row (${at})`, got: walked});

      // 7. A placed drilling panel: Enter in its field chooses its first row.
      await p.evaluate(() => { document.getElementById('menu').close({restoreFocus: false}); window.log = []; });
      await p.waitForTimeout(80);
      await p.focus('#placed .sf-context-menu-search-input');
      await p.keyboard.type('Заг');
      await p.waitForTimeout(80);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(120);
      const placed = await p.evaluate(() => window.log.splice(0));
      if (selected(placed).join('|') !== 'heading') note({case: `Enter in a placed panel's field chooses its first row (${at})`, got: placed});

      if (errors.length) note({case: `no page errors (${at})`, errors});
      await p.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({evidence, failures}, null, 2));
if (failures.length) {
  console.error(`${failures.length} case(s) failed`);
  process.exit(1);
}
