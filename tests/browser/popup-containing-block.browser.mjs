#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [shots-dir]
//
// Every anchored Framework popup opens on its anchor wherever the anchor
// stands (docs pre-check DP-01, 2026-11-09). On ui.simai.io the calendar of a
// field at y 516 opened at y 1336: Docara's content column is
// container-type: inline-size, SF.Position took it for the containing block of
// fixed panels (Floating UI still does), and Chromium no longer makes it one,
// so the panel was moved by the column's offset a second time. A transform, a
// filter or contain: layout does make a containing block, and an overflow box
// around it clipped a fixed panel. Now SF.Position lifts the panel into the top
// layer while it is anchored, and asks a container query box instead of
// assuming.
//
// Each popup stands on the page, then in a wrapper with container-type:
// inline-size, with a transform, and with contain: layout (the last two also
// overflow: hidden and only as tall as the field, so a panel left inside is
// clipped). In each the panel opens within 8px of its anchor, where it opens on
// the page (2px), inside the viewport, and its middle is its own (nothing
// covers or clips it); Escape closes it. 1440x900 and 390x844, unscrolled and
// scrolled, light and dark, three loads, console clean.
import {readFileSync, existsSync, mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const shots = process.argv[3] ? resolve(process.argv[3]) : '';
if (shots) mkdirSync(shots, {recursive: true});
const loads = Number(process.env.SF_PROBE_LOADS || 3);
const required = ['core/core/js/core.js', 'core/core/css/core.css', 'smart/smart/input-date/js/input-date.js', 'component/component/tooltip/css/tooltip.css'];
const absent = required.filter((path) => !existsSync(join(out, path)));
if (absent.length) throw new Error(`asset(s) not found under ${out}: ${absent.join(', ')}`);

const WRAPPERS = {
  page: '',
  'container-type': 'container-type:inline-size',
  transform: 'transform:translateX(0);overflow:hidden',
  contain: 'contain:layout;overflow:hidden',
};

// id -> markup, how it opens, what it is anchored to and what opens.
const POPUPS = {
  date: {
    surface: true,
    html: '<sf-input-date id="date" label="Дата" value="2026-09-15" style="inline-size:280px"></sf-input-date>',
    ready: '#date .sf-input-field',
    open: async (page) => page.click('#date input'),
    anchor: '#date .sf-input-field',
    panel: '#date .sf-datepicker',
  },
  dropdown: {
    surface: true,
    html: `<sf-dropdown id="dropdown" label="Город" value="kazan" style="inline-size:280px">
      <sf-list-item value="kazan" text="Казань"></sf-list-item><sf-list-item value="moscow" text="Москва"></sf-list-item>
      <sf-list-item value="perm" text="Пермь"></sf-list-item></sf-dropdown>`,
    ready: '#dropdown .sf-dropdown-field',
    open: async (page) => page.click('#dropdown .sf-dropdown-field'),
    anchor: '#dropdown .sf-dropdown-field',
    panel: () => document.querySelector('#dropdown .sf-dropdown')?.__sfDropdownPortalList,
  },
  country: {
    surface: true,
    html: '<sf-input-country id="country" label="Телефон" value="+7 999 123-45-67" style="inline-size:280px"></sf-input-country>',
    ready: '#country .sf-country-code-left',
    open: async (page) => page.click('#country .sf-country-code-left'),
    anchor: '#country .sf-country-code',
    panel: '#country .sf-country-code-list',
  },
  tooltip: {
    html: `<span class="sf-tooltip-anchor" id="tooltip">
      <button id="tooltip-button" class="sf-icon-button sf-icon-button--size-1" type="button" data-tooltip="tooltip-tip" aria-label="Перетащить" style="inline-size:40px;block-size:40px">i</button>
      <span id="tooltip-tip" class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 sf-tooltip--arrow-top-center" hidden>
        <span class="sf-tooltip-content"><span class="sf-tooltip-text">Перетащить блок</span><span class="sf-tooltip-tail"></span></span>
      </span></span>`,
    ready: '#tooltip-tip[role="tooltip"]',
    open: async (page) => page.focus('#tooltip-button'),
    anchor: '#tooltip',
    panel: '#tooltip-tip',
  },
  help: {
    surface: true,
    html: '<sf-help-mark id="help" label="Подробнее" text="Уникальное имя модуля латиницей." placement="bottom"></sf-help-mark>',
    ready: '#help .sf-help-mark-button',
    open: async (page) => page.click('#help .sf-help-mark-button'),
    // sf-button-icon draws no box of its own: its button does.
    anchor: '#help .sf-help-mark-button > button',
    panel: '#help .sf-help-mark-panel',
  },
  // The menu's fill is its content's (.sf-context-menu-content); the surface draws the shadow.
  menu: {
    html: `<button id="menu-button" type="button" style="block-size:40px">Действия</button>
      <sf-menu-context id="menu" popup aria-label="Действия" entries='[{"id":"edit","text":"Изменить"},{"id":"copy","text":"Копировать"},{"id":"delete","text":"Удалить"}]'></sf-menu-context>`,
    ready: '#menu-button',
    open: async (page) => page.evaluate(() => {
      const menu = document.getElementById('menu');
      return customElements.whenDefined('sf-menu-context').then(() => menu.openFor(document.getElementById('menu-button'), {focus: 'first'}));
    }),
    anchor: '#menu-button',
    panel: '#menu > .sf-context-menu',
  },
  flyout: {
    surface: true,
    html: `<sf-menu id="flyout" label="Разделы" orientation="horizontal"
      items='[{"id":"about","label":"О компании","href":"#about"},{"id":"catalog","label":"Каталог","children":[{"id":"solutions","label":"Решения","href":"#solutions"},{"id":"products","label":"Продукты","href":"#products"}]}]'></sf-menu>`,
    ready: '#flyout [data-sf-menu-item="catalog"]',
    open: async (page) => page.click('#flyout [data-sf-menu-item="catalog"] > :is(a, button, .sf-menu-link, .sf-menu-item-link)'),
    anchor: '#flyout [data-sf-menu-item="catalog"]',
    panel: '#flyout [data-sf-menu-item="catalog"] > ul.sf-menu',
  },
};

const failures = [];
const note = (detail) => failures.push(detail);
const measures = {};
const page_ = (theme, popup, wrapper, width) => {
  const left = width > 600 ? 320 : 24;
  const style = WRAPPERS[wrapper];
  return `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
    <link rel="stylesheet" href="/distr/core/css/core.css">
    <link rel="stylesheet" href="/distr/component/tooltip/css/tooltip.css">
    <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head>
    <body style="margin:0;background:var(--sf-surface-page, Canvas)">
    <header style="block-size:240px"></header>
    <main id="wrap" style="${style};margin-inline-start:${left}px;padding:4px">${POPUPS[popup].html}</main>
    <div style="block-size:2400px"></div>
    <script src="/distr/core/js/core.js"></script></body></html>`;
};

const browser = await chromium.launch();
try {
  for (const [width, height] of [[1440, 900], [390, 844]].filter(([w]) => !process.env.SF_PROBE_WIDTHS || process.env.SF_PROBE_WIDTHS.split(',').includes(String(w)))) {
    for (const theme of ['light', 'dark']) {
      for (const popup of Object.keys(POPUPS)) {
        const base = {};
        for (const wrapper of Object.keys(WRAPPERS).filter((name) => !process.env.SF_PROBE_WRAPPERS || process.env.SF_PROBE_WRAPPERS.split(',').includes(name))) {
          for (const scrolled of [0, 160]) {
            for (let load = 1; load <= loads; load += 1) {
              const label = `${popup} ${wrapper} ${width} ${theme} scroll ${scrolled} load ${load}`;
              const page = await browser.newPage({viewport: {width, height}});
              const errors = [];
              page.on('pageerror', (error) => errors.push(String(error)));
              page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
              await page.route('http://probe.test/**', (route) => {
                const url = new URL(route.request().url());
                if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: page_(theme, popup, wrapper, width)});
                if (url.pathname === '/favicon.ico') return route.fulfill({status: 204, body: ''});
                const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
                const file = join(out, product, product, ...rest);
                const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.json') ? 'application/json; charset=utf-8'
                  : file.endsWith('.woff2') ? 'font/woff2' : 'text/javascript; charset=utf-8';
                return existsSync(file) ? route.fulfill({status: 200, contentType: type, body: readFileSync(file)}) : route.fulfill({status: 404, body: ''});
              });
              await page.goto('http://probe.test/');
              const spec = POPUPS[popup];
              try {
                await page.waitForSelector(spec.ready, {timeout: 15000, state: 'attached'});
              } catch {
                note({case: `${label}: renders`, errors});
                await page.close();
                continue;
              }
              await page.waitForTimeout(250);
              await page.evaluate((y) => window.scrollTo(0, y), scrolled);
              await page.waitForTimeout(50);
              await spec.open(page);
              await page.waitForTimeout(350);
              const got = await page.evaluate(({anchor, panel}) => {
                const find = (selector) => (selector.startsWith('() =>') ? (0, eval)(selector)() : document.querySelector(selector));
                const a = find(anchor);
                const p = find(panel);
                if (!a || !p) return {found: false, anchor: Boolean(a), panel: Boolean(p)};
                const ar = a.getBoundingClientRect();
                const pr = p.getBoundingClientRect();
                const gapY = pr.top >= ar.bottom ? pr.top - ar.bottom : ar.top >= pr.bottom ? ar.top - pr.bottom : 0;
                const gapX = pr.left >= ar.right ? pr.left - ar.right : ar.left >= pr.right ? ar.left - pr.right : 0;
                const hit = document.elementFromPoint(pr.left + pr.width / 2, pr.top + Math.min(pr.height / 2, 12));
                let lifted = false;
                try { lifted = p.matches(':popover-open'); } catch { /* no popovers */ }
                const css = getComputedStyle(p);
                const look = ['background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'padding-top', 'padding-left', 'overflow-x', 'overflow-y', 'box-shadow', 'border-top-left-radius', 'color', 'font-size']
                  .map((name) => `${name}:${css.getPropertyValue(name)}`).join(';');
                return {found: true, shown: pr.width > 0 && pr.height > 0, look, size: [Math.round(pr.width), Math.round(pr.height)],
                  dcx: Math.round((pr.left + pr.width / 2) - (ar.left + ar.width / 2)),
                  dx: Math.round(pr.left - ar.left), dy: Math.round(pr.top - ar.top), gap: Math.round(Math.max(gapX, gapY)),
                  inside: pr.left >= -1 && pr.top >= -1 && pr.right <= innerWidth + 1 && pr.bottom <= innerHeight + 1,
                  own: Boolean(hit && (p.contains(hit) || hit === p)), lifted, color: getComputedStyle(p).color,
                  background: getComputedStyle(p).backgroundColor};
              }, {anchor: spec.anchor, panel: typeof spec.panel === 'function' ? `() => (${spec.panel.toString()})()` : spec.panel});
              if (shots && load === 1) await page.screenshot({path: join(shots, `${popup}-${wrapper}-${width}-${theme}-${scrolled}.png`)});
              // Escape closes it, and the focus stays in the popup's own control.
              await page.keyboard.press('Escape');
              await page.waitForTimeout(200);
              const closed = await page.evaluate(({panel}) => {
                const p = panel.startsWith('() =>') ? (0, eval)(panel)() : document.querySelector(panel);
                return !p || !p.isConnected || p.hidden || p.getBoundingClientRect().height === 0 || getComputedStyle(p).visibility === 'hidden';
              }, {panel: typeof spec.panel === 'function' ? `() => (${spec.panel.toString()})()` : spec.panel});
              measures[label] = got;
              if (!got.found || !got.shown) note({case: `${label}: opens`, got});
              else {
                if (got.gap > 8) note({case: `${label}: within 8px of its anchor`, got});
                if (!got.inside) note({case: `${label}: inside the viewport`, got});
                if (!got.own) note({case: `${label}: nothing covers or clips it`, got});
                const key = `${scrolled}`;
                if (wrapper === 'page') base[key] = base[key] || got;
                // Start-aligned panels keep their start, centred ones (a tooltip) their centre: a
                // tooltip whose text settled a pixel wider moves its start, not its centre.
                else if (base[key] && ((Math.abs(base[key].dx - got.dx) > 2 && Math.abs(base[key].dcx - got.dcx) > 2) || Math.abs(base[key].dy - got.dy) > 2)) {
                  note({case: `${label}: where it opens on the page`, got, page: base[key]});
                }
                // Lifted, it looks as it does in place: the user-agent popover look
                // (Canvas, a border, padding, overflow) is taken back below the component's sheet.
                if (base[key] && base[key].look !== got.look) note({case: `${label}: keeps its look`, got, page: base[key]});
                if (spec.surface && /rgba\(0, 0, 0, 0\)|transparent/u.test(got.background)) note({case: `${label}: keeps its fill`, got});
              }
              if (!closed) note({case: `${label}: Escape closes it`});
              if (errors.length) note({case: `${label}: console clean`, errors});
              await page.close();
            }
          }
        }
      }
    }
  }
} finally {
  await browser.close();
}
const summary = {};
for (const [label, got] of Object.entries(measures)) {
  const [popup] = label.split(' ');
  summary[popup] = summary[popup] || {runs: 0, maxGap: 0, lifted: 0};
  summary[popup].runs += 1;
  summary[popup].maxGap = Math.max(summary[popup].maxGap, got.gap ?? 99);
  summary[popup].lifted += got.lifted ? 1 : 0;
}
console.log(JSON.stringify({summary, runs: Object.keys(measures).length}, null, 1));
if (process.env.SF_PROBE_MEASURES) console.log(JSON.stringify(measures, null, 1));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 60), count: failures.length}, null, 1)); process.exit(1); }
console.log('POPUP_CONTAINING_BLOCK_OK');
