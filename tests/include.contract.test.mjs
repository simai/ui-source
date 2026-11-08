import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-include (2026-11-02), the successor of the retired class units ajax,
// ajaxload and lazy-load: what its source promises, held without a browser.
// The behaviour is probed on the built bytes by tests/browser/include.browser.mjs
// and src/smart/include/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/include/component.json');
const source = read('src/smart/include/index.js');

test('the manifest: a leaf that fetches, two facts and the refresh action', () => {
  assert.equal(manifest.tag, 'sf-include');
  assert.equal(manifest.version, '1.0.3');
  assert.deepEqual(manifest['side-effects'], ['network']);
  assert.deepEqual(Object.keys(manifest.settings), ['src', 'load', 'lines']);
  assert.deepEqual(manifest.settings.load.values, ['now', 'view']);
  assert.equal(manifest.settings.load.default, 'now');
  assert.deepEqual(Object.keys(manifest.events), ['loaded', 'load-failed']);
  for (const event of Object.values(manifest.events)) assert.equal(event['own-verb'], true);
  assert.deepEqual(Object.keys(manifest.actions), ['refresh']);
  assert.deepEqual(Object.keys(manifest.slots), ['placeholder']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-skeleton', 'cl-button', 'cl-icon']);
});

test('sf-fragment stays the core boundary\'s name', () => {
  // The interface-fragment boundary defines sf-fragment on every page; a
  // second component of that name would be refused (§21.4).
  assert.match(read('src/core/js/composition/fragments.mjs'), /registry\.define\('sf-fragment'/u);
  assert.match(manifest['x-decisions'][0], /^name: sf-include, not sf-fragment/u);
});

test('the words are the language files\', the same keys in Russian and English', () => {
  const ru = json('src/smart/include/lang/ru.json');
  const en = json('src/smart/include/lang/en.json');
  assert.deepEqual(Object.keys(ru.runtime).sort(), ['failed', 'retry']);
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.deepEqual(Object.keys(en.events).sort(), Object.keys(manifest.events).sort());
  assert.equal(ru.runtime.retry, 'Повторить');
  assert.equal(en.runtime.retry, 'Retry');
});

test('one request, no polling: fetch on the same origin\'s credentials, one observer 200 px out', () => {
  // The code, not its comments (which say what the old ajaxload did).
  const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /setInterval|BX\.|XMLHttpRequest/u);
  assert.match(source, /globalThis\.fetch\(src, \{credentials: 'same-origin'/u);
  assert.match(source, /export const VIEW_MARGIN = '200px'/u);
  assert.match(source, /rootMargin: `\$\{VIEW_MARGIN\} 0px`/u);
  // A newer load aborts the older one; the instance's scope aborts it on removal.
  assert.match(source, /this\._request\?\.abort\(\)/u);
  assert.match(source, /scope\.addEventListener\('abort', end/u);
});

test('the part is drawn without its scripts, and the Loader is asked for its Smart tags', () => {
  assert.match(source, /script\.remove\(\)/u);
  assert.match(source, /lower\.startsWith\('on'\)/u);
  assert.match(source, /ensureSmartElementLoaded\(tag\)/u);
  assert.match(read('src/smart/include/docs.md'), /\*\*Scripts are not run\.\*\*/u);
});

test('Core knows the rule, and the conformance probe covers the four behaviours', () => {
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/include\/rule\.js';/u);
  const probe = json('src/smart/include/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), [
    'p1-load-now', 'p2-load-view', 'p3-own-placeholder', 'p4-error', 'p5-retry', 'p6-components-start', 'p7-src-change', 'p8-english',
  ]);
});
