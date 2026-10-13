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

test('Doc is a presentation-only owner with bounded Loader discovery', async () => {
  const [runtime, rule] = await Promise.all([
    read('src/component/doc/js/_doc.js'),
    read('src/component/doc/rule.js'),
  ]);

  assert.doesNotMatch(runtime, /querySelector|addEventListener|innerHTML|preventDefault/);
  assert.match(rule, /sf-doc-/);
  assert.match(rule, /js: false/);
  assert.doesNotMatch(rule, /language-|btn-clipboard|bd-content|bd-example/);
});

test('Doc surfaces use semantic typography, spacing, color and radius contracts', async () => {
  const css = await read('src/component/doc/scss/_sf_css_doc.scss');

  assert.match(css, /--sf-text-large--size/);
  assert.match(css, /--sf-text-large--height/);
  assert.match(css, /--sf-radius--surface/);
  assert.match(css, /--sf-on-surface-variant/);
  assert.match(css, /--sf-on-surface-inverse/);
  assert.match(css, /--sf-space-2/);
  assert.match(css, /\.sf-doc-pair/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /(?:^|[\s:])(?:5\.66|16|\.25)px\b/m);
  assert.doesNotMatch(css, /hsla?\(|#[0-9a-f]{3,8}\b/i);
});

test('Doc keeps Highlight and Clipboard ownership outside its source', async () => {
  const [css, runtime] = await Promise.all([
    read('src/component/doc/scss/_sf_css_doc.scss'),
    read('src/component/doc/js/_doc.js'),
  ]);

  assert.doesNotMatch(css, /\.btn-clipboard|\.clipboard\s*\{/);
  assert.doesNotMatch(css, /\.sf-code-surface\s*\{/);
  assert.doesNotMatch(runtime, /Clipboard|progress-bar|modal|checkbox/);
  assert.match(css, /\.sf-doc-source/);
});

test('Doc documentation explains ownership and uses canonical examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, lead, pair, patterns] = await Promise.all([
    readUiDoc('content/ru/components/content/doc.md'),
    readUiDoc('examples/components/doc/overview/index.html'),
    readUiDoc('examples/components/doc/lead/index.html'),
    readUiDoc('examples/components/doc/source-pair/index.html'),
    readUiDoc('examples/components/doc/patterns/index.html'),
  ]);

  // Doc has no runtime: highlighting belongs to Highlight, copying to Clipboard.
  assert.match(page, /У компонента нет своего JavaScript/);
  assert.match(page, /подсветку кода выполняет\s+\[Highlight\]\([^)]+\), копирование —\s+\[Clipboard\]/);
  assert.match(overview, /class="sf-doc-example/);
  assert.match(lead, /class="sf-doc-lead\b/);
  assert.match(pair, /class="sf-doc-pair"/);
  assert.match(pair, /<div class="sf-doc-example">[\s\S]*?<\/div>\s*<pre class="sf-doc-source">/);
  assert.match(patterns, /sf-doc-checkerboard/);
  assert.match(patterns, /sf-doc-stripes/);
  for (const example of [overview, lead, pair, patterns]) {
    assert.doesNotMatch(example, /style=/);
    assert.doesNotMatch(example, /class="(?:example|source|t-lead)\b/);
  }
});
