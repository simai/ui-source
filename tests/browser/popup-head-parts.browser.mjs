#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The heads of two list windows (owner remark 2026-11-21, VR11-4; study
// ui-control control/research/2026-11-21-popup-head, group build 16 G8),
// opened by real clicks at 1440 and 390, light and dark, with a few rows (no
// scrollbar) and with many (a scrollbar), at size 1, size 1/2 and size 1 in a
// compact region:
//
// - the filter field window (SF.fieldRenderers.filterWindow.open): the
//   condition band is the window's one step -- its text the rows' text and
//   its height the option search's (48 / 40 / 40, the hairline inside, not
//   one pixel more), in a size 1/2 list too, where the band was 1/2 over a
//   size 1 search and rows; its chevron's glyph ends in the rows' check
//   column, with and without the scrollbar (it stood 14 px further while the
//   options scrolled);
// - sf-settings look="panel" as a popup: its head is as tall as its search
//   (the field step of the panel's size and density: 48 / 40 / 40, it was
//   45 / 41 / 37) and the close button's glyph ends in the checks' column,
//   with and without the scrollbar (it stood 8 px further, 19 with one).
//
// The grey fill of a shared head (sf-popup-head) is not here: it waits for
// the owner. A clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();
const near = (a, b, tolerance = 0.6) => Math.abs(a - b) <= tolerance;

const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';
const options = (n) => Array.from({length: n}, (_, index) => ({id: `o${index}`, text: `Колонка ${index + 1}`, checked: index < 2}));
const settings = (id, size, n) => `<sf-settings id="${id}" look="panel" size="${size}" search label="Колонки">
  <sf-button-icon slot="trigger" id="${id}-open" icon="view_column" appearance="outline" scheme="on-surface" aria-label="Колонки"></sf-button-icon>
  <script type="application/json" data-sf-settings>${JSON.stringify({items: [{id: 'cols', type: 'fields', text: 'Колонки', options: options(n)}]})}</script>
</sf-settings>`;
const cases = [];
for (const [region, size] of [['normal', '1'], ['normal', '1/2'], ['compact', '1']]) {
  for (const n of [3, 30]) cases.push({region, size, n, key: `${region}-${size.replace('/', '-')}-${n}`});
}
const BODY = `<main style="display:flex;flex-direction:column;gap:12px;padding:16px">${['normal', 'compact'].map((region) => `
  <div data-sf-density="${region}" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
  ${cases.filter((one) => one.region === region).map((one) => `<sf-button id="f-${one.key}" size="${one.size}" appearance="outline" scheme="on-surface" text="Фильтр ${one.key}"></sf-button>
  ${settings(`s-${one.key}`, one.size, one.n)}`).join('\n')}
  </div>`).join('')}
</main>`;

// The window's parts, read where they stand (a phone sheet draws on the body).
const READ_FILTER = () => {
  const host = document.querySelector('[data-sf-filter-window]');
  const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
  const band = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field');
  const bandText = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field input');
  const chevron = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-chevron i.sf-icon');
  const search = scope?.querySelector('.sf-filter-window :is(.sf-choice-search, .sf-list-search, [role="search"], .sf-input-choice-search)');
  const rows = [...(scope?.querySelectorAll('.sf-filter-window .sf-checkbox-box') ?? [])].filter((node) => node.getBoundingClientRect().height > 0);
  const row = rows[0]?.closest('.sf-choice-row') ?? null;
  const scroller = scope?.querySelector('.sf-choice-scroll');
  const box = (node) => node?.getBoundingClientRect() ?? null;
  return {
    band: box(band)?.height ?? null, bandSize: band?.closest('sf-dropdown')?.getAttribute('size') ?? null,
    bandText: bandText ? getComputedStyle(bandText).fontSize : null,
    search: box(search)?.height ?? null,
    row: box(row)?.height ?? null, rowText: row ? getComputedStyle(row).fontSize : null,
    chevronEnd: box(chevron)?.right ?? null, checkEnd: box(rows[0])?.right ?? null,
    scrollbar: scroller ? scroller.offsetWidth - scroller.clientWidth : null,
  };
};
const READ_SETTINGS = (id) => {
  const panel = [...document.querySelectorAll('.sf-settings-panel')].find((node) => node.closest(`#${id}`) || node.closest('[data-sf-drawer-panel], .sf-popover__surface, [popover]'));
  const root = document.getElementById(id);
  const scope = root.querySelector('.sf-settings-panel') ?? panel;
  const head = scope?.querySelector('.sf-settings-panel-head');
  const search = scope?.querySelector('.sf-settings-panel-search');
  const close = scope?.querySelector('.sf-settings-panel-close i.sf-icon');
  const check = [...(scope?.querySelectorAll('.sf-settings-row-check i.sf-icon') ?? [])].find((node) => node.getBoundingClientRect().width > 0);
  const body = scope?.querySelector('.sf-settings-panel-body');
  return {
    head: head?.getBoundingClientRect().height ?? null, search: search?.getBoundingClientRect().height ?? null,
    closeEnd: close?.getBoundingClientRect().right ?? null, checkEnd: check?.getBoundingClientRect().right ?? null,
    scrollbar: body?.classList.contains('sf-settings-panel-body--scrollbar') ?? null,
  };
};

