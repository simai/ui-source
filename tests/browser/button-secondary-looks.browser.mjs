#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// Secondary in the outline, surface and link looks (owner decision
// 2026-11-07, variant A), on the built bytes over the Loader, in the light
// and the dark theme, three loads each:
//
//   - a secondary sf-button in outline, surface, link (and ghost, link's old
//     name) is the on-surface button of the same size and look: the same
//     height, block and side padding, border widths and colour, fill and type;
//     before, these three had no rule -- about 32px at size 1, no padding;
//   - its label and its icon are --sf-secondary, at rest and hovered; the
//     hovered fill is on-surface's hovered fill;
//   - a plain class button (component.buttons without the Smart element)
//     draws the same;
//   - default and tonal secondary keep their own fill (--sf-secondary and
//     --sf-secondary-container): nothing else of secondary changed.
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
const LOOKS = ['outline', 'surface', 'link', 'ghost'];
const SCHEMES = ['on-surface', 'secondary'];

const body = () => SIZES.map((size) => `
<div class="row" data-size="${size}">
  ${LOOKS.map((look) => SCHEMES.map((scheme) =>
    `<sf-button size="${size}" appearance="${look}" scheme="${scheme}" text="Кнопка" icon-start="settings" data-k="smart ${look} ${scheme}"></sf-button>`).join('')).join('')}
  ${['outline', 'surface', 'link'].map((look) => SCHEMES.map((scheme) =>
    `<button type="button" class="sf-button sf-button--${look} sf-button--${scheme} sf-button--size-${size} flex items-cross-center" data-k="plain ${look} ${scheme}"><span class="sf-button-text-container">Кнопка</span></button>`).join('')).join('')}
  ${['default', 'tonal'].map((look) =>
    `<sf-button size="${size}" appearance="${look}" scheme="secondary" text="Кнопка" data-k="smart ${look} secondary"></sf-button>`).join('')}
</div>`).join('\n') + `
<span id="ink" style="color: var(--sf-secondary)">x</span>
<span id="fill-tonal" style="color: var(--sf-secondary-container)">x</span>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/buttons/css/buttons.css">
<style>.row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;margin:8px 16px}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">${body()}</body></html>`;

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
  const round = (value) => Math.round(value * 100) / 100;
  const rows = {};
  for (const row of document.querySelectorAll('.row')) {
    const cells = {};
    // sf-button forwards data-* to its inner button: the key sits on the
    // control itself, on a Smart and a plain button alike.
    for (const host of row.querySelectorAll('[data-k]')) {
      const button = host.matches('.sf-button') ? host : host.querySelector('.sf-button');
      if (!button) { cells[host.dataset.k] = null; continue; }
      const style = getComputedStyle(button);
      const label = button.querySelector('.sf-button-text-container');
      const icon = button.querySelector('.sf-icon');
      cells[host.dataset.k] = {
        h: round(button.getBoundingClientRect().height),
        block: round(parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth)),
        side: round(parseFloat(style.paddingInlineStart) + parseFloat(style.borderInlineStartWidth)),
        textSide: label ? round(parseFloat(getComputedStyle(label).paddingInlineStart)) : null,
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
        fill: style.backgroundColor,
        font: label ? `${getComputedStyle(label).fontSize} ${getComputedStyle(label).fontWeight} ${getComputedStyle(label).lineHeight}` : null,
        label: label ? getComputedStyle(label).color : null,
        icon: icon ? getComputedStyle(icon).color : null,
      };
    }
    rows[row.dataset.size] = cells;
  }
  const color = (id) => getComputedStyle(document.getElementById(id)).color;
  return {rows, ink: color('ink'), fillTonal: color('fill-tonal')};
};

