import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {TonalPalette} from '../src/core/js/vendor/material-color-utilities/palettes/tonal_palette.js';
import {hexFromArgb} from '../src/core/js/vendor/material-color-utilities/utils/string_utils.js';

// The chart series roles (--sf-chart-1 .. -8), their area fills and the
// diverging midpoint, ordered by SIMAI Chart (D4; parameters 8.3-8.4). The
// guarantees the order asks for are computed here from the shipped values, so
// a retuned primitive that breaks one fails this file instead of a chart:
//
//   contrast   every series 3:1 or more on surfaces 0, 1 and 2 in both
//              themes -- WCAG 1.4.11, the bar Atlassian and Fluent set for
//              series colour.
//   deficiency series 1 to 5 at least CVD_MIN apart under protanopia,
//              deuteranopia and tritanopia: Machado, Oliveira and Fernandes
//              2009, severity 1.0, applied to linear sRGB, distance CIEDE2000.
//              Fifteen is three times the usual "clearly different" step of
//              CIEDE2000 for small marks; five series is what Atlassian and
//              SLDS advise using at once.
//   order      each series at least NEIGHBOUR_MIN from the one before it in
//              normal vision, as Carbon orders its palette, and no two of the
//              eight closer than ALL_MIN.
//
// The report the order asked for is the diagnostic of the first test: run
// `node --test tests/chart-colours.contract.test.mjs` and read it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const palette = read('src/core/scss/_sf_figma_colors_variables.scss');
const theme = read('src/core/scss/_sf_css__theme.scss');

const CONTRAST_MIN = 3;
const CVD_MIN = 15;
const NEIGHBOUR_MIN = 25;
const ALL_MIN = 15;

// The hues of the initials, which the series reuse (tests/avatar-tones).
const TONE_HUES = {rose: 5, amber: 65, lime: 110, green: 150, teal: 190, sky: 245, indigo: 285, violet: 325};
const TONE_CHROMA = 48;

const primitives = new Map([...palette.matchAll(/(--sf-[a-z0-9-]+): (#[0-9a-f]{6,8});/gu)].map(([, name, hex]) => [name, hex]));
const role = (name) => (theme.match(new RegExp(`\\s${name}: ([^;]+);`, 'u')) ?? [])[1]?.trim() ?? null;
const branches = (name) => {
  const value = role(name);
  const match = value?.match(/^light-dark\(var\((--sf-[a-z0-9-]+)\), var\((--sf-[a-z0-9-]+)\)\)$/u);
  assert.ok(match, `${name} is a light-dark() pair of two primitives: ${value}`);
  return {light: match[1], dark: match[2]};
};
const hexOf = (primitive) => {
  const hex = primitives.get(primitive);
  assert.ok(hex, `${primitive} is a palette primitive`);
  return hex;
};
const resolveRole = (name) => {
  const {light, dark} = branches(name);
  return {light: hexOf(light), dark: hexOf(dark)};
};

// --- colour arithmetic ------------------------------------------------------

const channels = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
const linear = (hex) => channels(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const luminance = (hex) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

// Machado, Oliveira, Fernandes (2009), "A Physiologically-based Model for
// Simulation of Color Vision Deficiency", severity 1.0, on linear RGB.
const MACHADO = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const clamp = (value) => Math.min(1, Math.max(0, value));
const simulate = (rgb, matrix) => matrix.map(([r, g, b]) => clamp(r * rgb[0] + g * rgb[1] + b * rgb[2]));

const lab = ([r, g, b]) => {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

// CIEDE2000 (Sharma, Wu, Dalal 2005), kL = kC = kH = 1.
const DEG = Math.PI / 180;
const ciede2000 = ([l1, a1, b1], [l2, a2, b2]) => {
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b, a) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / DEG + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  let dh = 0;
  if (c1p * c2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dL = l2 - l1;
  const dC = c2p - c1p;
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh / 2) * DEG);
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBar = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hBar += hBar < 360 ? 360 : -360;
    hBar /= 2;
  }
  const t = 1 - 0.17 * Math.cos((hBar - 30) * DEG) + 0.24 * Math.cos(2 * hBar * DEG)
    + 0.32 * Math.cos((3 * hBar + 6) * DEG) - 0.20 * Math.cos((4 * hBar - 63) * DEG);
  const rotation = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * rotation * DEG) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
};

const distance = (a, b, deficiency = null) => {
  const [x, y] = [linear(a), linear(b)].map((rgb) => (deficiency ? simulate(rgb, MACHADO[deficiency]) : rgb));
  return ciede2000(lab(x), lab(y));
};

const minimumOver = (colours, deficiency) => {
  let least = Infinity;
  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) least = Math.min(least, distance(colours[i], colours[j], deficiency));
  }
  return least;
};

