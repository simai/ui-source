import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Smart File Preview projects the ordinary source-owned structure', async () => {
  const template = await read('src/smart/file-preview/js/templates/default.js');

  for (const className of [
    'sf-file-preview',
    'sf-file-preview-holder',
    'sf-file-preview-thumbnail',
    'sf-file-preview-main',
    'sf-file-preview-name',
    'sf-file-preview-size',
    'sf-file-preview-actions',
  ]) assert.ok(template.includes(className));
  assert.doesNotMatch(template, /\b(?:absolute|translate-y-half|inline-flex|flex-col|items-cross-center)\b/);
});

test('Smart File Preview exposes native localized actions and cancellable events', async () => {
  const [source, template, manifest] = await Promise.all([
    read('src/smart/file-preview/index.js'),
    read('src/smart/file-preview/js/templates/default.js'),
    read('src/smart/file-preview/smart.manifest.json').then(JSON.parse),
  ]);

  assert.match(template, /\?disabled=\$\{disabled\}/);
  assert.match(template, /aria-label=\$\{label\}/);
  // Standard 1.3.8: the labels are settings of component.json whose words come
  // from the language files; the events are vocabulary requests, cancelable.
  const declared = JSON.parse(await read('src/smart/file-preview/component.json'));
  assert.equal(declared.settings['download-label']['default-from'], 'runtime.download-label');
  assert.equal(declared.settings['remove-label']['default-from'], 'runtime.remove-label');
  assert.equal(declared.events.download.cancelable, true);
  assert.equal(declared.events.detach.cancelable, true);
  assert.match(source, /cancelable: true/);
  assert.equal(manifest.contracts.event_delivery.properties.cancelable.const, true);
  assert.equal(manifest.events['sf-file-preview:download'].payload.type, 'object');
  assert.equal(manifest.events['sf-file-preview:remove'].payload.type, 'object');
});

test('Smart File Preview keeps bounded compatibility without restoring floating actions', async () => {
  const [source, docs, rule] = await Promise.all([
    read('src/smart/file-preview/index.js'),
    read('src/smart/file-preview/docs/docs.md'),
    read('src/smart/file-preview/rule.js'),
  ]);

  // The compatibility value lives in the prop config now, where the template
  // reads it: see contracts/public-api-axes.json.
  assert.match(source, /valueAliases: \{auto: \['default'\]\}/);
  assert.match(source, /setOpen\(value\)/);
  assert.match(source, /toggleOpen\(\)/);
  assert.doesNotMatch(source, /document\.addEventListener\('click'/);
  assert.match(docs, /actions are no longer hidden/);
  assert.match(rule, /\{ name: 'file-preview' \}/);
  assert.match(rule, /\{ name: 'icon-buttons' \}/);
});
