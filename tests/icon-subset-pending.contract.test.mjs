import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The icons stylesheet declares the full Material Symbols font, and a browser
// fetches a declared font for any text set in it, an icon at font-size 0
// included: every first visit paid 409 KB for a font the subset replaced. The
// core runtime marks the root while the subset is on its way, the stylesheet
// sets icons in the subset family meanwhile, and the Loader lifts the mark on
// every path that ends with a font that draws them.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('the core runtime marks the root while the subset font is pending, with a timer', () => {
  const source = read('src/core/js/index.js');
  assert.match(source, /setAttribute\('data-sf-icons', 'subset-pending'\)/u);
  assert.match(source, /SF_BOOT_CONFIG\?\.icons\?\.enabled/u, 'a page with the subset off is not marked');
  assert.match(source, /setTimeout\(\(\) => \{\s*if \(root\.getAttribute\('data-sf-icons'\) === 'subset-pending'\)/u);
});

test('while pending, icons are set in the subset family and draw nothing', () => {
  const source = read('src/component/icons/scss/_css__icons.scss');
  const match = source.match(/:root\[data-sf-icons='subset-pending'\] & \{([^}]*)\}/u);
  assert.ok(match, 'the pending rule is declared');
  assert.match(match[1], /--sf-icon--font-family: 'Material Symbols Outlined Subset'/u);
  assert.match(match[1], /-webkit-text-fill-color: transparent/u);
  assert.match(match[1], /overflow: hidden/u);
});

test('the Loader lifts the mark when the subset, a cached manifest or the fallback is in place', () => {
  const source = read('src/core/js/iconSubsetRuntime.js');
  assert.equal(source.match(/this\.liftIconSubsetPending\(\);/gu)?.length, 3);
  const fallback = source.slice(source.indexOf('prototype.applyIconFontFallback = '));
  assert.match(fallback.slice(0, fallback.indexOf('};')), /this\.liftIconSubsetPending\(\)/u);
  const family = source.slice(source.indexOf('prototype.loadIconSubsetFamily = '));
  assert.match(family.slice(0, family.indexOf('return true;')), /this\.liftIconSubsetPending\(\)/u);
});

test('the core runtime opens the connection to the subset host before the request', () => {
  const source = read('src/core/js/index.js');
  assert.match(source, /link\.rel = 'preconnect';/u);
  assert.match(source, /link\.crossOrigin = 'anonymous';/u, 'fetch and font are anonymous CORS requests');
  assert.match(source, /SF_BOOT_CONFIG\?\.icons\?\.subsetHost/u, 'the configured host is the one preconnected');
});
