#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// The notice's actions and spacing (owner decision C35, remarks R066, R067,
// R079), on the built bytes over the Loader, at 1440 and 390, normal and
// compact density (data-sf-density="compact"), light and dark, three loads
// each:
//
//   - the action of an sf-toast is an unsized low button: 32 on desktop, 28
//     compact and on a phone; its label is the notice's text size;
//   - sf-button-icon and sf-button-close take height="low" (C27): size 1 is
//     32 / 28 / 28, like a low sf-button; without height they keep 40 / 32 / 36;
//   - the title and its text are one block (0); text to the action plate is
//     --sf-space-1/2 (12 / 8 / 8); two actions of a class toast stand
//     --sf-space-1/3 apart;
//   - the inline padding is one --sf-space-1 on both sides (16 / 12 / 12): the
//     status icon's start edge, a toast without an icon its text, and the
//     close's cross all stand on it; the block padding is --sf-space-1/2;
//   - the action plate starts at the text edge; the icon and the close are
//     centred on the first line; the icon is the line's size (24 / 20 / 20);
//   - a one-line toast is 56 / 44 / 44 plus its border;
//   - a declined sf-confirm says nothing: no «Отменено» anywhere.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const jsonAt = process.argv.indexOf('--json');
const jsonFile = jsonAt > 0 ? process.argv[jsonAt + 1] : '';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const block = (id) => `
<section class="zone" id="${id}">
  <sf-toast id="${id}-stack" icon="warning" status="neutral" heading="Сессия закончится через 2 минуты"
    supporting-text="Несохранённые изменения пропадут." action-text="Продлить" action="extend"></sf-toast>
  <sf-toast id="${id}-line" icon="delete" heading="Представление удалено"></sf-toast>
  <sf-toast id="${id}-plain" heading="Ссылка скопирована"></sf-toast>
  <div class="sf-toast sf-toast--neutral flex items-cross-start" id="${id}-two">
    <i class="sf-icon" aria-hidden="true">warning</i>
    <div class="sf-toast-container flex flex-col flex-1">
      <div class="sf-toast-wrap flex flex-col"><div class="sf-toast-text">Сессия закончится</div><div class="sf-toast-supporting-text">Несохранённые изменения пропадут.</div></div>
      <div class="sf-toast-bottom flex items-center">
        <button type="button" class="sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="a"><span class="sf-button-text-container">Продлить</span></button>
        <button type="button" class="sf-button sf-button--ghost sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="b"><span class="sf-button-text-container">Выйти</span></button>
      </div>
    </div>
    <button type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Закрыть" data-close>
      <span class="sf-close sf-close--size-1 flex justify-center items-center" aria-hidden="true"><span class="sf-close-icon"></span></span>
    </button>
  </div>
  <div class="controls">
    <sf-button height="low" text="Низкая" data-k="button-low"></sf-button>
    <sf-button-icon height="low" icon="settings" aria-label="Настройки" data-k="icon-low"></sf-button-icon>
    <sf-button-icon height="low" kind="close" appearance="ghost" scheme="on-surface" aria-label="Закрыть" data-k="icon-close-low"></sf-button-icon>
    <sf-button-close size="1" height="low" data-k="close-low"></sf-button-close>
    <sf-button-close height="low" data-k="close-placed"></sf-button-close>
    <sf-button-icon icon="settings" aria-label="Настройки" data-k="icon-default"></sf-button-icon>
    <sf-button-close size="1" data-k="close-default"></sf-button-close>
    <sf-button-icon height="high" icon="settings" aria-label="Настройки" data-k="icon-high"></sf-button-icon>
    <sf-button height="high" text="Высокая" data-k="button-high"></sf-button>
  </div>
  <sf-confirm id="${id}-ask" question="Удалить «Мои новые»?" accept-text="Удалить" status="danger" confirm-id="${id}"></sf-confirm>
</section>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.zone{display:flex;flex-direction:column;gap:16px;margin:16px;max-inline-size:28rem}.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
${block('normal')}
<div data-sf-density="compact">${block('compact')}</div>
</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
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
  const r = (value) => Math.round(value * 100) / 100;
  const box = (node) => node?.getBoundingClientRect();
  const token = (zone, name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${name})`;
    zone.append(probe);
    const value = probe.getBoundingClientRect().width;
    probe.remove();
    return r(value);
  };
  const toast = (root) => {
    if (!root) return null;
    const toastBox = box(root);
    const style = getComputedStyle(root);
    const inner = {left: toastBox.left + parseFloat(style.borderLeftWidth), right: toastBox.right - parseFloat(style.borderRightWidth),
      top: toastBox.top + parseFloat(style.borderTopWidth), bottom: toastBox.bottom - parseFloat(style.borderBottomWidth)};
    const title = root.querySelector('.sf-toast-text');
    const text = root.querySelector('.sf-toast-supporting-text');
    const icon = root.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon');
    const close = root.querySelector(':scope > .sf-icon-button');
    const cross = close?.querySelector('.sf-close-icon');
    const actions = [...root.querySelectorAll('.sf-toast-bottom .sf-button')];
    const titleBox = box(title);
    const line = parseFloat(getComputedStyle(title).lineHeight);
    const firstLine = titleBox.top + line / 2;
    const centre = (b) => b.top + b.height / 2;
    const result = {
      height: r(toastBox.height), inner: r(inner.bottom - inner.top), border: r(parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)),
      padTop: r(parseFloat(style.paddingTop)), padStart: r(parseFloat(style.paddingInlineStart)), padEnd: r(parseFloat(style.paddingInlineEnd)),
      textSize: r(parseFloat(getComputedStyle(title).fontSize)), line: r(line),
      textStart: r(titleBox.left - inner.left),
    };
    if (icon) {
      const b = box(icon);
      Object.assign(result, {icon: r(b.height), iconStart: r(b.left - inner.left), iconToText: r(titleBox.left - b.right), iconCentre: r(centre(b) - firstLine)});
    }
    if (close) {
      const b = box(close);
      const c = box(cross);
      Object.assign(result, {close: r(b.height), closeCentre: r(centre(b) - firstLine), crossEnd: r(inner.right - c.right), plateEnd: r(inner.right - b.right)});
    }
    if (text) result.titleToText = r(box(text).top - titleBox.bottom);
    if (actions.length) {
      const a = box(actions[0]);
      const last = text ? box(text) : titleBox;
      Object.assign(result, {action: r(a.height), actionLabel: r(parseFloat(getComputedStyle(actions[0].querySelector('.sf-button-text-container') ?? actions[0]).fontSize)),
        textToAction: r(a.top - last.bottom), actionEdge: r(a.left - titleBox.left), actionToBottom: r(inner.bottom - a.bottom - parseFloat(style.paddingBottom))});
      if (actions[1]) result.betweenActions = r(box(actions[1]).left - a.right);
    }
    return result;
  };
  const zones = {};
  for (const zone of document.querySelectorAll('.zone')) {
    const id = zone.id;
    const controls = {};
    for (const host of zone.querySelectorAll('[data-k]')) {
      // A Smart button moves its data-* attributes to the control it draws.
      const control = host.matches('button') ? host : host.querySelector('button');
      const b = box(control);
      // A label's width follows the font as it loads: only the square
      // controls report theirs.
      controls[host.dataset.k] = b ? (host.dataset.k.startsWith('button-') ? {h: r(b.height)} : {h: r(b.height), w: r(b.width)}) : null;
    }
    zones[id] = {
      tokens: {space1: token(zone, '--sf-space-1'), space12: token(zone, '--sf-space-1\\/2'), space13: token(zone, '--sf-space-1\\/3'),
        line1: token(zone, '--sf-text-height-1'), iconSize3: token(zone, '--sf-icon-size-3'), iconSize2: token(zone, '--sf-icon-size-2')},
      stack: toast(zone.querySelector(`#${id}-stack .sf-toast`)),
      line: toast(zone.querySelector(`#${id}-line .sf-toast`)),
      plain: toast(zone.querySelector(`#${id}-plain .sf-toast`)),
      two: toast(zone.querySelector(`#${id}-two`)),
      controls,
    };
  }
  return zones;
};

