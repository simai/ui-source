import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import test from 'node:test';
import {themeFromColor, themeFromHct, themeToCss, themeVariables, staticPalette, STATIC_HUES, STATUS_HUES, THEME_TONES, THEME_PALETTES, DEFAULT_THEME_COLOR} from '../src/core/js/theme-palette.js';

const root = new URL('..', import.meta.url).pathname;
// A status primitive is var() of its static hue (C17): the shipped value of
// --sf-success-40 is the one --sf-green-40 holds in the generated palette.
const staticPrimitives = readFileSync(join(root, 'src/core/scss/_sf_static_palette.scss'), 'utf8');
const primitives = readFileSync(join(root, 'src/core/scss/_sf_figma_colors_variables.scss'), 'utf8')
  .replace(/(--sf-[a-z]+-\d+(?:--alfa-\d+)?): var\((--sf-[a-z]+-\d+(?:--alfa-\d+)?)\);/gu,
    (line, name, target) => `${name}: ${staticPrimitives.match(new RegExp(`${target}: (#[0-9a-f]+);`, 'u'))?.[1] ?? 'unresolved'};`);

// The rules are the generator's, and the Framework's colours were made with
// them: the default colour has to give back every shipped primitive, or the
// component would re-theme a page that asked for nothing.
test('the default colour gives back the 64 shipped primitives of the dynamic palettes and their 80 translucent steps exactly', () => {
  const theme = themeFromColor(DEFAULT_THEME_COLOR);
  const variables = themeVariables(theme);
  assert.deepEqual([...THEME_PALETTES], ['primary', 'secondary', 'tertiary', 'neutral']);
  const dynamic = new RegExp(`^--sf-(?:${THEME_PALETTES.join('|')})-`, 'u');
  const declared = [...primitives.matchAll(/(--sf-[a-z]+-\d+--alfa-\d+):/gu)].map(([, name]) => name).filter((name) => dynamic.test(name));
  // Every translucent step core declares on a palette tone is one the theme writes.
  assert.deepEqual([...new Set(declared)].filter((name) => !(name in variables)), []);
  assert.equal(Object.keys(variables).length, THEME_PALETTES.length * THEME_TONES.length + new Set(declared).size);
  assert.equal(Object.keys(variables).length, 144);
  const off = [];
  for (const [name, value] of Object.entries(variables)) {
    const shipped = primitives.match(new RegExp(`${name}: (#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?);`))?.[1]?.toLowerCase();
    if (shipped !== value) off.push(`${name}: shipped ${shipped}, made ${value}`);
  }
  assert.deepEqual(off, []);
});

test('another colour moves the brand palettes; a theme holds and writes no status palette (TG-01)', () => {
  const green = themeFromColor('#2e7d32');
  const base = themeFromColor(DEFAULT_THEME_COLOR);
  assert.notEqual(green.palettes.primary.tones[40], base.palettes.primary.tones[40]);
  assert.equal(Math.round(green.palettes.tertiary.hue), Math.round((green.source.hue + 60) % 360));
  assert.deepEqual(Object.keys(green.palettes), ['primary', 'secondary', 'tertiary', 'neutral']);
  const status = /^--sf-(?:error|warning|success|info)-/u;
  assert.deepEqual(Object.keys(themeVariables(green)).filter((name) => status.test(name)), []);
  assert.doesNotMatch(themeToCss(green), /--sf-(?:error|warning|success|info)-/u);
  // A theme object stored before TG-01 still carries the eight palettes: the
  // status ones are not written, so core's static hues apply over it.
  const stored = {...green, palettes: {...green.palettes, info: {hue: 265, chroma: 59, tones: {40: '#005bbe'}}}};
  assert.equal(themeVariables(stored)['--sf-info-40'], undefined);
  assert.deepEqual(themeFromColor('#2E7D32'), themeFromColor('2e7d32'));
});

// Information is a status, not the brand (owner, 2026-10-21, simai/ui-source#14):
// derived from the source colour, info went red under a red primary and read as
// danger. Since C17 as amended 2026-11-11 it is the static hue sky (blue read
// as the Framework's own primary): these are sky's tones, and no brand colour
// moves them.
const INFO_PALETTE = Object.freeze({
  98: '#f5faff', 95: '#e3f3ff', 90: '#c4e7ff', 85: '#a2dcff', 80: '#7cd0ff', 70: '#00b7f7',
  60: '#009bd1', 50: '#0080ad', 40: '#00668a', 35: '#005979', 30: '#004c69', 25: '#004059',
  20: '#00344a', 15: '#00293b', 10: '#001e2c', 5: '#00131d',
});

test('info is the static hue sky under every brand colour (C17 as amended 2026-11-11, C90), and stays far from error', () => {
  const shipped = readFileSync(join(root, 'src/core/scss/_sf_figma_colors_variables.scss'), 'utf8');
  const sky = staticPalette()[STATUS_HUES.info];
  for (const tone of THEME_TONES) {
    assert.equal(sky.tones[tone], INFO_PALETTE[tone], `sky ${tone}`);
    // Core's info primitive is var() of sky's, and the resolved value is sky's.
    assert.match(shipped, new RegExp(`--sf-info-${tone}: var\\(--sf-sky-${tone}\\);`, 'u'));
    assert.match(primitives, new RegExp(`--sf-info-${tone}: ${INFO_PALETTE[tone]};`, 'u'));
  }
  // No brand colour moves it: no theme writes an info primitive at all.
  const primaries = {red: '#b3261e', green: '#2e7d32', yellow: '#f9a825', violet: '#6a1b9a', blue: DEFAULT_THEME_COLOR, sky: '#00668a'};
  for (const [name, color] of Object.entries(primaries)) {
    const variables = themeVariables(themeFromColor(color));
    assert.deepEqual(Object.keys(variables).filter((key) => key.startsWith('--sf-info-')), [], name);
  }
  // Information and danger never tell the same story in the same colour.
  const apart = Math.abs(STATIC_HUES[STATUS_HUES.info].hue - STATIC_HUES[STATUS_HUES.error].hue) % 360;
  assert.ok(Math.min(apart, 360 - apart) >= 90, `info and error are ${Math.min(apart, 360 - apart)} deg apart`);
});

test('a dynamic palette rule can be overridden, and a bad colour is refused', () => {
  const theme = themeFromColor('#005bbe', {secondary: {chroma: 30}});
  assert.equal(Math.round(theme.palettes.secondary.chroma), 30);
  assert.throws(() => themeFromColor('blue'), TypeError);
  assert.throws(() => themeFromColor('#12345'), TypeError);
});

test('the CSS is one rule of the 64 primitives and 80 translucent steps under the selector', () => {
  const css = themeToCss(themeFromColor('#005bbe'), '.site-main');
  assert.match(css, /^\.site-main \{\n/u);
  assert.equal((css.match(/--sf-[a-z]+-\d+: #[0-9a-f]{6};/gu) ?? []).length, 64);
  assert.equal((css.match(/--sf-[a-z]+-\d+--alfa-\d+: #[0-9a-f]{8};/gu) ?? []).length, 80);
});

// The copied HCT files are the package's own bytes: a copy that drifted would
// be code nobody reviewed under a name that says otherwise.
test('the vendored material-color-utilities files are the pinned package, byte for byte', () => {
  const vendor = join(root, 'src/core/js/vendor/material-color-utilities');
  const pkg = join(root, 'node_modules/@material/material-color-utilities');
  const files = [];
  const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files.push(relative(vendor, path)); } };
  walk(vendor);
  for (const file of files.filter((name) => name !== 'package.json')) {
    assert.ok(readFileSync(join(vendor, file)).equals(readFileSync(join(pkg, file))), `${file} differs from the package`);
  }
  assert.equal(JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version, '0.4.0');
});

test('a pastel colour keeps its own chroma; a vivid one stands for the vivid palette', async () => {
  const {colorToHct, VIVID_CHROMA} = await import('../src/core/js/theme-palette.js');
  const pastel = colorToHct('#b8c4dc');
  assert.ok(pastel.chroma < 20, `pastel read as ${pastel.chroma}`);
  assert.equal(colorToHct('#005bbe').chroma, VIVID_CHROMA);
  assert.equal(colorToHct('#005bbe').hue, 265);
});

// C16 (2026-11-08): the greys never take more chroma than the colour they are
// made from. A near-grey brand colour made greys of chroma 5 in a hue it
// barely had -- teal or violet greys under a grey brand.
test('the neutral palette is no more chromatic than its source', () => {
  for (const color of ['#6b6f76', '#7a7a7a', '#5f6b6d']) {
    const theme = themeFromColor(color);
    assert.ok(theme.palettes.neutral.chroma <= Math.max(theme.source.chroma, 0) + 0.5,
      `${color}: neutral chroma ${theme.palettes.neutral.chroma} over source ${theme.source.chroma}`);
  }
  assert.equal(Math.round(themeFromColor(DEFAULT_THEME_COLOR).palettes.neutral.chroma), 5);
});

// TG-03 (docs study 2026-11-11): black and white sit where the gamut holds no
// chroma, so the "as vivid as the hue holds" reading took them for vivid
// colours -- #000000 made a pink theme (hue 0, chroma 85), #ffffff a teal one.
// A colour no more chromatic than the greys (chroma under 5) is a grey: it
// keeps its own chroma, and its secondary and tertiary are greys too, not
// chroma 20 and 40 in a hue it barely has (#111111 is HCT hue 209: a
// chroma-20 secondary of it was a bluish grey).
test('a grey colour makes a grey theme: black, white and near-greys are not read as vivid (C16, TG-03)', async () => {
  const {colorToHct} = await import('../src/core/js/theme-palette.js');
  for (const color of ['#000000', '#ffffff', '#111111', '#222222', '#808080', '#f5f5f5']) {
    const read = colorToHct(color);
    assert.ok(read.chroma < 5, `${color} read as chroma ${read.chroma}`);
    const theme = themeFromColor(color);
    for (const name of THEME_PALETTES) {
      assert.ok(theme.palettes[name].chroma <= read.chroma + 0.5, `${color}: ${name} chroma ${theme.palettes[name].chroma} over the colour's ${read.chroma}`);
    }
  }
  // A tinted grey and a muted colour keep the accents they had.
  for (const color of ['#6b6f76', '#1a1a2e', '#b8c4dc']) {
    const theme = themeFromColor(color);
    assert.equal(Math.round(theme.palettes.secondary.chroma), 20, `${color} secondary`);
    assert.equal(Math.round(theme.palettes.tertiary.chroma), 40, `${color} tertiary`);
  }
  // A near-black brand colour of real hue is still read as its vivid palette.
  assert.equal(colorToHct('#0a1f44').chroma >= 5, true);
});

// TG-04 (docs study 2026-11-11): the generator took #ffd600 to buttons of
// #705d00 and #bb171d to a primary beside error's #bb1919, and said nothing.
test('themeChecks says what a person should know about a colour (TG-04)', async () => {
  const {themeChecks, contrastRatio, THEME_CHECKS} = await import('../src/core/js/theme-palette.js');
  const codes = (color) => themeChecks(themeFromColor(color));
  assert.deepEqual(codes(DEFAULT_THEME_COLOR), []);
  assert.deepEqual(codes('#ffd600'), [{code: 'adjusted', level: 'warning', from: '#ffd600', to: '#705d00', lighter: true}]);
  assert.deepEqual(codes('#bb171d'), [{code: 'close-to-status', level: 'warning', status: 'error', hue: 'red'}]);
  assert.deepEqual(codes('#00668a').map((check) => check.status), ['info']);
  assert.deepEqual(codes('#111111').map((check) => check.code), ['adjusted', 'grey']);
  // A colour made from a hue and a chroma has no hex to be adjusted from.
  assert.equal(themeChecks(themeFromHct({hue: 96, chroma: 85})).some((check) => check.code === 'adjusted'), false);
  // The contrast check reads the roles core draws a filled control with:
  // light --sf-on-primary (white) on --sf-primary (40), dark 20 on 80.
  const weak = themeFromColor(DEFAULT_THEME_COLOR);
  const forced = {...weak, palettes: {...weak.palettes, primary: {...weak.palettes.primary, tones: {...weak.palettes.primary.tones, 40: '#8a8a8a'}}}};
  const contrast = themeChecks(forced).filter((check) => check.code === 'contrast');
  assert.deepEqual(contrast.map((check) => check.scheme), ['light']);
  assert.ok(contrast[0].ratio < THEME_CHECKS.contrast);
  assert.equal(Math.round(contrastRatio('#ffffff', '#000000')), 21);
  assert.deepEqual(themeChecks(null), []);
});

// TG-01 compatibility until 2027-01-01 (journal option-theme-status-override,
// property-theme-status-palettes): a status override is ignored, not refused,
// and the former theme.palettes.<status> reads the static hue. Like every
// compatibility note (contracts/lifecycle-policy.json) each use is in
// SF.deprecations always, and in the console only when the page opts in.
test('a status override is ignored and a status palette still reads; noted in SF.deprecations, printed only on opt-in (TG-01 compat)', async (t) => {
  const {STATUS_COMPAT, withStatusCompat} = await import('../src/core/js/theme-palette.js');
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(String(message)));
  const notes = () => globalThis.SF.deprecations.list().filter((note) => note.component === 'theme-palette');
  assert.equal(STATUS_COMPAT.remove_after, '2027-01-01');
  const statics = staticPalette();
  const exercise = () => {
    const plain = themeFromColor(DEFAULT_THEME_COLOR);
    for (let run = 0; run < 3; run += 1) {
      assert.deepEqual(themeVariables(themeFromColor(DEFAULT_THEME_COLOR, {error: {hue: 10}, info: {hue: 200}})), themeVariables(plain));
    }
    themeFromHct({hue: 265, chroma: 85}, {warning: {chroma: 10}});
    const theme = themeFromColor('#2e7d32');
    for (let run = 0; run < 2; run += 1) assert.deepEqual(theme.palettes.error.tones, statics.red.tones);
    assert.deepEqual(theme.palettes.info.tones, statics.sky.tones);
    assert.deepEqual(Object.keys(theme.palettes), ['primary', 'secondary', 'tertiary', 'neutral']);
    assert.doesNotMatch(JSON.stringify(theme), /"error"/u);
    theme.palettes.error.tones[40] = '#000000';
    assert.deepEqual(theme.palettes.error.tones, statics.red.tones, 'a read gives a copy');
    // A copy made for a host (the generator's theme value) keeps the reads.
    assert.deepEqual(withStatusCompat(JSON.parse(JSON.stringify(theme))).palettes.success.tones, statics.green.tones);
  };

  // By default: every use is in the list with its dates, nothing is printed.
  const before = globalThis.SF?.deprecations?.warn;
  try {
    globalThis.SF.deprecations.warn = false;
    globalThis.SF.deprecations.clear();
    exercise();
    assert.deepEqual(warnings, []);
    const listed = Object.fromEntries(notes().map((note) => [`${note.kind} ${note.from}`, note]));
    assert.deepEqual(Object.keys(listed).sort(), [
      'option themeFromHct options error, info', 'option themeFromHct options warning',
      'property theme.palettes.error', 'property theme.palettes.info', 'property theme.palettes.success']);
    assert.equal(listed['option themeFromHct options error, info'].count, 3);
    assert.equal(listed['property theme.palettes.error'].count, 4);
    for (const note of Object.values(listed)) {
      assert.equal(note.remove_after, '2027-01-01');
      assert.equal(note.since, '2026-11-12');
      assert.match(note.to, /staticPalette\(\)\[SF\.ThemePalette\.STATUS_HUES\.<status>\]/u);
      assert.match(note.to, /https:\/\/ui\.simai\.io\/ru\/smart-components\/forms\/theme-generator\//u);
    }

    // Opted in: the console says each once, with its date and its replacement.
    globalThis.SF.deprecations.warn = true;
    globalThis.SF.deprecations.clear();
    exercise();
    assert.equal(warnings.length, 5, warnings.join('\n'));
    for (const message of warnings) {
      assert.match(message, /^\[SIMAI Framework\] theme-palette: /u);
      assert.match(message, /until 2027-01-01/u);
      assert.match(message, /STATUS_HUES\.<status>/u);
    }
    assert.ok(warnings.some((message) => message.includes('themeFromHct options error, info')));
    assert.ok(warnings.some((message) => message.includes('theme.palettes.error')));
  } finally {
    globalThis.SF.deprecations.warn = before;
    globalThis.SF.deprecations.clear();
  }
});
