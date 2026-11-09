#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// One height per size whatever the look or the density (owner rule C01, docs
// review R022, 2026-11-07), on the built bytes over the Loader, at a desktop
// and a phone width (the side padding ladder differs below 60rem), three
// loads each:
//
//   - every sf-button of a size -- five appearances x four densities
//     (normal, compact, comfortable, spacious) and the three retired
//     tightness names -- stands at one height, the size's control height
//     (--sf-ui-<size>--control-height);
//   - density moves the side padding only: compact <= normal <= comfortable
//     <= spacious, and spacious is wider than compact where the size's ladder
//     has the steps;
//   - a segmented sf-button-group of a size is as tall as a button of it at
//     every density;
//   - sf-button-icon the same: one height per size (the size's control
//     height) at every appearance and density, the side padding moving;
//   - the places that used compact spacing for a smaller button keep their
//     released height with the next size down: the calendar's month and year
//     toggles (sf-input-date) and the inline empty-state link.
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

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const APPEARANCES = ['default', 'tonal', 'outline', 'link', 'surface'];
// The density attribute and the retired tightness name of the same step.
const DENSITIES = [['spacing', 'normal'], ['spacing', 'compact'], ['spacing', 'comfortable'], ['spacing', 'spacious'], ['tightness', 'low'], ['tightness', 'high'], ['tightness', 'highest']];
const STEP = {normal: 'normal', compact: 'compact', comfortable: 'comfortable', spacious: 'spacious', low: 'compact', high: 'comfortable', highest: 'spacious'};
const key = (size) => size.replace('/', '_');

const body = () => SIZES.map((size) => `
<div class="row" id="s-${key(size)}" data-size="${size}">
  <span class="ladder" style="block-size: var(--sf-ui-${size.replace('/', '\\/')}--control-height)"></span>
  ${APPEARANCES.map((appearance) => DENSITIES.map(([name, value]) =>
    `<sf-button size="${size}" appearance="${appearance}" scheme="on-surface" ${name}="${value}" text="Кнопка" data-a="${appearance}" data-d="${value}"></sf-button>`).join('')).join('')}
  ${['normal', 'compact', 'comfortable', 'spacious'].map((spacing) =>
    `<sf-segmented appearance="segmented" aria-label="Период" size="${size}" spacing="${spacing}" value="w" data-d="${spacing}"><script type="application/json" data-sf-settings>{"items":[{"value":"d","label":"День"},{"value":"w","label":"Неделя"}]}</script></sf-segmented>`).join('')}
  ${APPEARANCES.map((appearance) => DENSITIES.map(([name, value]) =>
    `<sf-button-icon size="${size}" appearance="${appearance}" scheme="on-surface" ${name}="${value}" icon="settings" aria-label="Настройки"></sf-button-icon>`).join('')).join('')}
</div>`).join('\n') + `
<div class="row" id="consumers">
  <sf-input-date input="false" value="2026-09-03"></sf-input-date>
  <sf-empty-state kind="error" layout="inline" size="1"></sf-empty-state>
  <sf-empty-state kind="error" layout="inline" size="1/2"></sf-empty-state>
</div>`;

const page = () => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin:8px 16px}.ladder{inline-size:4px;background:red}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">${body()}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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

