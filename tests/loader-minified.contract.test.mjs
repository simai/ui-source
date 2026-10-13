import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// The Loader fetches the minified twin of a component's, Smart element's and
// stylesheet's file unless a page is being debugged. It fetched the readable
// files on every page before: 7 MB of script on the admin where 3 would do.

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const helpers = slice('function resolveMinified(', 'SFLoaderPlugin.prototype.isLoaded =');
const paths = slice('SFLoaderPlugin.prototype.pathPluginJs =', 'SFLoaderPlugin.prototype.loadRelationPlugins');

function loader({minified}) {
  function SFLoaderPlugin() {
    this.minified = minified;
    this.componentPath = '/distr/component';
    this.utilyPath = '/distr/utility';
    this.smartPath = '/distr/smart';
  }
  const context = {SFLoaderPlugin, globalThis: {}, URLSearchParams};
  vm.runInNewContext(`${helpers}\n${paths.split('SFLoaderPlugin.prototype.pathPluginCss')[0]}`, context);
  SFLoaderPlugin.prototype.resolveSmartBase = () => '/distr/smart';
  return {plugin: new SFLoaderPlugin(), context};
}

test('component and Smart scripts load minified; a utility script keeps its name', () => {
  const {plugin} = loader({minified: true});
  assert.equal(plugin.pathPluginJs('buttons', false, 'default', 'component'), '/distr/component/buttons/js/buttons.min.js');
  assert.equal(plugin.pathPluginJs('sf-dropdown', true, 'default', 'smart'), '/distr/smart/dropdown/js/dropdown.min.js');
  assert.equal(plugin.pathPluginJs('gap', false, 'default', 'utility'), '/distr/utility/gap/js/default.js');
});

test('a page being debugged loads the readable files', () => {
  const {plugin} = loader({minified: false});
  assert.equal(plugin.pathPluginJs('buttons', false, 'default', 'component'), '/distr/component/buttons/js/buttons.js');
});

test('either form of a file counts as loaded, and a missing minified twin falls back once', () => {
  const {context} = loader({minified: true});
  vm.runInContext('globalThis.forms = [otherForm("/a/x.min.js?sf_v=1"), otherForm("/a/x.css"), minifiedToReadable("/a/x.min.css"), minifiedToReadable("/a/x.css")]', context);
  assert.equal(JSON.stringify(context.globalThis.forms), JSON.stringify(['/a/x.js?sf_v=1', '/a/x.min.css', '/a/x.css', null]));
  assert.match(source, /const min = otherForm\(cssFile\);/u, 'the CSS fallback tries the other form, not x.min.min.css');
  assert.match(slice('SFLoaderPlugin.prototype.addScript =', 'SFLoaderPlugin.prototype.setPreloaderParams'), /minifiedToReadable\(pluginURL\)/u);
});

test('the minified default is switched off by config, address or attribute', () => {
  assert.match(helpers, /SF_BOOT_CONFIG\?\.minified/u);
  assert.match(helpers, /has\('sf-debug'\)/u);
  assert.match(helpers, /hasAttribute\?\.\('data-sf-debug'\)/u);
});
