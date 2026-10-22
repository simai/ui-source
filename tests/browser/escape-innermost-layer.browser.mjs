#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Escape closes the innermost open layer and nothing else (Larena admin
// acceptance, 2026-10-22): in a record panel, Escape over an open sf-datepicker
// calendar closed the whole panel, and the date typed into the field went with
// it. The calendar listened in the bubble phase and raised no open-surface mark,
// so the drawer, listening before it, and the record panel, listening on the
// document in capture, both closed first.
//
// Measured with real key presses, because the defect is the order of listeners
// on one path, inside an sf-drawer and an sf-modal, each holding a datepicker, a
// dropdown, a popover and a calendar inside a popover. A stand-in for the record
// panel listens on the document in capture from the start and counts the presses
// it would have closed on, by the published protocol: it stands back while the
// root carries the open-surface mark or the press was already taken.
//   - Esc with the calendar open closes the calendar only; the typed text stays
//     and the focus is back in the field. The next Esc closes the container.
//   - the same for the dropdown list and the popover;
//   - a calendar inside a popover: Esc closes the calendar, the next the
//     popover, the next the container;
//   - Esc with nothing open closes the container as before.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = [
  'core/core/css/core.css', 'core/core/css/utility.full.css',
  'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css',
  'component/component/dropdown/css/dropdown.css',
  'component/component/datepicker/css/datepicker.css',
  'component/component/modal/css/modal.css',
  'smart/smart/drawer/css/drawer.css',
  'smart/smart/popover/css/popover.css',
];
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js',
  'smart/smart/icons/js/icons.js', 'smart/smart/buttons/js/buttons.js',
  'smart/smart/icon-buttons/js/icon-buttons.js',
  'smart/smart/inputs/js/inputs.js',
  'smart/smart/list-item/js/list-item.js',
  'smart/smart/dropdown/js/dropdown.js',
  'smart/smart/datepicker/js/datepicker.js',
  'smart/smart/context-menu/js/context-menu.js',
  'smart/smart/popover/js/popover.js',
  'smart/smart/drawer/js/drawer.js',
  'smart/smart/modal/js/modal.js',
];

const absent = [...styles, ...modules].map((p) => join(out, p)).filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const fields = (id) => ''
  + `<sf-datepicker id="${id}-date" aria-label="Дата" format="DD.MM.YYYY"></sf-datepicker>`
  + `<sf-dropdown id="${id}-list" label="Статус" size="1">`
  + '<sf-list-item text="Черновик" value="draft"></sf-list-item>'
  + '<sf-list-item text="Опубликовано" value="live"></sf-list-item>'
  + '</sf-dropdown>'
  + `<sf-popover id="${id}-pop" label="Настройки" width="22rem">`
  + `<button slot="trigger" id="${id}-pop-trigger" type="button">Настройки</button>`
  + `<div slot="content"><sf-datepicker id="${id}-pop-date" aria-label="Срок" format="DD.MM.YYYY"></sf-datepicker></div>`
  + '</sf-popover>';