const MEASURE = ({appearances, densities}) => {
  const round = (value) => Math.round(value * 100) / 100;
  const rows = {};
  for (const row of document.querySelectorAll('.row')) {
    // Written in order: each appearance with each density in turn (the hosts'
    // own attributes are rewritten by the element, a retired name included).
    const buttons = Array.from(row.querySelectorAll('sf-button > .sf-button')).map((button, index) => {
      const style = getComputedStyle(button);
      return {a: appearances[Math.floor(index / densities.length)], d: densities[index % densities.length], h: round(button.getBoundingClientRect().height),
        side: round(parseFloat(style.paddingInlineStart) + parseFloat(style.borderInlineStartWidth)),
        block: round(parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth))};
    });
    const groups = Array.from(row.querySelectorAll('sf-segmented')).map((group) => {
      const track = group.querySelector('.sf-button-group') ?? group.firstElementChild;
      return {d: group.dataset.d, h: round(track.getBoundingClientRect().height)};
    });
    const icons = Array.from(row.querySelectorAll('sf-button-icon > .sf-icon-button')).map((button, index) => {
      const style = getComputedStyle(button);
      return {a: appearances[Math.floor(index / densities.length)], d: densities[index % densities.length], h: round(button.getBoundingClientRect().height),
        side: round(parseFloat(style.paddingInlineStart) + parseFloat(style.borderInlineStartWidth))};
    });
    if (!row.dataset.size) continue;
    rows[row.dataset.size] = {icons, ladder: round(row.querySelector('.ladder').getBoundingClientRect().height), buttons, groups};
  }
  const box = (selector) => { const node = document.querySelector(selector); return node ? round(node.getBoundingClientRect().height) : null; };
  rows.consumers = {
    monthToggle: box('#consumers .sf-datepicker-month-toggle button'),
    yearToggle: box('#consumers .sf-datepicker-year-toggle button'),
    emptyLink1: box('#consumers sf-empty-state[size="1"] .sf-empty-state-link button'),
    emptyLink12: box('#consumers sf-empty-state[size="1/2"] .sf-empty-state-link button'),
  };
  return rows;
};

