import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/component/tabs/scss/_css__tabs.scss', import.meta.url), 'utf8');
const smartCss = await readFile(new URL('../src/smart/tabs/js/templates/default.css', import.meta.url), 'utf8');

test('Tabs skin selectors reach only their direct header, never a nested panel header', () => {
  assert.doesNotMatch(css, /\.sf-tabs(?:\.sf-tabs--[\w-]+)? \.sf-tabs-top/);
  assert.doesNotMatch(css, /\.sf-tabs--[\w-]+ \.sf-tabs-top/);
  for (const type of ['pills', 'underline', 'full', 'vertical']) assert.ok(css.includes(`.sf-tabs--${type} > .sf-tabs-top-container`));
  assert.doesNotMatch(smartCss, /sf-tabs \.sf-tabs/);
  assert.match(smartCss, /sf-tabs > \.sf-tabs--full > \.sf-tabs-top-container > \.sf-tabs-top/);
});

test('Tabs labels can shrink and wrap without clipping text or shrinking glyphs', () => {
  assert.match(css, /min-inline-size: 0/);
  assert.match(css, /max-inline-size: 100%/);
  assert.match(css, /white-space: normal/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /scroll-behavior: auto/);
  assert.match(css, /flex: 1 0 0;\n\s+min-inline-size: max-content/);
  assert.match(css, /\.sf-icon \{\n\s+flex-shrink: 0/);
  assert.doesNotMatch(css, /text-overflow: ellipsis|overflow: hidden/);
});

test('full Tabs join mixed ordinary and Smart actions without a double seam', () => {
  assert.match(
    css,
    /> :is\(\.sf-button, \.sf-icon-button\) \+ :is\(\.sf-button, \.sf-icon-button\)/,
  );
  assert.match(
    smartCss,
    /> :is\(sf-button, sf-icon-button\):not\(:first-child\) > :is\(\.sf-button, \.sf-icon-button\)/,
  );
  assert.match(
    smartCss,
    /> \[role="tab"\]:not\(:first-child\) :is\(\.sf-button, \.sf-icon-button\)/,
  );
});
