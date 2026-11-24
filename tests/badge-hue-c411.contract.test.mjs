import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {BADGE_HUES, canonicalBadgeHue} from '../src/component/badges/js/contract.js';
import {FIXTURES} from './browser/contrast-markup-cases.mjs';

// Owner decision C411 (2026-11-22, ui-control control/docs-review/decisions.md):
// a badge coloured from the static palette takes a hue class, sf-badge--<hue>,
// for the sixteen palette names. The class sets the fill (tone 50 at the fill
// step 24) and the text --sf-on-surface, the same in light and dark; status
// colours stay with the status classes; no raw colour in a badge. The drawing
// is probed on built bytes (sf-badge probe p-hue) and its contrast in the
// contrast matrix (contrast-markup-cases.mjs, C411 cases).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

const PALETTE = (() => {
  const list = read('src/core/scss/vars/_sf_var__hue.scss').match(/\$sf-static-hues: \(([^)]*)\)/u)[1];
  return [...list.matchAll(/'([a-z]+)'/gu)].map((match) => match[1]);
})();

test('C411: the hue list is the static palette, in its order', () => {
  assert.equal(PALETTE.length, 16);
  assert.deepEqual([...BADGE_HUES], PALETTE);
  assert.equal(canonicalBadgeHue(' Teal '), 'teal');
  assert.equal(canonicalBadgeHue('magenta'), '');
  assert.equal(canonicalBadgeHue('success'), '', 'a status is not a hue');
  assert.equal(canonicalBadgeHue('#ff0000'), '', 'no raw colour');
});

test('C411: the sheet draws every hue as tone 50 at step 24 under --sf-on-surface, a status winning', () => {
  const sheet = read('src/component/badges/scss/_css__badges.scss');
  assert.match(sheet, /^@use '\.\.\/\.\.\/\.\.\/core\/scss\/vars\/sf_var__hue' as \*;/u);
  const block = sheet.match(/@each \$hue in \$sf-static-hues \{\n([\s\S]*?)\n\}\n/u);
  assert.ok(block, 'one loop over the palette names');
  const rule = block[1];
  // The tonal looks only, the same :where() as every tonal colour; a status class wins.
  assert.ok(rule.includes('.sf-badge:where(.sf-badge--tonal, .sf-badge--main:not(.sf-badge--error, .sf-badge--danger), :not(.sf-badge--main, .sf-badge--tonal, .sf-badge--outline)).sf-badge--#{$hue}:not(.sf-badge--info, .sf-badge--success, .sf-badge--warning, .sf-badge--error, .sf-badge--danger) {'));
  assert.match(rule, /--sf-badge--background-color: var\(--sf-badge-background-color, var\(--sf-#\{\$hue\}-50--alfa-24\)\);/u);
  assert.match(rule, /--sf-badge--color: var\(--sf-badge-color, var\(--sf-on-surface\)\);/u);
  assert.match(rule, /--sf-badge--tonal-edge: light-dark\(var\(--sf-#\{\$hue\}-50\), var\(--sf-#\{\$hue\}-70\)\);/u);
  assert.doesNotMatch(rule, /#[0-9a-f]{3,8}\b/iu, 'palette steps only');
  // Every step the rule names exists for every hue.
  const palette = read('src/core/scss/_sf_static_palette.scss');
  for (const hue of PALETTE) {
    for (const step of ['50--alfa-24', '50', '70']) assert.match(palette, new RegExp(`--sf-${hue}-${step}: #`, 'u'), `${hue} ${step}`);
  }
});

test('C411: the constructor and sf-badge draw the class from hue', () => {
  const constructor = read('src/component/badges/js/_badges.js');
  assert.match(constructor, /const hue = canonicalBadgeHue\(params\.hue\);\n\s+if \(hue\) \{\n\s+this\.badge\.classList\.add\(`sf-badge--\$\{hue\}`\);/u);
  const component = json('src/smart/badge/component.json');
  assert.equal(component.version, '1.8.1');
  assert.deepEqual(component.settings.hue.values, ['', ...PALETTE]);
  assert.equal(component.settings.hue.default, '');
  const manifest = json('src/smart/badge/smart.manifest.json');
  assert.deepEqual(manifest.inputs.properties.hue.enum, ['', ...PALETTE]);
  const template = read('src/smart/badge/js/templates/default.js');
  assert.match(template, /context\.hue \? `sf-badge--\$\{context\.hue\}` : '',/u);
  assert.match(read('src/smart/badge/index.js'), /\n {6}hue: this\.hue,\n/u);
  const examples = json('src/smart/badge/examples.json');
  assert.deepEqual(examples.examples.find((entry) => entry.name === 'hue').settings, {text: 'Дизайн', hue: 'teal'});
  assert.ok(json('src/smart/badge/probe.json').probes.some((check) => check.id === 'p-hue'));
  assert.equal(json('src/component/badges/passport.json').version, '1.14.0');
});

test('C411: the public variables still win and say so; the docs list the classes', () => {
  const badge = json('src/core/contracts/public-variables.v1.json').components.find((entry) => entry.component === 'badge');
  for (const name of ['--sf-badge-background-color', '--sf-badge-color']) {
    const variable = badge.variables.find((entry) => entry.name === name);
    assert.ok(variable.varies_with.includes('hue'), name);
    assert.match(variable.summary, /sf-badge--<hue>/u, name);
  }
  const docs = read('src/component/badges/docs/docs.md');
  for (const hue of PALETTE) assert.ok(docs.includes(`\`--${hue}\``) || docs.includes(`\`sf-badge--${hue}\``), hue);
  assert.match(read('src/smart/badge/docs/docs.md'), /## A colour from the palette/u);
});

test('C411: the journal points the inline variables at the class', () => {
  const record = json('contracts/changes/journal.json').records.find((entry) => entry.id === 'class-c411-badge-palette-variables-to-hue-class');
  assert.ok(record);
  assert.equal(record.rewrite, 'manual');
  assert.deepEqual(record.items.map((item) => item.to), PALETTE.map((hue) => `sf-badge--${hue}`));
  for (const item of record.items) assert.match(item.from, new RegExp(item.match, 'u'));
});

test('C411: the contrast matrix reads every hue on every neutral ground', () => {
  const cases = FIXTURES.join('\n');
  for (const hue of PALETTE) {
    for (const place of ['page', 'card', 'raised', 'popup', 'popup-nested']) {
      assert.ok(cases.includes(`data-case="C411 sf-badge--${hue} text on --sf-surface-${place}" data-need="4.5"`), `${hue} on ${place}`);
    }
  }
});
