#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// The alert's actions and spacing: owner decision C35 with the toast's
// numbers (DEV acceptance D3: C35 covers every notice, sf-alert included), on
// the built bytes over the Loader, at 1440 and 390, normal and compact
// density (data-sf-density="compact"), light and dark, three loads each:
//
//   - the actions of an sf-alert are unsized low buttons: 32 on desktop, 28
//     compact and on a phone; their label is the notice's text size; the
//     first is tonal on-surface (C110 variant E), the second ghost on-surface;
//   - the close is sf-button-icon kind="close" height="low": 32 / 28 / 28,
//     centred on the first line, its cross on the inline padding;
//   - the title and its text are one block (0); text to the action plate is
//     --sf-space-1/2 (12 / 8 / 8); two actions stand --sf-space-1/3 apart;
//   - the inline padding is one --sf-space-1 on both sides (16 / 12 / 12): the
//     status icon's start edge, an alert without an icon its text, and the
//     close's cross all stand on it; the block padding is --sf-space-1/2;
//   - the action plate starts at the text edge; the icon is the line's size
//     (24 / 20 / 20) and centred on the first line;
//   - a one-line alert is 56 / 44 / 44 plus its border;
//   - the class alert written as the docs write it draws the same.
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
  <sf-alert id="${id}-stack" status="warning" heading="Сессия закончится через 2 минуты"
    supporting-text="Несохранённые изменения пропадут." action-text="Продлить" action="extend" closable></sf-alert>
  <sf-alert id="${id}-pair" status="info" heading="Есть обновление" supporting-text="Новая версия уже доступна."
    action-text="Обновить" action="update" secondary-action-text="Позже" secondary-action="later" closable></sf-alert>
  <sf-alert id="${id}-line" status="success" heading="Изменения сохранены" closable></sf-alert>
  <sf-alert id="${id}-plain" icon="none" heading="Ссылка скопирована" closable></sf-alert>
  <sf-alert id="${id}-outlined" status="error" appearance="outlined" heading="Не удалось сохранить" supporting-text="Проверьте соединение" closable></sf-alert>
  <div class="sf-alert sf-alert--neutral sf-alert--default flex items-start" id="${id}-class">
    <i class="sf-icon" aria-hidden="true">info</i>
    <div class="sf-alert-wrap flex flex-col flex-1">
      <div class="sf-alert-content flex flex-col flex-1"><div class="sf-alert-text">Сессия закончится</div><div class="sf-alert-supporting-text">Несохранённые изменения пропадут.</div></div>
      <div class="sf-alert-buttons flex flex-wrap items-center">
        <button type="button" class="sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="a"><span class="sf-button-text-container">Продлить</span></button>
        <button type="button" class="sf-button sf-button--ghost sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="b"><span class="sf-button-text-container">Выйти</span></button>
      </div>
    </div>
    <button type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Закрыть" data-close>
      <span class="sf-close sf-close--size-1 flex justify-center items-center" aria-hidden="true"><span class="sf-close-icon"></span></span>
    </button>
  </div>
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
  const notice = (root) => {
    if (!root) return null;
    const noticeBox = box(root);
    const style = getComputedStyle(root);
    const inner = {left: noticeBox.left + parseFloat(style.borderLeftWidth), right: noticeBox.right - parseFloat(style.borderRightWidth),
      top: noticeBox.top + parseFloat(style.borderTopWidth), bottom: noticeBox.bottom - parseFloat(style.borderBottomWidth)};
    const title = root.querySelector('.sf-alert-text');
    const text = root.querySelector('.sf-alert-supporting-text');
    const icon = root.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon');
    const close = root.querySelector(':scope > .sf-icon-button, :scope > sf-button-icon > .sf-icon-button');
    const cross = close?.querySelector('.sf-close-icon');
    const actions = [...root.querySelectorAll('.sf-alert-buttons .sf-button')];
    const titleBox = box(title);
    const line = parseFloat(getComputedStyle(title).lineHeight);
    const firstLine = titleBox.top + line / 2;
    const centre = (b) => b.top + b.height / 2;
    const result = {
      height: r(noticeBox.height), inner: r(inner.bottom - inner.top), border: r(parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)),
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
      // ghost is the look without a fill (C15, CB-01 d584b340); sf-button--link
      // is its former name, written beside it until 2027-01-01.
      result.looks = actions.map((one) => ['tonal', 'ghost', 'link', 'default', 'outline'].find((look) => one.classList.contains(`sf-button--${look}`))
        + '/' + ['primary', 'on-surface'].find((scheme) => one.classList.contains(`sf-button--${scheme}`)));
      if (actions[1]) result.betweenActions = r(box(actions[1]).left - a.right);
    }
    return result;
  };
  const zones = {};
  for (const zone of document.querySelectorAll('.zone')) {
    const id = zone.id;
    zones[id] = {
      tokens: {space1: token(zone, '--sf-space-1'), space12: token(zone, '--sf-space-1\\/2'), space13: token(zone, '--sf-space-1\\/3'),
        line1: token(zone, '--sf-text-height-1')},
    };
    for (const name of ['stack', 'pair', 'line', 'plain', 'outlined']) zones[id][name] = notice(zone.querySelector(`#${id}-${name} .sf-alert`));
    zones[id].class = notice(zone.querySelector(`#${id}-class`));
  }
  return zones;
};

// The decision's numbers, the toast's: [desktop, compact desktop, phone]; the
// phone keeps its scale in a compact region (C36).
const EXPECT = {
  desktop: {action: 32, label: 16, close: 32, icon: 24, padX: 16, padY: 12, gap: 12, between: 8, oneLine: 56},
  compact: {action: 28, label: 14, close: 28, icon: 20, padX: 12, padY: 8, gap: 8, between: 4, oneLine: 44},
  phone: {action: 28, label: 14, close: 28, icon: 20, padX: 12, padY: 8, gap: 8, between: 8, oneLine: 44},
};
const NAMES = ['stack', 'pair', 'line', 'plain', 'outlined', 'class'];

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
        await tab.waitForFunction(() => document.querySelectorAll('sf-alert > .sf-alert').length === 10
          && document.querySelectorAll('sf-alert sf-button-icon > button.sf-icon-button').length === 10, null, {timeout: 30000})
          .catch(() => failures.push(`${key} load ${load}: the page never drew its alerts`));
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(300);
        const seen = await tab.evaluate(MEASURE);
        if (errors.length) failures.push(`${key} load ${load}: console ${JSON.stringify(errors)}`);
        if (load === 1) {
          report[key] = seen;
          await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `alert-notice-${key}.png`), fullPage: true}).catch(() => {});
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
        for (const name of NAMES) {
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
            if (t.looks[0] !== 'tonal/on-surface') failures.push(`${key} ${zone}: ${name} first action ${t.looks[0]}, expected tonal/on-surface`);
            if (t.looks[1] !== undefined && t.looks[1] !== 'ghost/on-surface') failures.push(`${key} ${zone}: ${name} second action ${t.looks[1]}, expected ghost/on-surface`);
          }
          if (t.betweenActions !== undefined) check(`${name} between actions`, t.betweenActions, want.between);
        }
        check('one-line alert without the border', at.line?.inner, want.oneLine);
        check('plain one-line alert without the border', at.plain?.inner, want.oneLine);
        if (at.pair?.betweenActions === undefined) failures.push(`${key} ${zone}: the two-action alert drew one action`);
      }
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
console.log(`alert-notice-geometry: ${Object.keys(report).length} views x 2 densities x 3 loads, every check holds`);
