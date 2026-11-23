// FS-10 (group build 18): a script the Loader preloads while it waits is preloaded once per page, never after it was
// asked for, and never inside Chrome's unused-preload window after the load event (Chrome checks the page's link
// preloads about 3 s after that event and warns of every one no script has used yet). No request of the Loader's own.
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
    clock: now, document, performance, URL, Symbol, Map, Set, Number, Math, Object, String,
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

test('before the load event and after Chrome\'s check the preload is added at once', () => {
  const before = page({readyState: 'interactive'});
  before.loader().preloadScript(MODAL);
  assert.equal(before.links.length, 1);
  const after = page({readyState: 'complete', now: 9000, loadEventEnd: 5000});
  after.loader().preloadScript(MODAL);
  assert.equal(after.links.length, 1);
  assert.equal(after.timers.length, 0);
});

test('inside the window it waits for the check and is added only if the script is still not asked for', () => {
  const p = page({readyState: 'complete', now: 6000, loadEventEnd: 5000});
  p.loader().preloadScript(MODAL);
  p.loader().preloadScript('https://example.test/ui/distr/smart/confirm/js/confirm.min.js');
  assert.equal(p.links.length, 0, 'nothing inside the window');
  assert.deepEqual(p.timers.map((t) => t.ms), [2250, 2250], 'load + 3000 + 250 margin - now');
  p.context.registry().scripts.set(MODAL, Promise.resolve());
  p.timers.forEach((t) => t.fn());
  assert.deepEqual(p.links.map((l) => l.href), ['https://example.test/ui/distr/smart/confirm/js/confirm.min.js'],
    'the modal was asked for meanwhile: its own element fetches it');
  p.loader().preloadScript('https://example.test/ui/distr/smart/confirm/js/confirm.min.js');
  assert.equal(p.links.length, 1, 'still once');
});

test('the load event under way (no time written yet) counts as now', () => {
  const p = page({readyState: 'complete', now: 4000, loadEventEnd: 0});
  p.loader().preloadScript(MODAL);
  assert.equal(p.links.length, 0);
  assert.equal(p.timers[0].ms, 3250);
});

test('a relation does not preload a rule that is not on its way', () => {
  const start = loader.indexOf('SFLoaderPlugin.prototype.isRelationPlugin = function');
  const body = loader.slice(start, loader.indexOf('SFLoaderPlugin.prototype.', start + 50));
  assert.match(body, /this\.pendingLoadPlugins\.has\(relationMainPlugin\) &&\n\s+!this\.loadedPlugins\[relationMainPlugin\]\?\.js\n\s+\) \{\n\s+this\.preloadScript\(waiting\.jsFile\);/u);
  const rel = loader.slice(loader.indexOf('SFLoaderPlugin.prototype.loadRelationPlugins = function'));
  assert.match(rel.slice(0, 2400), /if \(!this\.totalRelationsPlugins\[name\]\.canLoad && !skipJs && jsFile\) this\.preloadScript\(jsFile\);/u);
});

test('no request of the Loader\'s own (the GB17 warm-up fetch stays withdrawn)', () => {
  assert.doesNotMatch(code, /globalThis\.fetch\(|\bfetch\(href/u);
});
