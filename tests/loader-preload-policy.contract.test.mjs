// The Loader preloads an element's script only when the page will use it
// promptly (2026-11-11): Chrome reports a preload not used within about 3 s,
// and two kinds were: every rule that names a relation the page loads, used
// or not, and an element's script preloaded when its wait for five relations
// began. The browser side is tests/browser/loader-script-timeout.browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `${from} .. ${to}`);
  return source.slice(start, end);
};

function fixture() {
  const links = [];
  const context = {
    URL,
    document: {baseURI: 'http://x/', createElement: () => ({}), head: {append: (node) => links.push(node)}},
    SFLoaderPlugin: function SFLoaderPlugin() { this.totalRelationsPlugins = {}; },
  };
  context.globalThis = context;
  vm.runInNewContext([
    slice('const ASSET_REGISTRY =', 'SFLoaderPlugin.prototype.scriptLoadTimeoutMs ='),
    'SFLoaderPlugin.prototype.versionAssetUrl = (url) => url;',
  ].join('\n'), context);
  return {loader: new context.SFLoaderPlugin(), links, context};
}

test('an element waiting on its relations is preloaded with one relation left, not before', () => {
  const {loader} = fixture();
  loader.totalRelationsPlugins['cl-button-icon'] = {total: 5, load: 3, canLoad: false};
  assert.equal(loader.relationWaitNearlyDone('cl-button-icon'), false);
  loader.totalRelationsPlugins['cl-button-icon'].load = 4;
  assert.equal(loader.relationWaitNearlyDone('cl-button-icon'), true);
  loader.totalRelationsPlugins['cl-button-icon'] = {total: 1, load: 0, canLoad: false};
  assert.equal(loader.relationWaitNearlyDone('cl-button-icon'), true, 'one relation: preloaded beside it');
  loader.totalRelationsPlugins['cl-button-icon'].canLoad = true;
  assert.equal(loader.relationWaitNearlyDone('cl-button-icon'), false, 'free to load: the script itself goes in');
  assert.equal(loader.relationWaitNearlyDone('cl-unknown'), false);
});

test('a preload goes in once per script, and not for a script already asked for', () => {
  const {loader, links, context} = fixture();
  loader.preloadScript('/smart/button-icon/js/button-icon.min.js');
  loader.preloadScript('/smart/button-icon/js/button-icon.min.js');
  assert.equal(links.length, 1);
  assert.equal(links[0].rel, 'preload');
  assert.equal(links[0].as, 'script');
  vm.runInNewContext("assetRegistry().scripts.set(assetKey('/smart/icon/js/icon.min.js'), Promise.resolve())", context);
  loader.preloadScript('/smart/icon/js/icon.min.js');
  assert.equal(links.length, 1, 'the script is on its way: nothing left to announce');
});

test('each preload of a waiting element asks whether its wait is nearly done; a rule the page did not ask for is not preloaded', () => {
  const calls = source.match(/this\.preloadScript\([^)]*\)/gu) || [];
  assert.equal(calls.length, 3, 'loadRelationPlugins, checkToFullRelationLoad, isRelationPlugin');
  const relations = slice('SFLoaderPlugin.prototype.loadRelationPlugins =', 'SFLoaderPlugin.prototype.awaitPluginAssetsReady =');
  assert.match(relations, /if \(!skipJs && jsFile && this\.relationWaitNearlyDone\(name\)\) this\.preloadScript\(jsFile\);/u);
  const full = slice('SFLoaderPlugin.prototype.checkToFullRelationLoad =', 'SFLoaderPlugin.prototype.isRelationPlugin =');
  assert.match(full, /this\.pendingLoadPlugins\.has\(pluginName\)\s*&& this\.relationWaitNearlyDone\(pluginName\)\) \{\s*this\.preloadScript\(waiting\.jsFile\);/u);
  const named = slice('SFLoaderPlugin.prototype.isRelationPlugin =', 'SFLoaderPlugin.prototype.sortPlugin =');
  assert.match(named, /this\.pendingLoadPlugins\.has\(relationMainPlugin\)\s*&& this\.relationWaitNearlyDone\(relationMainPlugin\)\) \{\s*this\.preloadScript\(waiting\.jsFile\);/u);
});
