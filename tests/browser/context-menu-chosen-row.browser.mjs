#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// How a chosen row is marked (owner decision R016, 2026-11-07). Every row kept
// an empty column at its end for a check, so every row stopped short of the
// edge. Now: the chosen row of a pick-one list (menuitemradio) has the soft
// fill of the chosen and no mark, and the rows reach the end padding; a ticked
// row (menuitemcheckbox) leads with its check in the icons' column, at their
// width; the pointer's plate and the focus ring are never the chosen fill --
// light and dark, a flyout list and a drilled choice's options.
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

const failures = [];
const note = (detail) => failures.push(detail);
const evidence = {};
const browser = await chromium.launch();

const HARNESS = /Automatic publicPath/u;

async function open(theme) {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  const errors = [];
  page.on('pageerror', (error) => { if (!HARNESS.test(String(error))) errors.push(String(error)); });
  // A bundle injected by addScriptTag has no script URL for webpack to read
  // its public path from: that one message is the harness's, not the menu's.
  page.on('console', (message) => { if (message.type() === 'error' && !HARNESS.test(message.text())) errors.push(message.text()); });
  await page.setContent(
    `<!doctype html><html class="theme-${theme}" lang="ru"><body style="margin:0;padding:40px">`
    + '<button id="trigger" type="button">Меню</button>'
    + '<sf-menu-context id="menu" popup aria-label="Меню"></sf-menu-context>'
    + '</body></html>',
  );
  for (const path of styles) await page.addStyleTag({path}).catch(() => {});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => customElements.get('sf-menu-context'));
  return {page, errors};
}

async function show(page, entries, attributes = {}) {
  await page.evaluate(([list, attrs]) => {
    const menu = document.getElementById('menu');
    if (menu.isOpen) menu.close({restoreFocus: false});
    for (const [name, value] of Object.entries(attrs)) menu.setAttribute(name, value);
    menu.entries = list;
  }, [entries, attributes]);
  await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById('menu').openFor(document.getElementById('trigger')));
  await page.waitForTimeout(200);
}

// The rows of the open surface: their box against the content's inner box,
// what stands at their end, their fill.
const ROWS = () => {
  const content = document.querySelector('#menu .sf-context-menu-content');
  const inner = content.getBoundingClientRect();
  const border = parseFloat(getComputedStyle(content).borderRightWidth) || 0;
  return [...document.querySelectorAll('#menu .sf-context-menu-item')].map((row) => {
    const box = row.getBoundingClientRect();
    const style = getComputedStyle(row);
    const value = row.querySelector('.sf-context-menu-item-value');
    const lead = row.querySelector('.sf-context-menu-item-lead');
    return {
      text: row.querySelector('.sf-context-menu-item-label')?.textContent.trim() ?? '',
      role: row.getAttribute('role'),
      checked: row.getAttribute('aria-checked'),
      chosen: row.classList.contains('sf-context-menu-item--chosen'),
      endMark: Boolean(row.querySelector(':scope > .sf-context-menu-item-check')),
      checkInLead: Boolean(lead?.querySelector('.sf-context-menu-item-check')),
      leadLeft: lead ? lead.getBoundingClientRect().left - inner.left : null,
      leadWidth: lead ? lead.getBoundingClientRect().width : null,
      gapToEdge: inner.right - border - box.right,
      valueGap: value ? box.right - parseFloat(style.paddingRight) - value.getBoundingClientRect().right : null,
      background: style.backgroundColor,
    };
  });
};

