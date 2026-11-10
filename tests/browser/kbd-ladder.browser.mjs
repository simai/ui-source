#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every theme x viewport.
//
// Keys are sized from the ladder (owner decision C38, 2026-11-09, which
// replaces C04's 0.8125em / 1.6em; ui-control control/research/
// 2026-11-09-kbd-sizing.md, prototypes/kbd-sizing.html). A plate takes the
// text step one below the text of its place: the plate is that step's line
// height, the letters its size, never below step 1/3. On the built bytes,
// over the Loader, in the light and the dark theme, on a desktop (1280) and
// a phone (390), a Mac emulated so one-character keys are glyphs:
//
//   - sf-button and sf-input of size 1/3, 1/2, 1, 2 and 3: plate / letters
//     16/12, 16/12, 20/14, 24/16, 28/20 on the desktop; 16/12, 16/12, 16/12,
//     20/14, 24/16 on the phone;
//   - compact density (desktop): a button and a field without a size stand
//     at 32 and take 16/12; an explicit size 2 keeps 24/16; a plain
//     paragraph there (the region's 14/20) 16/12, the line not grown;
//   - a one-character key is a square; a word is at least as wide as high;
//     the room on each side and the gap between keys are --sf-space-1/4;
//   - keys in running text: body 16/24 -> 20/14, sf-text-1/2 14/20 -> 16/12,
//     the line does not grow (16/12 everywhere on the phone);
//   - keys in running text are centred in the line (top and bottom gaps
//     within 0.5 px);
//   - a bare control (a native button, the button, combobox and searchbox
//     roles) without a size class takes size 1's plates;
//   - plain glyphs in a menu row and a tooltip: the letters of the row's
//     label, not a step smaller;
//   - sf-input shortcut: the keys drawn at the end of the field and
//     vertically centred in it (top and bottom gaps within 0.5 px), the
//     native input saying aria-keyshortcuts;
//   - the line box: in sf-button and sf-input the keys' group has the
//     plate's line and is as high as the plate; plain glyphs in a menu and a
//     tooltip have the glyphs' line, their letters' size (pair
//     ui-a0370c0c99fb acceptance, F2: the group had the label's line, normal,
//     and plain glyphs the row's 20 / 16).
//
// Console clean on every page.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const id = (size) => size.replace('/', '-');
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/tooltip/css/tooltip.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}
main{display:flex;flex-direction:column;gap:var(--sf-space-1);padding:var(--sf-space-1);max-inline-size:100%;box-sizing:border-box}
.row{display:flex;flex-wrap:wrap;gap:var(--sf-space-1\\/2);align-items:center}
.field{inline-size:18rem;max-inline-size:100%}
.prose{margin:0;max-inline-size:22rem}
.tip{position:static;display:inline-flex;inset:auto;opacity:1;visibility:visible;transform:none}</style></head><body><main>
<div class="row" id="buttons">${SIZES.map((size) => `<sf-button id="b-${id(size)}" size="${size}" appearance="outline" scheme="on-surface" text="Поиск" shortcut="mod+k"></sf-button>`).join('')}
<sf-button id="b-word" text="Закрыть" appearance="outline" scheme="on-surface" shortcut="escape"></sf-button></div>
<div class="row" id="inputs">${SIZES.map((size) => `<div class="field"><sf-input id="i-${id(size)}" size="${size}" placeholder="Поиск" aria-label="Поиск" icon-start="search" shortcut="mod+k"></sf-input></div>`).join('')}</div>
<div class="row" id="compact" data-sf-density="compact">
<sf-button id="c-button" appearance="outline" scheme="on-surface" text="Сохранить" shortcut="mod+s"></sf-button>
<sf-button id="c-2" size="2" appearance="outline" scheme="on-surface" text="Сохранить" shortcut="mod+s"></sf-button>
<div class="field"><sf-input id="c-input" placeholder="Поиск" aria-label="Поиск" shortcut="mod+k"></sf-input></div>
<p class="prose" id="c-body">Открыть поиск: <kbd>Ctrl</kbd> <kbd class="sf-kbd--square">K</kbd>.</p></div>
<p class="prose" id="body">Откройте поиск: <kbd>Ctrl</kbd> <kbd class="sf-kbd--square">K</kbd>.</p>
<p class="prose sf-text-1/2" id="small">Сохранить — <kbd>Ctrl</kbd> <kbd class="sf-kbd--square">S</kbd>.</p>
<div class="row" id="bare"><button type="button" id="bare-button">Найти <kbd>Ctrl</kbd></button>
<span role="button" tabindex="0" id="bare-role">Найти <kbd>Ctrl</kbd></span>
<span role="combobox" aria-expanded="false" tabindex="0" id="bare-combobox">Раздел <kbd>Ctrl</kbd></span>
<span role="searchbox" tabindex="0" id="bare-searchbox">Поиск <kbd>Ctrl</kbd></span></div>
<div class="row"><sf-menu-context id="menu" aria-label="Правка"></sf-menu-context>
<div class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 tip" role="tooltip" id="tip"><div class="sf-tooltip-content"><div class="sf-tooltip-wrap"><div class="sf-tooltip-text">Жирный <kbd class="sf-kbd--group"><kbd class="sf-kbd--square">⌘</kbd><kbd class="sf-kbd--square">B</kbd></kbd></div></div></div></div></div>
</main><script>
customElements.whenDefined('sf-menu-context').then(() => {
  document.getElementById('menu').entries = [
    {id: 'copy', text: 'Копировать', icon: 'content_copy', shortcut: 'mod+c'},
    {id: 'redo', text: 'Повторить', icon: 'redo', shortcut: 'shift+mod+z'},
  ];
});
</script></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const space = (element) => {
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;inline-size:var(--sf-space-1\\/4)';
    element.append(probe);
    const value = probe.getBoundingClientRect().width;
    probe.remove();
    return round(value);
  };
  const key = (element) => {
    const s = getComputedStyle(element);
    const r = element.getBoundingClientRect();
    return {text: element.textContent, square: element.classList.contains('sf-kbd--square'), width: round(r.width), height: round(r.height),
      fontSize: parseFloat(s.fontSize), padding: parseFloat(s.paddingLeft), top: r.top, bottom: r.bottom, lineHeight: parseFloat(s.lineHeight)};
  };
  const keysOf = (root) => (root ? Array.from(root.querySelectorAll('kbd:not(.sf-kbd--group)')).map(key) : []);
  const groupGap = (root) => {
    const group = root?.querySelector('.sf-kbd--group');
    return group ? parseFloat(getComputedStyle(group).columnGap) : null;
  };
  const control = (hostId) => {
    const host = document.getElementById(hostId);
    const box = host?.querySelector('.sf-button, .sf-input-field');
    const r = box?.getBoundingClientRect();
    const keys = keysOf(host?.querySelector('.sf-button-shortcut, .sf-input-shortcut'));
    return {
      height: r ? round(r.height) : null,
      keys,
      gap: groupGap(host),
      group: (() => {
        const group = host?.querySelector('.sf-button-shortcut > .sf-kbd--group, .sf-input-shortcut > .sf-kbd--group');
        return group ? {lineHeight: parseFloat(getComputedStyle(group).lineHeight), height: round(group.getBoundingClientRect().height)} : null;
      })(),
      space: host ? space(box ?? host) : null,
      // The keys' place in the control: the gap above and below.
      above: keys.length && r ? round(Math.min(...keys.map((one) => one.top)) - r.top) : null,
      below: keys.length && r ? round(r.bottom - Math.max(...keys.map((one) => one.bottom))) : null,
      aria: host?.querySelector('input')?.getAttribute('aria-keyshortcuts') ?? host?.querySelector('button')?.getAttribute('aria-keyshortcuts') ?? null,
    };
  };
  const prose = (pid) => {
    const p = document.getElementById(pid);
    const s = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    const keys = keysOf(p);
    return {keys, lineHeight: parseFloat(s.lineHeight), fontSize: parseFloat(s.fontSize), height: round(r.height), space: space(p),
      // The keys' place in the line: the gap above and below.
      above: keys.length ? round(Math.min(...keys.map((one) => one.top)) - r.top) : null,
      below: keys.length ? round(r.bottom - Math.max(...keys.map((one) => one.bottom))) : null};
  };
  const menuRows = Array.from(document.querySelectorAll('#menu .sf-context-menu-item')).map((row) => {
    const label = row.querySelector('.sf-context-menu-item-label, .sf-context-menu-item-text') ?? row;
    return {label: parseFloat(getComputedStyle(label).fontSize), keys: keysOf(row.querySelector('.sf-kbd--group'))};
  });
  const tipText = document.querySelector('#tip .sf-tooltip-text');
  return {
    viewport: innerWidth,
    buttons: Object.fromEntries(['1-3', '1-2', '1', '2', '3', 'word'].map((size) => [size, control(`b-${size}`)])),
    inputs: Object.fromEntries(['1-3', '1-2', '1', '2', '3'].map((size) => [size, control(`i-${size}`)])),
    compact: {button: control('c-button'), size2: control('c-2'), input: control('c-input'), body: prose('c-body')},
    body: prose('body'),
    small: prose('small'),
    bare: Object.fromEntries(['button', 'role', 'combobox', 'searchbox'].map((what) => {
      const host = document.getElementById(`bare-${what}`);
      return [what, {keys: keysOf(host), space: space(host), gap: null}];
    })),
    menu: menuRows,
    tip: {label: tipText ? parseFloat(getComputedStyle(tipText).fontSize) : null, keys: keysOf(document.getElementById('tip'))},
  };
};

