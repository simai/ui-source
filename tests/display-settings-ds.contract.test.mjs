import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// DS-1..DS-5 (DEV letter msg-8977f46e; ui-control
// control/evidence/2026-11-22-display-settings-roles): what a real site hit
// with sf-display-settings and the core's colour schemes. The browser half,
// on the built core and panel, is
// tests/browser/display-settings-ds.browser.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
const core = strip(read('../src/core/scss/_sf_css__display.scss'));
const panel = strip(read('../src/smart/display-settings/scss/_smart__display_settings.scss'));
const script = read('../src/smart/display-settings/index.js');
const component = JSON.parse(read('../src/smart/display-settings/component.json'));

const block = (code, selector) => {
  const at = code.indexOf(selector);
  assert.ok(at >= 0, `${selector} is written`);
  const open = code.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    if (code[i] === '}') depth -= 1;
    if (depth === 0) return code.slice(open + 1, i);
  }
  return '';
};

test('DS-1: the disclosure panel is a layer under its button, capped by the screen and moved in at its edge', () => {
  const layer = block(panel, '.sf-display-settings--disclosure > .sf-display-settings__panel {');
  assert.match(layer, /position: absolute;/u);
  assert.match(layer, /inset-block-start: calc\(100% \+ var\(--sf-display-settings--group-gap\)\);/u);
  assert.match(layer, /z-index: var\(--sf-layer--popover\);/u);
  assert.match(layer, /inline-size: max-content;/u);
  assert.match(layer, /max-inline-size: min\(var\(--sf-measure-96\), var\(--sf-display-settings--room, calc\(100vw - 2 \* var\(--sf-space-1\)\)\)\);/u);
  assert.match(layer, /scroll-margin-inline: var\(--sf-space-1\);/u);
  assert.match(layer, /translate: var\(--sf-display-settings--shift, 0\) 0;/u);
  assert.match(block(panel, '.sf-display-settings--disclosure {'), /position: relative;/u);
  assert.match(panel, /\.sf-display-settings--disclosure > \.sf-display-settings__panel \{\s*background-color: var\(--sf-display-settings-background, var\(--sf-surface-popup\)\);\s*box-shadow: var\(--sf-shadow-overlay\);/u);
  // The in-flow panel of layout=panel keeps its 100 %.
  assert.match(block(panel, '.sf-display-settings__panel {'), /inline-size: 100%;/u);
  assert.match(script, /placePanel\(\) \{/u);
  assert.match(script, /view\.addEventListener\('resize', this\._onResize\)/u);
  assert.match(script, /view\.removeEventListener\('resize', this\._onResize\)/u);
  assert.equal(component.version, '1.3.0'); // DSA-3: 1.2.0 moved on by the trigger's fold
});

test('DS-2: the visitor\'s spacing and pictures are !important, so site CSS and later layers do not beat them', () => {
  for (const property of ['letter-spacing: 0.12em', 'word-spacing: 0.16em', 'line-height: 1.5', 'margin-block-end: 2em', 'filter: grayscale(1)', 'display: none']) {
    assert.match(core, new RegExp(`${property.replace(/[().]/gu, '\\$&')} !important;`, 'u'), property);
  }
  assert.match(block(core, ":root[data-sf-images='hide'] .sf-image-caption {"), /display: block !important;/u);
});

test('DS-3: the wide spacing reaches every element and the form fields', () => {
  const at = core.indexOf(":root[data-sf-text-spacing='wide'] body,");
  const head = core.slice(at, core.indexOf('{', at));
  for (const target of ['body', 'body *', 'input', 'textarea', 'select', 'button']) {
    assert.ok(head.includes(`:root[data-sf-text-spacing='wide'] ${target}`), target);
  }
  // An icon is a ligature of its name: spacing would spell the name out.
  assert.ok(head.includes(":root[data-sf-text-spacing='wide'] body *:not(.sf-icon, sf-icon)"), 'icons keep their own spacing');
});

test('DS-4: in a scheme every floating surface has a 1 px edge in the text tone', () => {
  const roles = block(core, '@mixin scheme-roles {');
  assert.match(roles, /--sf-shadow-overlay: 0 0 0 var\(--sf-px\) var\(--sf-scheme-text\), #\{shadow\.sf-shadow\('overlay'\)\};/u);
  assert.match(roles, /--sf-shadow-modal: 0 0 0 var\(--sf-px\) var\(--sf-scheme-text\), #\{shadow\.sf-shadow\('modal'\)\};/u);
  const filter = roles.match(/--sf-shadow-overlay-filter: ([^;]+);/u)?.[1] ?? '';
  const ring = filter.slice(0, filter.indexOf('#{shadow.sf-drop-shadow'));
  assert.equal((ring.match(/drop-shadow\(/gu) ?? []).length, 4, 'four one-pixel drop-shadows');
  assert.equal((ring.match(/0 var\(--sf-scheme-text\)\)/gu) ?? []).length, 4, 'each in the text tone');
  assert.match(filter, /#\{shadow\.sf-drop-shadow\('overlay'\)\}$/u);
});

test('DS-5: media, veil and chart roles take the scheme\'s tones, on the alpha scale', () => {
  const roles = block(core, '@mixin scheme-roles {');
  // DSA-4: hover and press moved off the rest value (tests/display-settings-dsa.contract.test.mjs).
  assert.match(roles, /--sf-surface-media: var\(--sf-scheme-text\);/u);
  assert.match(roles, /--sf-on-surface-media: var\(--sf-scheme-ground\);/u);
  assert.match(roles, /--sf-surface-veil: #\{scheme-ground-alpha\(64\)\};/u);
  assert.match(roles, /@include aliases\.sf-role-aliases\(\('surface-veil',\)\);/u);
  assert.match(roles, /--sf-chart-#\{\$series\}-fill: #\{scheme-alpha\(\$rest\)\};/u);
  assert.match(roles, /--sf-chart-diverging-bad: var\(--sf-scheme-text\);/u);
  assert.match(roles, /--sf-chart-diverging-good: #\{scheme-alpha\(64\)\};/u);
  assert.match(roles, /--sf-chart-midpoint: #\{scheme-alpha\(12\)\};/u);
  // Every step is one of the eleven of the alpha scale.
  const scale = new Set([4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 80]);
  for (const [, step] of roles.matchAll(/scheme-(?:ground-)?alpha\((\d+)\)/gu)) assert.ok(scale.has(Number(step)), `step ${step}`);
  for (const rest of [12, 24]) for (const add of [0, 4, 8]) assert.ok(scale.has(rest + add), `fill ${rest}+${add}`);
});
