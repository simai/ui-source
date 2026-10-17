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
test('the default colour gives back all 128 shipped primitives exactly', () => {
  const theme = themeFromColor(DEFAULT_THEME_COLOR);
  const variables = themeVariables(theme);
  assert.equal(Object.keys(variables).length, THEME_PALETTES.length * THEME_TONES.length);
  const off = [];
  for (const [name, value] of Object.entries(variables)) {
    const shipped = primitives.match(new RegExp(`${name}: (#[0-9a-fA-F]{6});`))?.[1]?.toLowerCase();
    if (shipped !== value) off.push(`${name}: shipped ${shipped}, made ${value}`);
  }
  assert.deepEqual(off, []);
});

test('another colour moves the brand palettes and leaves the status ones', () => {
  const green = themeFromColor('#2e7d32');
  const base = themeFromColor(DEFAULT_THEME_COLOR);
  assert.notEqual(green.palettes.primary.tones[40], base.palettes.primary.tones[40]);
  assert.equal(Math.round(green.palettes.tertiary.hue), Math.round((green.source.hue + 60) % 360));
  for (const status of ['error', 'warning', 'success']) assert.deepEqual(green.palettes[status], base.palettes[status], status);
  assert.deepEqual(themeFromColor('#2E7D32'), themeFromColor('2e7d32'));
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
