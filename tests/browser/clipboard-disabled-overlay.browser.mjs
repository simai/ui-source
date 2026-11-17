#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// The copy button, owner remarks 2026-11-15 (component.clipboard 1.2.0,
// component.buttons 1.15.0, component.icon-buttons 1.10.0), on the built bytes,
// at 1440 (normal and compact) and 390, light and dark, three loads each:
//
//   - disabled: a copy button with aria-disabled="true" (as it is while it
//     copies) -- the clipboard surface, an sf-icon-button and an sf-button --
//     changes no computed fill, ink or icon ink on hover or press; its icon is
//     --sf-on-surface-disabled (the third icon role, no opacity); the cursor
//     is not the wait cursor. A plain sf-button / sf-icon-button with
//     aria-disabled="true" draws as a :disabled one and keeps still on hover;
//   - overlay: sf-clipboard--overlay in a box with the p-2 padding stands on
//     the first line of the content -- |button middle - line middle| <= 0.5 --
//     and its glyph ends where the content ends (<= 0.5), at every size the
//     docs use (none, 1/3, 1, 2 and the former sf-clipboard-1/2/3) and as an
//     icon button of every size (1/3, 1/2, 1, 2, 3); a block of
//     three lines keeps it on the first line (the same top as one line).
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SIZES = [['none', ''], ['1/3', 'sf-clipboard--size-1/3'], ['1', 'sf-clipboard--size-1'], ['2', 'sf-clipboard--size-2'],
  ['former 1', 'sf-clipboard-1'], ['former 2', 'sf-clipboard-2'], ['former 3', 'sf-clipboard-3'],
  // The overlay drawn as an icon button (component.clipboard 1.6.0,
  // msg-cd695627): placed by the icon button's own size, every size of it.
  ...['1/3', '1/2', '1', '2', '3'].map((size) => [`icon-button ${size}`, `sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--on-surface sf-icon-button--size-${size}`, true])];
const ICON = '<i class="sf-icon" aria-hidden="true">content_copy</i>';
const DISABLED = [
  ['surface', 'sf-clipboard sf-clipboard-surface', ''],
  ['surface 1/3', 'sf-clipboard sf-clipboard-surface sf-clipboard--size-1/3', ''],
  ['icon-button link', 'sf-clipboard sf-icon-button sf-icon-button--icon sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1', ''],
  ['button outline', 'sf-clipboard sf-button sf-button--outline sf-button--on-surface sf-button--size-1', 'Копировать код'],
  ['plain icon-button tonal', 'sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1', ''],
  ['plain button default', 'sf-button sf-button--default sf-button--primary sf-button--size-1', 'Сохранить'],
  ['plain button ghost', 'sf-button sf-button--ghost sf-button--primary sf-button--size-1', 'Сохранить'],
];

const body = () => `
${SIZES.map(([name, cls, iconButton]) => [1, 3].map((lines) => `
<div class="relative p-2 radius-2 border border-outline-variant box" data-k="${name}|${lines}">
  <code id="c-${lines}-${name.replace(/[^a-z0-9]+/giu, '-')}">${Array(lines).fill('npm install @simai/ui').join('<br>')}</code>
  <button type="button" class="sf-clipboard${iconButton ? '' : ' sf-clipboard-surface'} sf-clipboard--overlay ${cls}" data-copy="x" aria-label="Копировать">${ICON}</button>
</div>`).join('')).join('')}
<div class="row">
${DISABLED.map(([name, cls, text]) => ['rest', 'aria', 'native'].map((state) => `
  <button type="button" class="${cls}" data-d="${name}|${state}" aria-label="Копировать"${state === 'aria' ? ' aria-disabled="true"' : state === 'native' ? ' disabled' : ''}>${ICON}${text ? `<span class="sf-button-text-container">${text}</span>` : ''}</button>`).join('')).join('')}
</div>
<span id="ink-disabled" style="color: var(--sf-on-surface-disabled)">x</span>`;

const page = (theme, density) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/buttons/css/buttons.css">
<link rel="stylesheet" href="/distr/component/icon-buttons/css/icon-buttons.css">
<link rel="stylesheet" href="/distr/component/clipboard/css/clipboard.css">
<style>.box{max-inline-size:420px;margin:8px 16px}.row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin:8px 16px}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface"${density ? ` data-sf-density="${density}"` : ''}>${body()}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light', url.searchParams.get('density') || ''));
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

const OVERLAY = () => Object.fromEntries([...document.querySelectorAll('.box')].map((box) => {
  const round = (value) => Math.round(value * 100) / 100;
  const style = getComputedStyle(box);
  const rect = box.getBoundingClientRect();
  const top = rect.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
  const end = rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  const button = box.querySelector('button').getBoundingClientRect();
  const icon = box.querySelector('.sf-icon').getBoundingClientRect();
  return [box.dataset.k, {
    dMid: round((button.top + button.bottom) / 2 - (top + parseFloat(style.lineHeight) / 2)),
    dEnd: round(icon.right - end),
    top: round(button.top - rect.top),
    box: round(button.height),
  }];
}));

