/* global URL, process */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = async path => withoutPublicVariables(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('ordinary Alert uses dynamic delegated actions and shared token motion', async () => {
  const runtime = await read('src/component/alerts/js/_alerts.js');
  const dismiss = await read('src/component/alerts/dismiss.js');

  assert.match(runtime, /document\.addEventListener\('click', handleDocumentClick\)/);
  assert.match(runtime, /\[data-close\].*\[data-alert-close\].*\[data-action\].*\[data-alert-action\]/);
  assert.match(runtime, /belongsToSmartAlert/);
  assert.match(runtime, /sf-alert-action/);
  assert.match(runtime, /sf-alert-close/);
  assert.doesNotMatch(runtime, /getElementsByClassName|setTimeout|style\.opacity|style\.transition/);
  assert.match(dismiss, /prefers-reduced-motion: reduce/);
  assert.match(dismiss, /getAnimations\(\)/);
  assert.match(dismiss, /Promise\.allSettled/);
});

test('Alert presentation uses semantic surface, typography and motion tokens', async () => {
  const css = await read('src/component/alerts/scss/_css__alerts.scss');

  assert.match(css, /var\(--sf-radius--surface\)/);
  assert.match(css, /var\(--sf-px\)/);
  assert.match(css, /--sf-alert-text--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-alert-supporting-text--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-alert-text--font-weight: var\(--sf-font-weight-medium\)/);
  for (const role of ['info', 'error', 'warning', 'success']) {
    assert.match(css, new RegExp(`--sf-alert--color: var\\(--sf-on-${role}-container\\)`));
  }
  assert.match(css, /transition: opacity var\(--sf-duration-normal\) var\(--sf-ease-enter\)/);
  assert.match(css, /\.closing \{[^}]*transition-timing-function: var\(--sf-ease-exit\)/u);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Smart Alert declares exact variants, composition and short behavior hooks', async () => {
  const template = await read('src/smart/alert/js/templates/default.js');
  const runtime = await read('src/smart/alert/index.js');
  const rule = await read('src/smart/alert/rule.js');
  const manifest = JSON.parse(await read('src/smart/alert/smart.manifest.json'));

  assert.match(template, /context\.icon === 'none'/);
  assert.match(template, /data-action=/);
  assert.match(template, /data-close/);
  assert.match(template, /flex flex-wrap items-center/);
  assert.match(runtime, /dismissAlertElement\(this\._boundRoot \|\| this, this\)/);
  assert.match(rule, /name: 'cl-icon-buttons'/);
  assert.match(rule, /name: 'cl-icons'/);
  // The axes are named: status for what the alert reports, appearance for how it
  // looks. The legacy names still answer, which the axes rule checks.
  assert.deepEqual(manifest.inputs.properties.status.enum, ['neutral', 'info', 'success', 'warning', 'error']);
  assert.deepEqual(manifest.inputs.properties.type.enum, manifest.inputs.properties.status.enum);
  assert.deepEqual(manifest.inputs.properties.appearance.enum, ['default', 'outlined', 'flat']);
  assert.deepEqual(manifest.inputs.properties.variant.enum, manifest.inputs.properties.appearance.enum);
  assert.deepEqual(manifest.composition.uses, ['component.alerts', 'component.buttons', 'smart.icons', 'smart.icon-buttons']);
  assert.deepEqual(manifest.contracts.canonical_behavior_attributes.enum, ['data-action', 'data-close']);
});

test('Alert documentation has source-faithful examples without control surface radius misuse', async () => {
  const root = process.env.UI_DOC_ROOT;
  assert.ok(root, 'UI_DOC_ROOT is required');
  const page = await readFile(`${root}/content/ru/components/feedback/alerts.md`, 'utf8');
  const examples = await Promise.all([
    'basic',
    'overview',
    'appearance',
    'actions',
  ].map(id => readFile(`${root}/examples/components/alerts/${id}/index.html`, 'utf8')));

  assert.match(page, /role="alert"/);
  assert.match(page, /role="status"/);
  assert.match(page, /data-close/);
  assert.match(page, /data-action/);
  assert.doesNotMatch(examples.join('\n'), /radius-default/);
  assert.doesNotMatch(examples.join('\n'), /<i class="sf-icon[^>]*>(?![^<]*<\/i>)/);
  for (const html of examples) {
    for (const icon of html.matchAll(/<i class="sf-icon[^"]*"([^>]*)>/g)) {
      assert.match(icon[1], /aria-hidden="true"/);
    }
  }
});