const html = '<!doctype html><html class="theme-light" lang="ru"><head><meta charset="utf-8">'
  + styles.map((p) => `<link rel="stylesheet" href="/${p}">`).join('')
  + '</head><body style="margin:0;padding:40px">'
  + '<script>'
  // The record panel's own listener, by the protocol it publishes: on the
  // document, in capture, registered before anything opens.
  + 'window.panelCloses = 0;'
  + 'document.addEventListener("keydown", (event) => {'
  + '  if (event.key !== "Escape" || event.defaultPrevented) return;'
  + '  if (document.documentElement.dataset.sfPopoverOpen) return;'
  + '  window.panelCloses += 1;'
  + '}, true);'
  + '</script>'
  + `<sf-drawer id="drawer" title="Запись" size="1">${fields('d')}</sf-drawer>`
  + `<sf-modal id="modal" title="Запись"><div slot="content">${fields('m')}</div></sf-modal>`
  + modules.map((p) => `<script type="module" src="/${p}"></script>`).join('')
  + '</body></html>';

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({viewport: {width: 1200, height: 900}});
  const origin = 'http://probe.test';
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html});
    const path = join(out, decodeURIComponent(url.pathname));
    return existsSync(path)
      ? route.fulfill({status: 200, contentType: path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(path)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${origin}/`);
  await page.waitForTimeout(1500);

  const unupgraded = await page.evaluate(() => ['sf-datepicker', 'sf-dropdown', 'sf-popover', 'sf-drawer', 'sf-modal', 'sf-list-item']
    .filter((tag) => !customElements.get(tag)));
  if (unupgraded.length) {
    console.error(JSON.stringify({unupgraded}, null, 2));
    throw new Error(`${unupgraded.join(', ')} not defined: every measurement of an unupgraded element is false in the same direction.`);
  }

  const settle = (ms = 250) => page.waitForTimeout(ms);
  const state = (container, prefix) => page.evaluate(({container, prefix}) => {
    const host = document.getElementById(container);
    const date = document.getElementById(`${prefix}-date`);
    const popDate = document.getElementById(`${prefix}-pop-date`);
    const list = document.getElementById(`${prefix}-list`);
    const pop = document.getElementById(`${prefix}-pop`);
    const active = document.activeElement;
    return {
      container: host.hasAttribute('open'),
      calendar: date.hasAttribute('open'),
      popCalendar: popDate.hasAttribute('open'),
      list: Boolean(list.querySelector('.sf-dropdown--open')),
      popover: pop.hasAttribute('open'),
      typed: date.querySelector('input')?.value ?? null,
      focusInDate: Boolean(active && date.contains(active)),
      focusOnPopTrigger: active?.id === `${prefix}-pop-trigger`,
      mark: Boolean(document.documentElement.dataset.sfPopoverOpen),
      panelCloses: window.panelCloses,
    };
  }, {container, prefix});

  // A modal closes through an animation: read until the attribute drops.
  const waitClosed = async (container) => {
    for (let waited = 0; waited < 1800; waited += 150) {
      if (!(await page.evaluate((id) => document.getElementById(id).hasAttribute('open'), container))) return true;
      await settle(150);
    }
    return false;
  };
  const openContainer = async (container) => {
    await page.evaluate((id) => {
      window.panelCloses = 0;
      document.getElementById(id).setAttribute('open', '');
    }, container);
    await settle(500);
  };

  const run = async (container, prefix) => {
    const result = {};

    // 1. The calendar, with a date typed into its field.
    await openContainer(container);
    await page.evaluate((id) => document.getElementById(id).querySelector('input')?.click(), `${prefix}-date`);
    await settle();
    await page.evaluate((id) => document.getElementById(id).querySelector('input')?.focus(), `${prefix}-date`);
    await page.keyboard.type('14.10.2026');
    await settle(150);
    const calendarOpen = await state(container, prefix);
    await page.keyboard.press('Escape');
    await settle(300);
    const calendarFirst = await state(container, prefix);
    await page.keyboard.press('Escape');
    const calendarSecondClosed = await waitClosed(container);
    result.calendar = {open: calendarOpen, first: calendarFirst, secondClosed: calendarSecondClosed,
      panelCloses: await page.evaluate(() => window.panelCloses)};

    // 2. The dropdown list.
    await openContainer(container);
    await page.evaluate((id) => {
      const dropdown = document.getElementById(id);
      dropdown.openDropdown();
    }, `${prefix}-list`);
    await settle();
    await page.evaluate((id) => {
      const dropdown = document.getElementById(id);
      const target = dropdown.querySelector('.sf-dropdown--open [tabindex], .sf-dropdown--open button, .sf-dropdown--open input')
        || document.querySelector('.sf-list-item[tabindex]');
      target?.focus();
    }, `${prefix}-list`);
    const listOpen = await state(container, prefix);
    await page.keyboard.press('Escape');
    await settle(300);
    const listFirst = await state(container, prefix);
    await page.keyboard.press('Escape');
    const listSecondClosed = await waitClosed(container);
    result.list = {open: listOpen, first: listFirst, secondClosed: listSecondClosed,
      panelCloses: await page.evaluate(() => window.panelCloses)};

    // 3. The popover, then a calendar inside it.
    await openContainer(container);
    await page.evaluate((id) => document.getElementById(id).click(), `${prefix}-pop-trigger`);
    await settle();
    const popOpen = await state(container, prefix);
    await page.keyboard.press('Escape');
    await settle(300);
    const popFirst = await state(container, prefix);

    await page.evaluate((id) => document.getElementById(id).click(), `${prefix}-pop-trigger`);
    await settle();
    await page.evaluate((id) => document.getElementById(id).querySelector('input')?.click(), `${prefix}-pop-date`);
    await settle();
    const nestedOpen = await state(container, prefix);
    await page.keyboard.press('Escape');
    await settle(300);
    const nestedFirst = await state(container, prefix);
    await page.keyboard.press('Escape');
    await settle(300);
    const nestedSecond = await state(container, prefix);
    await page.keyboard.press('Escape');
    const nestedThirdClosed = await waitClosed(container);
    result.popover = {open: popOpen, first: popFirst, nestedOpen, nestedFirst, nestedSecond, nestedThirdClosed,
      panelCloses: await page.evaluate(() => window.panelCloses)};

    // 4. Nothing open: Escape is the container's, as before.
    await openContainer(container);
    await page.evaluate((id) => {
      const host = document.getElementById(id);
      const panel = host.querySelector('[data-sf-drawer-panel], .sf-modal, [role="dialog"]') || document.querySelector('[data-sf-drawer-panel]');
      (panel?.querySelector('button, input, [tabindex]') || panel)?.focus?.();
    }, container);
    await page.keyboard.press('Escape');
    result.plainClosed = await waitClosed(container);
    result.plainPanelCloses = await page.evaluate(() => window.panelCloses);
    result.markAfter = await page.evaluate(() => Boolean(document.documentElement.dataset.sfPopoverOpen));
    return result;
  };

  const measured = {drawer: await run('drawer', 'd'), modal: await run('modal', 'm')};

  for (const [where, r] of Object.entries(measured)) {
    const c = r.calendar;
    if (!c.open.calendar || !c.open.mark) {
      note({case: `${where}: a calendar opened from its field says so on the root`, got: c.open, expected: 'calendar open, mark present'});
    }
    if (c.first.calendar || !c.first.container || c.first.typed !== '14.10.2026' || !c.first.focusInDate || c.first.mark) {
      note({case: `${where}: Esc with the calendar open closes the calendar only, keeps the typed date, returns focus to the field`,
        got: c.first, expected: `calendar closed, ${where} open, typed 14.10.2026, focus in the field, no mark`});
    }
    if (!c.secondClosed) note({case: `${where}: the next Esc closes the ${where}`, got: c.secondClosed, expected: true});
    if (c.panelCloses !== 1) {
      note({case: `${where}: a record panel listening in capture acts on the second press only`, got: c.panelCloses, expected: 1});
    }

    const l = r.list;
    if (!l.open.list || !l.open.mark) note({case: `${where}: the dropdown list is open and marked`, got: l.open, expected: 'open, mark'});
    if (l.first.list || !l.first.container) {
      note({case: `${where}: Esc over the list closes the list only`, got: l.first, expected: `list closed, ${where} open`});
    }
    if (!l.secondClosed) note({case: `${where}: the next Esc after the list closes the ${where}`, got: l.secondClosed, expected: true});
    if (l.panelCloses !== 1) note({case: `${where}: the record panel acts on the second press only (list)`, got: l.panelCloses, expected: 1});

    const p = r.popover;
    if (!p.open.popover || !p.open.mark) note({case: `${where}: the popover is open and marked`, got: p.open, expected: 'open, mark'});
    if (p.first.popover || !p.first.container || !p.first.focusOnPopTrigger) {
      note({case: `${where}: Esc over the popover closes the popover only and returns focus to its trigger`,
        got: p.first, expected: `popover closed, ${where} open, focus on the trigger`});
    }
    if (!p.nestedOpen.popover || !p.nestedOpen.popCalendar) {
      note({case: `${where}: a calendar opens inside the popover`, got: p.nestedOpen, expected: 'popover and its calendar open'});
    }
    if (p.nestedFirst.popCalendar || !p.nestedFirst.popover || !p.nestedFirst.container) {
      note({case: `${where}: Esc closes the calendar inside the popover, not the popover`, got: p.nestedFirst,
        expected: `calendar closed, popover and ${where} open`});
    }
    if (p.nestedSecond.popover || !p.nestedSecond.container) {
      note({case: `${where}: the next Esc closes the popover, not the ${where}`, got: p.nestedSecond, expected: `popover closed, ${where} open`});
    }
    if (!p.nestedThirdClosed) note({case: `${where}: the third Esc closes the ${where}`, got: p.nestedThirdClosed, expected: true});
    if (p.panelCloses !== 1) note({case: `${where}: the record panel acts on the last press only (popover)`, got: p.panelCloses, expected: 1});

    if (!r.plainClosed || r.plainPanelCloses !== 1) {
      note({case: `${where}: Esc with nothing open closes the ${where} as before`, got: {closed: r.plainClosed, panelCloses: r.plainPanelCloses},
        expected: {closed: true, panelCloses: 1}});
    }
    if (r.markAfter) note({case: `${where}: nothing open, no mark left`, got: r.markAfter, expected: false});
  }

  console.error(JSON.stringify(measured, null, 1));
  await page.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('ESCAPE_INNERMOST_LAYER_OK');
