import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('Highlight uses compact Framework tokens and a transparent code surface', async () => {
  const [defaults, theme] = await Promise.all([
    read('src/component/highlight/scss/_default.scss'),
    read('src/component/highlight/scss/_theme.scss'),
  ]);

  assert.match(
    defaults,
    /&-head\s*\{[\s\S]*padding:\s*var\(--sf-space-1\\\/3\) var\(--sf-space-1\);/,
  );
  assert.match(
    defaults,
    /&-wrap\s*\{[\s\S]*padding:\s*0;[\s\S]*> \.sf-scrollbar__viewport:not\(\[class\*='p-'\]\)\s*\{[\s\S]*padding:\s*var\(--sf-space-1\);/,
  );
  assert.doesNotMatch(
    defaults,
    /&-wrap\s*\{[^}]*padding:\s*0 var\(--sf-space-1\) var\(--sf-space-1\);/s,
  );
  assert.match(theme, /--sf-highlight-background:\s*transparent;/);
  assert.match(
    theme,
    /\.hljs\s*\{[\s\S]*background:\s*var\(--sf-highlight-background\);/,
  );
});

test('Highlight creates an accessible icon-only Clipboard action at size 1/2', async () => {
  const [highlight, clipboard, rule] = await Promise.all([
    read('src/component/highlight/js/index.js'),
    read('src/component/clipboard/js/index.js'),
    read('src/component/highlight/rule.js'),
  ]);

  assert.match(highlight, /sf-text-1\/2/);
  assert.match(highlight, /sf--highlight-wrap sf-scrollbar/);
  assert.match(highlight, /sfScrollbarAxis = 'horizontal'/);
  assert.match(highlight, /sf-scrollbar__viewport/);
  assert.match(highlight, /lineNumbersEnabled\(el\)/);
  assert.match(highlight, /createElement\('button'\)/);
  assert.match(highlight, /sf-icon-button--size-1\/2/);
  assert.match(highlight, /createElement\('span'\)/);
  assert.match(highlight, /icon\.className = 'sf-icon'/);
  assert.match(highlight, /setAttribute\('aria-label', strings\.label\)/);
  assert.doesNotMatch(highlight, /\[!Copy|Math\.random/);
  assert.match(clipboard, /'sf-icon-button'/);
  assert.match(clipboard, /'sf-icon-button--icon'/);
  assert.match(clipboard, /createElement\('sf-icon'\)/);
  assert.match(clipboard, /setAttribute\('icon', 'content_copy'\)/);
  assert.match(clipboard, /setIcon\(button, state === 'success' \? 'check'/);
  assert.doesNotMatch(clipboard, /createElement\('i'\)/);
  assert.match(clipboard, /setAttribute\('aria-label', accessibleLabel\)/);
  assert.match(clipboard, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(rule, /name: 'clipboard'/);
  assert.match(rule, /name: 'icon-buttons'/);
  assert.match(rule, /name: 'icons'/);
  assert.match(rule, /name: 'scrollbar'/);
});
