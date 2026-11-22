#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Group build 16 returns GB16-5 and GB16-6 (DEV msg-ae20b3b7, re-check
// control/evidence/2026-11-22-gb16-returns-recheck N1-N3 in ui-control).
//
// GB16-5: in the narrow icon rows (120-176 px at 1440, 120-150 at 390) the
// current tab drew its icon alone beside a bare «Ещё» chevron while 40-96 px
// stood empty and the whole name fitted there (176 px: «Заказ» needs 45.1,
// the room is 45.1). The label is now decided again beside the glyph-alone
// trigger. Over rows of 120-360 px (step 8; underline and pills, icons and
// words, the current tab first and last): an icon-only current tab is one
// whose label, forced back to the shortened state beside the glyph-alone
// trigger, would keep fewer than two letters; a glyph-alone trigger beside a
// labelled current tab means two letters did not stand beside «Ещё (n)»; the
// current tab is never cut, never hidden, never in «Ещё».
//
// GB16-6: the hidden names are the Framework tooltip. The glyph-alone
// trigger and the icon-only current tab name a .sf-tooltip by data-tooltip,
// its text their hidden words («Ещё (3)», the tab's label); a real mouse hover
// (1.5 s) and keyboard focus show it; a trigger that writes its words names
// none. The accessible names stay the words.
//
// 1440 and 390, light and dark, `loads` cold loads (3). A clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const items = (icons) => JSON.stringify([
  {id: 'order', label: 'Заказ', ...(icons ? {icon: 'receipt_long'} : {})},
  {id: 'client', label: 'Клиент', ...(icons ? {icon: 'person'} : {})},
  {id: 'delivery', label: 'Доставка', ...(icons ? {icon: 'local_shipping'} : {})},
  {id: 'history', label: 'История', ...(icons ? {icon: 'history'} : {})},
]);
const ROWS = [];
for (const type of ['underline', 'pills']) {
  for (const icons of [true, false]) {
    for (const active of [0, 3]) {
      for (let width = 120; width <= 360; width += 8) ROWS.push({id: `r-${type}-${icons ? 'i' : 't'}-${active}-${width}`, type, icons, active, width});
    }
  }
}
const BODY = `<main style="display:flex;flex-direction:column;gap:12px">${ROWS.map((row) => `<div style="inline-size:${row.width}px"><sf-tabs id="${row.id}" type="${row.type}" active-index="${row.active}" aria-label="Разделы" items='${items(row.icons)}'></sf-tabs></div>`).join('')}</main>`;

// Every row: the current tab's state; an icon-only one is forced back to the
// shortened state beside the glyph-alone trigger and its label measured.
const READ = (ids) => ids.map((id) => {
  const root = document.querySelector(`#${id} > .sf-tabs`);
  const container = root?.querySelector(':scope > .sf-tabs-top-container');
  const list = container?.querySelector(':scope > .sf-tabs-top');
  const tab = list?.querySelector('[role="tab"][aria-selected="true"]');
  if (!tab) return {id, none: true};
  const host = tab.parentElement;
  const text = tab.querySelector(':scope > .sf-button-text-container');
  const name = (text?.querySelector('.sf-tabs-name') ?? text)?.textContent.trim() ?? '';
  const canvas = document.createElement('canvas').getContext('2d');
  canvas.font = getComputedStyle(text).font;
  const two = canvas.measureText(name.length > 2 ? `${[...name].slice(0, 2).join('')}…` : name).width;
  const iconOnly = host.classList.contains('sf-tabs-icon-only');
  const squeezed = host.classList.contains('sf-tabs-squeezed');
  const compact = container.hasAttribute('data-sf-tabs-more-compact');
  const labelWidth = () => {
    const style = getComputedStyle(text);
    return (parseFloat(style.width) || 0) - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  };
  let besideGlyph = null;
  if (iconOnly) {
    const floor = text.style.getPropertyValue('--sf-tabs--squeezed-min');
    host.classList.replace('sf-tabs-icon-only', 'sf-tabs-squeezed');
    const had = compact;
    container.setAttribute('data-sf-tabs-more-compact', '');
    besideGlyph = labelWidth();
    if (!had) container.removeAttribute('data-sf-tabs-more-compact');
    host.classList.replace('sf-tabs-squeezed', 'sf-tabs-icon-only');
    if (floor) text.style.setProperty('--sf-tabs--squeezed-min', floor);
  }
  const own = tab.getBoundingClientRect();
  const box = list.getBoundingClientRect();
  const trigger = container.querySelector(':scope > .sf-tabs-more > button');
  const triggerShown = Boolean(trigger) && trigger.getBoundingClientRect().width > 0 && trigger.checkVisibility();
  const tipOf = (button) => {
    const ref = button?.getAttribute('data-tooltip');
    const surface = ref ? document.getElementById(ref) : null;
    return ref ? {ref, text: surface?.matches('.sf-tooltip') ? surface.querySelector('.sf-tooltip-text')?.textContent.trim() ?? '' : null} : null;
  };
  return {
    id, name, two: Math.round(two * 10) / 10, iconOnly, squeezed, compact, besideGlyph: besideGlyph === null ? null : Math.round(besideGlyph * 10) / 10,
    shown: iconOnly ? 0 : Math.round(labelWidth() * 10) / 10,
    inside: own.width > 0 && own.left >= box.left - 1 && own.right <= box.right + 1,
    fills: own.width + 0.5 >= box.width,
    triggerShown, moreName: trigger?.closest('.sf-tabs-more')?.getAttribute('aria-label') ?? null,
    moreTip: tipOf(trigger), tabTip: tipOf(tab),
  };
});

