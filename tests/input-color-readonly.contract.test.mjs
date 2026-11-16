import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Follow-up of the colour field C83 (msg-68c4b654): a record's view drew its
// colour as a disabled field (the value in the disabled ink). sf-input-color
// 1.17.0 takes readonly, as sf-input's, and the field renderers draw the view,
// the cell and a read-only edit field with it. The browser check is the
// area-e probe (ink, frame line, no chevron, no window).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/input-color/component.json'));
const template = read('src/smart/input-color/js/templates/default.js');
const source = read('src/smart/input-color/index.js');
const sheet = read('src/smart/input-color/js/templates/default.css');
const renderers = read('src/smart/field-renderers/index.js');

test('sf-input-color declares readonly beside disabled', () => {
  assert.equal(manifest.settings.readonly.type, 'boolean');
  assert.equal(manifest.settings.readonly.default, false);
});

test('read-only: no window, no press, no reset, no chevron, the region line', () => {
  assert.match(source, /if \(this\.disabled \|\| this\.readonly \|\| this\._open\) return/u);
  assert.match(source, /if \(this\.disabled \|\| this\.readonly \|\| event\.button > 0\) return;/u);
  assert.match(template, /\?data-readonly=\$\{readonly && !disabled\}/u);
  assert.match(template, /class="sf-color-trigger" role="img" aria-label=\$\{spoken\}/u);
  assert.match(template, /!context\.hasInheritedValue && !readonly/u);
  assert.match(sheet, /\.sf-color-frame\[data-readonly\] \{\s*border-color: var\(--sf-outline-variant\);/u);
});

test('the field renderers draw a colour to read read-only, never disabled', () => {
  const colour = renderers.slice(renderers.indexOf('function renderColorCell'), renderers.indexOf('function renderFileCell'));
  assert.doesNotMatch(colour, /''\} disabled><\/sf-input-color>/u);
  assert.doesNotMatch(colour, /\n\s+disabled\n\s+><\/sf-input-color>/u);
  assert.doesNotMatch(colour, /\?disabled=\$\{field\.readonly === true\}/u);
  assert.equal((colour.match(/\breadonly\b/gu) || []).length >= 3, true);
  assert.match(colour, /\?readonly=\$\{field\.readonly === true\}/u);
});
