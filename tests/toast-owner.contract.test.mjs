/* global URL, process */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').then(withoutPublicVariables);

test('ordinary Toast owns delegated actions, pause-safe lifetime and token dismissal', async () => {
  const runtime = await read('src/component/toast/js/_toast.js');
  const dismiss = await read('src/component/toast/dismiss.js');

  assert.match(runtime, /\[data-close\].*\[data-toast-close\].*\[data-action\].*\[data-toast-action\]/s);
  assert.match(runtime, /data-duration/);
  assert.match(runtime, /pointerenter/);
  assert.match(runtime, /focusin/);
  assert.match(runtime, /__sfToastPauseReasons/);
  assert.match(runtime, /sf-toast-action/);
  assert.match(runtime, /sf-toast-close/);
  assert.doesNotMatch(runtime, /querySelectorAll\('\[data-toast-(?:close|action)\]'/);
  assert.match(dismiss, /prefers-reduced-motion: reduce/);
  assert.match(dismiss, /getAnimations\(\)/);
  assert.match(dismiss, /Promise\.allSettled/);
});

test('Toast presentation uses semantic surface, typography and motion tokens', async () => {
  const css = await read('src/component/toast/scss/_css__toast.scss');

  assert.match(css, /var\(--sf-radius--surface\)/);
  assert.match(css, /border: var\(--sf-px\)/);
  assert.match(css, /--sf-toast-text--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-toast-supporting-text--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-toast-text--font-weight: var\(--sf-font-weight-medium\)/);
  for (const role of ['primary', 'error', 'warning', 'success']) {
    assert.match(css, new RegExp(`--sf-toast--content-color: var\\(--sf-on-${role}-container\\)`));
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Smart Toast declares exact roles, composition and concise behavior inputs', async () => {
  const template = await read('src/smart/toast/js/templates/default.js');
  const runtime = await read('src/smart/toast/index.js');
  const rule = await read('src/smart/toast/rule.js');
  const manifest = JSON.parse(await read('src/smart/toast/smart.manifest.json'));

  assert.match(template, /data-action=/);
  assert.match(template, /data-close/);
  assert.match(template, /data-duration=/);
  assert.match(runtime, /bindToast\(this\._boundRoot, this\)/);
  assert.match(runtime, /dismissToast\(this\._boundRoot, this\)/);
  assert.match(rule, /name: 'cl-icon-buttons'/);
  assert.match(rule, /name: 'cl-icons'/);
  // The axis is named status and speaks the shared vocabulary; type still answers.
  assert.deepEqual(manifest.inputs.properties.status.enum, ['neutral', 'info', 'success', 'warning', 'error']);
  assert.deepEqual(manifest.inputs.properties.type.enum, manifest.inputs.properties.status.enum);
  assert.deepEqual(manifest.inputs.properties.role.enum, ['', 'status', 'alert']);
  assert.deepEqual(manifest.composition.uses, ['component.toast', 'component.buttons', 'smart.icon-buttons', 'smart.icons']);
  assert.deepEqual(manifest.contracts.canonical_behavior_attributes.enum, ['data-action', 'data-close', 'data-duration']);
});

test('Toast documentation covers supported roles, lifetime and actions without false live regions', async () => {
  const root = process.env.UI_DOC_ROOT;
  assert.ok(root, 'UI_DOC_ROOT is required');
  const page = await readFile(`${root}/content/ru/components/feedback/toast.md`, 'utf8');
  const examples = await Promise.all(['basic', 'overview', 'lifetime', 'actions']
    .map(id => readFile(`${root}/examples/components/toast/${id}/index.html`, 'utf8')));

  assert.match(page, /role="status"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /data-duration/);
  assert.match(page, /data-action/);
  assert.match(page, /data-close/);
  assert.doesNotMatch(examples.join('\n'), /radius-default/);
  // A toast present from page load is static: a live role on it would be a
  // false live region. A demo's own result line may be live, but only when it
  // starts empty and a script fills it, so it announces a real change.
  assert.doesNotMatch(examples.join('\n'), /<[^>]*class="sf-toast[ "][^>]*role="(?:status|alert)"|<[^>]*role="(?:status|alert)"[^>]*class="sf-toast[ "]/);
  for (const region of examples.join('\n').matchAll(/<(\w+)[^>]*role="(?:status|alert)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    assert.equal(region[2].trim(), '', `live region is not empty at load: ${region[0]}`);
  }
  for (const html of examples) {
    for (const icon of html.matchAll(/<i class="sf-icon[^"]*"([^>]*)>/g)) {
      assert.match(icon[1], /aria-hidden="true"/);
    }
  }
});