// The decision's numbers: [desktop, compact desktop, phone]; the phone
// keeps its scale in a compact region (C36).
const EXPECT = {
  desktop: {action: 32, label: 16, close: 32, icon: 24, padX: 16, padY: 12, gap: 12, between: 8, oneLine: 56, iconDefault: 40, iconHigh: 48},
  compact: {action: 28, label: 14, close: 28, icon: 20, padX: 12, padY: 8, gap: 8, between: 4, oneLine: 44, iconDefault: 32, iconHigh: 40},
  phone: {action: 28, label: 14, close: 28, icon: 20, padX: 12, padY: 8, gap: 8, between: 8, oneLine: 44, iconDefault: 36, iconHigh: 44},
};

const failures = [];
const report = {};
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 0.5;
const browser = await chromium.launch();
try {
  for (const [width, label] of [[1440, 'desktop'], [390, 'phone']]) {
    for (const theme of ['light', 'dark']) {
      const key = `${label}-${theme}`;
      for (let load = 1; load <= 3; load += 1) {
        const tab = await browser.newPage({viewport: {width, height: 1400}});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
        await tab.waitForFunction(() => document.querySelectorAll('sf-toast > .sf-toast').length === 6
          && [...document.querySelectorAll('[data-k]')].filter((node) => node.matches('button') || node.querySelector('button')).length === 18
          && document.querySelectorAll('sf-confirm button[data-action="decline"]').length === 2, null, {timeout: 30000})
          .catch(() => failures.push(`${key} load ${load}: the page never drew its toasts, controls and questions`));
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(300);
        const seen = await tab.evaluate(MEASURE);
        // R067: decline, as the host does, then read what the page says.
        const declined = await tab.evaluate(async () => {
          const said = [];
          for (const ask of document.querySelectorAll('sf-confirm')) {
            ask.addEventListener('sf-confirm-answer', (event) => { if (!event.detail.accepted) ask.state = 'declined'; }, {once: true});
            ask.querySelector('button[data-action="decline"]').click();
          }
          await new Promise((settle) => setTimeout(settle, 300));
          for (const ask of document.querySelectorAll('sf-confirm')) {
            const line = ask.querySelector('.sf-confirm__status');
            const style = line && getComputedStyle(line);
            said.push({state: ask.state, status: line?.textContent.trim() ?? null,
              ring: line && line === document.activeElement && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0});
          }
          return {said, page: document.body.innerText.includes('Отменено')};
        });
        seen.declined = declined;
        if (errors.length) failures.push(`${key} load ${load}: console ${JSON.stringify(errors)}`);
        if (load === 1) {
          report[key] = seen;
          await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `toast-notice-${key}.png`), fullPage: true}).catch(() => {});
        } else if (JSON.stringify(seen) !== JSON.stringify(report[key])) {
          const diff = [];
          const walk = (a, b, at) => {
            if (a && b && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b?.[k], `${at}.${k}`); return; }
            if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`${at} ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
          };
          walk(report[key], seen, '');
          failures.push(`${key} load ${load}: the measurements differ from the first load: ${diff.slice(0, 8).join('; ')}`);
        }
        await tab.close();
      }

      for (const zone of ['normal', 'compact']) {
        const at = report[key]?.[zone];
        if (!at) { failures.push(`${key} ${zone}: nothing measured`); continue; }
        const want = EXPECT[label === 'phone' ? 'phone' : zone === 'compact' ? 'compact' : 'desktop'];
        const check = (what, got, expected) => { if (!near(got, expected)) failures.push(`${key} ${zone}: ${what} ${got}, expected ${expected}`); };
        for (const name of ['stack', 'line', 'plain', 'two']) {
          const t = at[name];
          if (!t) { failures.push(`${key} ${zone}: ${name} not drawn`); continue; }
          check(`${name} inline padding start`, t.padStart, want.padX);
          check(`${name} inline padding end`, t.padEnd, want.padX);
          check(`${name} block padding`, t.padTop, want.padY);
          check(`${name} close`, t.close, want.close);
          check(`${name} close centre - first line centre`, t.closeCentre, 0);
          check(`${name} cross end inset`, t.crossEnd, want.padX);
          if (t.icon !== undefined) {
            check(`${name} icon`, t.icon, want.icon);
            check(`${name} icon = line`, t.icon, t.line);
            check(`${name} icon start inset`, t.iconStart, want.padX);
            check(`${name} icon to text`, t.iconToText, want.gap);
            check(`${name} icon centre - first line centre`, t.iconCentre, 0);
          } else {
            check(`${name} text start (no icon)`, t.textStart, want.padX);
          }
          if (t.titleToText !== undefined) check(`${name} title to text`, t.titleToText, 0);
          if (t.action !== undefined) {
            check(`${name} action height`, t.action, want.action);
            check(`${name} action label = text`, t.actionLabel, t.textSize);
            check(`${name} action label`, t.actionLabel, want.label);
            check(`${name} text to action plate`, t.textToAction, want.gap);
            check(`${name} action plate - text edge`, t.actionEdge, 0);
            check(`${name} action to padding`, t.actionToBottom, 0);
          }
          if (t.betweenActions !== undefined) check(`${name} between actions`, t.betweenActions, want.between);
        }
        check('one-line toast without the border', at.line?.inner, want.oneLine);
        check('plain one-line toast without the border', at.plain?.inner, want.oneLine);
        const c = at.controls;
        check('sf-button height=low', c['button-low']?.h, want.action);
        check('sf-button-icon height=low', c['icon-low']?.h, want.close);
        check('sf-button-icon height=low is square', c['icon-low']?.w, want.close);
        check('sf-button-icon kind=close height=low', c['icon-close-low']?.h, want.close);
        // Without a size, a height takes the place's step (DEV D1): 32 / 28 / 28.
        check('sf-button-close height=low (no size)', c['close-placed']?.h, want.close);
        // An explicit size is stronger than the density (C22): size="1"
        // keeps its desktop step in a compact region.
        const sized = EXPECT[label === 'phone' ? 'phone' : 'desktop'];
        check('sf-button-close size=1 height=low', c['close-low']?.h, sized.close);
        check('sf-button-icon default', c['icon-default']?.h, want.iconDefault);
        check('sf-button-close size=1 default', c['close-default']?.h, sized.iconDefault);
        check('sf-button-icon height=high', c['icon-high']?.h, want.iconHigh);
        check('sf-button-icon high = sf-button high', c['icon-high']?.h, c['button-high']?.h);
      }
      const said = report[key]?.declined;
      if (!said || said.page || said.said.some((one) => one.state !== 'declined' || one.status !== '' || one.ring)) failures.push(`${key}: a declined question still says something ${JSON.stringify(said)}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify({report, failures}, null, 1)}\n`);
if (reportOnly) {
  console.log(JSON.stringify(report, null, 1));
  console.log(JSON.stringify({failures}, null, 1));
  process.exit(0);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`toast-notice-geometry: ${Object.keys(report).length} views x 2 densities x 3 loads, every check holds`);
