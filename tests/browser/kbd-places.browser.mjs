#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        SF_EVIDENCE_DIR=<folder> keeps a picture of every theme x platform.
//
// One component draws every key, and the place decides how (owner decision
// 2026-11-07, docs review R030, rule C04; the accepted prototype is ui-control
// prototypes/shortcuts.html, card «Предложение для SIMAI Framework»). On the
// built bytes, over the Loader, in the light and the dark theme, on a Mac and
// on Windows (the platform emulated before the page runs):
//
//   - caps in buttons and in the search trigger (filled, outline, link,
//     tonal): no edge, the text face at weight 500, sized from the ladder
//     (owner decision C38: a size 1 button's caps are step 1/2, 20 high with
//     letters of 14), a key of one character square, --sf-space-1/4 apart; ink the
//     label's own, fill that ink at 8 %; caps stand apart (a + written
//     between Windows words is not drawn);
//   - plain glyphs in a menu (sf-menu-context entries) and in a tooltip: no
//     fill, no edge, no room, the row's own text (C38); in a menu
//     --sf-on-surface-variant, in a tooltip the tooltip's ink at 64 %; on a
//     Mac ⇧⌘Z side by side, on Windows Ctrl+Shift+Z joined;
//   - keycaps in running text: a 1px --sf-outline-variant edge and an inset
//     bottom edge, the text face, step 1/2 in body text (20/14);
//   - appearance="plain" in a button and appearance="cap" in running text win
//     over the place.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const evidence = process.env.SF_EVIDENCE_DIR ? resolve(process.env.SF_EVIDENCE_DIR) : '';
if (evidence) mkdirSync(evidence, {recursive: true});
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/tooltip/css/tooltip.css">
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-1);color:var(--sf-on-surface)}
main{display:grid;grid-template-columns:repeat(3,300px);gap:24px;padding:24px;align-items:start}
.s{display:flex;flex-direction:column;gap:6px}.prose{margin:0;max-inline-size:300px}
.tip{position:static;display:inline-flex;inset:auto;opacity:1;visibility:visible;transform:none}</style></head><body><main>
<div class="s"><sf-button id="filled" text="Сохранить" shortcut="mod+s"></sf-button></div>
<div class="s"><sf-button id="outline" text="Новая вкладка" appearance="outline" scheme="on-surface" shortcut="shift+mod+p"></sf-button></div>
<div class="s"><sf-button id="link" text="Закрыть" appearance="link" scheme="on-surface" shortcut="escape"></sf-button></div>
<div class="s"><sf-button id="trigger" text="Поиск" appearance="tonal" scheme="on-surface-variant" radius="rounded" icon-start="search" text-position="start" shortcut="mod+k" root-class="w-full"></sf-button></div>
<div class="s"><sf-menu-context id="menu" aria-label="Правка"></sf-menu-context></div>
<div class="s"><div class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 tip" role="tooltip" id="tip"><div class="sf-tooltip-content"><div class="sf-tooltip-wrap"><div class="sf-tooltip-text">Жирный <kbd class="sf-kbd--group"><kbd class="sf-kbd--square">⌘</kbd><kbd class="sf-kbd--square">B</kbd></kbd></div></div></div></div></div>
<div class="s"><p class="prose" id="prose">Чтобы найти страницу, нажмите <kbd>Ctrl</kbd> <kbd class="sf-kbd--square">K</kbd>, а чтобы закрыть окно — <kbd>Esc</kbd>.</p></div>
<div class="s"><button type="button" id="said-plain">Назад <kbd appearance="plain">Esc</kbd></button>
<p class="prose" id="said-cap">В тексте плашкой: <kbd appearance="cap">Tab</kbd></p></div>
</main><script>
customElements.whenDefined('sf-menu-context').then(() => {
  document.getElementById('menu').entries = [
    {id: 'copy', text: 'Копировать', icon: 'content_copy', shortcut: 'mod+c'},
    {id: 'paste', text: 'Вставить', icon: 'content_paste', shortcut: 'mod+v'},
    {id: 'undo', text: 'Отменить', icon: 'undo', shortcut: 'mod+z'},
    {id: 'redo', text: 'Повторить', icon: 'redo', shortcut: 'shift+mod+z'},
    {id: 'off', text: 'Вырезать', icon: 'content_cut', shortcut: 'mod+x', disabled: true},
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
  const mixed = (colour, percent) => {
    const probe = document.createElement('span');
    probe.style.color = `color-mix(in srgb, ${colour} ${percent}%, transparent)`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const role = (name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const read = (key) => {
    const s = getComputedStyle(key);
    const r = key.getBoundingClientRect();
    return {
      text: key.textContent, width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100,
      fontSize: parseFloat(s.fontSize), parentSize: parseFloat(getComputedStyle(key.parentElement).fontSize),
      weight: s.fontWeight, family: s.fontFamily, color: s.color, parentColor: getComputedStyle(key.parentElement).color,
      background: s.backgroundColor, border: s.borderTopWidth, borderColor: s.borderTopColor, shadow: s.boxShadow,
      padding: parseFloat(s.paddingLeft), radius: s.borderTopLeftRadius,
    };
  };
  const button = (id) => {
    const host = document.getElementById(id);
    const label = host.querySelector('.sf-button-text-container');
    const group = host.querySelector('.sf-button-shortcut .sf-kbd--group');
    return {
      label: {size: parseFloat(getComputedStyle(label).fontSize), color: getComputedStyle(label).color},
      gap: parseFloat(getComputedStyle(group).columnGap),
      joins: Array.from(group.querySelectorAll(':scope > .sf-kbd-join')).map((join) => getComputedStyle(join).display),
      keys: Array.from(group.querySelectorAll(':scope > kbd')).map(read),
      square: Array.from(group.querySelectorAll(':scope > kbd')).map((key) => key.classList.contains('sf-kbd--square')),
    };
  };
  const rows = Array.from(document.querySelectorAll('#menu .sf-context-menu-item')).map((row) => {
    const group = row.querySelector('.sf-kbd--group');
    return {
      label: row.textContent.replace(/\s+/gu, ' ').trim(),
      disabled: row.disabled === true,
      rowColor: getComputedStyle(row.querySelector('.sf-context-menu-item-label') ?? row).color,
      // The menu's own muted role: a panel may redefine it for its fill.
      variant: (() => { const probe = document.createElement('span'); probe.style.color = 'var(--sf-on-surface-variant)'; row.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })(),
      shown: group ? group.innerText.replace(/\s+/gu, '') : null,
      joins: group ? Array.from(group.querySelectorAll('.sf-kbd-join')).map((join) => getComputedStyle(join).display) : [],
      keys: group ? Array.from(group.querySelectorAll(':scope > kbd')).map(read) : [],
    };
  });
  const tipGroup = document.querySelector('#tip .sf-kbd--group');
  const step = document.createElement('span');
  step.style.cssText = 'position:absolute;display:block;block-size:var(--sf-text-height-1\\/2);inline-size:var(--sf-text-size-1\\/2);padding-inline-start:var(--sf-space-1\\/4)';
  document.body.append(step);
  const stepHalf = {height: step.getBoundingClientRect().height, letters: parseFloat(getComputedStyle(step).inlineSize), space: parseFloat(getComputedStyle(step).paddingInlineStart)};
  step.remove();
  return {
    stepHalf,
    textFamily: (() => { const probe = document.createElement('span'); probe.style.fontFamily = 'var(--sf-text--family)'; document.body.append(probe); const value = getComputedStyle(probe).fontFamily; probe.remove(); return value; })(),
    variant: role('--sf-on-surface-variant'),
    outlineVariant: role('--sf-outline-variant'),
    buttons: Object.fromEntries(['filled', 'outline', 'link', 'trigger'].map((id) => [id, button(id)])),
    rows,
    tip: {keys: Array.from(tipGroup.querySelectorAll(':scope > kbd')).map(read), ink: getComputedStyle(tipGroup).color, expect: mixed(getComputedStyle(tipGroup).color, 64)},
    prose: Array.from(document.querySelectorAll('#prose kbd')).map(read),
    saidPlain: read(document.querySelector('#said-plain kbd')),
    saidCap: read(document.querySelector('#said-cap kbd')),
    expectCap: Object.fromEntries(['filled', 'outline', 'link', 'trigger'].map((id) => {
      const ink = getComputedStyle(document.querySelector(`#${id} .sf-button-text-container`)).color;
      return [id, {ink, fill: mixed(ink, 8)}];
    })),
  };
};

const failures = [];
const seen = {};
const near = (a, b, tolerance = 0.3) => Math.abs(a - b) <= tolerance;
// Two computed colours, the same to the third decimal of a channel (a mix
// may round its last digit differently from the colour mixed again).
const channels = (colour) => (String(colour).match(/-?\d*\.?\d+/gu) ?? []).map(Number);
const same = (a, b) => {
  const [x, y] = [channels(a), channels(b)];
  const scale = (list) => (String(a).startsWith('rgb') && list.length >= 3 ? list.map((value, at) => (at < 3 ? value / 255 : value)) : list);
  return x.length === y.length && scale(x).every((value, at) => Math.abs(value - scale(y)[at]) < 0.002);
};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const platform of ['mac', 'win']) {
      const name = `${theme}-${platform}`;
      const tab = await browser.newPage({viewport: {width: 1000, height: 640}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.addInitScript((onWindows) => {
        const said = onWindows ? ['Win32', 'Windows'] : ['MacIntel', 'macOS'];
        Object.defineProperty(Navigator.prototype, 'platform', {get: () => said[0], configurable: true});
        Object.defineProperty(Navigator.prototype, 'userAgentData', {get: () => ({platform: said[1], brands: [], mobile: false}), configurable: true});
      }, platform === 'win');
      await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
      await tab.waitForFunction(() => document.querySelectorAll('.sf-button-shortcut kbd kbd').length >= 4
        && document.querySelectorAll('#menu .sf-context-menu-item kbd kbd').length >= 5
        && document.querySelector('#trigger .sf-icon')
        && Array.from(document.styleSheets).some((sheet) => /\/kbd\//u.test(sheet.href || '')), null, {timeout: 30000})
        .catch(() => failures.push(`${name}: the page never drew its keys with the kbd sheet`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const m = await tab.evaluate(MEASURE);
      seen[name] = m;
      if (evidence) await tab.screenshot({path: join(evidence, `kbd-places-${name}.png`), fullPage: true});
      if (errors.length) failures.push(`${name}: console ${JSON.stringify(errors)}`);
      const fail = (detail) => failures.push(`${name}: ${detail}`);

      // Caps in buttons.
      const words = platform === 'mac'
        ? {filled: ['⌘', 'S'], outline: ['⇧', '⌘', 'P'], link: ['Esc'], trigger: ['⌘', 'K']}
        : {filled: ['Ctrl', 'S'], outline: ['Ctrl', 'Shift', 'P'], link: ['Esc'], trigger: ['Ctrl', 'K']};
      for (const [id, drawn] of Object.entries(m.buttons)) {
        const caps = drawn.keys.map((key) => key.text);
        if (JSON.stringify(caps) !== JSON.stringify(words[id])) fail(`${id} reads ${caps}, expected ${words[id]}`);
        if (drawn.joins.some((display) => display !== 'none')) fail(`${id} draws a + between caps`);
        if (platform === 'win' && drawn.keys.length > 1 && drawn.joins.length !== drawn.keys.length - 1) fail(`${id} wrote ${drawn.joins.length} joins between ${drawn.keys.length} Windows words`);
        if (!near(drawn.gap, m.stepHalf.space)) fail(`${id}: caps ${drawn.gap}px apart, not --sf-space-1/4 (${m.stepHalf.space}px)`);
        drawn.keys.forEach((key, at) => {
          if (key.border !== '0px' || key.shadow !== 'none') fail(`${id} ${key.text}: an edge (${key.border}, ${key.shadow})`);
          if (key.weight !== '500' || key.family !== m.textFamily) fail(`${id} ${key.text}: face ${key.weight} ${key.family}`);
          if (!near(key.fontSize, m.stepHalf.letters, 0.05)) fail(`${id} ${key.text}: letters ${key.fontSize}px, not step 1/2 (${m.stepHalf.letters}px)`);
          if (!near(key.height, m.stepHalf.height)) fail(`${id} ${key.text}: ${key.height}px high, not the step 1/2 line (${m.stepHalf.height}px)`);
          if (drawn.square[at] && !near(key.width, key.height)) fail(`${id} ${key.text}: a one-character key ${key.width}x${key.height}, not square`);
          if (!drawn.square[at] && key.width < key.height - 0.3) fail(`${id} ${key.text}: narrower than high`);
          if (!same(key.color, m.expectCap[id].ink) || !same(key.background, m.expectCap[id].fill)) fail(`${id} ${key.text}: ${key.color} on ${key.background}, expected ${m.expectCap[id].ink} on ${m.expectCap[id].fill}`);
        });
      }

      // Plain glyphs in the menu.
      const shown = platform === 'mac' ? ['⌘C', '⌘V', '⌘Z', '⇧⌘Z', '⌘X'] : ['Ctrl+C', 'Ctrl+V', 'Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+X'];
      if (JSON.stringify(m.rows.map((row) => row.shown)) !== JSON.stringify(shown)) fail(`the menu shows ${JSON.stringify(m.rows.map((row) => row.shown))}, expected ${JSON.stringify(shown)}`);
      for (const row of m.rows) {
        if (platform === 'mac' && row.joins.length) fail(`${row.shown}: joins on a Mac`);
        if (platform === 'win' && row.joins.some((display) => display === 'none')) fail(`${row.shown}: a + not drawn`);
        for (const key of row.keys) {
          if (!key.background.endsWith(', 0)') && key.background !== 'transparent') fail(`${row.shown}: a fill ${key.background}`);
          if (key.border !== '0px' || key.padding !== 0) fail(`${row.shown}: an edge or room (${key.border}, ${key.padding})`);
          if (!near(key.fontSize, key.parentSize, 0.05)) fail(`${row.shown}: ${key.fontSize}px of a ${key.parentSize}px row`);
          const ink = row.disabled ? key.parentColor : row.variant;
          if (!same(key.color, ink)) fail(`${row.shown}${row.disabled ? ' (disabled)' : ''}: ink ${key.color}, expected ${ink}`);
        }
      }

      // Plain glyphs in a tooltip.
      for (const key of m.tip.keys) {
        if (!same(key.color, m.tip.expect)) fail(`tooltip ${key.text}: ink ${key.color}, expected the tooltip's at 64 % ${m.tip.expect}`);
        if (key.border !== '0px' || key.padding !== 0 || !near(key.fontSize, key.parentSize, 0.05)) fail(`tooltip ${key.text}: not plain`);
      }

      // Keycaps in running text.
      for (const key of m.prose) {
        if (key.border !== '1px' || key.borderColor !== m.outlineVariant || !key.shadow.includes('inset')) fail(`prose ${key.text}: edge ${key.border} ${key.borderColor} ${key.shadow}`);
        if (key.family !== m.textFamily || !near(key.fontSize, m.stepHalf.letters, 0.05) || !near(key.height, m.stepHalf.height)) fail(`prose ${key.text}: ${key.family} ${key.fontSize}px ${key.height}px`);
      }

      // Said outright.
      if (m.saidPlain.padding !== 0 || m.saidPlain.border !== '0px' || !near(m.saidPlain.fontSize, m.saidPlain.parentSize, 0.05)) fail('appearance="plain" in a button is not plain');
      if (m.saidCap.border !== '0px' || m.saidCap.shadow !== 'none' || m.saidCap.background.endsWith(', 0)')) fail('appearance="cap" in running text is not a cap');
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen: Object.fromEntries(Object.entries(seen).map(([name, m]) => [name, {buttons: m.buttons, rows: m.rows.map((row) => row.shown), tip: m.tip.keys.map((key) => key.color)}])), failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
