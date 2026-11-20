#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--json file]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The width ladder in characters (owner decision C396, 2026-11-19; C178: every
// general rule has an automatic check in the pair build; the source half is
// tests/measure-c396.contract.test.mjs). A text container keeps its number of
// characters per line whatever the body text is: 16 (a desktop at normal
// density), 14 (compact density on the page or on a region, and a phone) and
// 20 (the browser's font size at 125 %). One character is half the body text
// size (--sf-measure--char), so a container N characters wide is N x that,
// within one character.
//
// Read on the built bytes, in a browser: core.css and the sheets of the text
// containers (tooltip, tags, the notification area, the help mark's panel,
// the drawer's widths, the site header's side panel, the bottom sheet of a
// window, the question and form windows), each drawn with a line longer than
// it. A container the screen caps (min(step, 100vw - ...)) is read only where
// the step is narrower than the screen. Exits 1 on failure.
import {existsSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

const args = process.argv.slice(2);
const out = args[0] ? resolve(args[0]) : null;
if (!out || !existsSync(join(out, 'core'))) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt > 0 ? args[jsonAt + 1] : null;

const STEPS = [20, 28, 36, 44, 52, 64, 80, 96];
const ROLES = {
  '--sf-popup-menu-min-width': 20,
  '--sf-popup-menu-max-width': 36,
  '--sf-popup-list-max-width': 44,
  '--sf-popup-panel-width': 44,
  '--sf-popup-form-width': 44,
  '--sf-popup-form-wide-width': 52,
  '--sf-popup-question-width': 52,
  '--sf-popup--window-form-width': 80,
  '--sf-popup--window-wide-width': 96,
  '--sf-field--width-short': 20,
  '--sf-field--width-medium': 28,
  '--sf-field--width-long': 44,
  '--sf-text--measure': 80,
  '--sf-text--measure-wide': 96,
  '--sf-text--measure-narrow': 52,
};
const LONG = 'Ширина в знаках следует за размером текста, поэтому в строке столько же знаков при любой плотности и любом шрифте браузера. '.repeat(4);
// [name, characters, markup, the element read]; the markup stands in the scope.
const CONTAINERS = [
  ['tooltip', 44, `<div class="sf-tooltip" role="tooltip" data-read>${LONG}</div>`],
  ['tag', 44, `<div style="inline-size:2000px"><span class="sf-tag" data-read style="display:inline-flex;white-space:nowrap;overflow:hidden"><span class="sf-tag-label">${LONG}</span></span></div>`],
  ['notification area', 52, '<div class="sf-notifications" data-read style="position:static"></div>'],
  ['help mark', 44, `<div class="sf-help-mark-panel" data-read style="position:static">${LONG}</div>`],
  ['drawer 1/2', 44, '<div class="sf-drawer" data-sf-drawer-size="1/2"><div data-read style="inline-size:var(--sf-drawer-width)"></div></div>'],
  ['drawer 1', 52, '<div class="sf-drawer" data-sf-drawer-size="1"><div data-read style="inline-size:var(--sf-drawer-width, var(--sf-measure-52))"></div></div>'],
  ['drawer 2', 64, '<div class="sf-drawer" data-sf-drawer-size="2"><div data-read style="inline-size:var(--sf-drawer-width)"></div></div>'],
  ['site header panel', 44, '<div class="sf-site-header"><div data-read style="inline-size:var(--sf-site-header--sheet-size)"></div></div>'],
  ['window bottom sheet', 96, `<div class="sf-modal" data-sf-modal-position="bottom"><div data-sf-modal-panel data-read style="position:static">${LONG}</div></div>`],
  ['question window', 52, '<div class="sf-modal sf-modal--size-question"><div data-sf-modal-panel data-read style="position:static"></div></div>'],
];
const SHEETS = ['component/component/tooltip/css/tooltip.css', 'component/component/tags/css/tags.css', 'component/component/toast/css/toast.css',
  'component/component/modal/css/modal.css', 'smart/smart/help-mark/css/help-mark.css', 'smart/smart/drawer/css/drawer.css', 'smart/smart/header-site/css/header-site.css'];
// [name, viewport width, attributes of <html>, a region attribute or null, the body text expected]
const VIEWS = [
  ['desktop, normal, light', 1440, 'class="theme-light"', null, 16],
  ['desktop, normal, dark', 1440, 'class="theme-dark"', null, 16],
  ['desktop, compact page', 1440, 'class="theme-light" data-sf-density="compact"', null, 14],
  ['desktop, compact region', 1440, 'class="theme-light"', 'data-sf-density="compact"', 14],
  ['desktop, normal region in a compact page', 1440, 'class="theme-light" data-sf-density="compact"', 'data-sf-density="normal"', 16],
  ['desktop, browser font 125 %', 1440, 'class="theme-light" style="font-size:125%"', null, 20],
  ['phone', 390, 'class="theme-light"', null, 14],
];

const browser = await chromium.launch({headless: true});
const failures = [];
const rows = [];
try {
  for (const [view, width, html, region, expectedText] of VIEWS) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push(`${view}: page error ${error.message}`); });
    const scope = (inner) => region ? `<div ${region}>${inner}</div>` : inner;
    const probes = [
      ...STEPS.map((n) => `<div data-probe="step" data-name="--sf-measure-${n}" data-n="${n}" style="inline-size:var(--sf-measure-${n})"></div>`),
      ...Object.entries(ROLES).map(([name, n]) => `<div data-probe="role" data-name="${name}" data-n="${n}" style="inline-size:var(${name})"></div>`),
      ...CONTAINERS.map(([name, n, markup]) => `<div data-probe="container" data-name="${name}" data-n="${n}">${markup}</div>`),
    ].join('');
    await page.setContent(`<!doctype html><html lang="ru" ${html}><head><meta charset="utf-8"><style>*,*::before,*::after{transition:none!important;animation:none!important}[data-probe]{display:block}</style></head><body style="margin:0">${scope(`<div data-text style="inline-size:var(--sf-text--size-1)"></div>${probes}`)}</body></html>`);
    for (const sheet of ['core/core/css/core.css', ...SHEETS]) {
      if (!existsSync(join(out, sheet))) { failures.push(`${view}: no sheet ${sheet}`); continue; }
      await page.addStyleTag({path: join(out, sheet)});
    }
    const measured = await page.evaluate(() => {
      const text = document.querySelector('[data-text]').getBoundingClientRect().width;
      return {
        text,
        viewport: document.documentElement.clientWidth,
        rows: [...document.querySelectorAll('[data-probe]')].map((probe) => {
          const target = probe.dataset.probe === 'container' ? probe.querySelector('[data-read]') : probe;
          return {kind: probe.dataset.probe, name: probe.dataset.name, n: Number(probe.dataset.n), px: target ? target.getBoundingClientRect().width : null};
        }),
      };
    });
    if (Math.abs(measured.text - expectedText) > 0.01) failures.push(`${view}: the body text is ${measured.text}px, not ${expectedText}`);
    const char = measured.text / 2;
    for (const row of measured.rows) {
      const chars = row.px ? row.px / char : 0;
      // A step the screen caps is not read (min(step, 100vw - insets)).
      const capped = row.n * char > measured.viewport - 2 * 16;
      const ok = capped && row.kind === 'container' ? true : Math.abs(chars - row.n) <= 1;
      rows.push({view, ...row, px: row.px === null ? null : Math.round(row.px * 100) / 100, chars: Math.round(chars * 100) / 100, capped: capped && row.kind === 'container', ok});
      if (!ok) failures.push(`${view}: ${row.kind} ${row.name} is ${row.px}px, ${chars.toFixed(2)} characters of ${char}px, not ${row.n} (±1)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const summary = {checks: rows.length, passed: rows.filter((row) => row.ok).length, failed: failures.length};
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify({summary, rows, failures}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
for (const failure of failures) process.stdout.write(`FAIL ${failure}\n`);
if (failures.length) process.exitCode = 1;
