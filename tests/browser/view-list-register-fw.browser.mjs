#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The SIMAI Framework side of the owner's remarks on the View list (ui-control
// control/standards/view-list-register.json, 2026-11-22), by real clicks, at
// 1440, 768 and 390, light and dark, three loads each:
// VL-43 the filter window's condition head «Условие: любой из» is paler than
//   a chip (a tonal button's plate) in every condition state;
// VL-45 the window's footer buttons start where the options' text starts
//   (C397 PH-9: 16 on a desktop, the sheet's 12 on a phone);
// VL-54 a choice cell's badge, as the field renderers give it to a table, is
//   the row's text size (16 at size 1, 14 compact) and keeps a word's room;
// VL-65 the words of a value not set (sf-list-description's empty) are
//   paler than the label and hold 4.5:1 (C402).
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const CASES = [1440, 768, 390].flatMap((width) => ['light', 'dark'].map((theme) => ({width, theme})));
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();

const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';
const STATUS = [{value: 'new', label: 'Новый', color: 'info'}, {value: 'wait', label: 'Ждёт оплаты', color: 'warning'}, {value: 'paid', label: 'Оплачен', color: 'success'}, {value: 'sent', label: 'Отправлен', color: 'teal'}];
const BODY = `<main style="display:flex;flex-direction:column;gap:16px;align-items:flex-start">
<div style="display:flex;gap:8px"><sf-button id="chip" size="1" appearance="tonal" scheme="on-surface" text="Состояние"></sf-button><sf-button id="open" size="1" appearance="outline" scheme="on-surface" text="Фильтр"></sf-button></div>
<table style="border-collapse:collapse"><tbody>
<tr id="row-normal" class="text-1"><td data-key="client">ООО «Ромашка»</td><td data-key="status" id="cell-normal"></td></tr>
<tr id="row-compact" data-sf-density="compact" class="text-1"><td data-key="client">ООО «Север»</td><td data-key="status" id="cell-compact"></td></tr>
</tbody></table>
<sf-list-description id="record" label="Запись"><script type="application/json" data-sf-settings>{"items": [{"label": "Клиент", "value": "ООО «Ромашка»"}, {"label": "Комментарий", "value": "", "empty": "не заполнено"}]}</script></sf-list-description>
</main>`;

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
  const alpha = (colour) => { const m = String(colour).match(/rgba?\(([^)]+)\)/u); if (!m) return null; const p = m[1].split(/[ ,/]+/u).filter(Boolean); return p.length > 3 ? Math.round(+p[3] * 100) / 100 : 1; };
  const backdrop = (node) => {
    const stack = [];
    for (let at = node; at; at = at.parentElement ?? at.getRootNode?.().host ?? null) {
      const style = getComputedStyle(at);
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') { stack.push(style.backgroundColor); if (alpha(style.backgroundColor) === 1) break; }
    }
    stack.push(getComputedStyle(document.body).backgroundColor);
    return paint(...stack.reverse());
  };
  return {paint, contrast, alpha, backdrop, lum};
};

const WINDOW = (paintSource) => {
  // eslint-disable-next-line no-new-func
  const {alpha} = new Function(`return (${paintSource})()`)();
  const host = document.querySelector('[data-sf-filter-window]');
  const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
  const sheet = host?.localName === 'sf-drawer';
  const frame = sheet ? scope?.querySelector('[data-sf-drawer-panel]') : scope?.querySelector('.sf-filter-window');
  const labels = [...(scope?.querySelectorAll('.sf-choice-row .sf-checkbox-label') ?? [])].filter((node) => node.getBoundingClientRect().height > 0);
  const apply = [...(sheet ? scope?.querySelectorAll('button') ?? [] : scope?.querySelectorAll('.sf-filter-window-foot button') ?? [])].filter((b) => b.getBoundingClientRect().height > 0 && /Применить/u.test(b.textContent));
  const field = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field');
  const input = field?.querySelector('input:not([type=hidden])');
  const chip = document.querySelector('#chip > button');
  const left = (node) => Math.round(node.getBoundingClientRect().left - frame.getBoundingClientRect().left);
  return {sheet, value: input?.value ?? null, caption: field ? getComputedStyle(field, '::before').content : null,
    bandFill: field ? alpha(getComputedStyle(field).backgroundColor) : null, chipFill: chip ? alpha(getComputedStyle(chip).backgroundColor) : null,
    textStart: frame && labels.length ? left(labels[0]) : null, footStart: frame && apply.length ? left(apply[0]) : null};
};

const CELLS = (paintSource) => {
  // eslint-disable-next-line no-new-func
  const {paint, contrast, backdrop} = new Function(`return (${paintSource})()`)();
  const out = {};
  for (const key of ['normal', 'compact']) {
    const badge = document.querySelector(`#cell-${key} .sf-badge`);
    const text = badge?.querySelector('.sf-badge-text') ?? badge;
    const cell = document.querySelector(`#row-${key} td[data-key="client"]`);
    out[key] = badge ? {badge: parseFloat(getComputedStyle(text).fontSize), row: parseFloat(getComputedStyle(cell).fontSize),
      room: parseFloat(getComputedStyle(badge).paddingInlineStart), height: Math.round(badge.getBoundingClientRect().height),
      line: parseFloat(getComputedStyle(cell).lineHeight)} : null;
  }
  const empty = document.querySelector('#record .sf-list-description-empty');
  const label = document.querySelector('#record .sf-list-description-label');
  if (empty && label) {
    const back = backdrop(empty);
    out.notSet = {empty: contrast(paint(...[getComputedStyle(document.body).backgroundColor, getComputedStyle(empty).color]), back), label: contrast(paint(getComputedStyle(document.body).backgroundColor, getComputedStyle(label).color), back), emptyColour: getComputedStyle(empty).color, labelColour: getComputedStyle(label).color};
  }
  return out;
};

