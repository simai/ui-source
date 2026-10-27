/* global process, URL */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Reference Link owns native navigation, complete geometry and BEM aliases', async () => {
  const css = await read('src/component/reference-link/scss/_css__reference_link.scss');
  const template = await read('src/smart/reference-link/js/templates/default.js');
  const rule = await read('src/component/reference-link/rule.js');
  const manifest = JSON.parse(await read('src/smart/reference-link/smart.manifest.json'));

  assert.match(css, /display: flex/);
  assert.match(css, /border: var\(--sf-px\)/);
  assert.match(css, /border-radius: var\(--sf-(?:reference-link|download-file)-radius, var\(--sf-radius--ui\)\)/);
  assert.match(css, /:has\([^}]*:focus-visible/s);
  assert.match(css, /\.sf-reference-link__link/);
  assert.match(css, /\.sf-reference-link-left/);
  assert.match(template, /<a class="sf-reference-link__link"/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(template, /href && !disabled/);
  assert.match(rule, /js: false/);
  assert.deepEqual(manifest.composition.uses, ['component.reference-link', 'smart.icons']);
  assert.equal(manifest.contracts.navigation.disabled, 'non-interactive content with no href');
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Download File owns native/button semantics, canonical structure and tokens', async () => {
  const runtime = await read('src/component/download-file/js/_download-file.js');
  const css = await read('src/component/download-file/scss/_css_download-file.scss');
  const template = await read('src/smart/download-file/js/templates/default.js');
  const rule = await read('src/smart/download-file/rule.js');
  const manifest = JSON.parse(await read('src/smart/download-file/smart.manifest.json'));

  assert.match(runtime, /createElement\('span'\)/);
  assert.match(runtime, /sf-download-file__body/);
  assert.match(runtime, /sf-download-file__main/);
  assert.match(runtime, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(runtime, /^\s*console;\s*$/m);
  assert.match(css, /--sf-download-file--text-size: var\(--sf-text-size-1\)/);
  assert.match(css, /border: var\(--sf-px\)/);
  assert.match(css, /border-radius: var\(--sf-(?:reference-link|download-file)-radius, var\(--sf-radius--ui\)\)/);
  assert.match(css, /\.sf-download-file:focus-visible/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(template, /href && !disabled \? 'a' : 'button'/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(rule, /name: 'icons'/);
  assert.deepEqual(manifest.inputs.properties.size.enum, ['1/3', '1/2', '1', '2', '3']);
  assert.deepEqual(manifest.composition.uses, ['component.download-file', 'smart.icons']);
  assert.ok(manifest.events['sf-download-file:click']);
  assert.doesNotMatch(css, /(?:^|[\s:,])1px(?:[\s;,)])/m);
});

test('Reference and download documentation uses native destinations and decorative icons', async () => {
  const root = process.env.UI_DOC_ROOT;
  assert.ok(root, 'UI_DOC_ROOT is required');
  const reference = await readFile(`${root}/content/ru/components/content/reference-link.md`, 'utf8');
  const download = await readFile(`${root}/content/ru/components/actions/download-file.md`, 'utf8');
  const examples = await Promise.all([
    'examples/components/reference-link/overview/index.html',
    'examples/components/reference-link/state-disabled/index.html',
    'examples/components/download-file/overview/index.html',
    'examples/components/download-file/sizes/index.html',
    'examples/components/download-file/action/index.html',
    'examples/components/download-file/disabled/index.html',
    'examples/components/reference-link/state-focus/index.html',
    'examples/components/download-file/state-focus/index.html',
  ].map(path => readFile(`${root}/${path}`, 'utf8')));

  // The whole card is the native link's hit area and its focus ring.
  assert.match(reference, /Ссылка — настоящий `<a href>`; её область нажатия растягивается на всю\s+карточку/);
  assert.match(reference, /кольцо фокуса охватывает всю карточку/);
  assert.match(download, /sf-download-file:click/);
  assert.doesNotMatch(examples[1], /disabled[^>]*>[\s\S]*?<a\b/);
  assert.doesNotMatch(examples[5], /href=/);
  for (const html of examples) {
    for (const icon of html.matchAll(/<i class="[^"]*sf-icon[^"]*"([^>]*)>/g)) {
      assert.match(icon[1], /aria-hidden="true"/);
    }
  }
});
