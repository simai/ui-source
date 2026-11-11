// R074 F-1 (2026-11-11): a component script that is never answered kept
// sf-loader-ready, and the splash with it, away for as long as the browser
// kept the socket. A script now has a time limit; past it the rule fails for
// this page, once, and a script that arrives later still runs and its rule
// reads as loaded again. The browser side is
// tests/browser/loader-script-timeout.browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {installPendingTags} from '../src/core/js/pending-tags.js';

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `${from} .. ${to}`);
  return source.slice(start, end);
};

function fixture() {
  const scripts = [];
  const document = {
    baseURI: 'http://x/',
    createElement: () => {
      const listeners = {};
      const element = {
        listeners,
        attributes: {},
        addEventListener: (name, fn) => { listeners[name] = fn; },
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { scripts.splice(scripts.indexOf(element), 1); },
      };
      return element;
    },
    getElementsByTagName: () => [{append: (node) => scripts.push(node)}],
  };
  const warnings = [];
  const context = {
    document,
    URL,
    setTimeout,
    clearTimeout,
    console: {warn: (...args) => warnings.push(args.join(' '))},
    otherForm: () => null,
    PACKAGE_MISS_SEPARATOR: '::',
    encodeCacheValue: (value) => value,
    safeSetItem: () => {},
    SFLoaderPlugin: function SFLoaderPlugin() {
      this.notFoundFiles = {};
      this.loadedPlugins = {};
      this.findPlugins = {'cl-tag': {tags: ['sf-tag']}};
    },
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext([
    slice('const ASSET_REGISTRY =', 'SFLoaderPlugin.prototype.setPreloaderParams ='),
    slice('SFLoaderPlugin.prototype.getPersistentMissingFiles =', 'SFLoaderPlugin.prototype.getAssetVersion ='),
    'SFLoaderPlugin.prototype.versionAssetUrl = (url) => url;',
  ].join('\n'), context);
  const registry = new Map();
  const win = {
    SF: {},
    document: null,
    customElements: {get: (tag) => registry.get(tag), whenDefined: () => new Promise(() => {})},
  };
  context.window.SF = win.SF;
  const pending = installPendingTags(win);
  return {loader: new context.SFLoaderPlugin(), scripts, warnings, pending, registry};
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

test('the time limit is 15 s, and a script past it rejects with a late answer to follow', async () => {
  assert.match(source, /const SCRIPT_LOAD_TIMEOUT_MS = 15000;/u);
  const {loader, scripts} = fixture();
  loader.scriptLoadTimeoutMs = 20;
  const load = loader.addScript('/tag.js');
  const error = await load.then(() => null, (reason) => reason);
  assert.equal(error?.timedOut, true);
  assert.match(error.message, /Script not loaded within 20 ms: \/tag\.js/u);
  assert.equal(scripts.length, 1, 'the request is not cancelled: the script element stays');
  // Asked again while it is still on its way: no second script element.
  const again = await loader.addScript('/tag.js').then(() => null, (reason) => reason);
  assert.equal(again, error);
  assert.equal(scripts.length, 1);
  scripts[0].listeners.load();
  await error.arrival;
  await wait(0);
  await loader.addScript('/tag.js');
  assert.equal(scripts.length, 1, 'once arrived, it reads as loaded');
});

test('a script that answers in time is not touched by the limit', async () => {
  const {loader, scripts} = fixture();
  loader.scriptLoadTimeoutMs = 30;
  const load = loader.addScript('/ok.js');
  scripts[0].listeners.load();
  await load;
  await wait(50);
  const failed = fixture();
  failed.loader.scriptLoadTimeoutMs = 30;
  const refused = failed.loader.addScript('/missing.js');
  failed.scripts[0].listeners.error();
  const error = await refused.then(() => null, (reason) => reason);
  assert.equal(error?.timedOut, undefined, 'a refused script is a failure, not a timeout');
});

test('past the limit the rule fails once for this page, and recovers when its script arrives', async () => {
  const {loader, scripts, warnings, pending} = fixture();
  loader.scriptLoadTimeoutMs = 20;
  const writes = [];
  loader.addToMissingFiles = (...args) => writes.push(args);
  const load = loader.addScript('/tag.js');
  pending.hold('sf-tag', {asked: true, timeout: 1000});
  await load.catch((error) => loader.scriptFailed('cl-tag', error));
  await load.catch((error) => loader.scriptFailed('cl-tag', error));
  assert.equal(warnings.length, 1, 'one message, however many wait for the script');
  assert.match(warnings[0], /not loaded within 20 ms.*<sf-tag> counted as failed for this page, and drawn if the script still arrives/u);
  assert.deepEqual(writes, [], 'not stored as missing: the next page asks again');
  assert.deepEqual(pending.failed(), ['sf-tag']);
  assert.equal(pending.isHeld('sf-tag'), false, 'its elements are shown at once');
  scripts[0].listeners.load();
  await wait(0);
  assert.deepEqual(pending.failed(), [], 'arrived: no longer counted as failed');
  assert.equal(loader.loadedPlugins['cl-tag'].js, true);
  assert.equal(loader.loadedPlugins['cl-tag'].ready, true);
});

test('a script refused after its limit stays missing for this page only', async () => {
  const {loader, scripts, warnings} = fixture();
  loader.scriptLoadTimeoutMs = 20;
  const writes = [];
  loader.addToMissingFiles = (...args) => writes.push(args);
  const load = loader.addScript('/tag.js');
  await load.catch((error) => loader.scriptFailed('cl-tag', error));
  scripts[0].listeners.error();
  await wait(0);
  assert.equal(warnings.length, 1, 'no second message');
  assert.equal(loader.notFoundFiles['cl-tag'].js, true);
  assert.deepEqual(writes, []);
});

test('a refused script keeps the stored-missing policy', async () => {
  const {loader} = fixture();
  const writes = [];
  loader.addToMissingFiles = (...args) => writes.push(args);
  loader.scriptFailed('cl-tag', new Error('Failed to load script: /tag.js'));
  assert.deepEqual(writes, [['cl-tag', 'js']]);
});
