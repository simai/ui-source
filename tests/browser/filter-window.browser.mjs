#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Framework order FO-5 (the view set study, ui-control control/research/
// 2026-11-17-view-round-1/framework-orders.md): a filter field's window,
// SF.fieldRenderers.filterWindow.open, on a page with no table -- opened from
// a plain button and from a chip (sf-tag) through sf-popover's anchor
// (1.8.0). At 1440 and 390, light and dark, `loads` fresh loads each (3 by
// default). Measured: the window is a dialog named by the field, placed
// against its anchor and on screen; its footer is «Применить» then «Сбросить»
// in the document and from the start of the row (C157 (3)); a choice made and
// applied answers {action: 'apply', value}, «Сбросить» answers {action:
// 'reset'}, Escape answers null and the focus is back on the anchor; the same
// anchor pressed again closes the window and no second one opens; the filter
// control is sf-input-choice with the host's pages and search (FO-4 inside
// FO-5); no window is left on the page after it closes. A clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const BODY = `<main style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
  <sf-button id="status" size="1" appearance="outline" scheme="on-surface" text="Статус" icon-end="expand_more"></sf-button>
  <sf-tag id="owner" text="Ответственный"></sf-tag>
</main>`;
const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';

const STATUS = {key: 'status', label: 'Статус', propertyType: 'choice', filter: {options: [
  {value: 'new', label: 'Новая', scheme: 'primary'}, {value: 'work', label: 'В работе', scheme: 'warning'}, {value: 'done', label: 'Готово', scheme: 'success'}]}};

// Opens the window from an anchor; the answer lands in window.answers.
const open = (tab, anchor, field) => tab.evaluate(({anchor, field}) => {
  const target = document.getElementById(anchor);
  const given = field === 'status' ? window.STATUS : window.OWNER;
  window.answers ??= [];
  window.SF.fieldRenderers.filterWindow.open({anchor: target, field: given, value: {}}).then((answer) => window.answers.push(answer));
}, {anchor, field});
const shown = (tab) => tab.waitForFunction(() => {
  const surface = document.querySelector('[data-sf-filter-window] [role="dialog"], [data-sf-filter-window] dialog, [data-sf-filter-window] .sf-popover__surface');
  return document.querySelector('[data-sf-filter-window] [data-action="apply"] button') && surface && surface.getBoundingClientRect().height > 0;
}, null, {timeout: 10_000});
const lastAnswer = (tab) => tab.evaluate(() => window.answers.at(-1));

for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const key = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, head: HEAD, body: BODY})));
    await tab.waitForFunction(() => window.SF?.fieldRenderers?.filterWindow?.open && customElements.get('sf-button')
      && document.querySelector('#status button') && customElements.get('sf-tag'), null, {timeout: 20_000});
    await tab.evaluate((status) => {
      window.STATUS = status;
      const people = Array.from({length: 120}, (_, index) => ({value: `u${index + 1}`, label: `Сотрудник ${index + 1}`, avatar: {text: `С${index + 1}`}}));
      window.ownerCalls = [];
      window.OWNER = {key: 'owner', label: 'Ответственный', propertyType: 'user', filter: {searchable: true, optionRenderer: 'avatar-checkbox',
        provider: async (query, {cursor, limit}) => {
          window.ownerCalls.push({query, cursor});
          const found = people.filter((one) => one.label.toLowerCase().includes(query.toLowerCase()));
          const at = Number(cursor ?? 0);
          return {items: found.slice(at, at + limit), nextCursor: at + limit < found.length ? String(at + limit) : null};
        }}};
    }, STATUS);
    const noTable = await tab.evaluate(() => !document.querySelector('sf-table, sf-view-table, table'));

    // 1. From a plain button: a dialog named by the field, the footer's order.
    await open(tab, 'status', 'status');
    await shown(tab);
    await tab.waitForTimeout(250);
    const window1 = await tab.evaluate(() => {
      const popover = document.querySelector('[data-sf-filter-window]');
      const dialog = popover.querySelector('[role="dialog"]') ?? popover.querySelector('dialog') ?? popover;
      const surface = popover.querySelector('.sf-popover__surface') ?? dialog;
      const box = surface.getBoundingClientRect();
      const anchor = document.getElementById('status').getBoundingClientRect();
      const buttons = [...popover.querySelectorAll('[data-action]')];
      const text = (node) => (node.getAttribute('text') || node.textContent).trim();
      return {
        role: dialog.getAttribute('role') || dialog.localName,
        name: dialog.getAttribute('aria-label') || popover.getAttribute('label'),
        order: buttons.map((one) => one.dataset.action),
        words: buttons.map(text),
        xs: buttons.map((one) => Math.round(one.getBoundingClientRect().left)),
        onScreen: box.left >= 0 && box.right <= innerWidth + 0.5 && box.top >= 0 && box.bottom <= innerHeight + 0.5,
        below: box.top >= anchor.bottom - 1,
        choice: Boolean(popover.querySelector('sf-input-choice[appearance="list"]')),
        badges: popover.querySelectorAll('sf-input-choice sf-badge.sf-choice-name-badge').length,
        focusInside: popover.contains(document.activeElement),
      };
    });
    ok(`${key}: no table on the page`, noTable);
    ok(`${key}: the window is a dialog named by the field, on screen, under its anchor`, ['dialog'].includes(window1.role) && window1.name === 'Статус' && window1.onScreen && window1.below, window1);
    ok(`${key}: «Применить» then «Сбросить», in the document and from the start (C157 (3))`, window1.order.join() === 'apply,reset' && window1.words[0] === 'Применить' && window1.words[1] === 'Сбросить' && window1.xs[0] < window1.xs[1], window1);
    ok(`${key}: the control is sf-input-choice list, the statuses as tonal badges; the focus in the window`, window1.choice && window1.badges === 3 && window1.focusInside, window1);

    await tab.click('[data-sf-filter-window] .sf-choice-input[value="work"]', {force: true});
    await tab.click('[data-sf-filter-window] [data-action="apply"] button');
    await tab.waitForTimeout(400);
    const applied = {answer: await lastAnswer(tab), left: await tab.evaluate(() => document.querySelectorAll('[data-sf-filter-window]').length)};
    ok(`${key}: apply answers the choice, the window leaves the page`, applied.answer?.action === 'apply' && JSON.stringify(applied.answer?.value?.values) === '["work"]' && applied.left === 0, applied);

    // 2. Reset.
    await open(tab, 'status', 'status');
    await shown(tab);
    await tab.click('[data-sf-filter-window] [data-action="reset"] button');
    await tab.waitForTimeout(400);
    const reset = await lastAnswer(tab);
    ok(`${key}: reset answers reset, with no value`, reset?.action === 'reset' && reset?.value === null, reset);

    // 3. Escape: null, the focus back on the anchor.
    await open(tab, 'status', 'status');
    await shown(tab);
    await tab.waitForTimeout(150);
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(400);
    const escaped = await tab.evaluate(() => ({
      answer: window.answers.at(-1),
      count: window.answers.length,
      focus: document.getElementById('status').contains(document.activeElement) || document.activeElement === document.getElementById('status'),
      left: document.querySelectorAll('[data-sf-filter-window]').length,
    }));
    ok(`${key}: Escape answers null, the focus back on the anchor`, escaped.answer === null && escaped.count === 3 && escaped.focus && escaped.left === 0, escaped);

    // 4. The anchor pressed again closes it; no second window. The page's click
    // handler that opened it asks again on that press and is answered null.
    await tab.evaluate(() => document.getElementById('status').addEventListener('click', () => window.open1()));
    await tab.exposeFunction('open1', () => open(tab, 'status', 'status'));
    await tab.click('#status button');
    await shown(tab);
    await tab.waitForTimeout(200);
    await tab.click('#status button');
    await tab.waitForTimeout(700);
    const toggled = await tab.evaluate(() => ({windows: document.querySelectorAll('[data-sf-filter-window]').length, answers: window.answers.length, tail: window.answers.slice(3)}));
    ok(`${key}: the anchor pressed again closes the window, none opens again`, toggled.windows === 0 && toggled.answers === 5 && toggled.tail.every((one) => one === null), toggled);

    // 5. From a chip, with the host's pages and search inside.
    await open(tab, 'owner', 'owner');
    await shown(tab);
    await tab.waitForFunction(() => document.querySelectorAll('[data-sf-filter-window] .sf-choice-input').length >= 50, null, {timeout: 10_000}).catch(() => null);
    const paged = await tab.evaluate(() => ({
      rows: document.querySelectorAll('[data-sf-filter-window] .sf-choice-input').length,
      avatars: document.querySelectorAll('[data-sf-filter-window] sf-avatar.sf-choice-avatar').length,
      search: Boolean(document.querySelector('[data-sf-filter-window] .sf-choice-search input')),
      more: Boolean(document.querySelector('[data-sf-filter-window] .sf-choice-more')),
      onScreen: (() => {
        const box = (document.querySelector('[data-sf-filter-window] .sf-popover__surface') ?? document.querySelector('[data-sf-filter-window] [role="dialog"]')).getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth + 0.5;
      })(),
    }));
    ok(`${key}: from a chip -- the host's first page with avatars, search and «Показать ещё», on screen`, paged.rows === 50 && paged.avatars === 50 && paged.search && paged.more && paged.onScreen, paged);
    await tab.locator('[data-sf-filter-window] .sf-choice-search input').fill('Сотрудник 7');
    await tab.waitForTimeout(600);
    const searched = await tab.evaluate(() => ({rows: [...document.querySelectorAll('[data-sf-filter-window] .sf-choice-input')].map((one) => one.value), calls: window.ownerCalls.map((one) => one.query)}));
    ok(`${key}: the search asks the host's provider`, searched.calls.includes('Сотрудник 7') && searched.rows.includes('u7') && searched.rows.includes('u70') && !searched.rows.includes('u1'), {rows: searched.rows.length, calls: searched.calls});
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(300);

    const sideways = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${key}: no sideways scroll`, sideways <= 0, {sideways});
    ok(`${key}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
await server.close();
report();
