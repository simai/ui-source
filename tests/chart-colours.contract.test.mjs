import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {STATIC_HUE_NAMES, themeFromColor, themeVariables, DEFAULT_THEME_COLOR} from '../src/core/js/theme-palette.js';
import {themeSource} from './support/theme-source.mjs';

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
// The primitives: the theme's palettes and the static palette (C17); a status
// primitive is var() of its hue.
const palette = `${read('src/core/scss/_sf_figma_colors_variables.scss')}\n${read('src/core/scss/_sf_static_palette.scss')}`;
const theme = themeSource();

const CONTRAST_MIN = 3;
const CVD_MIN = 15;
const NEIGHBOUR_MIN = 25;
const ALL_MIN = 15;


const primitives = new Map([...palette.matchAll(/(--sf-[a-z0-9-]+): (#[0-9a-f]{6,8});/gu)].map(([, name, hex]) => [name, hex]));
for (const [, name, target] of palette.matchAll(/(--sf-[a-z0-9-]+): var\((--sf-[a-z0-9-]+)\);/gu)) if (primitives.has(target)) primitives.set(name, primitives.get(target));
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

// C17 (2026-11-08): the order is fixed and every series is a static hue, so
// no theme colour moves a series or makes one the brand's twin; a single
// series takes the theme colour, --sf-chart-brand.
const ORDER = ['blue', 'amber', 'teal', 'violet', 'yellow', 'pink', 'green', 'red'];

test('the series are the static hues in the decided order, each the same hue in both themes; one series is the brand', () => {
  const hues = SERIES.map((name) => {
    const {light, dark} = branches(name);
    const [, hue] = light.match(/^--sf-([a-z]+)-\d+$/u) ?? [];
    assert.ok(STATIC_HUE_NAMES.includes(hue), `${name} takes a static hue: ${light}`);
    assert.match(dark, new RegExp(`^--sf-${hue}-\\d+$`, 'u'), `${name} keeps its hue in the dark theme`);
    return hue;
  });
  assert.deepEqual(hues, ORDER);
  assert.equal(role('--sf-chart-brand'), role('--sf-on-primary-container-graphic'));
});

test('no theme colour moves a series: none reads a primitive a theme writes', () => {
  // The series read the static palette only, so a theme -- which writes the
  // dynamic primitives and the four statuses -- leaves them where they are.
  const written = new Set(Object.keys(themeVariables(themeFromColor(DEFAULT_THEME_COLOR))));
  for (const name of SERIES) {
    const {light, dark} = branches(name);
    for (const primitive of [light, dark]) assert.ok(!written.has(primitive), `${name} reads ${primitive}, which a theme rewrites`);
  }
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

test('every former tone primitive is var() of the static hue of its name; rose is pink, violet purple', () => {
  const source = read('src/core/scss/_sf_figma_colors_variables.scss');
  const wrong = [];
  let count = 0;
  for (const [, name, hue, rest, value] of source.matchAll(/(--sf-tone-([a-z]+)-(\d+(?:--alfa-\d+)?)): ([^;]+);/gu)) {
    count += 1;
    // The former violet is HCT hue 325, the static purple; the static violet
    // (305) is 20 degrees away, and a former tone moves at most 15.
    const expected = `var(--sf-${({rose: 'pink', violet: 'purple'})[hue] ?? hue}-${rest})`;
    if (value !== expected) wrong.push(`${name}: ${value}, expected ${expected}`);
  }
  assert.ok(count > 0);
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
    // The diverging pairs (C17): red to blue for data with a good and a bad
    // side, purple to teal for data without; the theme pair as before.
    for (const family of ['red', 'blue', 'purple', 'teal', 'primary', 'tertiary']) {
      const end = hexOf(`--sf-${family}-${ends[scheme]}`);
      const ratio = contrast(midpoint, end);
      assert.ok(ratio >= CONTRAST_MIN, `${scheme}: ${family}-${ends[scheme]} is ${ratio.toFixed(2)}:1 from the midpoint`);
      t.diagnostic(`${scheme}: midpoint ${midpoint} to ${family}-${ends[scheme]} ${ratio.toFixed(2)}:1`);
    }
  }
});

// The warm and the cool series and the diverging ends (C17; dispatcher
// 2026-11-09): static hues in the research's orders, 3:1 on the surfaces in
// both themes, and the distances measured when they were picked kept as
// floors -- six close hues cannot meet the eight series' limits, so the floors
// say only that a retuned primitive did not make them worse.
const FAMILY_SETS = {
  warm: {hues: ['red', 'orange', 'amber', 'pink', 'brown', 'yellow'], floors: {cvd: 6.5, neighbours: 12, all: 10}},
  cool: {hues: ['blue', 'teal', 'violet', 'cyan', 'indigo', 'green'], floors: {cvd: 7, neighbours: 30, all: 11}},
};
const DIVERGING = {bad: 'red', good: 'blue', low: 'purple', high: 'teal'};

test('the warm and the cool series are static hues in order, 3:1 on the surfaces, no closer than when they were picked', (t) => {
  for (const [set, {hues, floors}] of Object.entries(FAMILY_SETS)) {
    const names = hues.map((_, index) => `--sf-chart-${set}-${index + 1}`);
    names.forEach((name, index) => {
      const {light, dark} = branches(name);
      assert.match(light, new RegExp(`^--sf-${hues[index]}-\\d+$`, 'u'), name);
      assert.match(dark, new RegExp(`^--sf-${hues[index]}-\\d+$`, 'u'), name);
    });
    for (const scheme of THEMES) {
      const colours = names.map((name) => resolveRole(name)[scheme]);
      for (const [index, colour] of colours.entries()) {
        for (const [level, ground] of surfaces(scheme).entries()) {
          const ratio = contrast(colour, ground);
          assert.ok(ratio >= CONTRAST_MIN, `${scheme}: ${names[index]} on surface-${level} is ${ratio.toFixed(2)}:1`);
        }
      }
      const cvd = Math.min(...Object.keys(MACHADO).map((deficiency) => minimumOver(colours.slice(0, 5), deficiency)));
      let neighbours = Infinity;
      for (let i = 0; i + 1 < colours.length; i += 1) neighbours = Math.min(neighbours, distance(colours[i], colours[i + 1]));
      const all = minimumOver(colours, null);
      assert.ok(cvd >= floors.cvd, `${set} ${scheme}: series 1-5 under CVD ${cvd.toFixed(1)}`);
      assert.ok(neighbours >= floors.neighbours, `${set} ${scheme}: neighbours ${neighbours.toFixed(1)}`);
      assert.ok(all >= floors.all, `${set} ${scheme}: any two ${all.toFixed(1)}`);
      t.diagnostic(`${set} ${scheme}: CVD ${cvd.toFixed(1)}, neighbours ${neighbours.toFixed(1)}, any two ${all.toFixed(1)}`);
    }
  }
});

test('the diverging ends are red and blue, purple and teal, tone 30 light and 80 dark, apart under every deficiency', (t) => {
  for (const [end, hue] of Object.entries(DIVERGING)) assert.equal(role(`--sf-chart-diverging-${end}`), `light-dark(var(--sf-${hue}-30), var(--sf-${hue}-80))`, end);
  for (const scheme of THEMES) {
    for (const [a, b] of [['bad', 'good'], ['low', 'high']]) {
      const [x, y] = [a, b].map((end) => resolveRole(`--sf-chart-diverging-${end}`)[scheme]);
      for (const deficiency of [null, ...Object.keys(MACHADO)]) {
        const value = distance(x, y, deficiency);
        assert.ok(value >= ALL_MIN, `${scheme}: ${a}-${b} ${deficiency ?? 'normal'} ${value.toFixed(1)}`);
      }
      t.diagnostic(`${scheme}: ${a}-${b} ${[null, ...Object.keys(MACHADO)].map((d) => distance(x, y, d).toFixed(1)).join(' / ')}`);
    }
  }
});

test('the roles are documented', () => {
  const docs = read('docs/foundation-chart-colours.md');
  for (const name of [...SERIES, '--sf-chart-warm-1', '--sf-chart-cool-1', ...Object.keys(DIVERGING).map((end) => `--sf-chart-diverging-${end}`), '--sf-chart-brand', '--sf-chart-N-fill', '--sf-chart-N-fill-hover', '--sf-chart-N-fill-active', '--sf-chart-midpoint']) assert.ok(docs.includes(`\`${name}\``), name);
});