// Resolves once no sf-tabs has laid its row out for 1.5 s (at most 90 s).
const QUIET = () => new Promise((settle) => {
  const tabs = customElements.get('sf-tabs');
  const layout = tabs.prototype.layoutRow;
  let last = performance.now();
  const start = last;
  tabs.prototype.layoutRow = function () { last = performance.now(); return layout.call(this); };
  const check = () => {
    const now = performance.now();
    if (now - last >= 1500 || now - start > 90_000) {
      tabs.prototype.layoutRow = layout;
      settle(Math.round(now - start));
    } else setTimeout(check, 250);
  };
  setTimeout(check, 250);
});

// The tooltip shown now (its text), if any.
const SHOWN_TIP = () => [...document.querySelectorAll('.sf-tooltip')].filter((surface) => !surface.hidden && surface.checkVisibility() && surface.getBoundingClientRect().width > 0).map((surface) => surface.textContent.trim());

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction((ids) => customElements.get('sf-tabs') && ids.every((id) => document.querySelector(`#${id} [role="tab"][aria-selected="true"]`)), ROWS.map((row) => row.id), {timeout: 120_000, polling: 250});
    await tab.evaluate(() => document.fonts.ready);
    // A page of 248 rows settles for 15-25 s as the icon subsets arrive (each
    // face lays every row out again; the base 8cd2dfe77 does the same): read
    // once no row has been laid out for 1.5 s.
    await tab.evaluate(QUIET);
    const read = await tab.evaluate(READ, ROWS.map((row) => row.id));
    await tab.evaluate(QUIET);
    const counts = {iconOnly: 0, compact: 0, labelBesideGlyph: 0};
    for (const row of read) {
      if (row.none) {
        ok(`${at} ${row.id}: the current tab is drawn`, false, row);
        continue;
      }
      const spec = ROWS.find((entry) => entry.id === row.id);
      counts.iconOnly += row.iconOnly ? 1 : 0;
      counts.compact += row.compact ? 1 : 0;
      counts.labelBesideGlyph += row.compact && !row.iconOnly ? 1 : 0;
      ok(`${at} ${row.id}: the current tab stands inside the row`, row.inside, row);
      if (row.iconOnly) ok(`${at} ${row.id}: GB16-5 an icon-only current tab has no room for two letters even beside the glyph-alone trigger`, row.besideGlyph + 0.5 < row.two, row);
      // Two letters and «…», or the whole row when even that is wider (a
      // plate of words in 120-128 px at 1440: the row is 68 px, the base the same).
      if (row.squeezed) ok(`${at} ${row.id}: a shortened label keeps two letters or takes the whole row`, row.shown + 0.5 >= row.two || row.fills, row);
      ok(`${at} ${row.id}: a row of words never draws the current tab as an icon`, spec.icons || !row.iconOnly, row);
      // GB16-6: the names hidden are the Framework tooltip; drawn names have none.
      if (row.compact && row.triggerShown) ok(`${at} ${row.id}: GB16-6 the glyph-alone trigger names a tooltip of its words`, row.moreTip && row.moreTip.text === row.moreName && /^Ещё \(\d+\)/u.test(row.moreName), row);
      else ok(`${at} ${row.id}: GB16-6 a trigger that writes its words names no row tooltip`, !row.moreTip, row);
      if (row.iconOnly) ok(`${at} ${row.id}: GB16-6 the icon-only current tab names a tooltip of its label`, row.tabTip && row.tabTip.text === row.name, row);
      else ok(`${at} ${row.id}: GB16-6 a labelled current tab names no row tooltip`, !row.tabTip, row);
    }
    evidence[at] = {counts, rows: read};
    // Real hover and keyboard focus on the first glyph-alone trigger and the
    // first icon-only tab of the page.
    const probes = [
      ['trigger', read.find((row) => row.compact && row.triggerShown), (id) => `#${id} .sf-tabs-more > button`, (row) => row.moreName],
      ['icon tab', read.find((row) => row.iconOnly), (id) => `#${id} .sf-tabs-top [role="tab"][aria-selected="true"]`, (row) => row.name],
    ];
    for (const [what, row, selector, words] of probes) {
      if (!row) {
        ok(`${at}: GB16-6 a ${what} to hover is drawn`, false, 'none in the page');
        continue;
      }
      const target = tab.locator(selector(row.id));
      await target.scrollIntoViewIfNeeded();
      const boxOf = await target.boundingBox();
      await tab.mouse.move(2, 2);
      await tab.waitForTimeout(400);
      await tab.mouse.move(boxOf.x + boxOf.width / 2, boxOf.y + boxOf.height / 2, {steps: 4});
      await tab.waitForTimeout(1500);
      const hover = await tab.evaluate(SHOWN_TIP);
      ok(`${at}: GB16-6 hover on the ${what} (${row.id}) shows «${words(row)}»`, hover.includes(words(row)), hover);
      await tab.mouse.move(2, 2);
      await tab.waitForTimeout(800);
      // Keyboard focus: a key first, so the focus is a keyboard one.
      await tab.keyboard.press('Shift');
      await target.focus();
      await tab.waitForTimeout(600);
      const focus = await tab.evaluate(SHOWN_TIP);
      ok(`${at}: GB16-6 keyboard focus on the ${what} (${row.id}) shows «${words(row)}»`, focus.includes(words(row)), focus);
      await tab.evaluate(() => document.activeElement?.blur());
      await tab.waitForTimeout(400);
    }
    ok(`${at}: GB16-5 some rows draw the label beside the glyph-alone trigger`, counts.labelBesideGlyph > 0, counts);
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(Object.fromEntries(Object.entries(evidence).map(([at, entry]) => [at, entry.counts]))));
report();
