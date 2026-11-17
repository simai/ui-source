import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Owner decision C260 (2026-11-16): when «Повторить» does not fit a narrow
// failed row it becomes the icon alone with «Повторить» in its tooltip
// instead of moving under the text (C88), so every row of a list is one
// height; the same in the Smart row and the class row sf-file-upload draws.
// Row-rung (C103): «Повторить» stands on the rung of the icon buttons beside
// it -- it was the low button, 32 beside 40.
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('C260: the Smart row draws «Повторить» with words and as the icon alone, both on the rung of their neighbours', async () => {
  const template = await read('src/smart/file-preview/js/templates/default.js');
  const retry = template.slice(template.indexOf('class="sf-file-preview-retry"'), template.indexOf('</sf-button>', template.indexOf('class="sf-file-preview-retry"')));
  assert.ok(retry.length > 0);
  assert.doesNotMatch(retry, /height="low"/u, 'the retry button is not the low one');
  assert.match(retry, /size=\$\{size\}/u, 'the retry button takes the size of the icon actions');
  assert.match(template, /\$\{renderRetryIcon\(context, size\)\}/u);
  const icon = template.slice(template.indexOf('function renderRetryIcon'), template.indexOf('// A file name breaks'));
  assert.match(icon, /class="sf-file-preview-retry-icon sf-tooltip-anchor"/u);
  assert.match(icon, /sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--primary sf-icon-button--size-\$\{size\}/u);
  assert.match(icon, /data-action="retry"/u);
  assert.match(icon, /data-tooltip=""/u);
  assert.match(icon, /aria-label=\$\{context\.words\.retryLabel\}/u);
  assert.match(icon, /@click=\$\{context\.onRetry\}/u);
  assert.match(icon, /<span class="sf-tooltip-text">\$\{context\.words\.retry\}<\/span>/u);
  const manifest = JSON.parse(await read('src/smart/file-preview/smart.manifest.json'));
  assert.ok(manifest.composition.uses.includes('component.tooltip'), 'the tooltip sheet and controller come with the row');
});

test('C260: the class row of sf-file-upload holds the same two, the low button is gone', async () => {
  const source = await read('src/component/file-upload/js/_file_upload.js');
  const draw = source.slice(source.indexOf('function createRetryIcon'), source.indexOf('function renderFileUploadItems'));
  assert.doesNotMatch(draw, /sf-button--height-low/u);
  assert.match(draw, /actions\.append\(retryHost, createRetryIcon\(row\.retryText\)\)/u);
  assert.match(draw, /anchor\.className = 'sf-file-preview-retry-icon sf-tooltip-anchor'/u);
  assert.match(draw, /sf-icon-button sf-icon-button--icon sf-icon-button--ghost sf-icon-button--primary sf-icon-button--size-1'/u);
  assert.match(draw, /button\.dataset\.tooltip = ''/u);
});

test('C260: the sheet shows the words in a wide row and the icon alone below the container step g2; nothing goes under the text', async () => {
  const css = await read('src/component/file-preview/scss/_css__file_preview.scss');
  assert.match(css, /\.sf-file-preview \.sf-file-preview-retry-icon \{\s*display: none;\s*\}/u);
  const narrow = css.slice(css.indexOf('@container (max-width: #{mq.container-step(g2)})'));
  const block = narrow.slice(0, narrow.indexOf('\n  }\n') + 4);
  assert.match(block, /\.sf-file-preview-retry > button \{\s*display: none;/u);
  assert.match(block, /\.sf-file-preview-retry-icon \{\s*display: inline-flex;/u);
  assert.doesNotMatch(block, /grid-row: 2|margin-inline-start/u, 'the words no longer move under the text (C88 layout retired)');
});
