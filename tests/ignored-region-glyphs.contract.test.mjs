// A Smart element's class-markup glyphs (<i class="sf-icon">) inside a
// data-sf-observer="ignore" region (core.runtime 1.54.0, 2026-11-11). The
// Loader's page scan and mutation observer pass such a region by, so the
// glyphs were never asked for and never marked sf-icon-loaded: they waited at
// font-size 0 (accordion, avatar, badge, menu, steps, tag, tree-item, wizard
// and others drew blank in documentation examples and loader wraps). The
// Smart base hands them to the Loader after every drawing; the Loader asks for
// them and marks them like page icons. Held on the built bytes by
// ui-control evidence 2026-11-11-bare-icon-templates (probe glyphs.mjs).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Smart base hands an ignored region\'s glyphs to the Loader after each drawing', () => {
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /const IGNORED_REGION = '\[data-sf-observer="ignore"\]';/u);
  assert.match(base, /this\._hasRendered = true;\s*this\.adoptIgnoredGlyphs\(\);\s*this\.afterRender\(changedAttributes\);/u);
  const method = base.slice(base.indexOf('  adoptIgnoredGlyphs() {'), base.indexOf('  shouldWaitForStylesReady() {'));
  assert.match(method, /if \(!this\.closest\?\.\(IGNORED_REGION\)\) return;/u);
  assert.match(method, /loader\.adoptStaticIcons\(this\);/u);
  // Drawn before the Loader exists: once it is ready.
  assert.match(method, /window\.addEventListener\("sf-loader-ready", [\s\S]*?\{once: true\}\);/u);
});

