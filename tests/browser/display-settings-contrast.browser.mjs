#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--json <file>]
//   (the build output root holding core/; PLAYWRIGHT_MODULE=/abs/playwright/index.mjs
//   picks another Playwright)
//
// The five colour schemes of the display settings (owner decision C196,
// 2026-11-15; core/scss/_sf_css__display.scss), measured on the built core
// sheet in a browser so every light-dark(), alias and translucent step
// resolves as a page gets it. The pairs are the C178 contrast matrix's (ink on
// every surface, ink on every fill laid over every surface, status and tone
// containers, status ink as text, status fills, paper and inverse), read in
// each scheme on the root and in a region of the other theme (.theme-light /
// .theme-dark inside the page), and held to:
//
//   text      13:1   the page's text and the quiet text on every neutral
//                    surface and on paper (C196: text not below 13:1);
//   links      7:1   --sf-link and its states on every neutral surface;
//   the rest   AA     4.5:1 for text, 3:1 for an icon or a graphic part;
//                    disabled ink is exempt (WCAG 1.4.3) and only reported.
//
// And the page without a scheme is not touched: every role the matrix reads
// resolves to the same colour as on a page with no display settings at all.
//
// Prints {schemes, minima, failures} and exits 1 on a failure.
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) throw new Error('Build output root is required');
const out = resolve(args[0]);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt > 0 ? args[jsonAt + 1] : null;
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sheet = readFileSync(join(out, 'core/core/css/core.css'), 'utf8');

const SCHEMES = ['black-on-white', 'white-on-black', 'yellow-on-black', 'blue-on-sky', 'brown-on-cream'];
const NEUTRAL = ['page', 'area', 'well', 'card', 'raised', 'popup', 'popup-nested'];
const OWN_VARIANT = {card: 'card-variant', raised: 'raised-variant', popup: 'popup-variant', 'popup-nested': 'popup-nested-variant'};
const FILLS = ['container', 'container-hover', 'container-active', 'container-strong'];
const STATUS = ['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info', 'neutral'];
const TONES = ['amber', 'green', 'indigo', 'lime', 'rose', 'sky', 'teal', 'violet'];
const INK_AS_TEXT = ['error', 'primary', 'success', 'warning', 'info'];
const LINKS = ['--sf-link', '--sf-link-hover', '--sf-link-active', '--sf-link-visited'];

// Every pair: [ink, surface, base, threshold, required, group].
function pairs() {
  const list = [];
  const add = (ink, surface, base, threshold, required, group) => list.push({ink, surface, base, threshold, required, group});
  for (const place of NEUTRAL) {
    const surface = `--sf-surface-${place}`;
    add('--sf-on-surface', surface, null, 13, true, 'text');
    add('--sf-on-surface-hover', surface, null, 13, true, 'text');
    add('--sf-on-surface-active', surface, null, 13, true, 'text');
    add('--sf-on-surface-variant', surface, null, 13, true, 'text');
    if (OWN_VARIANT[place]) add(`--sf-on-surface-${OWN_VARIANT[place]}`, surface, null, 13, true, 'text');
    add('--sf-on-surface-icon', surface, null, 3, true, 'icon');
    add('--sf-on-surface-disabled', surface, null, 4.5, false, 'disabled (exempt)');
    for (const link of LINKS) add(link, surface, null, 7, true, 'links');
    for (const fill of FILLS) {
      const over = `--sf-surface-${fill}`;
      add('--sf-on-surface', over, surface, 4.5, true, 'ink on a fill');
      add('--sf-on-surface-container-variant', over, surface, 4.5, true, 'ink on a fill');
      add('--sf-on-surface-icon', over, surface, 3, true, 'icon on a fill');
    }
    for (const status of STATUS) {
      add(`--sf-on-${status}-container`, `--sf-${status}-container`, surface, 4.5, true, 'status container');
      add(`--sf-on-${status}-container-graphic`, `--sf-${status}-container`, surface, 3, true, 'status container graphic');
    }
    for (const tone of TONES) add(`--sf-on-tone-${tone}-container`, `--sf-tone-${tone}-container`, surface, 4.5, true, 'tone container');
    for (const status of INK_AS_TEXT) add(`--sf-${status}`, surface, null, 4.5, true, 'status ink as text');
    add('--sf-focus--color', surface, null, 3, true, 'focus ring');
    add('--sf-outline', surface, null, 3, true, 'edge');
  }
  for (const status of STATUS) add(`--sf-on-${status}`, `--sf-${status}`, '--sf-surface-page', 4.5, true, 'status fill');
  add('--sf-on-paper', '--sf-paper', null, 13, true, 'text');
  add('--sf-on-surface-inverse', '--sf-surface-inverse', null, 4.5, true, 'inverse');
  return list;
}

