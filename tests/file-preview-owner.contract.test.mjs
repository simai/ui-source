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

test('File Preview owns its row geometry without utility classes', async () => {
  const css = await read('src/component/file-preview/scss/_css__file_preview.scss');

  assert.match(css, /display: grid/);
  assert.match(css, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
  assert.match(css, /inline-size: 100%/);
  assert.match(css, /min-inline-size: 0/);
  assert.match(css, /\.sf-file-preview-actions[\s\S]*display: inline-flex/);
  assert.doesNotMatch(css, /utility-hint/);
  assert.doesNotMatch(css, /\.sf-file-preview:not\([^}]*:hover/);
});

test('File Preview composes tokens and leaves Icon Button geometry to its owner', async () => {
  const css = await read('src/component/file-preview/scss/_css__file_preview.scss');

  // The public variable first, the token its fallback (standard 1.3.8 §6).
  assert.match(css, /--sf-file-preview-holder--size: var\(--sf-file-preview-holder-size, var\(--sf-ui-2--control-height\)\)/);
  assert.match(css, /--sf-file-preview-holder--radius: var\(--sf-radius--ui\)/);
  assert.match(css, /--sf-file-preview--radius: var\(--sf-file-preview-radius, var\(--sf-radius--ui\)\)/);
  assert.match(css, /--sf-file-preview-name--font-size: var\(--sf-text-size-1\)/);
  assert.match(css, /--sf-file-preview-size--font-size: var\(--sf-text-size-1\\\/2\)/);
  assert.doesNotMatch(css, /\.sf-file-preview \.sf-icon-button\s*\{/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('File Preview supports icon, thumbnail, surface and disabled presentation', async () => {
  const [css, rule] = await Promise.all([
    read('src/component/file-preview/scss/_css__file_preview.scss'),
    read('src/component/file-preview/rule.js'),
  ]);

  assert.match(css, /\.sf-file-preview--surface/);
  assert.match(css, /\.sf-file-preview-thumbnail/);
  assert.match(css, /\.sf-file-preview\.disabled/);
  assert.match(css, /forced-colors: active/);
  assert.match(rule, /css: true/);
  assert.match(rule, /js: false/);
});

test('File Preview documentation uses real Framework-only examples', {
  skip: uiDocRoot === null,
}, async () => {
  const [page, overview, thumbnail, surface, disabled] = await Promise.all([
    readUiDoc('content/ru/components/content/file-preview.md'),
    readUiDoc('examples/components/file-preview/overview/index.html'),
    readUiDoc('examples/components/file-preview/thumbnail/index.html'),
    readUiDoc('examples/components/file-preview/surface/index.html'),
    readUiDoc('examples/components/file-preview/disabled/index.html'),
  ]);

  // Upload progress belongs to File Upload, not to File Preview.
  assert.match(page, /ход загрузки\s+и повторную отправку показывает \[загрузка файлов\]/);
  assert.match(thumbnail, /sf-file-preview-thumbnail/);
  assert.match(surface, /sf-file-preview--surface/);
  assert.match(disabled, /aria-disabled="true"/);
  // The component lays out its own parts; only the sample wrappers that pair a
  // preview with its class label may use layout utilities.
  assert.doesNotMatch(`${overview}${thumbnail}${surface}${disabled}`, /class="sf-file-preview[^"]*\b(?:flex|flex-row|flex-col|flex-nowrap|items-center|flex-1)\b/);
  assert.doesNotMatch(`${overview}${thumbnail}${surface}${disabled}`, /style=/);
});