test('the Loader asks for adopted glyphs and marks them when their font is in', () => {
  const runtime = read('src/core/js/iconSubsetRuntime.js');
  const body = runtime.slice(runtime.indexOf('SFLoaderPlugin.prototype.adoptStaticIcons = function'), runtime.indexOf('SFLoaderPlugin.prototype.scanStaticIcons = function'));
  assert.ok(body.length > 0);
  // No page-scan filter here: the region is the reason the element hands them over.
  assert.doesNotMatch(body, /shouldSkipNode/u);
  // A glyph of an sf-icon element is the element's own.
  assert.match(body, /if \(el\.closest\?\.\("sf-icon"\)\) return;/u);
  assert.match(body, /added \+= this\.trackIconDescriptor\(tracked\.icon, tracked\.attrs\);/u);
  assert.match(body, /if \(this\.isTrackedIconLoaded\(tracked\)\) \{\s*el\.classList\.add\("sf-icon-loaded"\);/u);
  assert.match(body, /window\.addEventListener\("sf-icons-subset:ready", settle\);/u);
  assert.match(body, /if \(added > 0\) this\.mutate\(\(\) => this\.loadFonts\(\)\);/u);
});

// sf-sortable, sf-editor-inline, sf-editor-overlay and sf-resizer are not on
// the Smart base (manifest-host.mjs, resizer/index.js): they draw when they
// like, so the manifest layer they share watches them while they sit in an
// ignored region and hands what they add or rename to the same Loader method
// (the sortable's inserter "+" stayed blank in a late ignored copy).
test('an element on a plain base hands an ignored region\'s glyphs to the Loader as it adds them', () => {
  const manifest = read('src/core/js/element-manifest.js');
  assert.match(manifest, /const IGNORED_REGION = '\[data-sf-observer="ignore"\]';/u);
  const watch = manifest.slice(manifest.indexOf('export function watchIgnoredGlyphs(element) {'), manifest.indexOf('// The nearest closed container'));
  assert.ok(watch.length > 0);
  assert.match(watch, /if \(!element\.closest\?\.\(IGNORED_REGION\)\) return null;/u);
  assert.match(watch, /loader\.adoptStaticIcons\(root\);/u);
  assert.match(watch, /addEventListener\?\.\('sf-loader-ready', [\s\S]*?\{once: true\}\);/u);
  assert.match(watch, /observer\.observe\(element, \{\s*childList: true, subtree: true, characterData: true,\s*attributes: true, attributeFilter: \['class', 'data-icon'\], attributeOldValue: true,\s*\}\);/u);
  // Only where the Smart base does not hand them over itself, and stopped when the element leaves.
  assert.match(manifest, /if \(typeof this\.adoptIgnoredGlyphs !== 'function'\) \{\s*this\.__sfGlyphWatch\?\.disconnect\(\);\s*this\.__sfGlyphWatch = watchIgnoredGlyphs\(this\);/u);
  assert.match(manifest, /disconnectedCallback\(\) \{\s*super\.disconnectedCallback\?\.\(\);\s*this\.__sfGlyphWatch\?\.disconnect\(\);\s*this\.__sfGlyphWatch = null;/u);
  for (const path of ['src/core/js/composition/manifest-host.mjs', 'src/smart/resizer/index.js']) {
    assert.match(read(path), /elementFromManifest\(manifest, \{/u, `${path} builds its element through elementFromManifest`);
  }
});

// The watch itself, driven with stand-ins for the DOM (no browser): what it
// hands over, what it leaves alone, and how it waits for a late Loader. The
// built bytes are held by tests/browser/ignored-region-glyphs.browser.mjs.
const {watchIgnoredGlyphs} = await import('../src/core/js/element-manifest.js');

function stage({inRegion = true, loader = true} = {}) {
  const adopted = [];
  const listeners = [];
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.connected = true; }
    disconnect() { this.connected = false; }
  };
  globalThis.SF = loader ? {Loader: {adoptStaticIcons: (root) => { adopted.push(root); return 0; }}} : {};
  globalThis.addEventListener = (type, listener, options) => listeners.push({type, listener, options});
  const element = {
    isConnected: true,
    region: inRegion,
    closest(selector) { return selector === '[data-sf-observer="ignore"]' && this.region ? {} : null; },
  };
  const glyph = (classes, attributes = {}) => ({
    nodeType: 1, isConnected: true,
    classList: {contains: (name) => classes.split(' ').includes(name)},
    getAttribute: (name) => (name === 'class' ? classes : attributes[name] ?? null),
  });
  return {adopted, listeners, observers, element, glyph};
}

test('outside an ignored region nothing is watched and nothing is handed over', () => {
  const {adopted, observers, element} = stage({inRegion: false});
  assert.equal(watchIgnoredGlyphs(element), null);
  assert.equal(observers.length, 0);
  assert.equal(adopted.length, 0);
});

test('inside a region the element is handed over at once, then what is added or renamed under it', () => {
  const {adopted, observers, element, glyph} = stage();
  const observer = watchIgnoredGlyphs(element);
  assert.equal(observer, observers[0]);
  assert.deepEqual(adopted, [element]);
  assert.deepEqual(observer.options.attributeFilter, ['class', 'data-icon']);
  assert.equal(observer.options.attributeOldValue, true);
  adopted.length = 0;

  const added = glyph('sf-icon');
  const renamed = glyph('sf-icon');
  const byData = glyph('sf-icon', {'data-icon': 'forest'});
  const became = glyph('sf-icon');
  const marked = glyph('sf-icon sf-icon-loaded');
  const weight = glyph('sf-icon sf-icon--weight-bold');
  const notGlyph = glyph('row', {'data-icon': 'x'});
  const gone = {...glyph('sf-icon'), isConnected: false};
  observer.callback([
    {type: 'childList', addedNodes: [added, {nodeType: 3, parentElement: null}, gone]},
    {type: 'characterData', target: {parentElement: {closest: () => renamed}}},
    {type: 'attributes', target: byData, attributeName: 'data-icon', oldValue: null},
    {type: 'attributes', target: became, attributeName: 'class', oldValue: ''},
    {type: 'attributes', target: marked, attributeName: 'class', oldValue: 'sf-icon'},
    {type: 'attributes', target: weight, attributeName: 'class', oldValue: 'sf-icon sf-icon-loaded'},
    {type: 'attributes', target: notGlyph, attributeName: 'data-icon', oldValue: null},
  ]);
  // The Loader's own sf-icon-loaded mark is no rename, so marking never asks again.
  assert.deepEqual(adopted, [added, renamed, byData, became, weight]);
});

test('placed before the Loader: the element waits for sf-loader-ready once and is handed over then', () => {
  const {adopted, listeners, element} = stage({loader: false});
  watchIgnoredGlyphs(element);
  watchIgnoredGlyphs(element);
  assert.equal(adopted.length, 0);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].type, 'sf-loader-ready');
  assert.equal(listeners[0].options.once, true);
  globalThis.SF.Loader = {adoptStaticIcons: (root) => { adopted.push(root); return 0; }};
  listeners[0].listener();
  assert.deepEqual(adopted, [element]);
});

test('a Loader that arrives after the element left the region hands nothing over', () => {
  const {adopted, listeners, element} = stage({loader: false});
  watchIgnoredGlyphs(element);
  element.region = false;
  globalThis.SF.Loader = {adoptStaticIcons: (root) => { adopted.push(root); return 0; }};
  listeners[0].listener();
  assert.equal(adopted.length, 0);
});


// Bundles the page includes itself before core.js wait for sf-runtime-ready;
// when every part stands in an ignored region the Loader never asks for the
// runtime, so core starts it for them once the Loader is ready (N4). Held on
// the built bytes by tests/browser/ignored-region-glyphs.browser.mjs case 3.
test('a hand-included Smart bundle still waiting has the runtime started once the Loader is ready', () => {
  const core = read('src/core/js/index.js');
  const block = core.slice(core.indexOf('const handBundleWaiting = () =>'), core.indexOf('}, {once: true});', core.indexOf('const handBundleWaiting = () =>')) + 20);
  assert.ok(block.length > 20);
  assert.match(block, /window\.addEventListener\('sf-loader-ready', \(\) => \{/u);
  assert.match(block, /if \(SF\.__internal\.runtimeModules \|\| SF\.__internal\.runtimeLoading\) return;/u);
  assert.match(block, /if \(!handBundleWaiting\(\) \|\| !smartPartWaiting\(\)\) return;/u);
  assert.match(block, /SF\.loadRuntime\(\)\.catch\(/u);
});
