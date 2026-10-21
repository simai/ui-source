import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import test from 'node:test';
import {themeFromColor, themeToCss, themeVariables, THEME_TONES, THEME_PALETTES, DEFAULT_THEME_COLOR} from '../src/core/js/theme-palette.js';

const root = new URL('..', import.meta.url).pathname;
const primitives = readFileSync(join(root, 'src/core/scss/_sf_figma_colors_variables.scss'), 'utf8');

// The rules are the generator's, and the Framework's colours were made with
// them: the default colour has to give back every shipped primitive, or the
// component would re-theme a page that asked for nothing.
test('the default colour gives back all 128 shipped primitives and their 98 translucent steps exactly', () => {
  const theme = themeFromColor(DEFAULT_THEME_COLOR);
  const variables = themeVariables(theme);
  const declared = [...primitives.matchAll(/(--sf-[a-z]+-\d+--alfa-\d+):/gu)].map(([, name]) => name);
  // Every translucent step core declares on a palette tone is one the theme writes.
  assert.deepEqual([...new Set(declared)].filter((name) => !(name in variables)), []);
  assert.equal(Object.keys(variables).length, THEME_PALETTES.length * THEME_TONES.length + new Set(declared).size);
  const off = [];
  for (const [name, value] of Object.entries(variables)) {
    const shipped = primitives.match(new RegExp(`${name}: (#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?);`))?.[1]?.toLowerCase();
    if (shipped !== value) off.push(`${name}: shipped ${shipped}, made ${value}`);
  }
  assert.deepEqual(off, []);
});

test('another colour moves the brand palettes and leaves the status ones', () => {
  const green = themeFromColor('#2e7d32');
  const base = themeFromColor(DEFAULT_THEME_COLOR);
  assert.notEqual(green.palettes.primary.tones[40], base.palettes.primary.tones[40]);
  assert.equal(Math.round(green.palettes.tertiary.hue), Math.round((green.source.hue + 60) % 360));
  for (const status of ['error', 'warning', 'success', 'info']) assert.deepEqual(green.palettes[status], base.palettes[status], status);
  assert.deepEqual(themeFromColor('#2E7D32'), themeFromColor('2e7d32'));
});

// Information is a status, not the brand (owner, 2026-10-21, simai/ui-source#14):
// derived from the source colour, info went red under a red primary and read as
// danger. These are the owner-approved tones of #005bbe, and no brand colour
// moves them.
const INFO_PALETTE = Object.freeze({
  98: '#f9f9ff', 95: '#edf0ff', 90: '#d7e2ff', 85: '#c2d4ff', 80: '#acc7ff', 70: '#7eabff',
  60: '#538ff5', 50: '#3375d9', 40: '#005bbe', 35: '#0050a8', 30: '#004492', 25: '#00397c',
  20: '#002f67', 15: '#002453', 10: '#001a40', 5: '#00102c',
});

test('info is the fixed palette of #005bbe under every brand colour, and stays far from error', () => {
  const primaries = {red: '#b3261e', green: '#2e7d32', yellow: '#f9a825', violet: '#6a1b9a', blue: DEFAULT_THEME_COLOR};
  for (const [name, color] of Object.entries(primaries)) {
    const theme = themeFromColor(color);
    const variables = themeVariables(theme);
    for (const tone of THEME_TONES) assert.equal(variables[`--sf-info-${tone}`], INFO_PALETTE[tone], `${name}: --sf-info-${tone}`);
    // Information and danger never tell the same story in the same colour.
    const apart = Math.abs(theme.palettes.info.hue - theme.palettes.error.hue) % 360;
    assert.ok(Math.min(apart, 360 - apart) >= 90, `${name}: info and error are ${Math.min(apart, 360 - apart)} deg apart`);
  }
});

test('a palette rule can be overridden, and a bad colour is refused', () => {
  const theme = themeFromColor('#005bbe', {secondary: {chroma: 30}, error: {hue: 10}});
  assert.equal(Math.round(theme.palettes.secondary.chroma), 30);
  assert.equal(Math.round(theme.palettes.error.hue), 10);
  assert.throws(() => themeFromColor('blue'), TypeError);
  assert.throws(() => themeFromColor('#12345'), TypeError);
});

test('the CSS is one rule of the 128 primitives under the selector', () => {
  const css = themeToCss(themeFromColor('#005bbe'), '.site-main');
  assert.match(css, /^\.site-main \{\n/u);
  assert.equal((css.match(/--sf-[a-z]+-\d+: #[0-9a-f]{6};/gu) ?? []).length, 128);
  assert.equal((css.match(/--sf-[a-z]+-\d+--alfa-\d+: #[0-9a-f]{8};/gu) ?? []).length, 98);
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
