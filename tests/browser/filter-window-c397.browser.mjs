#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// Owner decision C397 (2026-11-21, popup head round 3, PH-8..10; refines
// C314) on the filter window, by real clicks:
// PH-8 the first row's text stands from the head's line, and the last row's
// from the footer's, as the rows' text stands from the side (16, 12 compact);
// PH-9 the popover's footer pads as that start column, its buttons on the
// rows' text; PH-10 the condition band reads «Условие: любой из», one medium
// text, the band one grey through «любой из» -> «ни один из» -> «не задано»
// -> «задано»; an excluding condition's words in the error ink above 4.5:1
// at rest and under the pointer; the menu without dots, the excluding row
// in the error ink above 4.5:1. 1440 and 390, light and dark, three loads.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const MIN_CONTRAST = 4.5;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';
const OPENERS = [];
for (const density of ['normal', 'compact']) for (const n of [3, 30]) OPENERS.push({id: `o-${density}-${n}`, density, n});
const BODY = `<main style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">${OPENERS.map(({id, density}) => `<div ${density === 'compact' ? 'data-sf-density="compact"' : ''}><sf-button id="${id}" size="1" appearance="outline" scheme="on-surface" text="${id}"></sf-button></div>`).join('')}</main>`;

// Colours as the screen paints them: a 1 px canvas resolves any CSS colour
// (oklch, color-mix) and composes the layers over the backdrop.
const PAINT = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  const paint = (...layers) => {
    ctx.clearRect(0, 0, 1, 1);
    for (const one of layers) { ctx.fillStyle = '#000'; ctx.fillStyle = one; ctx.fillRect(0, 0, 1, 1); }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  // The opaque backdrop under a node: its backgrounds up the tree, the page's at the end.
  const backdrop = (node) => {
    const stack = [];
    for (let at = node; at; at = at.parentElement ?? at.getRootNode?.().host ?? null) {
      const style = getComputedStyle(at);
      const image = style.backgroundImage.match(/linear-gradient\((rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\))/u)?.[1];
      if (image) stack.push(image);
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') { stack.push(style.backgroundColor); if (!/rgba\(.*,\s*0?\.\d+\)|\/\s*0?\.\d/u.test(style.backgroundColor)) break; }
    }
    stack.push(getComputedStyle(document.body).backgroundColor);
    return paint(...stack.reverse());
  };
  return {paint, contrast, backdrop};
};

const READ = (paintSource) => {
  // eslint-disable-next-line no-new-func
  const {paint, contrast, backdrop} = new Function(`return (${paintSource})()`)();
  const host = document.querySelector('[data-sf-filter-window]');
  const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
  const sheet = host?.localName === 'sf-drawer';
  const panel = sheet ? scope?.querySelector('[data-sf-drawer-panel]') : scope?.querySelector('.sf-filter-window');
  const scroll = scope?.querySelector('.sf-choice-scroll');
  const labels = [...(scope?.querySelectorAll('.sf-choice-row .sf-checkbox-label') ?? [])].filter((node) => node.getBoundingClientRect().height > 0);
  const foot = sheet ? null : scope?.querySelector('.sf-filter-window-foot');
  const button = (foot ?? host)?.querySelector('button[data-action="apply"]');
  const field = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field');
  const input = field?.querySelector('input:not([type=hidden])');
  const r = (node) => node?.getBoundingClientRect();
  const out = {sheet, value: input?.value ?? null};
  if (panel && labels.length) out.side = Math.round(r(labels[0]).left - r(panel).left);
  if (scroll && labels.length) {
    out.top = Math.round(r(labels[0]).top - r(scroll).top - scroll.scrollTop * 0);
    scroll.scrollTop = scroll.scrollHeight;
    const last = labels[labels.length - 1];
    const line = foot ? r(foot).top : r(scroll).bottom;
    out.bottom = Math.round(line - r(last).bottom);
    scroll.scrollTop = 0;
  }
  if (foot && button) {
    const fs = getComputedStyle(foot);
    out.footStart = Math.round(r(button).left - r(foot).left);
    out.footTop = Math.round(r(button).top - r(foot).top - parseFloat(fs.borderTopWidth));
    out.footBottom = Math.round(r(foot).bottom - r(button).bottom);
  }
  if (field && input) {
    const before = getComputedStyle(field, '::before');
    const ink = paint(getComputedStyle(input).color);
    const back = backdrop(field);
    out.band = {fill: back.join(), caption: before.content, captionWeight: before.fontWeight, captionInk: paint(before.color).join(),
      weight: getComputedStyle(input).fontWeight, ink: ink.join(), contrast: contrast(ink, back),
      error: paint(getComputedStyle(scope.querySelector('.sf-filter-window') ?? panel).getPropertyValue('--sf-error').trim() || 'red').join()};
  }
  return out;
};

