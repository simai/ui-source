import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const uiDocRoot = process.env.UI_DOC_ROOT
  ? new URL(`file://${process.env.UI_DOC_ROOT.replace(/\/$/, '')}/`)
  : null;
const readUiDoc = (path) => readFile(new URL(path, uiDocRoot), 'utf8');

test('Hide Show uses concise local behavior hooks and native hidden state', async () => {
  const source = await read('src/component/hideShow/js/_hide-show.js');

  assert.match(source, /\[data-action\]/);
  assert.match(source, /\[data-content\]/);
  assert.match(source, /content\.hidden = this\.hidden/);
  assert.match(source, /root\.dataset\.state = this\.hidden \? 'hidden' : 'shown'/);
  assert.doesNotMatch(source, /querySelector\([^)]*data-target|document\.getElementById/);
});

test('Hide Show synchronizes relationships, focus and cancellable intent', async () => {
  const source = await read('src/component/hideShow/js/_hide-show.js');

  assert.match(source, /setAttribute\('aria-controls'/);
  assert.match(source, /setAttribute\('aria-expanded'/);
  assert.match(source, /cancelable: true/);
  assert.match(source, /composed: true/);
  assert.match(source, /source === document\.activeElement/);
  assert.match(source, /focus\(\{preventScroll: true\}\)/);
});

test('Hide Show supports late loading, dynamic roots and cleanup', async () => {
  const [source, rule, presentation, docs] = await Promise.all([
    read('src/component/hideShow/js/_hide-show.js'),
    read('src/component/hideShow/rule.js'),
    read('src/component/hideShow/scss/_css__hide_show.scss'),
    read('src/component/hideShow/docs/docs.md'),
  ]);

  assert.match(source, /document\.readyState === 'loading'/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /mutation\.addedNodes/);
  assert.match(source, /mutation\.removedNodes/);
  assert.match(source, /instances\.get\(root\)\?\.destroy/);
  assert.match(rule, /css: false/);
  assert.match(rule, /js: true/);
  assert.doesNotMatch(presentation, /\.(?:sf-)?hide-show\s*\{/);
  assert.match(docs, /behavior-only/i);
  assert.match(docs, /native `hidden`/i);
});

test('Hide Show documentation uses Framework-only executable variants', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, hidden, toggle, cancel, cancelScript] = await Promise.all([
    readUiDoc('content/ru/components/tools/hide-show.md'),
    readUiDoc('examples/components/hide-show/overview/index.html'),
    readUiDoc('examples/components/hide-show/initial-hidden/index.html'),
    readUiDoc('examples/components/hide-show/toggle/index.html'),
    readUiDoc('examples/components/hide-show/cancel/index.html'),
    readUiDoc('examples/components/hide-show/cancel/index.js'),
  ]);

  assert.match(page, /data-action/);
  assert.match(page, /скрытие задаёт нативный атрибут `hidden`/i);
  assert.match(overview, /data-content/);
  assert.match(hidden, /data-state="hidden"/);
  assert.match(toggle, /data-action="toggle"/);
  // The cancellable change event is shown running, not only described.
  assert.match(cancel, /data-hide-show-cancel-demo/);
  assert.match(cancelScript, /addEventListener\('sf-hide-show:change'[\s\S]*event\.preventDefault\(\)/);
  assert.doesNotMatch(`${overview}${hidden}${toggle}${cancel}`, /style=/);
});
