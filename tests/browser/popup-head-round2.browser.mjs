#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [loads]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// DEV's popup head round 2 (msg-6e97b4ec, group build 16 G8), by real
// presses and keys at 1440 and 390, light and dark, three loads:
// - PH-1: a mouse press on a choice field's value draws no focus ring (a
//   plain sf-dropdown and the filter window's band); the keyboard's Tab to
//   the field rings it;
// - PH-2: no caret in the read-only value (caret-color transparent);
// - PH-3: the band at the window's top has the window's radius on its two
//   top corners, so its inward ring follows them (the ring drawn, keyboard);
// - PH-6: with 30 options (a scrollbar) the search icon, the band's chevron
//   and the rows' checks end in one column; with 3 (none) too.
// PH-4 and PH-5 are popup-head-parts.browser.mjs. A clean console.
import {chromium} from 'playwright';
import {serveBuild, russianPage, launchBrowser, watchConsole, CASES, results} from '../support/build-pages.mjs';

if (!process.argv[2]) throw new Error('Build output root is required');
const LOADS = Number(process.argv[3]) || 3;
const server = await serveBuild(process.argv[2]);
const browser = await launchBrowser(chromium);
const {ok, report} = results();
const near = (a, b, tolerance = 1) => a !== null && b !== null && Math.abs(a - b) <= tolerance;

const HEAD = '<script type="module" src="/distr/smart/field-renderers/js/field-renderers.js"></script>';
const BODY = `<main style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">
  <input id="before" aria-label="Перед полем">
  <sf-dropdown id="plain" size="1" mode="select" label="Город"><sf-list-item kind="text" value="a" text="Альфа" selected></sf-list-item><sf-list-item kind="text" value="b" text="Бета"></sf-list-item></sf-dropdown>
  <sf-button id="f3" size="1" appearance="outline" scheme="on-surface" text="Фильтр, 3"></sf-button>
  <sf-button id="f30" size="1" appearance="outline" scheme="on-surface" text="Фильтр, 30"></sf-button>
</main>`;

