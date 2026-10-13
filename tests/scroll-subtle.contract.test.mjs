import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const utilityPath = 'src/utility/scroll-subtle/default/scss/_sf_css__scroll_subtle.scss';

test('scroll-subtle preserves native sizing and interaction states', () => {
  const source = read(utilityPath);

  assert.match(source, /\.scroll-subtle\s*\{/);
  assert.match(source, /scrollbar-gutter:\s*auto/);
  assert.match(source, /scrollbar-width:\s*thin/);
  assert.match(source, /scrollbar-color:/);
  assert.match(source, /&:hover/);
  assert.match(source, /&:focus-within/);
  assert.match(source, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(source, /scrollbar-color:\s*auto/);
  assert.doesNotMatch(source, /scrollbar-width:\s*none/);
  assert.doesNotMatch(source, /scrollbar-gutter:\s*stable/);
  assert.doesNotMatch(source, /setTimeout|setInterval|transition:/);
});

test('scroll-subtle exposes theme-relative semantic thumb tokens', () => {
  const source = read(utilityPath);

  assert.match(source, /--sf-scroll-thumb-subtle:/);
  assert.match(source, /--sf-scroll-thumb-subtle-interactive:/);
  assert.match(source, /var\(--sf-on-surface\)\s*10%/);
  assert.match(source, /var\(--sf-on-surface\)\s*20%/);
  assert.match(source, /--sf-scroll-bg-track:\s*var\(--sf-transparent\)/);
});

test('full utility and RuleLoader entrypoints include scroll-subtle', () => {
  assert.match(
    read('src/core/utility-full.js'),
    /utility\/scroll-subtle\/default\/index\.scss/,
  );
  assert.match(
    read('src/core/js/rule.src.js'),
    /utility\/scroll-subtle\/default\/rule\.js/,
  );

  const sandbox = {SF: {RuleLoader: {}}};
  vm.runInNewContext(read('src/utility/scroll-subtle/default/rule.js'), sandbox);
  const rule = sandbox.SF.RuleLoader['scroll-subtle/default'];

  assert.equal(rule.test('scroll-subtle'), true);
  assert.equal(rule.test('overflow-auto scroll-subtle'), false);
  assert.equal(rule.test('overflow-auto scroll-hover'), false);
});

test('legacy scroll-hover remains byte-identical', () => {
  const source = read('src/utility/scroll-hover/default/scss/_sf_css__scroll_hover.scss');
  const digest = crypto.createHash('sha256').update(source).digest('hex');

  assert.equal(digest, 'c42128720fe544b1cb1ee231417a9f34a96e28ad0a2016e5b2edec5ecf407f5a');
});
