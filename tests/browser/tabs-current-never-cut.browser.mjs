#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The current tab is never cut hard (view record study VRS-2, group build 16
// G12): with overflow="more" a tab was at most as wide as its row, so a
// current tab wider than a narrow row was measured at the row's width, kept
// unshortened and its label cut mid-word («Зака» beside «Ещё (3)»). In narrow
// rows -- vertical tabs folded in a 192 px column, underline and pills rows of
// 150-260 px, the current tab first, in the middle and last -- every label in
// the row is whole, or it is the one shortened tab (sf-tabs-squeezed) with an
// ellipsis; the current tab stands inside the row. 1440 and 390, light and
// dark, three loads. A clean console.
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
  {id: 'folded', width: 192, type: 'vertical', icons: true, active: 'order'},
  {id: 'icons', width: 150, type: 'underline', icons: true, active: 'order'},
  {id: 'middle', width: 150, type: 'underline', icons: false, active: 'delivery'},
  {id: 'last', width: 200, type: 'underline', icons: true, active: 'history'},
  {id: 'pills', width: 192, type: 'pills', icons: true, active: 'order'},
  {id: 'wide', width: 260, type: 'underline', icons: true, active: 'client'},
];
const BODY = `<main style="display:flex;flex-direction:column;gap:16px">${ROWS.map((row) => `<div style="inline-size:${row.width}px"><sf-tabs id="${row.id}" type="${row.type}" active="${row.active}" aria-label="Разделы" items='${items(row.icons)}'></sf-tabs></div>`).join('')}</main>`;

const READ = (ids) => ids.map((id) => {
  const root = document.querySelector(`#${id} > .sf-tabs`);
  const row = root?.querySelector(':scope > .sf-tabs-top-container > .sf-tabs-top');
  const shown = [...(row?.querySelectorAll('[role="tab"]') ?? [])].filter((tab) => tab.getBoundingClientRect().width > 0);
  const cuts = shown.map((tab) => {
    const text = tab.querySelector(':scope > .sf-button-text-container');
    const style = text ? getComputedStyle(text) : null;
    const squeezed = Boolean(tab.closest('.sf-tabs-squeezed') || tab.hasAttribute('data-sf-tabs-squeezed'));
    return {name: text?.textContent.trim(), cut: text ? text.scrollWidth - text.clientWidth : 0, squeezed,
      ellipsis: style?.textOverflow === 'ellipsis' && style?.overflowX === 'hidden' && style?.whiteSpace === 'nowrap'};
  });
  const current = row?.querySelector('[role="tab"][aria-selected="true"]')?.getBoundingClientRect();
  const box = row?.getBoundingClientRect();
  return {id, look: root?.className.match(/sf-tabs--(underline|pills|vertical)/u)?.[1], cuts,
    hard: cuts.filter((entry) => entry.cut > 0 && !(entry.squeezed && entry.ellipsis)),
    inside: current && box ? current.width > 0 && current.left >= box.left - 1 && current.right <= box.right + 1 : false,
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
      ok(`${at} ${row.id} (${row.look}): no label in the row is cut hard`, row.hard.length === 0, row);
      ok(`${at} ${row.id}: the current tab stands inside the row`, row.inside, row);
    }
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
