import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {URL} from 'node:url';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Content Divider has static horizontal and vertical boundary contracts', async () => {
  const css = await read('src/component/contentDivider/scss/_css__contentDivider.scss');

  assert.match(css, /\.sf-divider-horizontal:empty/);
  assert.match(css, /\.sf-divider-horizontal:not\(:empty\)::before/);
  assert.match(css, /\.sf-divider-horizontal:not\(:empty\)::after/);
  assert.match(css, /\.sf-divider-vertical/);
  assert.match(css, /--sf-divider--thickness: var\(--sf-px\)/);
  assert.match(css, /background-color: var\(--sf-outline-variant\)/);
});

test('Content Divider labels use body roles and action paint stays composable', async () => {
  const css = await read('src/component/contentDivider/scss/_css__contentDivider.scss');

  assert.match(css, /--sf-divider-content--font-size: var\(--sf-text--size\)/);
  assert.match(css, /--sf-divider-content--line-height: var\(--sf-text--height\)/);
  assert.match(css, /\.sf-divider-content--small[\s\S]*--sf-text-small--size/);
  assert.match(css, /\.sf-divider-buttons[\s\S]*gap: var\(--sf-divider-buttons--gap\)/);
  assert.match(css, /\.sf-divider-button:focus-visible/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /(?:\d*\.)?\d+(?:px|rem)/);
});

test('Content Divider requires CSS only and uses a bounded Loader signature', async () => {
  const rule = await read('src/component/contentDivider/rule.js');

  assert.match(rule, /regex: \/\(\?:\^\|\["'/);
  assert.match(rule, /js: false/);
  assert.doesNotMatch(rule, /regex: \/sf-divider\//);
});

test('Content Divider documentation uses source-owned semantics and controls', {
  skip: !process.env.UI_DOC_ROOT,
}, async () => {
  const root = process.env.UI_DOC_ROOT;
  const overview = await readFile(path.join(
    root,
    'examples/components/content-divider/overview/index.html',
  ), 'utf8');
  const content = await readFile(path.join(
    root,
    'examples/components/content-divider/content/index.html',
  ), 'utf8');
  const actions = await readFile(path.join(
    root,
    'examples/components/content-divider/buttons/index.html',
  ), 'utf8');
  const vertical = await readFile(path.join(
    root,
    'examples/components/content-divider/orientation/index.html',
  ), 'utf8');

  assert.match(overview, /<hr class="sf-divider sf-divider-horizontal">/);
  assert.match(content, /role="separator" aria-label="или"/);
  assert.match(content, /aria-hidden="true">или<\/span>/);
  // sf-divider-button is legacy paint kept for compatibility (see the source
  // comment); new markup composes the regular Button and Icon Button.
  assert.match(actions, /class="sf-button /);
  assert.match(actions, /class="sf-icon-button /);
  assert.doesNotMatch(actions, /sf-divider-button(?:\s|"|--)/);
  assert.match(vertical, /aria-orientation="vertical"/);
});