const evidence = {};
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, head: HEAD, body: BODY})));
    await tab.waitForFunction(() => window.SF?.fieldRenderers?.filterWindow?.open && customElements.get('sf-settings')
      && document.querySelectorAll('sf-button > button').length >= 6, null, {timeout: 20_000});
    await tab.evaluate((list) => {
      for (const one of list) {
        const field = {key: one.key, label: 'Менеджер', propertyType: 'choice', filter: {search: one.n >= 10 ? 'local' : 'off',
          options: Array.from({length: one.n}, (_, index) => ({value: `m${index}`, label: `Менеджер ${index + 1}`}))}};
        document.querySelector(`#f-${one.key} > button`).addEventListener('click', (event) => {
          window.SF.fieldRenderers.filterWindow.open({anchor: event.currentTarget, field, value: {operator: 'in', values: []}, size: one.size});
        });
      }
    }, cases);
    await tab.evaluate(() => document.fonts.ready);
    for (const one of cases) {
      const where = `${at} ${one.key}`;
      // The filter window, by a real click on its button.
      await tab.click(`#f-${one.key} > button`);
      await tab.waitForFunction(() => document.querySelector('[data-sf-filter-window]') && (() => {
        const host = document.querySelector('[data-sf-filter-window]');
        const scope = host.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
        return [...scope.querySelectorAll('.sf-filter-window .sf-checkbox-box')].some((node) => node.getBoundingClientRect().height > 0)
          && scope.querySelector('.sf-filter-window-condition .sf-dropdown-field');
      })(), null, {timeout: 10_000}).catch(() => {});
      await tab.waitForTimeout(300);
      const filter = await tab.evaluate(READ_FILTER);
      evidence[`${where} filter`] = filter;
      ok(`${where} filter: the band is as tall as the option search (the hairline inside)`, filter.search === null || (filter.band !== null && near(filter.band, filter.search)), filter);
      ok(`${where} filter: the band's text is the rows' text`, filter.bandText !== null && filter.bandText === filter.rowText, filter);
      ok(`${where} filter: the band's chevron ends in the rows' check column${filter.scrollbar ? ' (scrollbar)' : ''}`, filter.chevronEnd !== null && near(filter.chevronEnd, filter.checkEnd, 1), filter);
      await tab.keyboard.press('Escape');
      await tab.waitForFunction(() => !document.querySelector('[data-sf-filter-window]'), null, {timeout: 5000}).catch(() => {});
      await tab.waitForTimeout(150);

      // sf-settings, by a real click on its trigger.
      await tab.click(`#s-${one.key}-open > button`);
      await tab.waitForFunction((id) => [...document.querySelectorAll(`#${id} .sf-settings-row-check, .sf-settings-row-check`)].some((node) => node.getBoundingClientRect().width > 0), `s-${one.key}`, {timeout: 10_000}).catch(() => {});
      await tab.waitForTimeout(300);
      const panel = await tab.evaluate(READ_SETTINGS, `s-${one.key}`);
      evidence[`${where} settings`] = panel;
      ok(`${where} settings: the head is as tall as the search`, panel.head !== null && near(panel.head, panel.search), panel);
      ok(`${where} settings: the close glyph ends in the checks' column${panel.scrollbar ? ' (scrollbar)' : ''}`, panel.closeEnd !== null && near(panel.closeEnd, panel.checkEnd, 1), panel);
      if (one.n === 30 && width > 600) ok(`${where} settings: thirty rows scroll`, panel.scrollbar === true, panel);
      await tab.keyboard.press('Escape');
      await tab.waitForTimeout(200);
    }
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
