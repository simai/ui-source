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
//     every density.
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
    `<sf-button-group appearance="segmented" aria-label="Период" size="${size}" spacing="${spacing}" value="w" data-d="${spacing}"><script type="application/json" data-sf-settings>{"items":[{"value":"d","label":"День"},{"value":"w","label":"Неделя"}]}</script></sf-button-group>`).join('')}
</div>`).join('\n');

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
    const groups = Array.from(row.querySelectorAll('sf-button-group')).map((group) => {
      const track = group.querySelector('.sf-button-group') ?? group.firstElementChild;
      return {d: group.dataset.d, h: round(track.getBoundingClientRect().height)};
    });
    rows[row.dataset.size] = {ladder: round(row.querySelector('.ladder').getBoundingClientRect().height), buttons, groups};
  }
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
        && document.querySelectorAll('sf-button > .sf-button').length === count
        && document.querySelectorAll('sf-button-group .sf-button-group-segment').length === 2 * 4 * 5, SIZES.length * APPEARANCES.length * DENSITIES.length, {timeout: 30000})
        .catch(() => failures.push(`${label}: the page never drew its buttons and groups`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const seen = await tab.evaluate(MEASURE, {appearances: APPEARANCES, densities: DENSITIES.map(([, value]) => value)});
      if (errors.length) failures.push(`${label} load ${load}: console ${JSON.stringify(errors)}`);
      if (load === 1) {
        report[label] = seen;
        await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-density-height-${label}.png`), fullPage: true}).catch(() => {});
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
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report: Object.fromEntries(Object.entries(report).map(([label, rows]) => [label, Object.fromEntries(Object.entries(rows).map(([size, row]) => [size, {
  ladder: row.ladder,
  heights: [...new Set(row.buttons.map((b) => b.h))],
  side: Object.fromEntries(['normal', 'compact', 'comfortable', 'spacious'].map((d) => [d, row.buttons.find((b) => b.a === 'default' && b.d === d)?.side])),
  groups: row.groups.map((g) => g.h),
}]))])), failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;
