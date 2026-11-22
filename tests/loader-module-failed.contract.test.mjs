// GB17 L2: a public signal that an element's script failed to load
// (sf-view-table read SF.__internal.pendingTags.settled; ui-control 86db6b49).
// The browser probe tests/browser/loader-module-failed.browser.mjs drives it
// through the real Loader; this holds the source, the contract and the words.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installPendingTags} from '../src/core/js/pending-tags.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const loader = read('src/core/js/loader.js');

test('one report per failed rule: the tags fail, the window hears sf-loader-module-failed', () => {
  assert.match(loader, /SFLoaderPlugin\.prototype\.reportModuleFailed = function \(pluginName\)/u);
  assert.match(loader, /new win\.CustomEvent\('sf-loader-module-failed', \{\n\s+detail: \{rule: pluginName, tags, package: rule\?\.package \|\| null\},/u);
  // addToMissingFiles(js) and the stored-missing skip both report.
  assert.match(loader, /if \(type === 'js'\) \{\n\s+\/\/ The rule's tags will not be defined: nothing waits for them \(D2\)\.\n\s+this\.reportModuleFailed\(pluginName\);/u);
  assert.match(loader, /\} else if \(this\.notFoundFiles\[missKey\]\?\.js\) \{[\s\S]{0,200}this\.reportModuleFailed\(pluginName\);/u);
  // Kept off the Loader object (its own names are a public list).
  assert.match(loader, /const reportedModuleFailures = new WeakMap\(\);/u);
});

test('settled(tag) and ensure() read the failure', () => {
  assert.match(loader, /SFLoaderPlugin\.prototype\.settled = function \(tag\)/u);
  assert.match(loader, /failed: names\.filter\(\(tag\) => !registry\?\.get\?\.\(tag\) && failed\.has\(tag\)\),/u);
  assert.match(loader, /this\.ensureWaits\.set\(tag, this\.settled\(tag\)\.finally/u);
});

test('the public contract and the developer words name it', () => {
  const api = JSON.parse(read('src/core/contracts/public-js-api.json'));
  const entry = api.globals.find((one) => one.name === 'SF.Loader');
  assert.ok(entry.members.includes('settled'));
  assert.match(entry.summary, /settled\(tag\) is a promise of "defined" or "failed"/u);
  assert.match(entry.summary, /sf-loader-module-failed, detail \{rule, tags, package\}/u);
  assert.match(entry.summary, /\{ready, missing, failed\}/u);
  const words = read('docs/developer/component-packages.md');
  assert.match(words, /`sf-loader-module-failed` comes once per rule/u);
  assert.match(words, /await SF\.Loader\.settled\('sf-view'\)/u);
});

test('the store settles a failed tag as "failed" and a defined one as "defined"', async () => {
  const defined = new Map();
  const waits = new Map();
  const win = {
    SF: {},
    document: null,
    customElements: {
      get: (tag) => defined.get(tag),
      whenDefined: (tag) => new Promise((done) => { waits.set(tag, done); }),
    },
  };
  const store = installPendingTags(win);
  const a = store.settled('sf-a');
  const b = store.settled('sf-b');
  assert.equal(store.fail('sf-a'), true);
  defined.set('sf-b', class {});
  waits.get('sf-b')();
  assert.equal(await a, 'failed');
  assert.equal(await b, 'defined');
  assert.deepEqual(store.failed(), ['sf-a']);
});