// --- the roles ----------------------------------------------------------------

const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--sf-chart-${n}`);
const THEMES = ['light', 'dark'];
const surfaces = (scheme) => [0, 1, 2].map((n) => resolveRole(`--sf-surface-${n}`)[scheme]);
const series = (scheme) => SERIES.map((name) => resolveRole(name)[scheme]);

test('the arithmetic is the published one', () => {
  // Sharma, Wu and Dalal's test data, pairs 1 and 17.
  assert.equal(ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485]).toFixed(4), '2.0425');
  assert.equal(ciede2000([50, 2.5, 0], [73, 25, -18]).toFixed(4), '27.1492');
  assert.equal(contrast('#ffffff', '#000000').toFixed(1), '21.0');
  // A grey has no hue to lose: every simulation leaves it where it was.
  for (const deficiency of Object.keys(MACHADO)) assert.ok(distance('#808080', '#808080', deficiency) < 0.5, deficiency);
});

test('eight series, each 3:1 on surfaces 0 to 2 in both themes, the first five apart under each deficiency', (t) => {
  const report = [];
  for (const scheme of THEMES) {
    const colours = series(scheme);
    const grounds = surfaces(scheme);
    let least = Infinity;
    for (const [index, colour] of colours.entries()) {
      for (const [level, ground] of grounds.entries()) {
        const ratio = contrast(colour, ground);
        least = Math.min(least, ratio);
        assert.ok(ratio >= CONTRAST_MIN, `${scheme}: ${SERIES[index]} ${colour} on surface-${level} ${ground} is ${ratio.toFixed(2)}:1`);
      }
    }
    const firstFive = colours.slice(0, 5);
    const cvd = Object.fromEntries(Object.keys(MACHADO).map((deficiency) => [deficiency, minimumOver(firstFive, deficiency)]));
    for (const [deficiency, value] of Object.entries(cvd)) {
      assert.ok(value >= CVD_MIN, `${scheme}: series 1-5 come within ${value.toFixed(1)} under ${deficiency}`);
    }
    let neighbours = Infinity;
    for (let i = 0; i + 1 < colours.length; i += 1) {
      const step = distance(colours[i], colours[i + 1]);
      neighbours = Math.min(neighbours, step);
      assert.ok(step >= NEIGHBOUR_MIN, `${scheme}: series ${i + 1} and ${i + 2} are ${step.toFixed(1)} apart`);
    }
    const all = minimumOver(colours, null);
    assert.ok(all >= ALL_MIN, `${scheme}: two of the eight series are ${all.toFixed(1)} apart`);
    report.push(`${scheme}: ${colours.join(' ')}; contrast min ${least.toFixed(2)}:1; series 1-5 CIEDE2000 min `
      + Object.entries(cvd).map(([deficiency, value]) => `${deficiency} ${value.toFixed(1)}`).join(', ')
      + `, normal ${minimumOver(firstFive, null).toFixed(1)}; neighbours min ${neighbours.toFixed(1)}; all eight min ${all.toFixed(1)}`);
  }
  for (const line of report) t.diagnostic(line);
});

test('series 1 is the primary graphic tone, and the rest are hues of the initials, indigo aside', () => {
  assert.equal(role('--sf-chart-1'), role('--sf-on-primary-container-graphic'));
  const hues = SERIES.slice(1).map((name) => {
    const {light, dark} = branches(name);
    const [, hue] = light.match(/^--sf-tone-([a-z]+)-\d+$/u) ?? [];
    assert.ok(hue, `${name} takes a tone primitive: ${light}`);
    assert.match(dark, new RegExp(`^--sf-tone-${hue}-\\d+$`, 'u'), `${name} keeps its hue in the dark theme`);
    return hue;
  });
  assert.equal(new Set(hues).size, 7, `seven different hues: ${hues}`);
  assert.ok(!hues.includes('indigo'), 'indigo is the primary hue\'s neighbour');
});

test('each fill is the fill family of the alpha scale on tone 50 of its series', () => {
  const STEPS = {'fill': [12, 24], 'fill-hover': [16, 28], 'fill-active': [20, 32]};
  for (const name of SERIES) {
    const {light} = branches(name);
    const family = light.replace(/-\d+$/u, '');
    for (const [suffix, [low, high]] of Object.entries(STEPS)) {
      assert.equal(role(`${name}-${suffix}`), `light-dark(var(${family}-50--alfa-${low}), var(${family}-50--alfa-${high}))`, `${name}-${suffix}`);
    }
  }
});

test('every tone primitive is the generator\'s tone of its hue', () => {
  const wrong = [];
  for (const [name, hex] of primitives) {
    const match = name.match(/^--sf-tone-([a-z]+)-(\d+)(?:--alfa-(\d+))?$/u);
    if (!match) continue;
    const [, hue, step, alpha] = match;
    assert.ok(hue in TONE_HUES, `${name}: ${hue} is one of the eight hues`);
    const made = hexFromArgb(TonalPalette.fromHueAndChroma(TONE_HUES[hue], TONE_CHROMA).tone(Number(step)));
    const expected = alpha ? made + Math.round((Number(alpha) * 255) / 100).toString(16).padStart(2, '0') : made;
    if (hex !== expected) wrong.push(`${name}: ${hex}, the generator gives ${expected}`);
  }
  assert.deepEqual(wrong, []);
});

test('the diverging midpoint is one quiet neutral per theme, off the surfaces and under both ends', (t) => {
  const {light, dark} = branches('--sf-chart-midpoint');
  assert.match(light, /^--sf-neutral-\d+$/u);
  assert.match(dark, /^--sf-neutral-\d+$/u);
  // The ends a diverging scale reaches: the strongest step of each family in
  // each theme, 40 light and 80 dark (parameters 8.4).
  const ends = {light: 40, dark: 80};
  for (const scheme of THEMES) {
    const midpoint = hexOf(scheme === 'light' ? light : dark);
    for (const [level, ground] of surfaces(scheme).entries()) {
      const ratio = contrast(midpoint, ground);
      // A cell at the midpoint is still a cell, and the quiet end of the scale.
      assert.ok(ratio > 1.1 && ratio < CONTRAST_MIN, `${scheme}: midpoint on surface-${level} is ${ratio.toFixed(2)}:1`);
    }
    for (const family of ['error', 'success', 'primary', 'tertiary']) {
      const end = hexOf(`--sf-${family}-${ends[scheme]}`);
      const ratio = contrast(midpoint, end);
      assert.ok(ratio >= CONTRAST_MIN, `${scheme}: ${family}-${ends[scheme]} is ${ratio.toFixed(2)}:1 from the midpoint`);
      t.diagnostic(`${scheme}: midpoint ${midpoint} to ${family}-${ends[scheme]} ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the roles are documented', () => {
  const docs = read('docs/foundation-chart-colours.md');
  for (const name of [...SERIES, '--sf-chart-N-fill', '--sf-chart-N-fill-hover', '--sf-chart-N-fill-active', '--sf-chart-midpoint']) assert.ok(docs.includes(`\`${name}\``), name);
});
