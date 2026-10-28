import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';

const source = async (file) => withoutPublicVariables(await readFile(new globalThis.URL(`../src/${file}`, import.meta.url), 'utf8'));

test('Input presentation uses semantic UI, hairline and motion tokens', async () => {
  const css = await source('component/inputs/scss/_css__inputs.scss');
  assert.match(css, /--sf-input--radius:\s*var\(--sf-radius--ui\)/);
  assert.match(css, /--sf-input-field--border:\s*var\(--sf-px\) solid/);
  assert.match(css, /transition-property:\s*background-color, border-color, box-shadow, color/);
  assert.match(css, /transition-duration:\s*var\(--sf-duration-fast\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.sf-input:not\(\.sf-input--pointer-focus\):has\(/);
  assert.doesNotMatch(css, /(?:^|[\s:])1px(?:[\s;]|$)/m);
});

test('Input constructor projects bounded native text metadata', async () => {
  const javascript = await source('component/inputs/js/_inputs.js');
  assert.match(javascript, /const INPUT_TYPES = new Set\(\[/);
  assert.match(javascript, /inputType = 'text'/);
  assert.match(javascript, /input\.type = normalizeInputType\(inputType\)/);
  assert.match(javascript, /input\.autocomplete = String\(autocomplete\)/);
  assert.match(javascript, /input\.inputMode = normalizeInputMode\(inputMode\)/);
  assert.match(javascript, /input\.minLength = normalizedMinLength/);
  assert.match(javascript, /input\.maxLength = normalizedMaxLength/);
  assert.match(javascript, /input\.pattern = String\(pattern\)/);
  assert.match(javascript, /addEventListener\('pointerdown', pointerFocusHandler\)/);
  assert.match(javascript, /classList\.remove\('sf-input--pointer-focus'\)/);
});

test('Smart Input projects the same native metadata and closed visual axes', async () => {
  const [template, index, manifestText] = await Promise.all([
    source('smart/input/js/templates/default.js'),
    source('smart/input/index.js'),
    source('smart/input/smart.manifest.json'),
  ]);
  const manifest = JSON.parse(manifestText);
  // The settings are the component.json's; core/js/element-manifest.js makes
  // the props the template reads (standard 1.3.8 §4).
  const declared = JSON.parse(await source('smart/input/component.json'));
  assert.match(index, /elementFromManifest\(manifest,/);
  for (const name of ['inputType', 'autocomplete', 'inputmode', 'minlength', 'maxlength', 'pattern']) {
    assert.match(template, new RegExp(name));
    assert.ok(declared.settings[name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)], name);
  }
  // smart.icon is listed because the template renders sf-icon, which the rule
  // has to fetch: see loader-relation-completeness.contract.test.mjs. The list is
  // generated from the Loader relations (standard 1.4): the reset button's sheet too.
  assert.deepEqual(manifest.composition.uses, ['component.icon-buttons', 'component.inputs', 'smart.icon']);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.deepEqual(manifest.inputs.properties.type.enum, ['bordered', 'filled', 'hidden']);
  assert.deepEqual(manifest.inputs.properties['input-type'].enum, ['text', 'email', 'password', 'search', 'tel', 'url']);
  assert.deepEqual(manifest.inputs.properties.inputmode.enum, ['', 'none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']);
  assert.equal(manifest.contracts.state_owner.const, 'native_input');
  assert.equal(manifest.accessibility.role, 'textbox');
  for (const state of ['empty', 'filled', 'focus-visible', 'readonly', 'disabled', 'invalid']) {
    assert.ok(manifest.contracts.field_states.enum.includes(state));
  }
});

test('Smart Input source metadata describes real form ownership', async () => {
  const [docs, fixture, scenario] = await Promise.all([
    source('smart/input/docs/docs.md'),
    source('smart/input/studio.fixture.json').then(JSON.parse),
    source('smart/input/studio.scenario.json').then(JSON.parse),
  ]);
  assert.match(docs, /input-type/);
  assert.match(docs, /autocomplete/);
  assert.equal(fixture.props['input-type'], 'email');
  assert.equal(fixture.props.autocomplete, 'email');
  assert.ok(scenario.assertions.some((item) => item.type === 'native-attribute'));
  assert.ok(scenario.assertions.some((item) => item.type === 'form-value'));
});
