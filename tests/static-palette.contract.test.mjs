import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  STATIC_HUES, STATIC_HUE_NAMES, STATUS_HUES, STATIC_ALPHA, THEME_TONES, THEME_ALPHA,
  staticPalette, staticVariables, themeFromColor, DEFAULT_THEME_COLOR,
} from '../src/core/js/theme-palette.js';
import {staticPaletteScss, STATIC_PALETTE_FILE} from '../scripts/generate-static-palette.mjs';

// The static palette (owner decision C17, 2026-11-08; research
// control/research/2026-11-08-palette.md): sixteen fixed hues from the theme's
// own generator, --sf-<hue>-<tone>; the statuses are four of them.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('sixteen hues with the numbers of the decision; added hues chroma 60, brown 30, gray 0', () => {
  assert.deepEqual([...STATIC_HUE_NAMES], ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'brown', 'gray']);
  const numbers = Object.fromEntries(Object.entries(STATIC_HUES).map(([name, {hue, chroma}]) => [name, [hue, chroma]]));
  assert.deepEqual(numbers, {
    red: [25, 85], orange: [45, 60], amber: [60, 60], yellow: [90, 60], lime: [120, 60], green: [145, 65],
    teal: [175, 60], cyan: [205, 60], sky: [235, 60], blue: [265.1, 58.6], indigo: [285, 60], violet: [305, 60],
    purple: [325, 60], pink: [350, 60], brown: [50, 30], gray: [265, 0],
  });
  assert.ok(Object.isFrozen(STATIC_HUES));
});

test('the generated sheet is the generator\'s output, and nothing is typed by hand', () => {
  // Sixteen hues of 16 tones and 20 translucent steps: 576 (research 3.4).
  assert.equal(Object.keys(staticVariables()).length, 576);
  assert.equal(read(STATIC_PALETTE_FILE), staticPaletteScss(), 'run node scripts/generate-static-palette.mjs');
  const variables = staticVariables();
  assert.equal(Object.keys(variables).length, STATIC_HUE_NAMES.length * (THEME_TONES.length + Object.values(STATIC_ALPHA).reduce((sum, steps) => sum + steps.length, 0)));
  for (const [name, value] of Object.entries(variables)) assert.ok(read(STATIC_PALETTE_FILE).includes(`${name}: ${value};`), name);
});

test('a status is its hue: the status primitive is var() of the hue, and no theme holds it (TG-01)', () => {
  const theme = themeFromColor(DEFAULT_THEME_COLOR);
  const palettes = staticPalette();
  const primitives = read('src/core/scss/_sf_figma_colors_variables.scss');
  for (const [status, hue] of Object.entries(STATUS_HUES)) {
    assert.ok(!Object.keys(theme.palettes).includes(status), `${status}: not a theme palette`);
    assert.equal(THEME_ALPHA[status], undefined, `${status}: no theme steps`);
    for (const tone of THEME_TONES) {
      assert.match(primitives, new RegExp(`--sf-${status}-${tone}: var\\(--sf-${hue}-${tone}\\);`, 'u'));
      for (const step of STATIC_ALPHA[tone] ?? []) {
        assert.match(primitives, new RegExp(`--sf-${status}-${tone}--alfa-${step}: var\\(--sf-${hue}-${tone}--alfa-${step}\\);`, 'u'));
      }
    }
  }
  // No theme colour moves a hue.
  for (const color of ['#2e7d32', '#b3261e', '#6a1b9a']) assert.deepEqual(staticPalette(), palettes, color);
});

