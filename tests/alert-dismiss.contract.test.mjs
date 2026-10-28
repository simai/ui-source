/* global URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read = file => readFile(new URL(`../src/smart/alert/${file}`, import.meta.url), 'utf8');

test('Alert default close is named and bound through the stable root', async () => {
  const source = await read('index.js'), template = await read('js/templates/default.js');
  assert.match(template, /data-alert-close/);
  assert.match(template, /aria-label=\$\{context.closeLabel \|\| 'Close alert'\}/);
  assert.match(source, /root.addEventListener\('click', this\._handleRootClick\)/);
  assert.match(source, /root.removeEventListener\('click', this\._handleRootClick\)/);
  assert.match(source, /trigger.closest\('\.sf-alert'\) !== this\._boundRoot/);
  assert.doesNotMatch(source, /querySelectorAll\('\[data-alert-close\]'\)/);
});

test('Alert close label is present in its source-owned contract and reference fixture', async () => {
  const manifest = JSON.parse(await read('smart.manifest.json'));
  const fixture = JSON.parse(await read('studio.fixture.json'));
  // No fixed default: the runtime reads the attribute, then the page language's
  // dictionary (default-from); the English default the manifest used to show was
  // never used (2026-10-13), and the generated registry names none (standard 1.4).
  assert.equal(manifest.inputs.properties['close-label'].default, undefined);
  assert.equal(fixture.props['close-label'], 'Закрыть уведомление');
});

test('success notice icon uses its semantic color role', async () => {
  const css = await readFile(new URL('../src/component/alerts/scss/_css__alerts.scss', import.meta.url), 'utf8');
  assert.match(css, /\.sf-alert\.sf-alert--success \.sf-icon\s*\{\s*--sf-icon--color: var\(--sf-success\)/);
});
