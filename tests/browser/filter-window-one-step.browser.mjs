#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The filter window has one step (popup head round 3, PH-7, DEV msg-161b24f8;
// the repro of ui-control control/research/2026-11-21-popup-head/data/
// repro-ph7.json): opened from lists of size 1 and 1/2, at normal and compact
// density, the condition changed by real clicks through «любой из» -> «ни
// один из» -> «не задано» -> «задано» -> «любой из»: the band's height, its
// chevron, the footer's buttons and the rows' checks are the same in every
// state, with rows or without, and the same whatever the list's size; the
// footer's buttons are the rows' step (an sf-button of size 1 at that
// density). With 30 options and a scrollbar the checks, the search's icon and
// the band's chevron keep the column they have with 3 (the owner's scroll
// variant B: nothing shifts). 1440 and 390, light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';
const opener = (id, density) => `<div ${density === 'compact' ? 'data-sf-density="compact"' : ''} style="display:flex;gap:8px;align-items:center">
  <sf-button id="${id}" size="1" appearance="outline" scheme="on-surface" text="${id}"></sf-button>
  <sf-button id="${id}-ref" size="1" text="Образец"></sf-button></div>`;
const OPENERS = [];
for (const density of ['normal', 'compact']) for (const size of ['1', '1/2']) for (const n of [3, 30]) OPENERS.push({id: `o-${density}-${size.replace('/', '')}-${n}`, density, size, n});
const BODY = `<main style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">${OPENERS.map(({id, density}) => opener(id, density)).join('')}</main>`;

