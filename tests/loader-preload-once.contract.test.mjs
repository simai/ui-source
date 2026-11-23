// FS-10 (group build 18): a script the Loader preloads while it waits is preloaded once per page, never after it was
// asked for; after the window's load event only when its relations are on their way and no check of Chrome's can come
// first (Chrome checks link preloads about 3 s after that event and after each quiet network spell). No own request.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const loader = readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const from = loader.indexOf("const ASSET_REGISTRY = Symbol.for('simai.sf.loader.assets');");
const to = loader.indexOf("// The page's language file while it is on its way");
const code = loader.slice(from, to);

function page({readyState = 'loading', now = 100, loadEventEnd = 0, fetched = [], scripts = []} = {}) {
  const links = [];
  const timers = [];
  const document = {
    readyState,
    baseURI: 'https://example.test/admin/',
    scripts: scripts.map((src) => ({src})),
    head: {append: (link) => links.push(link)},
    createElement: () => ({}),
  };
  const performance = {
    now: () => context.clock,
    getEntriesByType: (type) => (type === 'navigation' ? [{loadEventStart: loadEventEnd, loadEventEnd}] : []),
    getEntriesByName: (name) => fetched.filter((href) => href === name).map(() => ({})),
  };
  const context = {
    clock: now, document, performance, URL, Symbol, Map, Set, Number, Math, Object, String, Date, Promise, Array, Boolean,
    queueMicrotask: (fn) => fn(),
    setTimeout: (fn, ms) => timers.push({fn, ms}),
    SFLoaderPlugin: function SFLoaderPlugin() {},
  };
  context.globalThis = context;
  context.SFLoaderPlugin.prototype.versionAssetUrl = (url) => url;
  vm.runInNewContext(`${code}\nthis.registry = assetRegistry;`, context);
  return {context, links, timers, loader: () => new context.SFLoaderPlugin()};
}

const MODAL = 'https://example.test/ui/distr/smart/modal/js/modal.min.js';

test('a script is preloaded once per page, by every Loader on it', () => {
  const p = page();
  p.loader().preloadScript(MODAL);
  p.loader().preloadScript(MODAL);
  p.loader().preloadScript('/ui/distr/smart/modal/js/modal.min.js');
  assert.equal(p.links.length, 1);
  assert.equal(p.links[0].rel, 'preload');
  assert.equal(p.links[0].as, 'script');
});

test('never for a script already asked for, in the page or fetched', () => {
  const asked = page();
  asked.context.registry().scripts.set(MODAL, Promise.resolve());
  asked.loader().preloadScript(MODAL);
  assert.equal(asked.links.length, 0, 'asked for by the Loader (the asset registry)');
  const inPage = page({scripts: [MODAL]});
  inPage.loader().preloadScript(MODAL);
  assert.equal(inPage.links.length, 0, 'a script element of the page');
  const fetched = page({fetched: [MODAL]});
  fetched.loader().preloadScript(MODAL);
  assert.equal(fetched.links.length, 0, 'fetched before (resource timing)');
});

test('after the load event: only a waiting element, only when its relations are on their way and no check can come', () => {
  for (const readyState of ['loading', 'interactive']) {
    const p = page({readyState});
    p.loader().preloadScript(MODAL);
    assert.equal(p.links.length, 1, readyState);
  }
  const words = page({readyState: 'complete', now: 9000, loadEventEnd: 5000});
  words.loader().preloadScript(MODAL);
  assert.equal(words.links.length, 0, 'a script waiting for the page\'s words alone: its element fetches it');

  const p = page({readyState: 'complete', now: 9000, loadEventEnd: 5000});
  const loader = p.loader();
  loader.relationPlugins = {'cl-modal': ['modal', 'cl-button-close', 'backdrop-filter-blur/default']};
  loader.totalRelationsPlugins = {'cl-modal': {canLoad: false, completed: {modal: true}}};
  loader.pluginScriptFiles = {modal: '/m.js', 'cl-button-close': 'https://example.test/ui/distr/smart/button-close/js/button-close.min.js', 'backdrop-filter-blur/default': null};
  loader.loadedPlugins = {};
  loader.pendingLoadPlugins = new Set(['backdrop-filter-blur/default']);
  loader.preloadScript(MODAL, 'cl-modal');
  assert.equal(p.links.length, 0, 'the close button is not asked for yet');
  p.context.registry().scripts.set('https://example.test/ui/distr/smart/button-close/js/button-close.min.js', Promise.resolve());
  loader.tryLatePreloads();
  assert.deepEqual(p.links.map((l) => l.href), [MODAL], 'every relation on its way: preloaded');
  loader.preloadScript(MODAL, 'cl-modal');
  assert.equal(p.links.length, 1, 'once');

  const early = page({readyState: 'complete', now: 6000, loadEventEnd: 5000});
  const l2 = early.loader();
  l2.relationPlugins = {'cl-modal': ['modal']};
  l2.totalRelationsPlugins = {'cl-modal': {canLoad: false, completed: {modal: true}}};
  l2.preloadScript(MODAL, 'cl-modal');
  assert.equal(early.links.length, 0, 'inside the check after the load event');
  assert.equal(early.timers[0].ms, 2270, 'tried again once it passed (load + 3250 - now + 20)');
  early.context.clock = 8300;
  early.timers[0].fn();
  assert.equal(early.links.length, 1);
});

test('a relation does not preload a rule that is not on its way', () => {
  const start = loader.indexOf('SFLoaderPlugin.prototype.isRelationPlugin = function');
  const body = loader.slice(start, loader.indexOf('SFLoaderPlugin.prototype.', start + 50));
  assert.match(body, /this\.pendingLoadPlugins\.has\(relationMainPlugin\) &&\n\s+!this\.loadedPlugins\[relationMainPlugin\]\?\.js\n\s+\) \{\n\s+this\.preloadScript\(waiting\.jsFile, relationMainPlugin\);/u);
  const rel = loader.slice(loader.indexOf('SFLoaderPlugin.prototype.loadRelationPlugins = function'));
  assert.match(rel.slice(0, 2400), /if \(!this\.totalRelationsPlugins\[name\]\.canLoad && !skipJs && jsFile\) this\.preloadScript\(jsFile, name\);/u);
});

test('no request of the Loader\'s own (the GB17 warm-up fetch stays withdrawn)', () => {
  assert.doesNotMatch(code, /globalThis\.fetch\(|\bfetch\(href/u);
});
