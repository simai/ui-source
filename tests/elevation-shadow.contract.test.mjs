import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {themeSource} from './support/theme-source.mjs';

// Shadows by place (C20, owner 2026-11-08; ui-control prototypes/shadows.html).
// Before, a component chose a number -- five levels, five layer styles, a
// shadow of its own with rgb() -- and the numbers drifted: popups sat on
// levels 2 and 3, the slider read a length as a shadow and drew none, and
// every level was built on :root from the core's colours, so the theme's
// never applied. Now a component says where it stands.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const contract = JSON.parse(read('contracts/elevation-shadow.json'));

const files = (directory, pattern) => {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(resolve(root, dir), {withFileTypes: true})) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (pattern.test(entry.name)) found.push(path);
    }
  };
  walk(directory);
  return found;
};
const styles = [...files('src/component', /\.s?css$/u), ...files('src/smart', /\.s?css$/u)];
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

test('shadows: two colours from the alpha scale and four places on the size ladder', () => {
  const theme = themeSource();
  assert.match(theme, /--sf-shadow-key-color: light-dark\(var\(--sf-black--alfa-16\), var\(--sf-black--alfa-28\)\);/u);
  assert.match(theme, /--sf-shadow-ambient-color: light-dark\(var\(--sf-black--alfa-8\), var\(--sf-transparent\)\);/u);
  assert.match(theme, /--sf-shadow-flat: none;/u);
  for (const place of ['raised', 'overlay', 'modal']) {
    assert.match(theme, new RegExp(`--sf-shadow-${place}: #\\{shadow\\.sf-shadow\\('${place}'\\)\\};`, 'u'), place);
  }
  const geometry = read('src/core/scss/mix/_mix__shadow.scss');
  const expected = {
    raised: [['var(--sf-px)', 'var(--sf-a2)'], ['var(--sf-a2)', 'var(--sf-a8)']],
    overlay: [['var(--sf-a2)', 'var(--sf-a4)'], ['var(--sf-a8)', 'var(--sf-b6)']],
    modal: [['var(--sf-a4)', 'var(--sf-a8)'], ['var(--sf-b6)', 'var(--sf-c6)']],
  };
  for (const [place, [[ky, kb], [ay, ab]]] of Object.entries(expected)) {
    assert.ok(geometry.includes(`'${place}': (('0', '${ky}', '${kb}', 'key'), ('0', '${ay}', '${ab}', 'ambient'))`), `${place}: offsets and blurs on the ladder`);
  }
  // No length written by hand in the geometry.
  assert.doesNotMatch(strip(geometry), /(?<![\w-])\d+(?:px|rem|em)\b/u);
});

test('shadows: the places are declared on the theme root, beside the colours they read', () => {
  // Built on :root, --sf-ui-shadow-N read the core's colours (24/12/8) and
  // never the theme's (12/8/4); they are former names on the theme root now.
  const layer = read('src/core/figma_variables/figma_layer_styles.scss');
  assert.doesNotMatch(layer, /--sf-ui-shadow-/u);
  const core = strip(read('src/core/scss/_sf_css__shadow.scss'));
  assert.doesNotMatch(core, /\[class\*=/u, 'no rule gives a shadow to any element with the word in a class');
  assert.doesNotMatch(core, /--sf-shadow--color-/u);
});

test('shadows: a component reads one of the four places and nothing else', () => {
  const former = /--sf-(?:ui-shadow-(?:[1-5]|top)|elevation-[1-5]--shadow|shadow-card|shadow-popup(?:-nested)?|shadow--color-[a-z]+|shadow--rim)\b/gu;
  const offenders = [];
  for (const path of styles) {
    const css = strip(read(path));
    for (const [name] of css.matchAll(former)) offenders.push(`${path}: ${name}`);
    // A shadow is a place: no colour written by hand and no length read as a shadow.
    for (const line of css.split('\n')) {
      if (!/box-shadow\s*:/u.test(line)) continue;
      if (/rgba?\(|#[0-9a-f]{3}|color-mix\(/iu.test(line) && !/inset|--sf-focus|ring/u.test(line)) offenders.push(`${path}: ${line.trim()}`);
      if (/box-shadow\s*:\s*var\(--sf-blur-/u.test(line)) offenders.push(`${path}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], 'read --sf-shadow-flat, -raised, -overlay or -modal');
  assert.deepEqual(contract.exemptions, []);
});

test('shadows: a place that floats stands on its surface', () => {
  // overlay on the popup surface, modal on the popup surface (over the
  // scrim), raised on the raised surface where the component paints itself.
  const offenders = [];
  for (const path of styles) {
    const css = strip(read(path));
    if (/var\(--sf-shadow-(?:overlay|modal)\)/u.test(css) && !/var\(--sf-surface-popup(?:-nested)?[,)]/u.test(css)
      && !/sf-sortable|sf-thumb/u.test(css)) offenders.push(`${path}: an overlay or a window without the popup surface`);
  }
  assert.deepEqual(offenders, []);
});

test('shadows: the scrim is black 64, one role for every window', () => {
  const theme = themeSource();
  assert.match(theme, /--sf-scrim-color: var\(--sf-black--alfa-64\);/u);
  const composition = strip(read('src/core/scss/_sf_css__composition.scss'));
  assert.match(composition, /box-shadow: var\(--sf-shadow-modal\), 0 0 0 100vmax var\(--sf-scrim-color, var\(--sf-black--alfa-64\)\);/u);
  for (const path of styles) {
    const css = strip(read(path));
    assert.doesNotMatch(css, /color-mix\([^;]*--sf-scrim/u, `${path}: the scrim is a role, not a mix`);
  }
});

test('shadows: the elevation utility keeps the surface and takes the place', () => {
  const utility = read('src/utility/elevation/default/scss/_sf_css__elevation.scss');
  assert.match(utility, /1: \('surface-card', 'shadow-raised'/u);
  assert.match(utility, /4: \('surface-popup-nested', 'shadow-modal'/u);
});
