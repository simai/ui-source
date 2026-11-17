// Owner decision C123 for the reset inside sf-input-color's frame: what can be
// read from the source. The browser half -- no plate, the inks, the hit area,
// the half inset, the ring and the names as drawn at 1440 and 390, light and
// dark, normal and compact -- is tests/browser/input-color-reset-c123.browser.mjs.
//
//   (1) the field and brand variants draw the reset as the field layer's
//       action: a <button class="sf-field-action"> holding an sf-icon, not a
//       plated sf-button-icon; its name and title are the variant's words;
//   (2) the component loads the field layer's rules (relation inputs) and the
//       frame says its step through the three variables those rules read;
//   (3) the frame keeps half an inset round the glyph while it holds the
//       action; the chevron is the same glyph size;
//   (4) the theme variant's reset stands outside a field and keeps its plate
//       (C123 (7)).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is in the sheet`);
  return css.slice(at, css.indexOf('}', at));
};
const template = read('src/smart/input-color/js/templates/default.js');
const css = read('src/smart/input-color/js/templates/default.css');
const field = template.slice(template.indexOf('export function renderColorTemplate'), template.indexOf('function renderChecks'));
const theme = template.slice(template.indexOf('function renderThemeTemplate'), template.indexOf('function renderWindow'));

test('(1) the frame reset is a field action named by the variant', () => {
  assert.match(field, /<button type="button"\s+class="sf-field-action sf-color-reset"\s+data-action="clear"\s+aria-label=\$\{context\.clearLabel\}\s+title=\$\{context\.clearLabel\}/u);
  assert.match(field, /><sf-icon icon="restart_alt" aria-hidden="true"><\/sf-icon><\/button>/u);
  assert.doesNotMatch(field, /<sf-button-icon/u, 'no plated button inside the frame');
  assert.match(read('src/smart/input-color/index.js'), /clearLabel: this\.isBrand \? this\.brandResetLabel : this\.clearLabel,/u);
});

test('(2) the field layer rules are loaded and the frame says its step', () => {
  const manifest = json('src/smart/input-color/component.json');
  assert.equal(manifest.version, '1.19.1'); // C209 (fix/input-color-c209), above group build 7's 1.14.0 // fix/forms-fm2: 1.15.0 moved on by the merged branches
  assert.ok(manifest.relations.some((relation) => relation.name === 'inputs'), 'relation inputs');
  assert.match(read('src/smart/input-color/rule.js'), /\{ name: 'inputs' \}/u);
  assert.ok(json('src/smart/input-color/smart.manifest.json').composition.uses.includes('component.inputs'));
  const frame = css.slice(css.indexOf('The reset is an action inside the field'));
  const vars = rule(frame, '.sf-color-frame');
  assert.match(vars, /--sf-field-action--inset: var\(--sf-color--space-x\);/u);
  assert.match(vars, /--sf-field-action--glyph: var\(--sf-color--text-height\);/u);
  assert.match(vars, /--sf-field-action--height: var\(--sf-color--control-height\);/u);
});

test('(3) half an inset round the glyph; the chevron is the glyph size', () => {
  const gap = rule(css, '.sf-color-frame:has(> .sf-field-action, > .sf-field-inherited-slot > .sf-field-action:not([hidden]))');
  // 1.12.1: the field layer's value step (component.inputs field-action.scss), not a copy of its formula.
  assert.match(gap, /gap: var\(--sf-field-action--value-space\);/u);
  const chevron = rule(css, '.sf-color-chevron');
  for (const name of ['font-size', 'height', 'width']) assert.match(chevron, new RegExp(`--sf-icon--${name}: var\\(--sf-color--text-height\\);`, 'u'));
});

test('(4) the theme variant keeps its plated reset outside the field', () => {
  assert.match(theme, /<sf-button-icon\s+appearance="ghost"[\s\S]*?data-action="clear"/u);
});
