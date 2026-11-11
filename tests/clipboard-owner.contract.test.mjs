import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync(new URL('../src/component/clipboard/js/index.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/component/clipboard/scss/_sf_copy.scss', import.meta.url), 'utf8');
const rule = fs.readFileSync(new URL('../src/component/clipboard/rule.js', import.meta.url), 'utf8');
// The copy and its fallback are core's (core/js/clipboard.js), shared with
// sf-copy-button (reuse audit 2026-11-02, finding 11).
const core = fs.readFileSync(new URL('../src/core/js/clipboard.js', import.meta.url), 'utf8');

test('ordinary and constructed Copy share one lifecycle owner', () => {
  // The attribute route (decision C48) and the deprecated class route.
  assert.match(js, /const ROUTE_SELECTOR = '\[data-sf-copy\], \[data-sf-copy-target\]'/);
  assert.match(js, /const LEGACY_SELECTOR = '\.sf-clipboard, \.btn-clipboard'/);
  assert.match(js, /const COPY_SELECTOR = `\$\{ROUTE_SELECTOR\}, \$\{LEGACY_SELECTOR\}`/);
  assert.match(js, /initCopyTree/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /init\(\) \{ bindCopyButton\(this\.html\); \}/);
  assert.match(js, /destroyInternal\(\) \{ unbindCopyButton\(this\.html\); \}/);
});

test('Clipboard loads only its visual primitives while Highlight owns the reverse dependency', () => {
  assert.match(rule, /name: 'buttons'/);
  assert.match(rule, /name: 'icon-buttons'/);
  assert.match(rule, /name: 'icons'/);
  assert.match(rule, /name: 'tooltip'/);
  assert.match(rule, /data-sf-copy\|data-sf-copy-target/);
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
  assert.match(js, /copyText\(text, \{ document: documentRef \}\)/);
  assert.match(core, /navigator\?\.clipboard\?\.writeText/);
  assert.match(core, /documentRef\.execCommand\('copy'\)/);
  assert.match(js, /sf:copy-success/);
  assert.match(js, /sf:copy-error/);
  assert.match(js, /NotAllowedError'[\s\S]*copy_denied/);
  assert.match(js, /detail: \{ code \}/);
  // The pending mark goes with the phase (the helper's finally ends the copy).
  assert.match(js, /if \(phase === 'pending'\) \{[\s\S]*?return;\n  \}\n  button\.removeAttribute\('aria-disabled'\)/);
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
  // No layout shift (decision C48): the status takes no room.
  assert.match(css, /\.sf-clipboard-status,\n  \.sf-clipboard-holder \{[^}]*clip-path: inset\(50%\);[^}]*position: absolute;/);
  assert.doesNotMatch(css, /outline:\s*none\s*!important|\.3s/);
});

test('the attribute route gives sf-button-copy\'s feedback through the core helper (decision C48)', () => {
  assert.match(js, /createCopyFeedback, readCopyText/);
  assert.match(js, /from '\.\.\/\.\.\/\.\.\/core\/js\/copy-feedback\.js'/);
  // The name is the Framework tooltip, not the browser's title.
  assert.match(js, /button\.removeAttribute\('title'\)/);
  assert.match(js, /button\.setAttribute\('data-tooltip', surface\.id\)/);
  // The refusal's words stand above the button, placed over the page.
  assert.match(js, /positioning\(\)\.anchor\(button, controller\.result, \{ side: 'block-start'/);
  // The legacy names are noted, with their dates.
  assert.match(js, /noteDeprecated\(\{ component, kind: 'class', from: name, to: 'data-sf-copy', \.\.\.DEPRECATED \}\)/);
  assert.match(js, /remove_after: '2027-01-01'/);
  // One press handler for the document: an sf-button's inner button may be drawn again.
  assert.match(js, /document\.addEventListener\('click', onDocumentClick\)/);
});