const MENU = (paintSource) => {
  // eslint-disable-next-line no-new-func
  const {paint, contrast, backdrop} = new Function(`return (${paintSource})()`)();
  const list = [...document.querySelectorAll('[role="listbox"]')].find((one) => one.getBoundingClientRect().height > 0);
  if (!list) return null;
  const red = [...list.querySelectorAll('.sf-dropdown-option-ink--error')];
  return {options: list.querySelectorAll('[role="option"]').length, dots: list.querySelectorAll('.sf-dot-item, .sf-dropdown-option-dot').length,
    red: red.map((one) => ({text: one.textContent.trim(), contrast: contrast(paint(getComputedStyle(one).color), backdrop(one))}))};
};

const evidence = {};
const paintSource = PAINT.toString();
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, head: HEAD, body: BODY})));
    await tab.waitForFunction((count) => window.SF?.fieldRenderers?.filterWindow?.open && document.querySelectorAll('sf-button > button').length >= count, OPENERS.length, {timeout: 20_000});
    await tab.evaluate((openers) => {
      for (const {id, n} of openers) {
        const field = {key: id, label: 'Менеджер', propertyType: 'choice', filter: {search: n >= 10 ? 'local' : 'off', options: Array.from({length: n}, (_, i) => ({value: `m${i}`, label: `Менеджер ${i + 1}`}))}};
        document.querySelector(`#${id} > button`).addEventListener('click', (event) => window.SF.fieldRenderers.filterWindow.open({anchor: event.currentTarget, field, value: {operator: 'in', values: []}}));
      }
    }, OPENERS);
    await tab.evaluate(() => document.fonts.ready);
    const record = {};
    for (const {id, density, n} of OPENERS) {
      const label = `${at} ${density}, ${n} options`;
      await tab.click(`#${id} > button`);
      await tab.waitForFunction(() => {
        const host = document.querySelector('[data-sf-filter-window]');
        const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
        return [...(scope?.querySelectorAll('.sf-choice-row .sf-checkbox-label') ?? [])].some((node) => node.getBoundingClientRect().height > 0);
      }, null, {timeout: 10_000}).catch(() => {});
      await tab.waitForTimeout(250);
      const first = await tab.evaluate(READ, paintSource);
      const side = first.side;
      ok(`${label}: the first row's text stands ${side} px from the head's line, as from the side (PH-8)`, side > 0 && Math.abs(first.top - side) <= 1, first);
      ok(`${label}: the last row's text stands ${side} px from the ${first.sheet ? "list's end" : "footer's line"} (PH-8)`, Math.abs(first.bottom - side) <= 1, first);
      if (!first.sheet) {
        ok(`${label}: the footer pads as the start column, its button on the rows' text (PH-9)`,
          Math.abs(first.footStart - side) <= 1 && Math.abs(first.footTop - side) <= 1 && Math.abs(first.footBottom - side) <= 1, first);
      }
      // Through the four conditions by clicks on the band and the menu's rows.
      const states = [{name: 'любой из', ...first}];
      for (const [index, name] of [[1, 'ни один из'], [2, 'не задано'], [3, 'задано'], [0, 'любой из']]) {
        const spot = await tab.evaluate(() => {
          const host = document.querySelector('[data-sf-filter-window]');
          const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
          const r = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field')?.getBoundingClientRect();
          return r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
        });
        if (spot) await tab.mouse.click(spot[0], spot[1]);
        await tab.waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].some((node) => node.getBoundingClientRect().height > 0), null, {timeout: 5000}).catch(() => {});
        await tab.waitForTimeout(150);
        if (index === 1) {
          const menu = await tab.evaluate(MENU, paintSource);
          ok(`${label}: the menu of conditions has no dots, «ни один из» in the error ink above ${MIN_CONTRAST}:1 (PH-10)`,
            menu && menu.options === 4 && menu.dots === 0 && menu.red.length === 1 && menu.red[0].text === 'ни один из' && menu.red[0].contrast >= MIN_CONTRAST, menu);
          record[`${id}-menu`] = menu;
        }
        const target = await tab.evaluate((at) => {
          const node = [...document.querySelectorAll('[role="listbox"]')].filter((list) => list.getBoundingClientRect().height > 0).flatMap((list) => [...list.querySelectorAll('[role="option"]')])[at];
          const r = node?.getBoundingClientRect();
          return r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
        }, index);
        if (target) await tab.mouse.click(target[0], target[1]);
        await tab.waitForTimeout(300);
        const state = {name, ...(await tab.evaluate(READ, paintSource))};
        if (name === 'ни один из') {
          // Under the pointer: the band's state layer over its grey.
          const r = await tab.evaluate(() => {
            const host = document.querySelector('[data-sf-filter-window]');
            const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
            const box = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field')?.getBoundingClientRect();
            return box ? [box.left + 24, box.top + box.height / 2] : null;
          });
          if (r) await tab.mouse.move(r[0], r[1]);
          await tab.waitForTimeout(200);
          state.hover = (await tab.evaluate(READ, paintSource)).band;
          await tab.mouse.move(2, 890);
          await tab.waitForTimeout(100);
        }
        states.push(state);
      }
      record[id] = states;
      const bands = states.map((state) => state.band);
      ok(`${label}: the conditions changed by clicks (${states.map((state) => state.value).join(' > ')})`, states.map((state) => state.value).join('|') === 'любой из|ни один из|не задано|задано|любой из', states.map((state) => state.value));
      ok(`${label}: the band is one grey in every state (C397, no C314 tint)`, bands.every((band) => band && band.fill === bands[0].fill), bands.map((band) => band?.fill));
      ok(`${label}: «Условие: » before the value, one medium text in every state`,
        bands.every((band) => band && /Условие: /u.test(band.caption) && band.captionWeight === '500' && band.weight === '500'), bands.map((band) => [band?.caption, band?.captionWeight, band?.weight]));
      const excluding = states.find((state) => state.name === 'ни один из');
      ok(`${label}: usual conditions and «задано / не задано» in the caption's ink, no colour`,
        states.filter((state) => state.name !== 'ни один из').every((state) => state.band.ink === state.band.captionInk), states.map(({name, band}) => [name, band.ink, band.captionInk]));
      ok(`${label}: «ни один из» in the error ink, ${excluding.band.contrast}:1 at rest and ${excluding.hover?.contrast}:1 under the pointer, both above ${MIN_CONTRAST}:1`,
        excluding.band.ink === excluding.band.error && excluding.band.ink !== excluding.band.captionInk && excluding.band.contrast >= MIN_CONTRAST && excluding.hover?.contrast >= MIN_CONTRAST, {rest: excluding.band, hover: excluding.hover});
      await tab.keyboard.press('Escape');
      await tab.waitForFunction(() => !document.querySelector('[data-sf-filter-window]'), null, {timeout: 5000}).catch(async () => { await tab.keyboard.press('Escape'); });
      await tab.waitForTimeout(150);
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
