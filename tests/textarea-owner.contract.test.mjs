import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (file) => readFile(new globalThis.URL(`../src/${file}`, import.meta.url), 'utf8');

test('Textarea presentation uses UI, hairline, motion and safe resize contracts', async () => {
  const css = await source('component/textarea/scss/_css__textarea.scss');
  assert.match(css, /--sf-textarea--radius:\s*var\(--sf-radius--ui\)/);
  assert.match(css, /--sf-textarea-textarea--border:\s*var\(--sf-px\) solid/);
  assert.match(css, /resize:\s*var\(--sf-resize, vertical\)/);
  assert.match(css, /transition-property:\s*background-color, border-color, box-shadow, color/);
  assert.match(css, /transition-duration:\s*var\(--sf-duration-fast\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.sf-textarea:not\(\.sf-textarea--pointer-focus\):has\(/);
  assert.doesNotMatch(css, /--sf-ui-radius-default/);
  assert.doesNotMatch(css, /(?:^|[\s:])1px(?:[\s;]|$)/m);
  const resizeUtility = await source('utility/resize/default/scss/_sf_css__resize.scss');
  assert.match(resizeUtility, /--sf-resize:\s*#\{\$resize-value\}/);
  assert.match(resizeUtility, /resize:\s*var\(--sf-resize\)/);
});

test('Textarea constructor projects bounded native multiline metadata', async () => {
  const javascript = await source('component/textarea/js/_textarea.js');
  assert.match(javascript, /fieldSize\(size, 'sf-textarea'\)/);
  assert.match(javascript, /const TEXTAREA_VARIANTS = new Set\(\[/);
  assert.match(javascript, /textarea\.autocomplete = String\(autocomplete\)/);
  assert.match(javascript, /textarea\.inputMode = normalizeInputMode\(inputMode\)/);
  assert.match(javascript, /textarea\.minLength = normalizedMinLength/);
  assert.match(javascript, /textarea\.maxLength = normalizedMaxLength/);
  assert.match(javascript, /textarea\.spellcheck = toBoolean\(spellcheck, true\)/);
  assert.match(javascript, /textarea\.wrap = normalizeWrap\(wrap\)/);
  assert.match(javascript, /addEventListener\('pointerdown', pointerFocusHandler\)/);
  assert.match(javascript, /classList\.remove\('sf-textarea--pointer-focus'\)/);
});

test('Smart Textarea projects native metadata and closed visual axes', async () => {
  const [template, index, manifestText] = await Promise.all([
    source('smart/textarea/js/templates/default.js'),
    source('smart/textarea/index.js'),
    source('smart/textarea/smart.manifest.json'),
  ]);
  const manifest = JSON.parse(manifestText);
  for (const name of ['autocomplete', 'inputmode', 'minlength', 'maxlength', 'spellcheck', 'wrap']) {
    assert.match(template, new RegExp(name, 'i'));
    assert.match(index, new RegExp(name, 'i'));
  }
  assert.deepEqual(manifest.composition.uses, ['component.textarea']);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.deepEqual(manifest.inputs.properties.type.enum, ['bordered', 'filled']);
  assert.deepEqual(manifest.inputs.properties.inputmode.enum, ['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
  assert.deepEqual(manifest.inputs.properties.wrap.enum, ['soft', 'hard']);
  assert.equal(manifest.contracts.state_owner.const, 'native_textarea');
  assert.equal(manifest.accessibility.role, 'textbox');
  for (const state of ['empty', 'filled', 'focus-visible', 'readonly', 'disabled', 'invalid']) {
    assert.ok(manifest.contracts.field_states.enum.includes(state));
  }
});

test('Smart Textarea source metadata describes multiline form ownership', async () => {
  const [docs, fixture, scenario] = await Promise.all([
    source('smart/textarea/docs/docs.md'),
    source('smart/textarea/studio.fixture.json').then(JSON.parse),
    source('smart/textarea/studio.scenario.json').then(JSON.parse),
  ]);
  assert.match(docs, /spellcheck/);
  assert.match(docs, /resize-y/);
  assert.equal(fixture.props.maxlength, 500);
  assert.equal(fixture.props.spellcheck, true);
  assert.ok(scenario.assertions.some((item) => item.type === 'native-attribute'));
  assert.ok(scenario.assertions.some((item) => item.type === 'form-value'));
});
