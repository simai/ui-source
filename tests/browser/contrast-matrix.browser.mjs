#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--json <file>]
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The contrast matrix (owner decision C178, 2026-11-14: every general rule has
// an automatic check in the pair build; research ui-control
// control/research/2026-11-14-standards-tokens-utilities.md §1, "contrast of
// every text/icon role on every surface in both themes"). It reads the built
// core sheet in a browser, so every light-dark(), alias and translucent step
// resolves the way a page gets it, and computes the WCAG 2.2 contrast of:
//
//   ink on a surface   the neutral ink roles (--sf-on-surface, the variant,
//                      the hover and pressed ink, the icon role) on every
//                      opaque surface role (page, area, well, card, raised,
//                      popup, popup-nested, paper, inverse); a place with a
//                      variant of its own (card, raised, popup, popup-nested)
//                      is read with that variant; the generic variant there is
//                      measured and reported, not required (C16 places);
//   ink on a fill      the container fills (rest, hover, pressed, strong) are
//                      translucent: each is laid over every opaque neutral
//                      surface, and the ink, the container variant and the
//                      icon role are read on the result;
//   status pairs       --sf-on-X on --sf-X, --sf-on-X-container and its graphic
//                      on --sf-X-container (laid over every opaque surface),
//                      for primary ... neutral, and each tone container;
//   status ink as text --sf-error, -primary, -success, -warning and -info are
//                      written as the colour of text in the sources (an error
//                      message, a link, a status word): on every opaque surface;
//   glass              --sf-surface-media (the place over a picture) over a
//                      white and a black picture, with its own ink.
//
// AA: text 4.5:1 (1.4.3), an icon or a graphic part 3:1 (1.4.11). Disabled
// ink is exempt (1.4.3 inactive components) and only reported. A pair below
// its threshold fails unless KNOWN lists it with its owner; a KNOWN rule that
// covers fewer pairs than it says fails too, so the list only shrinks.
//
// Prints {matrix, failures, known, fixedKnown} and exits 1 on a failure.
import {writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) throw new Error('Build output root is required');
const out = resolve(args[0]);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt > 0 ? args[jsonAt + 1] : null;
const core = join(out, 'core/core/css/core.css');

const NEUTRAL = ['page', 'area', 'well', 'card', 'raised', 'popup', 'popup-nested'];
const OWN_VARIANT = {card: 'card-variant', raised: 'raised-variant', popup: 'popup-variant', 'popup-nested': 'popup-nested-variant'};
const FILLS = ['container', 'container-hover', 'container-active', 'container-strong'];
const STATUS = ['primary', 'secondary', 'tertiary', 'error', 'warning', 'success', 'info', 'neutral'];
const TONES = ['amber', 'green', 'indigo', 'lime', 'rose', 'sky', 'teal', 'violet'];
const INK_AS_TEXT = ['error', 'primary', 'success', 'warning', 'info'];

// Pairs below AA in group build 4 (2026-11-14), each a found defect with the
// owner that fixes it (C178: listed, not hidden). A rule matches the key
// "<theme> <ink> on <surface>[ over <base>]" and names how many pairs it
// covers: a pair below AA outside every rule fails, and a rule that covers
// fewer pairs than its count fails as well, so the list only shrinks. Each
// fix is a change of look (a colour step), which the owner decides.
const KNOWN = [
  {
    match: /^(light|dark) --sf-on-surface-media on --sf-surface-media over #ffffff$/u,
    count: 2,
    owner: 'core colour roles: glass (C16 place sf-surface-media, C92 text on a picture)',
    why: 'white ink on black 48 over a white picture is 3.69:1; text on glass needs the 64 step or a scrim',
  },
  {
    match: /^dark --sf-on-[a-z]+-container-graphic on --sf-[a-z]+-container over --sf-surface-popup(-nested)?$/u,
    count: 15,
    owner: 'core colour roles: the dark status graphic steps (C16 S3 status containers)',
    why: 'a status container laid over a raised dark surface leaves the graphic step (the 60 tone) below 3:1',
  },
  {
    match: /^dark --sf-on-neutral-container-graphic on --sf-neutral-container over --sf-surface-(page|area|well|card|raised)$/u,
    count: 5,
    owner: 'core colour roles: the dark neutral container graphic (C16 S3)',
    why: 'neutral-60 on the neutral container is 2.93:1 on every dark surface',
  },
  {
    match: /^dark --sf-on-surface(-container-variant)? on --sf-surface-container-(hover|active|strong) over --sf-surface-popup(-nested)?$/u,
    count: 5,
    owner: 'core colour roles: dark fills over raised steps (C16 S3 dim ink on a fill, open with the owner)',
    why: 'a hover, pressed or strong fill inside a dark popup brings the dim ink, and on the nested popup the ink, below 4.5:1',
  },
];

// Every pair: [ink, surface, base, threshold, required, group].
function pairs() {
  const list = [];
  const add = (ink, surface, base, threshold, required, group) => list.push({ink, surface, base, threshold, required, group});
  for (const place of NEUTRAL) {
    const surface = `--sf-surface-${place}`;
    add('--sf-on-surface', surface, null, 4.5, true, 'ink on a surface');
    add('--sf-on-surface-hover', surface, null, 4.5, true, 'ink on a surface');
    add('--sf-on-surface-active', surface, null, 4.5, true, 'ink on a surface');
    add('--sf-on-surface-icon', surface, null, 3, true, 'icon on a surface');
    add('--sf-on-surface-variant', surface, null, 4.5, !OWN_VARIANT[place], 'ink on a surface');
    if (OWN_VARIANT[place]) add(`--sf-on-surface-${OWN_VARIANT[place]}`, surface, null, 4.5, true, 'ink on a surface');
    add('--sf-on-surface-disabled', surface, null, 4.5, false, 'disabled (exempt)');
    for (const fill of FILLS) {
      const over = `--sf-surface-${fill}`;
      add('--sf-on-surface', over, surface, 4.5, true, 'ink on a fill');
      add('--sf-on-surface-container-variant', over, surface, 4.5, true, 'ink on a fill');
      add('--sf-on-surface-icon', over, surface, 3, true, 'icon on a fill');
      add('--sf-on-surface-variant', over, surface, 4.5, false, 'ink on a fill');
    }
    for (const status of STATUS) {
      add(`--sf-on-${status}-container`, `--sf-${status}-container`, surface, 4.5, true, 'status container');
      add(`--sf-on-${status}-container-graphic`, `--sf-${status}-container`, surface, 3, true, 'status container graphic');
    }
    for (const tone of TONES) add(`--sf-on-tone-${tone}-container`, `--sf-tone-${tone}-container`, surface, 4.5, true, 'tone container');
    for (const status of INK_AS_TEXT) add(`--sf-${status}`, surface, null, 4.5, true, 'status ink as text');
  }
  for (const status of STATUS) add(`--sf-on-${status}`, `--sf-${status}`, '--sf-surface-page', 4.5, true, 'status fill');
  add('--sf-on-paper', '--sf-paper', null, 4.5, true, 'ink on a surface');
  add('--sf-on-surface-inverse', '--sf-surface-inverse', null, 4.5, true, 'ink on a surface');
  add('--sf-on-surface-inverse-fixed', '--sf-surface-inverse-fixed', null, 4.5, true, 'ink on a surface');
  for (const picture of ['#ffffff', '#000000']) {
    for (const [ink, threshold] of [['--sf-on-surface-media', 4.5], ['--sf-on-surface-media', 3]]) {
      add(ink, '--sf-surface-media', picture, threshold, true, threshold === 3 ? 'glass icon' : 'glass text');
    }
  }
  return list;
}

const browser = await chromium.launch();
const matrix = [];
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html class="theme-${theme}"><head><meta charset="utf-8"></head><body></body></html>`);
    await page.addStyleTag({path: core});
    const measured = await page.evaluate((list) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      const probe = document.createElement('div');
      document.body.append(probe);
      // A role as the page resolves it: the computed colour of an element that
      // paints with it (a property that is not declared resolves to nothing).
      const colourOf = (name) => {
        if (name.startsWith('#')) return name;
        probe.style.color = `var(${name}, rgb(1, 2, 3))`;
        const value = getComputedStyle(probe).color;
        return value === 'rgb(1, 2, 3)' ? null : value;
      };
      // Painting composites a translucent colour over what lies under it.
      const paint = (...layers) => {
        context.globalCompositeOperation = 'source-over';
        context.clearRect(0, 0, 1, 1);
        for (const colour of layers) { context.fillStyle = colour; context.fillRect(0, 0, 1, 1); }
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return {r, g, b, a};
      };
      const luminance = ({r, g, b}) => [r, g, b].map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const hex = ({r, g, b}) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      return list.map((pair) => {
        const ink = colourOf(pair.ink);
        const surface = colourOf(pair.surface);
        const base = pair.base ? colourOf(pair.base) : null;
        if (!ink || !surface || (pair.base && !base)) return {...pair, missing: [!ink && pair.ink, !surface && pair.surface, pair.base && !base && pair.base].filter(Boolean)};
        // an opaque white page under everything: a translucent surface with no base lies on the page
        const under = base ? ['#ffffff', colourOf('--sf-surface-page'), base] : ['#ffffff', colourOf('--sf-surface-page')];
        const back = paint(...under, surface);
        const front = paint(...under, surface, ink);
        const [high, low] = [luminance(back), luminance(front)].sort((x, y) => y - x);
        const ratio = Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
        return {...pair, back: hex(back), front: hex(front), ratio};
      });
    }, pairs());
    for (const one of measured) matrix.push({theme, ...one});
    await page.close();
  }
} finally {
  await browser.close();
}

const keyOf = (one) => `${one.theme} ${one.ink} on ${one.surface}${one.base ? ` over ${one.base}` : ''}`;
const failures = [];
const known = [];
const covered = new Map(KNOWN.map((rule) => [rule, 0]));
for (const one of matrix) {
  const key = keyOf(one);
  if (one.missing) { if (one.required) failures.push(`${key}: not declared ${one.missing.join(', ')}`); continue; }
  if (!one.required || one.ratio >= one.threshold) continue;
  const rule = KNOWN.find((entry) => entry.match.test(key));
  if (rule) {
    covered.set(rule, covered.get(rule) + 1);
    known.push({key, ratio: one.ratio, threshold: one.threshold, owner: rule.owner});
  } else failures.push(`${key}: ${one.ratio}:1 < ${one.threshold}:1 (${one.group}; ${one.front} on ${one.back})`);
}
const fixedKnown = [...covered].filter(([rule, n]) => n !== rule.count)
  .map(([rule, n]) => `${rule.owner}: ${n} pairs below AA where the list says ${rule.count} -- set the count to ${n}${n ? '' : ' or remove the rule'}`);
const summary = {
  check: 'C178 contrast matrix: text 4.5:1, icons and graphics 3:1, both themes',
  pairs: matrix.length,
  required: matrix.filter((one) => one.required).length,
  below: matrix.filter((one) => one.required && one.ratio < one.threshold).length,
  informational_below: matrix.filter((one) => !one.required && one.ratio < one.threshold).map((one) => `${keyOf(one)}: ${one.ratio}:1 (${one.group})`),
  known,
  fixedKnown,
  failures,
};
if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify({...summary, matrix}, null, 1)}\n`);
console.log(JSON.stringify(summary, null, 1));
if (failures.length || fixedKnown.length) process.exit(1);