const RING = (selector) => {
  const field = document.querySelector(selector);
  if (!field) return null;
  const style = getComputedStyle(field);
  const input = field.querySelector('input');
  return {outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0, caret: input ? getComputedStyle(input).caretColor : null,
    radiusStart: style.borderStartStartRadius, radiusEnd: style.borderStartEndRadius, active: document.activeElement?.className ?? ''};
};
const WINDOW = () => {
  const host = document.querySelector('[data-sf-filter-window]');
  const scope = host?.localName === 'sf-drawer' ? host.getDrawerRoot?.() ?? host : host;
  const surface = scope?.querySelector('.sf-filter-window');
  const field = scope?.querySelector('.sf-filter-window-condition .sf-dropdown-field');
  const glyphEnd = (node) => node?.getBoundingClientRect().right ?? null;
  const check = [...(scope?.querySelectorAll('.sf-filter-window .sf-checkbox-box') ?? [])].find((node) => node.getBoundingClientRect().height > 0);
  const scroller = scope?.querySelector('.sf-choice-scroll');
  const style = field ? getComputedStyle(field) : null;
  return {
    sheet: host?.localName === 'sf-drawer',
    windowRadius: surface ? getComputedStyle(surface).borderStartStartRadius : null,
    bandRadius: style?.borderStartStartRadius ?? null, bandRadiusEnd: style?.borderStartEndRadius ?? null,
    bandRing: style ? style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 : null,
    bandAtTop: surface && field ? Math.abs(field.getBoundingClientRect().top - surface.getBoundingClientRect().top) <= 1 : null,
    caret: field?.querySelector('input') ? getComputedStyle(field.querySelector('input')).caretColor : null,
    chevron: glyphEnd(scope?.querySelector('.sf-filter-window-condition .sf-dropdown-chevron i.sf-icon')),
    search: glyphEnd(scope?.querySelector('.sf-choice-search-icon i.sf-icon, .sf-choice-search-icon')),
    check: glyphEnd(check),
    scrollbar: scroller ? scroller.offsetWidth - scroller.clientWidth : null,
    active: document.activeElement?.closest?.('.sf-filter-window-condition') ? 'band' : (document.activeElement?.className ?? ''),
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
    await tab.waitForFunction(() => window.SF?.fieldRenderers?.filterWindow?.open && document.querySelector('#plain .sf-dropdown-field input')
      && document.querySelectorAll('sf-button > button').length >= 2, null, {timeout: 20_000});
    await tab.evaluate(() => {
      for (const [id, n] of [['f3', 3], ['f30', 30]]) {
        const field = {key: id, label: 'Менеджер', propertyType: 'choice', filter: {search: n >= 10 ? 'local' : 'off', options: Array.from({length: n}, (_, i) => ({value: `m${i}`, label: `Менеджер ${i + 1}`}))}};
        document.querySelector(`#${id} > button`).addEventListener('click', (event) => window.SF.fieldRenderers.filterWindow.open({anchor: event.currentTarget, field, value: {operator: 'in', values: []}}));
      }
    });
    await tab.evaluate(() => document.fonts.ready);
    const record = {};

    // PH-1, PH-2 on a plain choice field: a mouse press, then the keyboard.
    await tab.click('#plain .sf-dropdown-field input');
    await tab.waitForTimeout(250);
    record.plainPress = await tab.evaluate(RING, '#plain .sf-dropdown-field');
    await tab.keyboard.press('Escape');
    await tab.mouse.click(5, 5);
    await tab.focus('#before');
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(150);
    record.plainKey = await tab.evaluate(RING, '#plain .sf-dropdown-field');
    ok(`${at} PH-1: a mouse press on the value draws no ring`, record.plainPress?.outline === false, record.plainPress);
    ok(`${at} PH-1: Tab to the field rings it`, record.plainKey?.outline === true, record.plainKey);
    ok(`${at} PH-2: no caret in the read-only value`, record.plainPress?.caret === 'rgba(0, 0, 0, 0)', record.plainPress);

    for (const n of [3, 30]) {
      // The filter window by a real click; the band pressed with the mouse.
      await tab.click(`#f${n} > button`);
      await tab.waitForFunction(() => document.querySelector('[data-sf-filter-window] .sf-filter-window-condition .sf-dropdown-field'), null, {timeout: 10_000}).catch(() => {});
      await tab.waitForTimeout(300);
      const open = await tab.evaluate(WINDOW);
      // A real press at the value's middle (in a phone's sheet the drawer's
      // panel is drawn over the host, so the mouse goes where the eye sees it).
      const spot = await tab.evaluate(() => { const box = document.querySelector('[data-sf-filter-window] .sf-filter-window-condition .sf-dropdown-field input')?.getBoundingClientRect(); return box ? [box.left + box.width / 3, box.top + box.height / 2] : null; });
      if (spot) await tab.mouse.click(spot[0], spot[1]);
      await tab.waitForTimeout(250);
      const press = await tab.evaluate(WINDOW);
      await tab.keyboard.press('Escape');
      await tab.waitForTimeout(150);
      // The band by the keyboard: a key press inside the window (the page's
      // focus modality is the keyboard's), then the band's trigger focused.
      await tab.keyboard.press('Tab');
      await tab.evaluate(() => document.querySelector('[data-sf-filter-window] .sf-filter-window-condition .sf-dropdown-field > button')?.focus());
      await tab.waitForTimeout(150);
      const key = await tab.evaluate(WINDOW);
      record[`window${n}`] = {open, press, key};
      ok(`${at} ${n} PH-1: a mouse press on the band draws no ring`, press.bandRing === false, press);
      ok(`${at} ${n} PH-2: no caret in the band's value`, press.caret === 'rgba(0, 0, 0, 0)', press);
      if (!open.sheet) {
        ok(`${at} ${n} PH-3: the band at the window's top has the window's corners`, open.bandAtTop === true && open.bandRadius === open.windowRadius && open.bandRadiusEnd === open.windowRadius && open.windowRadius !== '0px', open);
        ok(`${at} ${n} PH-3: the keyboard rings the band inside those corners`, key.active === 'band' && key.bandRing === true && key.bandRadius === key.windowRadius, key);
      }
      ok(`${at} ${n} PH-6: the chevron ends in the checks' column${open.scrollbar ? ' (scrollbar)' : ''}`, near(open.chevron, open.check), open);
      if (open.search !== null) ok(`${at} ${n} PH-6: the search icon ends in the checks' column${open.scrollbar ? ' (scrollbar)' : ''}`, near(open.search, open.check), open);
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