// The pairs as the page resolves them under `scheme` ('' for none), on the
// root and in a nested region of `region` theme.
function measure(list) {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const read = (probe, name) => {
    if (name.startsWith('#')) return name;
    probe.style.color = `var(${name}, rgb(1, 2, 3))`;
    const value = getComputedStyle(probe).color;
    return value === 'rgb(1, 2, 3)' ? null : value;
  };
  const paint = (...layers) => {
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, 1, 1);
    for (const colour of layers) { context.fillStyle = colour; context.fillRect(0, 0, 1, 1); }
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return {r, g, b};
  };
  const luminance = ({r, g, b}) => [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const hex = ({r, g, b}) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  const result = {};
  for (const where of ['root', 'region']) {
    const probe = document.getElementById(where);
    result[where] = list.map((pair) => {
      const ink = read(probe, pair.ink);
      const surface = read(probe, pair.surface);
      const base = pair.base ? read(probe, pair.base) : null;
      if (!ink || !surface || (pair.base && !base)) return {...pair, missing: true};
      const page = read(probe, '--sf-surface-page');
      const under = base ? ['#ffffff', page, base] : ['#ffffff', page];
      const back = paint(...under, surface);
      const front = paint(...under, surface, ink);
      const [high, low] = [luminance(back), luminance(front)].sort((x, y) => y - x);
      return {...pair, back: hex(back), front: hex(front), ink: pair.ink, raw: [ink, surface], ratio: Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100};
    });
  }
  return result;
}

const html = (theme, region, scheme) => `<!doctype html><html class="theme-${theme}"${scheme ? ` data-sf-scheme="${scheme}"` : ''}><head><meta charset="utf-8"><style>${sheet}</style></head>
<body><div id="root"></div><section class="theme-${region}"><div id="region"></div></section></body></html>`;

const failures = [];
const minima = {};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const list = pairs();
  // Without a scheme: the same colours as a page with no display settings
  // (the sheet without the display partial is not at hand, so the guard is
  // that nothing under :root[data-sf-scheme] leaks: the root and a region of
  // each theme read the same as on a page whose root carries an unknown scheme).
  for (const theme of ['light', 'dark']) {
    await page.setContent(html(theme, theme === 'light' ? 'dark' : 'light', ''));
    const plain = await page.evaluate(measure, list);
    await page.setContent(html(theme, theme === 'light' ? 'dark' : 'light', 'none-such'));
    const unknown = await page.evaluate(measure, list);
    for (const where of ['root', 'region']) {
      plain[where].forEach((one, index) => {
        const other = unknown[where][index];
        if (one.back !== other.back || one.front !== other.front) failures.push(`no scheme, ${theme} ${where}: ${one.ink} on ${one.surface} reads ${one.front}/${one.back}, an unknown scheme ${other.front}/${other.back}`);
      });
    }
  }
  for (const scheme of SCHEMES) {
    for (const theme of ['light', 'dark']) {
      await page.setContent(html(theme, theme === 'light' ? 'dark' : 'light', scheme));
      const measured = await page.evaluate(measure, list);
      for (const where of ['root', 'region']) {
        for (const one of measured[where]) {
          const key = `${scheme} (${theme} page, ${where}) ${one.ink} on ${one.surface}${one.base ? ` over ${one.base}` : ''}`;
          if (one.missing) { if (one.required) failures.push(`${key}: not declared`); continue; }
          const group = `${scheme} ${one.group}`;
          if (!minima[group] || one.ratio < minima[group].ratio) minima[group] = {ratio: one.ratio, at: key};
          if (one.required && one.ratio < one.threshold) failures.push(`${key}: ${one.ratio}:1 < ${one.threshold}:1 (${one.front} on ${one.back})`);
        }
      }
    }
  }
  // The scheme is the page's ground and text: body and the root take them.
  for (const scheme of SCHEMES) {
    await page.setContent(html('light', 'dark', scheme));
    const ground = await page.evaluate(() => {
      const probe = document.getElementById('root');
      probe.style.color = 'var(--sf-scheme-ground)';
      const want = getComputedStyle(probe).color;
      return {want, body: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme};
    });
    if (ground.body !== ground.want) failures.push(`${scheme}: the body is ${ground.body}, the scheme ground ${ground.want}`);
  }
} finally {
  await browser.close();
}

const summary = {check: 'C196 display schemes: text 13:1, links 7:1, every other role pair AA, root and nested regions, both page themes', schemes: SCHEMES, minima, failures};
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({schemes: SCHEMES.length, minima, failures}, null, 2));
if (failures.length) process.exit(1);
