import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync(new URL('../src/component/clipboard/js/index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/component/clipboard/scss/_sf_copy.scss', import.meta.url), 'utf8');
const rule = fs.readFileSync(new URL('../src/component/clipboard/rule.js', import.meta.url), 'utf8');

test('ordinary and constructed Copy share one lifecycle owner', () => {
  assert.match(js, /const COPY_SELECTOR = '\.sf-clipboard, \.btn-clipboard'/);
  assert.match(js, /initCopyTree/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /init\(\) \{ bindCopyButton\(this\.html\); \}/);
  assert.match(js, /destroyInternal\(\) \{ unbindCopyButton\(this\.html\); \}/);
});

test('Clipboard loads only its visual primitives while Highlight owns the reverse dependency', () => {
  assert.match(rule, /name: 'buttons'/);
  assert.match(rule, /name: 'icon-buttons'/);
  assert.match(rule, /name: 'icons'/);
  assert.doesNotMatch(rule, /name: 'doc'|name: 'highlight'/);
});

test('constructor inputs are bounded to existing Button and Icon Button variants', () => {
  assert.match(js, /const COPY_SIZES = new Set\(\['1\/3', '1\/2', '1', '2', '3'\]\)/);
  assert.match(js, /const COPY_TYPES = new Set\(\['default', 'tonal', 'outline', 'link'\]\)/);
  assert.match(js, /const COPY_SCHEMES = new Set\(\['primary', 'secondary', 'on-surface'\]\)/);
  assert.match(js, /normalizeChoice\(size, COPY_SIZES, '1'\)/);
  assert.match(js, /'flex',[\s\S]*'items-cross-center'/);
});

test('copy source resolution is exact and ambiguity fails closed', () => {
  assert.match(js, /ambiguous_source/);
  assert.match(js, /missing_target/);
  assert.match(js, /missing_source/);
  assert.match(js, /empty_source/);
  assert.match(js, /\^#\[A-Za-z\]/);
});

test('native clipboard has a checked fallback and explicit result events', () => {
  assert.match(js, /navigator\.clipboard\?\.writeText/);
  assert.match(js, /documentRef\.execCommand\('copy'\)/);
  assert.match(js, /sf:copy-success/);
  assert.match(js, /sf:copy-error/);
  assert.match(js, /NotAllowedError'[\s\S]*copy_denied/);
  assert.match(js, /detail: \{ code \}/);
  assert.match(js, /finally[\s\S]*removeAttribute\('aria-disabled'\)/);
});

test('feedback uses a stable status region without changing action name', () => {
  assert.match(js, /setAttribute\('role', 'status'\)/);
  assert.match(js, /setAttribute\('aria-live', 'polite'\)/);
  assert.doesNotMatch(js, /button\.setAttribute\('aria-label'.*done/);
});

test('Clipboard presentation follows token and focus contracts', () => {
  assert.match(css, /var\(--sf-radius--ui\)/);
  assert.match(css, /var\(--sf-ui-1--control-height\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.sf-clipboard--overlay/);
  assert.match(css, /\.sf-clipboard-status:empty/);
  assert.doesNotMatch(css, /outline:\s*none\s*!important|\.3s/);
});
