import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const utilityPath = 'src/utility/scroll-subtle/default/scss/_sf_css__scroll_subtle.scss';

test('scroll-subtle is the quiet look of the one bar, not a platform bar (C208 (1), SB-7)', () => {
  const source = read(utilityPath);

  assert.match(source, /\.scroll-subtle\s*\{/);
  assert.match(source, /scrollbar-gutter:\s*auto/);
  // Chrome 121+ drops the drawn ::-webkit-scrollbar of an element with
  // scrollbar-width or scrollbar-color: neither is set outside forced colours.
  const outsideForced = source.replace(/@media\s*\(forced-colors:\s*active\)\s*\{[\s\S]*$/, '');
  assert.doesNotMatch(outsideForced, /scrollbar-(?:width|color):/);
  assert.match(source, /@supports not selector\(::-webkit-scrollbar\)/);
  assert.match(source, /:is\(:hover, :focus-within\)/);
  assert.match(source, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(source, /scrollbar-color:\s*auto/);
  assert.doesNotMatch(source, /scrollbar-gutter:\s*stable/);
  assert.doesNotMatch(source, /setTimeout|setInterval|transition:/);
});

test('scroll-subtle takes the ink steps of the alpha scale (48 rest, 64 held)', () => {
  const source = read(utilityPath);

  assert.match(source, /var\(--sf-on-surface\) 48%/);
  assert.match(source, /var\(--sf-on-surface\) 64%/);
  assert.doesNotMatch(source, /\s10%|\s20%/);
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

test('scroll-hover keeps the room of the bar and shows only the thumb (C208 (1))', () => {
  const source = read('src/utility/scroll-hover/default/scss/_sf_css__scroll_hover.scss');

  assert.doesNotMatch(source, /scrollbar-(?:width|color):/);
  assert.doesNotMatch(source, /::-webkit-scrollbar\s*\{/);
  assert.match(source, /--sf-scroll-bg-thumb:\s*var\(--sf-transparent\)/);
});