const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const [width, label] of [[1280, 'desktop'], [375, 'phone']]) {
    for (let load = 1; load <= 3; load += 1) {
      const tab = await browser.newPage({viewport: {width, height: 900}});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/`);
      await tab.waitForFunction((count) => customElements.get('sf-button') && customElements.get('sf-button-group')
        && document.querySelectorAll('.row[data-size] sf-button > .sf-button').length === count
        && document.querySelectorAll('sf-segmented .sf-button-group-segment').length === 2 * 4 * 5
        && document.querySelectorAll('.row[data-size] sf-button-icon > .sf-icon-button').length === count
        && document.querySelector('#consumers .sf-datepicker-year-toggle button')
        && document.querySelectorAll('#consumers .sf-empty-state-link button').length === 2, SIZES.length * APPEARANCES.length * DENSITIES.length, {timeout: 30000})
        .catch(async () => failures.push(`${label}: the page never drew its buttons and groups ${JSON.stringify(await tab.evaluate(() => ({
          buttons: document.querySelectorAll('sf-button > .sf-button').length,
          segments: document.querySelectorAll('sf-segmented .sf-button-group-segment').length,
          icons: document.querySelectorAll('sf-button-icon > .sf-icon-button').length,
          year: Boolean(document.querySelector('#consumers .sf-datepicker-year-toggle button')),
          links: document.querySelectorAll('#consumers .sf-empty-state-link button').length,
        })))}`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const seen = await tab.evaluate(MEASURE, {appearances: APPEARANCES, densities: DENSITIES.map(([, value]) => value)});
      if (errors.length) failures.push(`${label} load ${load}: console ${JSON.stringify(errors)}`);
      if (load === 1) {
        report[label] = seen;
        await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-density-height-${label}.png`), fullPage: true}).catch(() => {});
        await tab.locator('#consumers').screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-density-height-consumers-${label}.png`)}).catch(() => {});
      } else if (JSON.stringify(seen) !== JSON.stringify(report[label])) {
        failures.push(`${label} load ${load}: the measurements differ from the first load`);
      }
      await tab.close();
    }

    for (const size of SIZES) {
      const {ladder, buttons, groups} = report[label][size] ?? {buttons: [], groups: []};
      const heights = new Set(buttons.map((button) => button.h));
      if (heights.size !== 1) {
        const odd = buttons.filter((button) => button.h !== buttons[0].h).map((button) => `${button.a}/${button.d} ${button.h}`);
        failures.push(`${label} size ${size}: buttons of different heights (${[...heights].join(', ')}): ${odd.slice(0, 6).join('; ')}`);
      }
      if (buttons.length && Math.abs(buttons[0].h - ladder) > 0.5) failures.push(`${label} size ${size}: a button is ${buttons[0].h}px, the control height is ${ladder}px`);
      for (const group of groups) {
        if (buttons.length && Math.abs(group.h - buttons[0].h) > 0.5) failures.push(`${label} size ${size}: a segmented group at spacing ${group.d} is ${group.h}px, a button ${buttons[0].h}px`);
      }
      const iconHeights = new Set((report[label][size]?.icons ?? []).map((icon) => icon.h));
      if (iconHeights.size !== 1) failures.push(`${label} size ${size}: icon buttons of different heights (${[...iconHeights].join(', ')})`);
      else if (Math.abs([...iconHeights][0] - ladder) > 0.5) failures.push(`${label} size ${size}: an icon button is ${[...iconHeights][0]}px, the control height is ${ladder}px`);
      for (const appearance of APPEARANCES) {
        const side = {};
        for (const icon of (report[label][size]?.icons ?? []).filter((b) => b.a === appearance)) side[STEP[icon.d]] = icon.side;
        if (!(side.compact <= side.normal && side.normal <= side.comfortable && side.comfortable <= side.spacious && side.spacious > side.compact)) failures.push(`${label} size ${size} icon ${appearance}: side padding not in order ${JSON.stringify(side)}`);
      }
      // Side padding by step, per appearance: monotonic, an alias equal to its step.
      for (const appearance of APPEARANCES) {
        const side = {};
        for (const button of buttons.filter((b) => b.a === appearance)) {
          const step = STEP[button.d];
          if (step in side && side[step] !== button.side) failures.push(`${label} size ${size} ${appearance}: ${button.d} pads ${button.side}px, its step ${step} ${side[step]}px`);
          side[step] = button.side;
        }
        if (!(side.compact <= side.normal && side.normal <= side.comfortable && side.comfortable <= side.spacious)) failures.push(`${label} size ${size} ${appearance}: side padding not in order ${JSON.stringify(side)}`);
        if (!(side.spacious > side.compact)) failures.push(`${label} size ${size} ${appearance}: spacing does not move the side padding ${JSON.stringify(side)}`);
      }
    }
    // The released heights of the compact buttons these places drew (pair
    // ui-b58b5dec35e4): month/year toggles and the size 1 link 32 / 28,
    // the 1/2 link 28 / 24 (desktop / phone); the next size down gives
    // 32 / 28 and 24 / 24.
    // C27: a size 1/3 button stands 28 on desktop (24 before), so the 1/2
    // empty-state's 1/3 link is 28 there; the phone keeps 24.
    const expected = label === 'desktop' ? {monthToggle: 32, yearToggle: 32, emptyLink1: 32, emptyLink12: 28} : {monthToggle: 28, yearToggle: 28, emptyLink1: 28, emptyLink12: 24};
    for (const [name, height] of Object.entries(expected)) {
      const seen = report[label].consumers?.[name];
      if (seen !== height) failures.push(`${label}: ${name} is ${seen}px, expected ${height}px`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report: Object.fromEntries(Object.entries(report).map(([label, rows]) => [label, Object.fromEntries(Object.entries(rows).map(([size, row]) => [size, size === 'consumers' ? row : {
  ladder: row.ladder,
  heights: [...new Set(row.buttons.map((b) => b.h))],
  side: Object.fromEntries(['normal', 'compact', 'comfortable', 'spacious'].map((d) => [d, row.buttons.find((b) => b.a === 'default' && b.d === d)?.side])),
  groups: row.groups?.map((g) => g.h),
  icons: row.icons ? [...new Set(row.icons.map((i) => i.h))] : undefined,
  iconSide: row.icons ? Object.fromEntries(['normal', 'compact', 'comfortable', 'spacious'].map((d) => [d, row.icons.find((b) => b.a === 'default' && b.d === d)?.side])) : undefined,
}]))])), failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;