const paintSource = PAINT.toString();
for (const {width, theme} of CASES) {
  for (let load = 1; load <= LOADS; load += 1) {
    const at = `${width} ${theme} #${load}`;
    const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme, locale: 'ru-RU', reducedMotion: 'reduce', hasTouch: width < 768});
    const tab = await context.newPage();
    const errors = watchConsole(tab);
    await tab.goto(server.page(russianPage({theme, head: HEAD, body: BODY})));
    await tab.waitForFunction(() => window.SF?.fieldRenderers?.filterWindow?.open && window.SF.fieldRenderers.renderCellField && document.querySelectorAll('sf-button > button').length >= 2 && document.querySelector('#record .sf-list-description-empty'), null, {timeout: 20_000});
    await tab.evaluate((status) => {
      const field = {key: 'status', label: 'Состояние', propertyType: 'choice', options: status, filter: {options: status}};
      document.querySelector('#open > button').addEventListener('click', (event) => window.SF.fieldRenderers.filterWindow.open({anchor: event.currentTarget, field, value: {operator: 'in', values: []}}));
      // The cell as a table draws it: the component the field renderers give, its props as attributes.
      for (const key of ['normal', 'compact']) {
        const {component} = window.SF.fieldRenderers.renderCellField(field, key === 'normal' ? 'wait' : 'paid', {});
        const badge = document.createElement(`sf-${component.type}`);
        for (const [name, value] of Object.entries(component.props)) {
          if (name === 'rootStyle') badge.setAttribute('style', value);
          else badge.setAttribute(name, value);
        }
        document.querySelector(`#cell-${key}`).append(badge);
      }
    }, STATUS);
    await tab.waitForFunction(() => document.querySelectorAll('td .sf-badge').length === 2, null, {timeout: 10_000}).catch(() => {});
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(300);
    const cells = await tab.evaluate(CELLS, paintSource);
    for (const key of ['normal', 'compact']) {
      const c = cells[key];
      ok(`${at}: VL-54 the ${key} row's badge is the row's text (${c?.badge} = ${c?.row}), a word's room ${c?.room}, within the line`, c && c.badge === c.row && c.room >= 8 && c.height <= c.line, c);
    }
    const n = cells.notSet;
    ok(`${at}: VL-65 «не заполнено» ${n?.empty}:1 paler than the label ${n?.label}:1 and at least 4.5:1`, n && n.empty >= 4.5 && n.empty < n.label, n);

    // The filter window, opened by a real click on «Фильтр».
    await tab.click('#open > button');
    await tab.waitForFunction(() => {
      const host = document.querySelector('[data-sf-filter-window]');
      const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
      return [...(scope?.querySelectorAll('.sf-choice-row .sf-checkbox-label') ?? [])].some((node) => node.getBoundingClientRect().height > 0);
    }, null, {timeout: 10_000}).catch(() => {});
    await tab.waitForTimeout(400);
    const states = [await tab.evaluate(WINDOW, paintSource)];
    const first = states[0];
    ok(`${at}: VL-45 the footer's «Применить» starts at the options' text (${first.footStart} / ${first.textStart})`, first.footStart !== null && first.textStart !== null && Math.abs(first.footStart - first.textStart) <= 1, first);
    // Through the conditions by clicks on the band and the menu's rows.
    for (const index of [1, 2, 0]) {
      const spot = await tab.evaluate(() => {
        const host = document.querySelector('[data-sf-filter-window]');
        const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
        const r = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field')?.getBoundingClientRect();
        return r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
      });
      if (spot) await tab.mouse.click(spot[0], spot[1]);
      await tab.waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].some((node) => node.getBoundingClientRect().height > 0), null, {timeout: 5000}).catch(() => {});
      await tab.waitForTimeout(150);
      const target = await tab.evaluate((i) => {
        const node = [...document.querySelectorAll('[role="listbox"]')].filter((list) => list.getBoundingClientRect().height > 0).flatMap((list) => [...list.querySelectorAll('[role="option"]')])[i];
        const r = node?.getBoundingClientRect();
        return r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
      }, index);
      if (target) await tab.mouse.click(target[0], target[1]);
      await tab.mouse.move(2, 890);
      await tab.waitForTimeout(300);
      states.push(await tab.evaluate(WINDOW, paintSource));
    }
    ok(`${at}: VL-43 the condition head reads «Условие: ${first.value}» and changed by clicks (${states.map((s) => s.value).join(' > ')})`,
      /Условие: /u.test(first.caption ?? '') && first.value === 'любой из' && new Set(states.map((s) => s.value)).size >= 3, states.map((s) => [s.caption, s.value]));
    ok(`${at}: VL-43 the head's fill ${states.map((s) => s.bandFill).join('/')} is under the chip's ${first.chipFill} in every state`,
      states.every((s) => s.bandFill !== null && s.chipFill !== null && s.bandFill < s.chipFill), states.map((s) => [s.bandFill, s.chipFill]));
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(300);
    ok(`${at}: no console errors, warnings or failed requests`, errors.length === 0, errors.slice(0, 4));
    await context.close();
  }
}
await browser.close();
await server.close();
report();
