import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// DSA-2..DSA-4 (DEV acceptance of display settings, ui-control
// control/evidence/2026-11-22-ds-roles-acceptance; evidence
// control/evidence/2026-11-22-dsa): the dropdown's placeholder, the panel's
// trigger at narrow widths and large text, and the states of controls on
// pictures in a colour scheme. Measured in the browser by the evidence's
// probes (dsa3.mjs, dsa4.mjs, ds-accept.mjs).

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
const dropdown = strip(read('../src/component/dropdown/scss/_css__dropdown.scss'));
const core = strip(read('../src/core/scss/_sf_css__display.scss'));
const template = read('../src/smart/display-settings/js/templates/default.js');
const script = read('../src/smart/display-settings/index.js');
const gallery = strip(read('../src/smart/gallery/js/templates/default.scss'));

test('DSA-2: the dropdown draws the field placeholder role on its input placeholder', () => {
  assert.match(dropdown, /\.sf-dropdown \.sf-dropdown-field input::placeholder \{\s*--sf-dropdown-placeholder--color: var\(--sf-on-surface-variant\);/u);
  assert.match(dropdown, /\.sf-dropdown:has\(> \.sf-dropdown-field > :disabled\) \.sf-dropdown-field input::placeholder \{\s*--sf-dropdown-placeholder--color: var\(--sf-on-surface-disabled\);/u);
  const paint = dropdown.slice(dropdown.indexOf('@layer sf.paint'));
  assert.match(paint, /\.sf-dropdown \.sf-dropdown-field input::placeholder \{\s*color: var\(--sf-dropdown-placeholder--color\);/u);
});

test('DSA-3: the disclosure trigger carries a glyph and folds to it through shrink="icon"', () => {
  assert.match(template, /icon-start=\$\{TRIGGER_ICON\} shrink="icon"/u);
  assert.match(template, /const TRIGGER_ICON = 'visibility';/u);
  assert.match(script, /fitTrigger\(\) \{/u);
  // A bar's request is the bar's: the panel lifts only its own fold.
  assert.match(script, /if \(shrunk && !this\._foldedTrigger\) return;/u);
  assert.match(script, /afterRender\(changed\) \{[\s\S]*?this\.fitTrigger\(\);[\s\S]*?this\.placePanel\(\);/u);
});

test('DSA-4: in a scheme a media plate has distinct rest, hover and press', () => {
  assert.match(core, /--sf-surface-media: var\(--sf-scheme-text\);/u);
  assert.match(core, /--sf-surface-media-hover: #\{scheme-text-under-ground\(8\)\};/u);
  assert.match(core, /--sf-surface-media-active: #\{scheme-text-under-ground\(12\)\};/u);
  assert.match(core, /--sf-scrim-control-state-hover: #\{scheme-ground-alpha\(8\)\};/u);
  assert.match(core, /--sf-scrim-control-state-active: #\{scheme-ground-alpha\(12\)\};/u);
  assert.doesNotMatch(core, /--sf-surface-media-(hover|active): var\(--sf-scheme-text\);/u);
});

test('DSA-4: in a scheme the gallery viewer stands on the ground with the text', () => {
  for (const name of ['black-on-white', 'white-on-black', 'yellow-on-black', 'blue-on-sky', 'brown-on-cream']) assert.match(gallery, new RegExp(`"${name}"`, 'u'));
  assert.match(gallery, /--sf-on-surface-media: var\(--sf-on-surface\);/u);
  assert.match(gallery, /background-color: var\(--sf-surface-page\);\s*color: var\(--sf-on-surface\);/u);
});
