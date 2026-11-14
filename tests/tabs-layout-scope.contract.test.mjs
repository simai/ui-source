import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/component/tabs/scss/_css__tabs.scss', import.meta.url), 'utf8');
const template = await readFile(new URL('../src/smart/tabs/js/templates/default.js', import.meta.url), 'utf8');

test('Tabs skin selectors reach only their direct header, never a nested panel header', () => {
  assert.doesNotMatch(css, /\.sf-tabs(?:\.sf-tabs--[\w-]+)? \.sf-tabs-top/);
  assert.doesNotMatch(css, /\.sf-tabs--[\w-]+ \.sf-tabs-top/);
  for (const type of ['pills', 'underline', 'full', 'vertical']) assert.ok(css.includes(`.sf-tabs--${type} > .sf-tabs-top-container`));
  // sf-tabs has no Smart sheet (its rule has no css, the Loader never asks
  // for one): the full row's single seam around wrapped buttons lives here.
  assert.doesNotMatch(template, /import '\.\/default\.css'/);
  assert.match(css, /\.sf-tabs\.sf-tabs--full > \.sf-tabs-top-container > \.sf-tabs-top > :not\(:first-child\) > :is\(\.sf-button, \.sf-icon-button\)/);
});

test('Tabs labels can shrink and wrap without clipping text or shrinking glyphs', () => {
  assert.match(css, /min-inline-size: 0/);
  assert.match(css, /max-inline-size: 100%/);
  assert.match(css, /white-space: normal/);
  // A word breaks only when it alone is wider than the tab (docs precheck
  // TB-02): break-word; anywhere let the vertical list shrink mid-word.
  assert.match(css, /overflow-wrap: break-word/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /scroll-behavior: auto/);
  assert.match(css, /flex: 1 0 0;\n\s+min-inline-size: max-content/);
  assert.match(css, /\.sf-icon \{\n\s+flex-shrink: 0/);
  // Only the current tab left alone in a row narrower than it is shortened
  // (C54 return D1, contract call 2026-11-11): nothing else clips its words.
  const squeezed = /\.sf-tabs-top > \.sf-tabs-squeezed \.sf-button-text-container \{[^}]*\}/;
  assert.match(css, squeezed);
  assert.match(css.match(squeezed)[0], /text-overflow: ellipsis/);
  assert.doesNotMatch(css.replace(squeezed, ''), /text-overflow: ellipsis|overflow: hidden/);
});

test('full Tabs join mixed ordinary and Smart actions without a double seam', () => {
  assert.match(
    css,
    /> :is\(\.sf-button, \.sf-icon-button\) \+ :is\(\.sf-button, \.sf-icon-button\)/,
  );
  // The Smart buttons sit in their hosts (display: contents) and a page's
  // own component in span[role=tab]: the class sheet joins those too (the
  // rule was in sf-tabs' Smart sheet, which never loads).
  assert.match(
    css,
    /\.sf-tabs-top > :not\(:first-child\) > :is\(\.sf-button, \.sf-icon-button\)/,
  );
  assert.match(
    css,
    /\.sf-tabs-top > span\[role="tab"\]:not\(:first-child\) :is\(\.sf-button, \.sf-icon-button\)/,
  );
});
