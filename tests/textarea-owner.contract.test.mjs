import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';

const source = (file) => readFile(new globalThis.URL(`../src/${file}`, import.meta.url), 'utf8').then(withoutPublicVariables);

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
  assert.deepEqual(manifest.inputs.properties.type.enum, ['bordered', 'filled', 'flush']);
  assert.deepEqual(manifest.inputs.properties.appearance.enum, ['bordered', 'filled', 'flush']);
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

// Flush (ui-chat's composer): the field inside a composite control that draws
// the box and the focus. The field draws neither, keeps its text on the size
// ladder, and auto-grows with a frame that has no hairline.
test('Textarea flush surface draws no box and no focus of its own', async () => {
  const [css, javascript, index, meta, docs, smartDocs] = await Promise.all([
    source('component/textarea/scss/_css__textarea.scss'),
    source('component/textarea/js/_textarea.js'),
    source('smart/textarea/index.js'),
    source('smart/textarea/meta.mjs'),
    source('component/textarea/docs/docs.md'),
    source('smart/textarea/docs/docs.md'),
  ]);
  assert.match(javascript, /const TEXTAREA_VARIANTS = new Set\(\['bordered', 'filled', 'flush'\]\);/);
  assert.match(index, /values: \['bordered', 'filled', 'flush'\], aliases: \['type'\]/);
  assert.match(meta, /\["bordered", "filled", "flush"\]/);
  const flush = css.slice(css.indexOf('\n.sf-textarea.sf-textarea--flush textarea {', css.indexOf('/* Flush:')));
  const own = flush.slice(0, flush.indexOf('}'));
  for (const declaration of ['background-color: transparent', 'border: 0', 'border-radius: 0', 'box-shadow: none', 'margin: 0', 'outline: none', 'resize: none']) {
    assert.ok(own.includes(declaration), declaration);
  }
  // Read with the public wrappers taken off: --sf-textarea-padding-inline and
  // --sf-textarea-padding-block still override the flush padding.
  assert.match(own, /--sf-textarea-textarea--padding-inline-start: 0px;/);
  for (const size of ['1', '2', '1\\/2']) {
    assert.ok(css.includes(`.sf-textarea.sf-textarea--flush.sf-textarea--size-${size} textarea {\n  --sf-textarea-textarea--padding-top: var(--sf-ui-${size}--space-y-tightness-default);`), size);
  }
  assert.match(css, /\.sf-textarea\.sf-textarea--flush\.sf-textarea--auto-grow textarea\[rows\] \{\n  --sf-textarea--row-frame: calc\(var\(--sf-textarea-textarea--padding-top\) \+ var\(--sf-textarea-textarea--padding-bottom\)\);/);
  assert.match(css, /\.sf-textarea\.sf-textarea--flush:not\(\.sf-textarea--pointer-focus\):has\(textarea:enabled:not\(:disabled\):not\(\.disabled\):focus-visible\) textarea \{\n  outline: none;/);
  // The text is on the ladder at every size: the shared font rules name flush too.
  for (const size of ['1', '2', '1\\/2']) assert.ok(css.includes(`.sf-textarea.sf-textarea--size-${size}.sf-textarea--flush textarea`), size);
  assert.match(docs, /## Flush/);
  assert.match(smartDocs, /## Flush/);
  assert.match(smartDocs, /:has\(:focus-visible\)/);
});
