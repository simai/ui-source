import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

// The former bundles of six renamed folders (standard simai.smart-component
// 1.3.8 §3, §21): smart/inputs, buttons, icon-buttons, icons, badges and tags.
// Each carries no element of its own -- a second copy of the element would be
// a second class for one tag -- so a page that links the old path by hand
// instead of through the Loader gets its element only from the forward: the
// stub notes the old path once in SF.deprecations and adds the new folder's
// bundle, smart/<new>/js/<new>.js (the path the build writes), until
// 2026-12-01 (change journal path-smart-<old>-to-<new>). The browser half is
// tests/browser/display-former-names.browser.mjs and
// tests/browser/input-former-names.browser.mjs, on the built bytes.

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const journal = JSON.parse(read('contracts/changes/journal.json'));

const RENAMES = [
  {old: 'inputs', name: 'input', tag: 'sf-input'},
  {old: 'buttons', name: 'button', tag: 'sf-button'},
  {old: 'icon-buttons', name: 'icon-button', tag: 'sf-icon-button'},
  {old: 'icons', name: 'icon', tag: 'sf-icon'},
  {old: 'badges', name: 'badge', tag: 'sf-badge'},
  {old: 'tags', name: 'tag', tag: 'sf-tag'},
];

// Runs a stub's source as its bundle would, its imports given: the
// deprecation note recorded, a document and a custom-element registry faked.
function run(old, {current = null, scripts = [], defined = false, globals = {}} = {}) {
  const source = read(`src/smart/${old}/index.js`).replace(/^import [^;]*;\n/gmu, '');
  const notes = [];
  const added = [];
  const element = (src) => ({src, dataset: {}});
  const head = {appendChild: (node) => { added.push(node); }};
  const document = {
    currentScript: current ? {...element(current), parentNode: head} : null,
    head,
    documentElement: head,
    querySelectorAll: (selector) => (selector === 'script[src]' ? [...scripts.map(element), ...added] : []),
    createElement: (name) => (name === 'script' ? element('') : {}),
  };
  const context = {
    document,
    customElements: {get: () => (defined ? class {} : undefined)},
    // Copied into this realm: a vm context's objects have its own Object.
    noteDeprecated: (note) => notes.push({...note}),
    ...globals,
  };
  vm.runInNewContext(source, context);
  return {notes, added};
}

for (const {old, name, tag} of RENAMES) {
  test(`smart/${old}/: a classic script forwards to smart/${name}/js/${name}.js and notes the old path`, () => {
    const {notes, added} = run(old, {current: `https://example.test/distr/smart/${old}/js/${old}.js?v=1`});
    assert.deepEqual(added.map((script) => [script.src, script.dataset.sfForwardedFrom]), [
      [`https://example.test/distr/smart/${name}/js/${name}.js?v=1`, `smart/${old}/`],
    ]);
    assert.deepEqual(notes, [{
      component: tag, kind: 'path', from: `smart/${old}/`, to: `smart/${name}/`, tag, since: '2026-10-27', remove_after: '2026-12-01',
    }]);
  });

  test(`smart/${old}/: the minified path forwards to the minified bundle`, () => {
    const {added} = run(old, {current: `/distr/smart/${old}/js/${old}.min.js`});
    assert.deepEqual(added.map((script) => script.src), [`/distr/smart/${name}/js/${name}.min.js`]);
  });

  test(`smart/${old}/: a module script, without currentScript, finds its own element`, () => {
    const {added} = run(old, {scripts: ['/distr/core/js/core.js', `/distr/smart/${old}/js/${old}.js`]});
    assert.deepEqual(added.map((script) => script.src), [`/distr/smart/${name}/js/${name}.js`]);
  });

  test(`smart/${old}/: bundled into a page script, the Loader's smart root is the way`, () => {
    const {added} = run(old, {current: '/assets/app.js', globals: {sfSmartPath: '/distr/'}});
    assert.deepEqual(added.map((script) => script.src), [`/distr/smart/${name}/js/${name}.js`]);
  });

  test(`smart/${old}/: nothing is added when ${tag} is defined or its bundle is on the page`, () => {
    const defined = run(old, {current: `/distr/smart/${old}/js/${old}.js`, defined: true});
    assert.deepEqual(defined.added, []);
    assert.equal(defined.notes.length, 1, 'the old path is still noted');
    const present = run(old, {current: `/distr/smart/${old}/js/${old}.js`, scripts: [`/distr/smart/${name}/js/${name}.min.js`]});
    assert.deepEqual(present.added, []);
  });

  test(`smart/${old}/: defines no element and is in the change journal`, () => {
    const source = read(`src/smart/${old}/index.js`);
    assert.doesNotMatch(source, /customElements\.define/u);
    const record = journal.records.find((one) => one.id === `path-smart-${old}-to-${name}`);
    assert.ok(record, `path-smart-${old}-to-${name} is recorded`);
    assert.equal(record.remove_after, '2026-12-01');
    const path = record.items.find((item) => item.component === tag);
    assert.deepEqual([path.from, path.to], [`smart/${old}/js/${old}.js`, `smart/${name}/js/${name}.js`]);
  });
}
