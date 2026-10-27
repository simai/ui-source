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
  // `invalid` is the shown state; `error` is its dated alias (standard 1.3.8 §17.2).
  assert.match(template, /aria-invalid=\$\{invalid \? 'true' : nothing\}/);
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
  // The closed axes are the component.json's (standard 1.3.8), from which
  // core/js/element-manifest.js makes the props.
  const declared = JSON.parse(await source('src/smart/checkbox/component.json'));
  assert.match(runtime, /elementFromManifest\(manifest,/);
  assert.deepEqual(declared.settings.size, {type: 'enum', values: ['1/2', '1', '2'], default: '1'});
  assert.deepEqual(declared.settings.position, {type: 'enum', values: ['start', 'end'], default: 'start'});
  assert.deepEqual(Object.keys(declared.accessibility.keys), ['Tab', 'Space']);
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

test('Smart checkbox marks of a size are that size\'s line (simai/ui-source#49)', async () => {
  // One ladder (ui-control VISUAL-DECISIONS 2026-10-05): the checked, mixed and
  // help marks are the line height of their size. The size-2 bridge rules read
  // text-height-1/3 and drew the mixed and help marks 16x16 on a 28px line.
  const css = await source('src/smart/checkbox/js/templates/default.css');
  const rules = [...css.replace(/@layer [^{]+\{/g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map(([, selector, body]) => ({selector: selector.trim(), body}))
    .filter(({body}) => /--sf-icon--(?:height|width)/.test(body));
  assert.ok(rules.length >= 5, `${rules.length} mark rules`);
  for (const {selector, body} of rules) {
    const size = selector.match(/sf-checkbox--size-([0-9\\/]+)/)?.[1];
    assert.ok(size, selector);
    const tokens = [...body.matchAll(/--sf-icon--(?:height|width):\s*var\(--sf-text-height-([^)]+)\)/g)].map(([, step]) => step);
    assert.equal(tokens.length, 2, selector);
    for (const step of tokens) assert.equal(step, size, `${selector}: text-height-${step} on size ${size}`);
  }
  assert.ok(rules.some(({selector}) => /size-2:has\(input:indeterminate\)/.test(selector)), 'the size-2 mixed mark has its rule');
  // The help mark sits in sf-icon, which the core sheet's child selector does
  // not reach: every size needs its own rule (size 1/2 drew 24px on a 16px line).
  for (const size of ['1\\/2', '1', '2']) {
    assert.ok(rules.some(({selector}) => selector.includes(`sf-checkbox--size-${size} > .sf-checkbox-container > .sf-checkbox-top > sf-icon > .sf-icon`)), `size ${size} help mark`);
  }
});
