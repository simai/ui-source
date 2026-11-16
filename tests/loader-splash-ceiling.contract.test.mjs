import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// R078: with the icon host held on a warm profile the splash never lifted.
// The remembered icon font held the window's load, the page scan waited for
// load, so sf-loader-ready never came, and the splash hid only on that event.
// Probe: tests/browser/loader-warm-held-icons.browser.mjs.
// The splash's time limit is gone again (re-acceptance): see the second test.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const body = (source, start) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `${start} is declared`);
  return source.slice(from, source.indexOf('\n};', from));
};

test('the page scan runs once the document is parsed, not at the window load', () => {
  const loader = read('src/core/js/loader.js');
  const parsed = body(loader, 'SFLoaderPlugin.prototype.onDomParsed = ');
  assert.match(parsed, /addEventListener\('DOMContentLoaded'/u);
  assert.doesNotMatch(parsed, /'load'/u);
  const prepare = body(loader, 'SFLoaderPlugin.prototype.prepare = ');
  assert.match(prepare, /this\.onDomParsed\(\(\) => \{/u);
  assert.doesNotMatch(prepare, /this\.onWindowLoad\(/u);
  assert.match(prepare, /this\.searchRegexp\(''\);[\s\S]*this\.endSearch\(\);/u,
    'changes met during the scan are read when it ends');
});

// R216: it also lifts at once when a component draws under it (core-first-paint).
test('the boot splash lifts on sf-loader-ready or a drawn component, with no time limit', () => {
  // A ceiling (1500 ms, an earlier R078 fix) lifted the splash on a slow page
  // at 5.5 s while its controls came in at 9-11 s: an empty page, then a jump.
  // The scan at DOMContentLoaded and the remembered font off the load are
  // what R078 needs.
  const index = read('src/core/js/index.js');
  const mount = index.slice(index.indexOf('const mountPreloader = () => {'), index.indexOf('mountPreloader();'));
  assert.doesNotMatch(mount, /ceiling/u);
});

test('the remembered icon font is fetched off the document load and adopted within the deadline', () => {
  const memory = read('src/core/js/icon-subset-memory.js');
  const apply = memory.slice(memory.indexOf('export function applyRememberedIconSubset'));
  assert.doesNotMatch(apply, /link\.rel = 'preload'/u, 'no preload: it holds the window load');
  assert.match(apply, /fetchApi\.call\(win, new URL\(font\.url\)\.href, \{mode: 'cors', credentials: 'omit'\}\)/u);
  assert.match(apply, /new FontFaceApi\(family, bytes,/u);
  const runtime = read('src/core/js/iconSubsetRuntime.js');
  assert.match(runtime, /const ready = adopted\.sfIconFacesReady;/u);
  assert.match(runtime, /remembered icon subset font not loaded after \$\{deadlineMs\} ms/u);
});