// The decision's table: plate / letters per host size.
const EXPECT = {
  desktop: {'1-3': [16, 12], '1-2': [16, 12], 1: [20, 14], 2: [24, 16], 3: [28, 20], body: [20, 14], small: [16, 12]},
  phone: {'1-3': [16, 12], '1-2': [16, 12], 1: [16, 12], 2: [20, 14], 3: [24, 16], body: [16, 12], small: [16, 12]},
};

const failures = [];
const seen = {};
const near = (a, b, tolerance = 0.3) => typeof a === 'number' && Math.abs(a - b) <= tolerance;
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [device, viewport] of [['desktop', {width: 1280, height: 900}], ['phone', {width: 390, height: 1400}]]) {
      const name = `${theme}-${device}`;
      const tab = await browser.newPage({viewport, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'platform', {get: () => 'MacIntel', configurable: true});
        Object.defineProperty(Navigator.prototype, 'userAgentData', {get: () => ({platform: 'macOS', brands: [], mobile: false}), configurable: true});
      });
      await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
      await tab.waitForFunction(() => document.querySelectorAll('.sf-button-shortcut kbd kbd').length >= 8
        && document.querySelectorAll('#menu .sf-context-menu-item kbd kbd').length >= 2
        && document.querySelectorAll('sf-input .sf-input-field').length >= 6
        && Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 30000})
        .catch(() => failures.push(`${name}: the page never drew its buttons, fields and menu with the kbd sheet`));
      await tab.waitForFunction(() => document.querySelectorAll('sf-input .sf-input-shortcut kbd kbd').length >= 12, null, {timeout: 5000})
        .catch(() => failures.push(`${name}: sf-input draws no shortcut keys`));
      // The icons come from the subset service after the page is ready: wait
      // for them (not a finding when the network is slow), so a picture
      // shows the page as a reader sees it.
      await tab.waitForFunction(() => Array.from(document.querySelectorAll('.sf-icon')).every((icon) => icon.classList.contains('sf-icon-loaded')), null, {timeout: 10000}).catch(() => {});
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const m = await tab.evaluate(MEASURE);
      seen[name] = m;
      if (evidence) await tab.screenshot({path: join(evidence, `kbd-ladder-${name}.png`), fullPage: true});
      if (errors.length) failures.push(`${name}: console ${JSON.stringify(errors)}`);
      const fail = (detail) => failures.push(`${name}: ${detail}`);
      const table = EXPECT[device];

      const plates = (what, drawn, [plate, letters]) => {
        if (!drawn.keys.length) return fail(`${what}: no keys`);
        for (const one of drawn.keys) {
          if (!near(one.height, plate)) fail(`${what} ${one.text}: plate ${one.height}, expected ${plate}`);
          if (!near(one.fontSize, letters, 0.05)) fail(`${what} ${one.text}: letters ${one.fontSize}, expected ${letters}`);
          if (one.square && !near(one.width, one.height)) fail(`${what} ${one.text}: one character ${one.width}x${one.height}, not square`);
          if (!one.square && one.width < one.height - 0.3) fail(`${what} ${one.text}: narrower than high`);
          if (!one.square && !near(one.padding, drawn.space, 0.05)) fail(`${what} ${one.text}: room ${one.padding}, not --sf-space-1/4 ${drawn.space}`);
        }
        if (drawn.keys.length > 1 && typeof drawn.gap === 'number' && !near(drawn.gap, drawn.space, 0.05)) fail(`${what}: keys ${drawn.gap} apart, not --sf-space-1/4 ${drawn.space}`);
      };

      const lineBox = (what, drawn, plate) => {
        if (!drawn.group) return fail(`${what}: no key group`);
        if (!near(drawn.group.lineHeight, plate) || !near(drawn.group.height, plate)) fail(`${what}: the key group's line ${drawn.group.lineHeight} and height ${drawn.group.height}, not the plate ${plate}`);
        for (const one of drawn.keys) if (!near(one.lineHeight, plate)) fail(`${what} ${one.text}: line ${one.lineHeight}, not the plate ${plate}`);
      };
      for (const size of ['1-3', '1-2', '1', '2', '3']) {
        lineBox(`sf-button ${size}`, m.buttons[size], table[size][0]);
        lineBox(`sf-input ${size}`, m.inputs[size], table[size][0]);
      }
      for (const [at, row] of m.menu.entries()) for (const one of row.keys) if (!near(one.lineHeight, one.fontSize)) fail(`menu row ${at + 1} ${one.text}: plain glyphs' line ${one.lineHeight}, not their size ${one.fontSize}`);
      for (const one of m.tip.keys) if (!near(one.lineHeight, one.fontSize)) fail(`tooltip ${one.text}: plain glyphs' line ${one.lineHeight}, not their size ${one.fontSize}`);

      for (const size of ['1-3', '1-2', '1', '2', '3']) {
        plates(`sf-button ${size}`, m.buttons[size], table[size]);
        plates(`sf-input ${size}`, m.inputs[size], table[size]);
        const field = m.inputs[size];
        if (field.keys.length) {
          if (!near(field.above, field.below, 0.5)) fail(`sf-input ${size}: keys ${field.above} from the top, ${field.below} from the bottom, not centred`);
          if (field.aria !== 'Meta+K') fail(`sf-input ${size}: aria-keyshortcuts ${field.aria}`);
        }
      }
      plates('sf-button word', m.buttons.word, table['1']);

      if (device === 'desktop') {
        // Compact density: a control without a size stands one step down.
        if (!near(m.compact.button.height, 32)) fail(`compact sf-button without a size stands ${m.compact.button.height}, not 32`);
        plates('compact sf-button without a size', m.compact.button, [16, 12]);
        plates('compact sf-button size 2', m.compact.size2, [24, 16]);
        plates('compact sf-input without a size', m.compact.input, [16, 12]);
        // A compact region sets its own body text, 14/20: a plain paragraph
        // there takes it, and its keys 16/12; the line does not grow.
        plates(`compact region, plain paragraph ${m.compact.body.fontSize}/${m.compact.body.lineHeight}`, m.compact.body, [16, 12]);
        if (!near(m.compact.body.height, m.compact.body.lineHeight, 0.5)) fail(`compact paragraph: the line grew to ${m.compact.body.height}, line height ${m.compact.body.lineHeight}`);
        if (!near(m.compact.body.above, m.compact.body.below, 0.5)) fail(`compact paragraph: keys ${m.compact.body.above} from the top, ${m.compact.body.below} from the bottom, not centred`);
        if (m.compact.input.keys.length && !near(m.compact.input.above, m.compact.input.below, 0.5)) fail(`compact sf-input: keys ${m.compact.input.above} / ${m.compact.input.below}, not centred`);
      }

      for (const [what, text] of [['body', m.body], ['small', m.small]]) {
        plates(`${what} text ${text.fontSize}/${text.lineHeight}`, text, table[what]);
        // One line of text: the paragraph is its line high, the keys inside it.
        if (!near(text.height, text.lineHeight, 0.5)) fail(`${what} text: the line grew to ${text.height}, line height ${text.lineHeight}`);
        // Centred in the line (DEV review of C38: baseline left them 1 px low).
        if (!near(text.above, text.below, 0.5)) fail(`${what} text: keys ${text.above} from the top, ${text.below} from the bottom, not centred`);
      }

      // A bare control without a size class is a control of size 1.
      for (const [what, drawn] of Object.entries(m.bare)) {
        if (!drawn.keys.length) fail(`bare ${what}: no keys`);
        plates(`bare ${what}`, drawn, table['1']);
      }

      if (!m.menu.length) fail('the menu drew no rows');
      for (const row of m.menu) {
        if (!row.keys.length) fail('a menu row without keys');
        for (const one of row.keys) if (!near(one.fontSize, row.label, 0.05)) fail(`menu ${one.text}: letters ${one.fontSize}, the label ${row.label}`);
      }
      if (!m.tip.keys.length) fail('the tooltip drew no keys');
      for (const one of m.tip.keys) if (!near(one.fontSize, m.tip.label, 0.05)) fail(`tooltip ${one.text}: letters ${one.fontSize}, the text ${m.tip.label}`);
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
const summary = (drawn) => drawn.keys.length ? `${drawn.height ?? ''} -> ${drawn.keys[0].height}/${drawn.keys[0].fontSize}${drawn.above !== null && drawn.above !== undefined ? ` (${drawn.above}/${drawn.below})` : ''}` : 'no keys';
console.log(JSON.stringify({
  seen: Object.fromEntries(Object.entries(seen).map(([name, m]) => [name, {
    buttons: Object.fromEntries(Object.entries(m.buttons).map(([size, drawn]) => [size, summary(drawn)])),
    inputs: Object.fromEntries(Object.entries(m.inputs).map(([size, drawn]) => [size, summary(drawn)])),
    compact: Object.fromEntries(Object.entries(m.compact).map(([what, drawn]) => [what, summary(drawn)])),
    body: `${m.body.fontSize}/${m.body.lineHeight} -> ${summary(m.body)}, p ${m.body.height}`,
    small: `${m.small.fontSize}/${m.small.lineHeight} -> ${summary(m.small)}, p ${m.small.height}`,
    bare: Object.fromEntries(Object.entries(m.bare).map(([what, drawn]) => [what, summary(drawn)])),
    menu: m.menu.map((row) => `${row.label} -> ${row.keys.map((one) => one.fontSize).join(',')}`),
    tip: `${m.tip.label} -> ${m.tip.keys.map((one) => one.fontSize).join(',')}`,
  }])),
  failures,
}, null, 1));
process.exitCode = failures.length ? 1 : 0;
