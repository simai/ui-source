#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The current tab is never cut hard (view record study VRS-2, group build 16
// G12): with overflow="more" a tab was at most as wide as its row, so a
// current tab wider than a narrow row was measured at the row's width, kept
// unshortened and its label cut mid-word («Зака» beside «Ещё (3)»). In narrow
// rows -- vertical tabs folded in a 192 px column, underline and pills rows of
// 192-300 px (and a 150 px row narrower than «Ещё» and a tab, read only), the current tab first, in the middle and last -- every label in
// the row is whole, or it is the one shortened tab (sf-tabs-squeezed) with an
// ellipsis; the current tab stands inside the row. 1440 and 390, light and
// dark, three loads. A clean console.
//
// The tightest rows (group build 16 returns GB16-1, GB16-2): a shortened
// label keeps at least two letters before its ellipsis; below that a tab with
// an icon draws its icon alone, whole and inside the row (no cut glyph, no
// empty sliver, no one-letter stub), a tab of words keeps two letters; «Ещё»
// gives way (its glyph alone) and always stands whole.
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
const ROWS = [
  {id: 'folded', width: 192, type: 'vertical', icons: true, active: 0},
  {id: 'icons', width: 192, type: 'underline', icons: true, active: 0},
  {id: 'middle', width: 220, type: 'underline', icons: false, active: 2},
  {id: 'last', width: 220, type: 'underline', icons: true, active: 3},
  {id: 'pills', width: 220, type: 'pills', icons: true, active: 0},
  {id: 'wide', width: 300, type: 'underline', icons: true, active: 1},
  // GB16-1 / GB16-2: narrower than «Ещё (3)» and a tab's icon, one letter left, a row of words.
  {id: 'tight', width: 150, type: 'underline', icons: true, active: 0},
  {id: 'tightlast', width: 120, type: 'underline', icons: true, active: 3},
  {id: 'oneletter', width: 200, type: 'underline', icons: true, active: 0},
  {id: 'pillicon', width: 192, type: 'pills', icons: true, active: 0},
  {id: 'pilltight', width: 136, type: 'pills', icons: true, active: 3},
  {id: 'words', width: 176, type: 'underline', icons: false, active: 0},
  {id: 'wordstight', width: 128, type: 'underline', icons: false, active: 3},
];
const BODY = `<main style="display:flex;flex-direction:column;gap:16px">${ROWS.map((row) => `<div style="inline-size:${row.width}px"><sf-tabs id="${row.id}" type="${row.type}" active-index="${row.active}" aria-label="Разделы" items='${items(row.icons)}'></sf-tabs></div>`).join('')}</main>`;

const READ = (ids) => ids.map((id) => {
  const root = document.querySelector(`#${id} > .sf-tabs`);
  const row = root?.querySelector(':scope > .sf-tabs-top-container > .sf-tabs-top');
  const shown = [...(row?.querySelectorAll('[role="tab"]') ?? [])].filter((tab) => tab.getBoundingClientRect().width > 0);
  const canvas = document.createElement('canvas').getContext('2d');
  const cuts = shown.map((tab) => {
    const text = tab.querySelector(':scope > .sf-button-text-container');
    const style = text ? getComputedStyle(text) : null;
    const squeezed = Boolean(tab.closest('.sf-tabs-squeezed') || tab.hasAttribute('data-sf-tabs-squeezed'));
    const iconOnly = Boolean(tab.closest('.sf-tabs-icon-only') || tab.hasAttribute('data-sf-tabs-icon-only'));
    const name = (text?.querySelector('.sf-tabs-name') ?? text)?.textContent.trim() ?? '';
    if (style) canvas.font = style.font;
    const two = name.length > 2 ? canvas.measureText(`${[...name].slice(0, 2).join('')}\u2026`).width : 0;
    const icon = tab.querySelector('.sf-icon')?.getBoundingClientRect();
    const own = tab.getBoundingClientRect();
    return {name, cut: text && !iconOnly ? text.scrollWidth - text.clientWidth : 0, shown: text ? text.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0) : 0, two: Math.round(two * 10) / 10, squeezed, iconOnly,
      iconWhole: !icon || icon.width === 0 || (icon.left >= own.left - 0.5 && icon.right <= own.right + 0.5),
      ellipsis: style?.textOverflow === 'ellipsis' && style?.overflowX === 'hidden' && style?.whiteSpace === 'nowrap'};
  });
  const current = row?.querySelector('[role="tab"][aria-selected="true"]')?.getBoundingClientRect();
  const box = row?.getBoundingClientRect();
  const frame = root?.getBoundingClientRect();
  const trigger = root?.querySelector('.sf-tabs-more > button')?.getBoundingClientRect();
  const selected = row?.querySelector('[role="tab"][aria-selected="true"] .sf-button-text-container')?.textContent.trim();
  return {id, selected, look: root?.className.match(/sf-tabs--(underline|pills|vertical)/u)?.[1], cuts,
    hard: cuts.filter((entry) => entry.cut > 0 && !(entry.squeezed && entry.ellipsis)),
    inside: current && box ? current.width > 0 && current.left >= box.left - 1 && current.right <= box.right + 1 : false,
    moreWhole: !trigger || trigger.width === 0 || (trigger.left >= frame.left - 0.5 && trigger.right <= frame.right + 0.5),
    more: root?.querySelector('.sf-tabs-more > button')?.textContent.replace(/\s+/gu, ' ').trim() ?? null};
});

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, body: BODY})));
    await tab.waitForFunction((ids) => customElements.get('sf-tabs') && ids.every((id) => document.querySelector(`#${id} [role="tab"][aria-selected="true"]`)), ROWS.map((row) => row.id), {timeout: 20_000});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(600);
    const read = await tab.evaluate(READ, ROWS.map((row) => row.id));
    evidence[at] = read;
    for (const row of read) {
      const spec = ROWS.find((entry) => entry.id === row.id);
      ok(`${at} ${row.id} (${row.look}): no label in the row is cut hard`, row.hard.length === 0, row);
      ok(`${at} ${row.id}: the current tab stands inside the row`, row.inside, row);
      ok(`${at} ${row.id}: a shortened label keeps two letters before its ellipsis`, row.cuts.every((entry) => !entry.squeezed || entry.shown + 0.5 >= entry.two), row);
      ok(`${at} ${row.id}: no glyph is cut, an icon-only tab draws its whole icon`, row.cuts.every((entry) => entry.iconWhole), row);
      ok(`${at} ${row.id}: «Ещё» stands whole`, row.moreWhole, row);
      ok(`${at} ${row.id}: a row of words never draws the current tab as an icon`, spec.icons || row.cuts.every((entry) => !entry.iconOnly), row);
    }
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
