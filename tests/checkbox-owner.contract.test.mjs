import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(withoutPublicVariables);
const uiDoc = (file) => readFile(`${process.env.UI_DOC_ROOT}/${file}`, 'utf8');

test('Checkbox retains one native input and concise mixed-state initialization', async () => {
  const runtime = await source('src/component/checkbox/js/_checkbox.js');
  const template = await source('src/smart/checkbox/js/templates/default.js');
  assert.match(runtime, /input\[type="checkbox"\]/);
  assert.match(runtime, /hasAttribute\('data-indeterminate'\)/);
  assert.match(runtime, /input\.indeterminate = toBoolean/);
  assert.match(template, /type="checkbox"/);
  assert.match(template, /\.indeterminate=\$\{indeterminate\}/);
  assert.doesNotMatch(runtime, /role\s*=\s*['"]checkbox/);
});

test('Smart invalid state is published by the native input', async () => {
  const template = await source('src/smart/checkbox/js/templates/default.js');
  assert.match(template, /aria-invalid=\$\{error \? 'true' : nothing\}/);
});

test('Checkbox geometry, colour and motion use Framework tokens', async () => {
  const css = await source('src/component/checkbox/scss/_css__checkbox.scss');
  assert.match(css, /--sf-checkbox-box--border: var\(--sf-px\) solid/);
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /transition-duration: var\(--sf-duration-fast\)/);
  assert.match(css, /transition-timing-function: var\(--sf-animation\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /(?:^|[\s:,])(#[0-9a-f]{3,8}|rgba?\(|[1-9][0-9.]*px|[0-9.]+rem)\b/im);
});

test('Checkbox public contract closes size, position, state and keyboard axes', async () => {
  const runtime = await source('src/smart/checkbox/index.js');
  const manifest = JSON.parse(await source('src/smart/checkbox/smart.manifest.json'));
  assert.match(runtime, /size: \{ default: '1', values: \['1\/2', '1', '2'\] \}/);
  assert.match(runtime, /position: \{type: String, default: 'start', values: \['start', 'end'\]\}/);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/2', '1', '2']);
  assert.deepEqual(manifest.inputs.properties.position.enum, ['start', 'end']);
  assert.deepEqual(manifest.contracts.checkbox_states.enum, ['unchecked', 'checked', 'mixed', 'disabled', 'invalid']);
  assert.deepEqual(manifest.state.visual_states, ['default', 'selected', 'conflict', 'disabled', 'error']);
  assert.deepEqual(manifest.accessibility.keyboard, ['Tab', 'Space']);
  assert.equal(manifest.accessibility.accessible_name, 'required');
  assert.ok(manifest.methods.isChecked);
});

test('Checkbox documentation covers grouping, mixed state, sizes and placement', async () => {
  const page = await uiDoc('content/ru/components/forms/checkbox.md');
  // The states example became one per state (ui-doc reference page standard).
  for (const id of ['overview', 'group', 'state-checked', 'state-indeterminate', 'state-disabled', 'state-error', 'state-focus', 'sizes', 'position']) {
    assert.match(page, new RegExp(`components/checkbox/${id}`));
  }
  assert.match(page, /fieldset/);
  assert.match(page, /data-indeterminate/);
  assert.match(page, /aria-invalid/);
});