const READ = () => {
  const host = document.querySelector('[data-sf-filter-window]');
  const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
  const box = (node) => (node ? node.getBoundingClientRect() : null);
  const band = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field');
  const chevron = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-chevron i.sf-icon');
  const buttons = [...(scope?.querySelectorAll('button[data-action="apply"], button[data-action="reset"], [data-action="apply"] > button, [data-action="reset"] > button') ?? []), ...(host?.querySelectorAll('button[data-action="apply"], button[data-action="reset"], [data-action="apply"] > button, [data-action="reset"] > button') ?? [])];
  const check = [...(scope?.querySelectorAll('.sf-filter-window .sf-checkbox-box') ?? [])].find((node) => node.getBoundingClientRect().height > 0);
  const search = scope?.querySelector('.sf-choice-search-icon i.sf-icon, .sf-choice-search-icon');
  const scroller = scope?.querySelector('.sf-choice-scroll');
  return {
    sheet: host?.localName === 'sf-drawer',
    band: band ? Math.round(box(band).height) : null,
    chevron: chevron ? Math.round(box(chevron).width) : null,
    chevronEnd: chevron ? Math.round(box(chevron).right) : null,
    foot: [...new Set(buttons.filter((node) => node.getBoundingClientRect().height > 0).map((node) => Math.round(box(node).height)))],
    footWrap: buttons.some((node) => node.querySelector('.sf-button-text-container')?.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight) * 1.5),
    check: check ? Math.round(box(check).height) : null,
    checkEnd: check ? Math.round(box(check).right) : null,
    searchEnd: search ? Math.round(box(search).right) : null,
    scrollbar: scroller ? scroller.offsetWidth - scroller.clientWidth : null,
    value: scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field input')?.value ?? null,
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
    await tab.waitForFunction((count) => window.SF?.fieldRenderers?.filterWindow?.open && document.querySelectorAll('sf-button > button').length >= count, OPENERS.length * 2, {timeout: 20_000});
    await tab.evaluate((openers) => {
      for (const {id, size, n} of openers) {
        const field = {key: id, label: 'Менеджер', propertyType: 'choice', filter: {search: n >= 10 ? 'local' : 'off', options: Array.from({length: n}, (_, i) => ({value: `m${i}`, label: `Менеджер ${i + 1}`}))}};
        document.querySelector(`#${id} > button`).addEventListener('click', (event) => window.SF.fieldRenderers.filterWindow.open({anchor: event.currentTarget, field, size, value: {operator: 'in', values: []}}));
      }
    }, OPENERS);
    await tab.evaluate(() => document.fonts.ready);
    const record = {};
    for (const {id, density, size, n} of OPENERS) {
      const reference = await tab.evaluate((ref) => Math.round(document.querySelector(`#${ref} > button`).getBoundingClientRect().height), `${id}-ref`);
      await tab.click(`#${id} > button`);
      await tab.waitForFunction(() => {
        const host = document.querySelector('[data-sf-filter-window]');
        const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
        return [...(scope?.querySelectorAll('.sf-filter-window .sf-checkbox-box') ?? [])].some((node) => node.getBoundingClientRect().height > 0);
      }, null, {timeout: 10_000}).catch(() => {});
      await tab.waitForTimeout(250);
      const states = [{name: 'любой из', ...(await tab.evaluate(READ))}];
      // любой из -> ни один из -> не задано -> задано -> любой из (the menu's rows 2, 3, 4, 1).
      for (const [index, name] of [[1, 'ни один из'], [2, 'не задано'], [3, 'задано'], [0, 'любой из']]) {
        const trigger = await tab.evaluateHandle(() => {
          const host = document.querySelector('[data-sf-filter-window]');
          const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
          return scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field > button, .sf-filter-window-condition .sf-dropdown-chevron');
        });
        const spot = await trigger.evaluate((node) => { const r = node?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
        if (spot) await tab.mouse.click(spot[0], spot[1]);
        await tab.waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].some((node) => node.getBoundingClientRect().height > 0), null, {timeout: 5000}).catch(() => {});
        const option = await tab.evaluateHandle((at) => [...document.querySelectorAll('[role="listbox"]')].filter((list) => list.getBoundingClientRect().height > 0).flatMap((list) => [...list.querySelectorAll('[role="option"]')])[at] ?? null, index);
        const target = await option.evaluate((node) => { const r = node?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
        if (target) await tab.mouse.click(target[0], target[1]);
        await tab.waitForTimeout(300);
        states.push({name, ...(await tab.evaluate(READ))});
      }
      record[id] = {reference, states};
      const label = `${at} ${density} size ${size}, ${n} options`;
      const one = (key) => new Set(states.map((state) => JSON.stringify(state[key]))).size === 1;
      ok(`${label}: the conditions changed by clicks (${states.map((state) => state.value).join(' > ')})`, states.map((state) => state.value).join('|') === 'любой из|ни один из|не задано|задано|любой из', states.map((state) => state.value));
      ok(`${label}: the band's height and chevron are the same in every state`, one('band') && one('chevron') && states[0].band > 0, states.map(({name, band, chevron}) => ({name, band, chevron})));
      ok(`${label}: the footer's buttons are the same in every state and the rows' step (${reference})`, one('foot') && states[0].foot.length === 1 && states[0].foot[0] === reference, states.map(({name, foot}) => ({name, foot})));
      ok(`${label}: «Применить» and «Сбросить» stay on one line`, states.every((state) => !state.footWrap), states.map(({name, footWrap}) => ({name, footWrap})));
      const rows = states.filter((state) => state.check !== null);
      ok(`${label}: the rows' checks are one size where rows show`, rows.length >= 2 && new Set(rows.map((state) => state.check)).size === 1, rows.map(({name, check}) => ({name, check})));
      await tab.keyboard.press('Escape');
      await tab.waitForFunction(() => !document.querySelector('[data-sf-filter-window]'), null, {timeout: 5000}).catch(async () => { await tab.keyboard.press('Escape'); });
      await tab.waitForTimeout(150);
    }
    // One step whatever the list's size; nothing shifts with a scrollbar.
    for (const density of ['normal', 'compact']) {
      const [a, b] = ['1', '12'].map((size) => record[`o-${density}-${size}-3`].states[0]);
      ok(`${at} ${density}: a list of size 1/2 opens the same window as one of size 1`, a.band === b.band && a.chevron === b.chevron && JSON.stringify(a.foot) === JSON.stringify(b.foot) && a.check === b.check, {size1: a, size12: b});
      const [few, many] = [3, 30].map((n) => record[`o-${density}-1-${n}`].states[0]);
      ok(`${at} ${density}: with a scrollbar (${many.scrollbar} px) the checks, the search's icon and the chevron keep the column they have without one`, (many.sheet && !many.scrollbar) || (Math.abs(many.checkEnd - few.checkEnd) <= 1 && Math.abs(many.chevronEnd - few.chevronEnd) <= 1 && (many.searchEnd === null || Math.abs(many.searchEnd - many.checkEnd) <= 1)), {few, many});
    }
    evidence[at] = record;
    ok(`${at}: console clean`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}
await browser.close();
await server.close();
console.log(JSON.stringify(evidence));
report();