const LOOK = (button) => {
  const style = getComputedStyle(button);
  const label = button.querySelector('.sf-button-text-container');
  return {
    fill: style.backgroundColor,
    ink: style.color,
    icon: getComputedStyle(button.querySelector('.sf-icon')).color,
    label: label ? getComputedStyle(label).color : null,
    border: style.borderTopColor,
    cursor: style.cursor,
    opacity: style.opacity,
  };
};

const VIEWS = [{name: '1440', width: 1440, height: 900}, {name: '1440 compact', width: 1440, height: 900, density: 'compact'}, {name: '390', width: 390, height: 844, mobile: true}];
const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const view of VIEWS) {
    for (const theme of ['light', 'dark']) {
      const key = `${view.name} ${theme}`;
      for (let load = 1; load <= 3; load += 1) {
        const context = await browser.newContext({viewport: {width: view.width, height: view.height}, colorScheme: theme, isMobile: !!view.mobile, hasTouch: !!view.mobile});
        const tab = await context.newPage();
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}${view.density ? `&density=${view.density}` : ''}`);
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(300);
        const seen = {overlay: await tab.evaluate(OVERLAY), disabled: {}};
        seen.inkDisabled = await tab.evaluate(() => getComputedStyle(document.getElementById('ink-disabled')).color);
        if (!view.mobile) {
          for (const [name] of DISABLED) {
            for (const state of ['rest', 'aria']) {
              const locator = tab.locator(`[data-d="${name}|${state}"]`);
              await locator.scrollIntoViewIfNeeded();
              await tab.mouse.move(0, 0);
              await tab.waitForTimeout(200);
              const rest = await locator.evaluate(LOOK);
              const box = await locator.boundingBox();
              await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await tab.waitForTimeout(250);
              const hover = await locator.evaluate(LOOK);
              await tab.mouse.down();
              await tab.waitForTimeout(200);
              const press = await locator.evaluate(LOOK);
              await tab.mouse.up();
              await tab.mouse.move(0, 0);
              const native = await tab.locator(`[data-d="${name}|native"]`).evaluate(LOOK);
              seen.disabled[`${name}|${state}`] = {rest, hover, press, native};
            }
          }
          // A press on a disabled copy button would start a copy: put the page back.
          await tab.evaluate(() => document.querySelectorAll('[data-copy-state]').forEach((node) => node.removeAttribute('data-copy-state')));
        }
        if (errors.length) failures.push(`${key} load ${load}: console ${JSON.stringify(errors)}`);
        if (load === 1) report[key] = seen;
        else if (JSON.stringify(seen.overlay) !== JSON.stringify(report[key].overlay)) failures.push(`${key} load ${load}: the overlay measurements differ from the first load`);
        await context.close();
      }

      const {overlay, disabled, inkDisabled} = report[key];
      for (const [name] of SIZES) {
        const one = overlay[`${name}|1`];
        const three = overlay[`${name}|3`];
        if (Math.abs(one.dMid) > 0.5) failures.push(`${key} size ${name}: one line, the button's middle is ${one.dMid} off the line's`);
        if (Math.abs(one.dEnd) > 0.5) failures.push(`${key} size ${name}: the glyph ends ${one.dEnd} off the content's end`);
        if (Math.abs(three.top - one.top) > 0.5 || Math.abs(three.dMid) > 0.5) failures.push(`${key} size ${name}: three lines, top ${three.top} (one line ${one.top}), off the first line by ${three.dMid}`);
      }
      for (const [state, look] of Object.entries(disabled)) {
        const [name, which] = state.split('|');
        if (which === 'rest') {
          if (JSON.stringify(look.hover) === JSON.stringify(look.rest)) failures.push(`${key} ${name}: a working button shows no hover`);
          continue;
        }
        for (const phase of ['hover', 'press']) {
          for (const property of ['fill', 'ink', 'icon', 'label', 'border']) {
            if (look[phase][property] !== look.rest[property]) failures.push(`${key} ${name} aria-disabled: ${phase} changes ${property} ${look.rest[property]} -> ${look[phase][property]}`);
          }
        }
        if (look.rest.icon !== inkDisabled) failures.push(`${key} ${name} aria-disabled: icon ${look.rest.icon}, --sf-on-surface-disabled ${inkDisabled}`);
        if (look.rest.cursor === 'wait' || look.rest.cursor === 'pointer') failures.push(`${key} ${name} aria-disabled: cursor ${look.rest.cursor}`);
        if (look.rest.opacity !== '1') failures.push(`${key} ${name} aria-disabled: opacity ${look.rest.opacity}`);
        for (const property of ['fill', 'icon', 'label', 'border']) {
          if (look.rest[property] !== look.native[property]) failures.push(`${key} ${name} aria-disabled: ${property} ${look.rest[property]}, :disabled ${look.native[property]}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report: Object.fromEntries(Object.entries(report).map(([key, seen]) => [key, {
  overlay: seen.overlay,
  disabled: Object.fromEntries(Object.entries(seen.disabled).map(([name, look]) => [name, {rest: look.rest, hover: look.hover}])),
}])), failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;