test('.sf-hue-<name> gives every static hue and the three theme palettes one role set', () => {
  const sheet = read('src/core/scss/_sf_css__hue.scss');
  const names = read('src/core/scss/vars/_sf_var__hue.scss');
  const list = (name) => names.match(new RegExp(`^\\$${name}: \\(([^)]*)\\) !default;`, 'mu'))?.[1].split(',').map((item) => item.trim().replace(/^'(.*)'$/u, '$1'));
  assert.deepEqual(list('sf-static-hues'), [...STATIC_HUE_NAMES]);
  assert.deepEqual(list('sf-theme-hues'), ['primary', 'secondary', 'tertiary']);
  const roles = [...sheet.matchAll(/^ {6}(--sf-[a-z-]+):/gmu)].map(([, name]) => name);
  assert.deepEqual(roles, ['--sf-hue', '--sf-on-hue', '--sf-hue-container', '--sf-hue-container-hover', '--sf-hue-container-active',
    '--sf-on-hue-container', '--sf-on-hue-container-graphic', '--sf-hue-outline']);
  // Every step a role reads exists for every hue it is given to.
  const steps = [...sheet.matchAll(/var\(--sf-#\{\$hue\}-(\d+(?:--alfa-\d+)?)\)/gu)].map(([, step]) => step);
  const variables = staticVariables();
  for (const hue of STATIC_HUE_NAMES) for (const step of steps) assert.ok(`--sf-${hue}-${step}` in variables, `${hue}-${step}`);
  for (const palette of ['primary', 'secondary', 'tertiary']) {
    for (const step of steps.filter((item) => item.includes('--alfa-'))) {
      const [tone, alpha] = step.split('--alfa-').map(Number);
      assert.ok(THEME_ALPHA[palette][tone]?.includes(alpha), `${palette}-${step}`);
    }
  }
});

// C17 item 4: info has the full set of variables success, warning and error
// have. Every colour utility map that offers a status offers info, under the
// role names of C16.
test('info is in every colour utility that offers success', () => {
  const maps = [
    'utility/accent-color/default/scss/_sf_var__accent_color.scss',
    'utility/background-color/default/scss/_sf_var__background_color.scss',
    'utility/border-color/default/scss/_sf_var__border_color.scss',
    'utility/box-shadow-color/default/scss/_sf_var__box_shadow_color.scss',
    'utility/caret-color/default/scss/_sf_var__caret_color.scss',
    'utility/divider-color/default/scss/_sf_var__divider_color.scss',
    'utility/drop-shadow-color/default/scss/_sf_var__filter_drop_shadow_color.scss',
    'utility/fill/default/scss/_sf_var__fill.scss',
    'utility/gradient-color/default/scss/_sf_var__gradient.scss',
    'utility/outline-color/default/scss/_sf_var__outline_color.scss',
    'utility/scroll-backdrop-color/default/scss/_sf_var__scroll_backdrop_color.scss',
    'utility/text-color/default/scss/_sf_var__color_base.scss',
    'utility/text-decoration-color/default/scss/_sf_var__text_decoration_color.scss',
  ];
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const aliases = read('src/core/scss/mix/_mix__role_aliases.scss');
  const missing = [];
  for (const map of maps) {
    const source = read(`src/${map}`);
    for (const [, mapName, body] of source.matchAll(/^\$([a-z-]+):\s*\(([\s\S]*?)^\);/gmu)) {
      const keys = [...body.matchAll(/'([a-z-]+)'\s*:\s*'([a-z-]+)'/gu)];
      if (!keys.some(([, key]) => key === 'success')) continue;
      if (!keys.some(([, key]) => key === 'info')) missing.push(map);
      for (const [, key, role] of keys.filter(([, item]) => item.startsWith('info') || item.startsWith('on-info'))) {
        // A state map adds the event to the name (bg hover: --sf-<role>-hover).
        if (mapName.includes('hover-active')) continue;
        const declared = new RegExp(`^\\s*--sf-${role}:`, 'mu').test(theme) || aliases.includes(`'${role.replace(/^outline-(.*)$/u, '$1-outline')}': ('${role}',)`);
        if (!declared) missing.push(`${map}: ${key} reads --sf-${role}, which the theme does not declare`);
      }
    }
  }
  assert.deepEqual(missing, []);
  for (const role of ['info', 'info-hover', 'info-active', 'info-container', 'info-container-hover', 'info-container-active',
    'info-state-hover', 'info-state-select', 'info-state-active', 'info-container-strong', 'on-info', 'on-info-container',
    'on-info-container-graphic', 'info-outline']) {
    assert.match(theme, new RegExp(`^\\s*--sf-${role}:`, 'mu'), role);
  }
});