const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      // The Loader writes the theme class from the system's preference.
      const tab = await browser.newPage({viewport: {width: 1280, height: 900}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
      const expected = SIZES.length * (LOOKS.length * SCHEMES.length + 2);
      await tab.waitForFunction((count) => customElements.get('sf-button')
        && document.querySelectorAll('sf-button > .sf-button').length === count
        && document.querySelectorAll('sf-button > .sf-button .sf-icon').length === count - 2 * 5, expected, {timeout: 30000})
        .catch(async () => failures.push(`${theme}: the page never drew its buttons (${await tab.evaluate(() => document.querySelectorAll('sf-button > .sf-button').length)})`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      if (!await tab.evaluate((name) => document.documentElement.classList.contains(`theme-${name}`), theme)) failures.push(`${theme} load ${load}: the page is not in that theme`);
      const seen = await tab.evaluate(MEASURE);
      // Hovered: the on-surface and the secondary outline / link of size 1.
      seen.hover = {};
      for (const look of ['outline', 'link', 'surface']) {
        for (const scheme of SCHEMES) {
          const locator = tab.locator(`.row[data-size="1"] [data-k="smart ${look} ${scheme}"]`);
          await locator.hover();
          await tab.waitForTimeout(250);
          seen.hover[`${look} ${scheme}`] = await locator.evaluate((button) => ({
            fill: getComputedStyle(button).backgroundColor,
            label: getComputedStyle(button.querySelector('.sf-button-text-container')).color,
            icon: getComputedStyle(button.querySelector('.sf-icon')).color,
          }));
        }
      }
      await tab.mouse.move(0, 0);
      if (errors.length) failures.push(`${theme} load ${load}: console ${JSON.stringify(errors)}`);
      if (load === 1) {
        report[theme] = seen;
        await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-secondary-looks-${theme}.png`), fullPage: true}).catch(() => {});
      } else if (JSON.stringify(seen) !== JSON.stringify(report[theme])) {
        failures.push(`${theme} load ${load}: the measurements differ from the first load`);
      }
      await tab.close();
    }

    const {rows, ink, fillTonal, hover} = report[theme];
    for (const size of SIZES) {
      const cells = rows[size] ?? {};
      for (const kind of ['smart', 'plain']) {
        for (const look of kind === 'smart' ? LOOKS : ['outline', 'surface', 'link']) {
          const base = cells[`${kind} ${look} on-surface`];
          const secondary = cells[`${kind} ${look} secondary`];
          if (!base || !secondary) { failures.push(`${theme} size ${size} ${kind} ${look}: not drawn`); continue; }
          for (const property of ['h', 'block', 'side', 'textSide', 'border', 'fill', 'font']) {
            if (base[property] !== secondary[property]) failures.push(`${theme} size ${size} ${kind} ${look}: secondary ${property} ${secondary[property]}, on-surface ${base[property]}`);
          }
          if (secondary.label !== ink) failures.push(`${theme} size ${size} ${kind} ${look}: secondary label ${secondary.label}, --sf-secondary ${ink}`);
          if (kind === 'smart' && secondary.icon !== ink) failures.push(`${theme} size ${size} ${kind} ${look}: secondary icon ${secondary.icon}, --sf-secondary ${ink}`);
        }
      }
      // One height per size: every cell of the row, Smart and plain, stands as tall.
      const heights = new Set(Object.values(cells).filter(Boolean).map((cell) => cell.h));
      if (heights.size !== 1) failures.push(`${theme} size ${size}: buttons of different heights (${[...heights].join(', ')})`);
      const filled = cells['smart default secondary'];
      const tonal = cells['smart tonal secondary'];
      if (!filled || filled.fill !== ink) failures.push(`${theme} size ${size}: default secondary fill ${filled?.fill}, --sf-secondary ${ink}`);
      if (!tonal || tonal.fill !== fillTonal) failures.push(`${theme} size ${size}: tonal secondary fill ${tonal?.fill}, --sf-secondary-container ${fillTonal}`);
      if (filled && cells['smart outline on-surface'] && filled.h !== cells['smart outline on-surface'].h) failures.push(`${theme} size ${size}: default secondary ${filled.h}px, outline on-surface ${cells['smart outline on-surface'].h}px`);
    }
    for (const look of ['outline', 'link', 'surface']) {
      const base = hover[`${look} on-surface`];
      const secondary = hover[`${look} secondary`];
      if (base.fill !== secondary.fill) failures.push(`${theme} hovered ${look}: secondary fill ${secondary.fill}, on-surface ${base.fill}`);
      if (secondary.label !== ink || secondary.icon !== ink) failures.push(`${theme} hovered ${look}: secondary label ${secondary.label} icon ${secondary.icon}, --sf-secondary ${ink}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report: Object.fromEntries(Object.entries(report).map(([theme, seen]) => [theme, {
  ink: seen.ink,
  heights: Object.fromEntries(SIZES.map((size) => [size, Object.fromEntries(Object.entries(seen.rows[size] ?? {}).map(([name, cell]) => [name, cell?.h]))])),
  size1: seen.rows['1'],
  hover: seen.hover,
}])), failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;
