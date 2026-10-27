import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// A relation marked lazy does not hold up the page: it is not a relation the
// component waits for, and it is fetched when it is first used -- asked for
// (SF.Loader.ensurePlugin) or met in the document (2026-10-12: the table's
// filter editors were a third of the admin's script at boot). Since standard
// simai.smart-component 1.3.8 §7.2.1 (simai/ui-source#47) it is no longer
// fetched in idle time after sf-loader-ready unless the page asks for that
// with SF_BOOT_CONFIG.prefetchLazyRelations = true.

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

function loader(rules) {
  function SFLoaderPlugin() {
    this.findPlugins = rules;
    this.relationPlugins = {};
    this.pluginListRelation = [];
    this.module = {};
    this.lazyRelations = new Set();
    this.loaded = [];
  }
  SFLoaderPlugin.prototype.isPluginResolvable = () => true;
  SFLoaderPlugin.prototype.setModule = function (name) { this.module[name] = name; };
  SFLoaderPlugin.prototype.setExistCookie = function (name) { this.loaded.push(name); this.module[name] = name; };
  SFLoaderPlugin.prototype.mutate = (fn) => fn();
  SFLoaderPlugin.prototype.getLoader = () => {};
  const context = {SFLoaderPlugin, globalThis: {}, setTimeout: (fn) => fn()};
  vm.runInNewContext(`${slice('SFLoaderPlugin.prototype.setRelation =', 'SFLoaderPlugin.prototype.sortPlugins =')}
${slice('SFLoaderPlugin.prototype.ensurePlugin =', 'SFLoaderPlugin.prototype.ensureSmartElementLoaded =')}`, context);
  return new SFLoaderPlugin();
}

test('a lazy relation is not waited for, and the opt-in prefetch fetches it', () => {
  const plugin = loader({'cl-table': {}, 'cl-buttons': {}, 'cl-datepicker': {}});
  const output = {smart: {}, component: {}, utility: {}, relation: {}};
  plugin.setRelation([{name: 'cl-buttons'}, {name: 'cl-datepicker', lazy: true}], 'cl-table', output);
  assert.equal(JSON.stringify(plugin.relationPlugins['cl-table']), JSON.stringify(['cl-buttons']));
  assert.equal(plugin.module['cl-datepicker'], undefined, 'not loaded with the page');
  assert.ok(plugin.lazyRelations.has('cl-datepicker'));
  plugin.prefetchLazyRelations();
  assert.equal(JSON.stringify(plugin.loaded), JSON.stringify(['cl-datepicker']));
});

test('ready prefetches nothing unless the page asks, and then after the announcement, in idle time', () => {
  const ready = slice('SFLoaderPlugin.prototype.dispatchReadyOnce =', 'SFLoaderPlugin.prototype.getAssets =');
  assert.ok(ready.indexOf('createReadyEvent()') < ready.indexOf('this.prefetchLazyRelations()'));
  assert.match(ready, /if \(this\.params\?\.prefetchLazyRelations === true\s*\|\| window\.SF_BOOT_CONFIG\?\.prefetchLazyRelations === true\) \{\s*this\.prefetchLazyRelations\(\);\s*\}/u);
  assert.match(slice('SFLoaderPlugin.prototype.prefetchLazyRelations =', 'SFLoaderPlugin.prototype.ensureSmartElementLoaded ='), /requestIdleCallback/u);
});