try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      const {page, errors} = await open(theme);

      // A pick-one list, as sf-language draws it: the native name, the English
      // one at the row's end, the current one checked.
      const languages = [['Русский', 'Russian'], ['English', null], ['Deutsch', 'German'], ['Français', 'French'], ['Español', 'Spanish']]
        .map(([text, value], index) => ({id: `l${index}`, text, value: value ?? undefined, kind: 'radio', checked: index === 0}));
      await show(page, languages);
      const radio = await page.evaluate(ROWS);
      for (const row of radio) {
        if (row.endMark) note({case: `a pick-one row keeps no mark at its end (${theme})`, got: row});
        if (row.chosen !== (row.checked === 'true')) note({case: `the chosen row and only it carries the chosen fill (${theme})`, got: row});
        // The row reaches the content's end padding (4px), its value the row's
        // own end padding.
        if (Math.abs(row.gapToEdge - 8) > 0.5) note({case: `a pick-one row reaches the end padding (${theme})`, got: row});
        if (row.valueGap !== null && Math.abs(row.valueGap) > 0.5) note({case: `the trailing hint ends at the row's end padding (${theme})`, got: row});
      }
      // The three states: the chosen fill, the pointer's plate on another row,
      // the pointer on the chosen row, and the ring of a focused row.
      await page.hover('#menu .sf-context-menu-item >> nth=2');
      await page.waitForTimeout(50);
      const hover = await page.evaluate(() => getComputedStyle(document.querySelectorAll('#menu .sf-context-menu-item')[2]).backgroundColor);
      await page.hover('#menu .sf-context-menu-item >> nth=0');
      await page.waitForTimeout(50);
      const chosenHover = await page.evaluate(() => getComputedStyle(document.querySelectorAll('#menu .sf-context-menu-item')[0]).backgroundColor);
      await page.mouse.move(800, 650);
      await page.waitForTimeout(50);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      const focus = await page.evaluate(() => {
        const row = document.activeElement;
        const style = getComputedStyle(row);
        return {text: row.querySelector('.sf-context-menu-item-label')?.textContent.trim(), outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`, background: style.backgroundColor};
      });
      const chosen = radio.find((row) => row.chosen)?.background;
      const plain = radio.find((row) => !row.chosen)?.background;
      const states = {chosen, chosenHover, hover, plain, focus};
      if (!chosen || chosen === plain || chosen === hover || chosenHover === chosen || chosenHover === hover) note({case: `the chosen fill, its hover and the pointer's plate are three colours (${theme})`, got: states});
      if (!/^solid [1-9]/u.test(focus.outline) || focus.background === chosen) note({case: `the focus is a ring, not the chosen fill (${theme})`, got: focus});
      if (load === 1) evidence[`${theme}-radio`] = {rows: radio.map(({text, gapToEdge, valueGap, chosen: c}) => ({text, gapToEdge, valueGap, chosen: c})), states};
      if (load === 1) await page.screenshot({path: join(process.env.SF_PROBE_SHOTS ?? '/tmp', `menu-chosen-radio-${theme}.png`), clip: {x: 20, y: 40, width: 320, height: 240}}).catch(() => {});

      // A menu of ticks among actions with icons: the check stands in the
      // icons' column, at their width; nothing at the end.
      await show(page, [
        {id: 'copy', text: 'Копировать', icon: 'content_copy'},
        {id: 'bold', text: 'Жирный', kind: 'check', checked: true},
        {id: 'italic', text: 'Курсив', kind: 'check', checked: false},
        {id: 'wrap', text: 'Переносить', kind: 'check', checked: true, icon: 'wrap_text'},
        {id: 'name', text: 'Название', kind: 'check', checked: false, icon: 'title'},
      ]);
      const checks = await page.evaluate(ROWS);
      const icon = checks[0];
      for (const row of checks) {
        if (row.endMark) note({case: `a ticked row keeps nothing at its end (${theme})`, got: row});
        if (row.leadLeft === null || Math.abs(row.leadLeft - icon.leadLeft) > 0.5 || Math.abs(row.leadWidth - icon.leadWidth) > 0.5) note({case: `the check column is the icons' column (${theme})`, got: {row, icon}});
        if (row.role === 'menuitemcheckbox' && row.checkInLead !== (row.checked === 'true')) note({case: `a ticked row shows its check in the lead (${theme})`, got: row});
        if (Math.abs(row.gapToEdge - 8) > 0.5) note({case: `a row of a check menu reaches the end padding (${theme})`, got: row});
      }
      // A menu of ticks alone keeps the column too.
      await show(page, [
        {id: 'name', text: 'Название', kind: 'check', checked: true},
        {id: 'date', text: 'Дата', kind: 'check'},
      ]);
      const ticks = await page.evaluate(ROWS);
      if (ticks.some((row) => row.leadWidth === null || row.leadWidth < 1) || ticks[0].leadLeft !== ticks[1].leadLeft) note({case: `a menu of ticks alone keeps the lead column (${theme})`, got: ticks});
      if (load === 1) {
        evidence[`${theme}-checks`] = checks.map(({text, leadLeft, leadWidth, checkInLead, gapToEdge}) => ({text, leadLeft, leadWidth, checkInLead, gapToEdge}));
        await show(page, [
          {id: 'copy', text: 'Копировать', icon: 'content_copy'},
          {id: 'bold', text: 'Жирный', kind: 'check', checked: true},
          {id: 'italic', text: 'Курсив', kind: 'check', checked: false},
          {id: 'wrap', text: 'Переносить', kind: 'check', checked: true, icon: 'wrap_text'},
          {id: 'name', text: 'Название', kind: 'check', checked: false, icon: 'title'},
        ]);
        await page.screenshot({path: join(process.env.SF_PROBE_SHOTS ?? '/tmp', `menu-chosen-checks-${theme}.png`), clip: {x: 20, y: 40, width: 320, height: 240}}).catch(() => {});
      }

      // A drilled choice's options: the chosen one filled, no check.
      await show(page, [
        {type: 'switch', id: 'compact', text: 'Компактно', value: true},
        {type: 'choice', id: 'size', text: 'Размер текста', view: 'drill', options: [
          {id: 's', text: 'Мелкий'}, {id: 'm', text: 'Обычный', checked: true}, {id: 'l', text: 'Крупный'},
        ]},
      ], {submenu: 'drill'});
      await page.click('#menu [aria-haspopup="menu"]');
      await page.waitForTimeout(250);
      const level = await page.evaluate(ROWS);
      const options = level.filter((row) => row.role === 'menuitemradio');
      if (options.length !== 3 || options.some((row) => row.endMark) || options.filter((row) => row.chosen).map((row) => row.text).join() !== 'Обычный') note({case: `a drilled choice marks its chosen option by the fill (${theme})`, got: level});
      if (options.some((row) => Math.abs(row.gapToEdge - 8) > 0.5)) note({case: `a drilled option reaches the end padding (${theme})`, got: options});
      if (load === 1) {
        evidence[`${theme}-drill`] = options.map(({text, chosen: c, background, gapToEdge}) => ({text, chosen: c, background, gapToEdge}));
        await page.screenshot({path: join(process.env.SF_PROBE_SHOTS ?? '/tmp', `menu-chosen-drill-${theme}.png`), clip: {x: 20, y: 40, width: 340, height: 220}}).catch(() => {});
      }
      await page.evaluate(() => { const menu = document.getElementById('menu'); menu.close({restoreFocus: false}); menu.removeAttribute('submenu'); });

      if (errors.length) note({case: `console clean (${theme} #${load})`, got: errors});
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (process.env.SF_PROBE_EVIDENCE) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} chosen-row check(s) failed`);
}
process.stdout.write('Context menu chosen row: PASS — pick-one rows filled and full width, ticks in the icon column, hover, chosen and focus distinct, drilled options filled; light and dark, three loads each\n');
