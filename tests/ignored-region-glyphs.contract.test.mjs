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
  const watch = manifest.slice(manifest.indexOf('function watchIgnoredGlyphs(element) {'), manifest.indexOf('function isShown(element) {'));
  assert.ok(watch.length > 0);
  assert.match(watch, /if \(!element\.closest\?\.\(IGNORED_REGION\)\) return null;/u);
  assert.match(watch, /loader\.adoptStaticIcons\(root\);/u);
  assert.match(watch, /addEventListener\?\.\('sf-loader-ready', [\s\S]*?\{once: true\}\);/u);
  assert.match(watch, /observer\.observe\(element, \{childList: true, subtree: true, characterData: true\}\);/u);
  // Only where the Smart base does not hand them over itself, and stopped when the element leaves.
  assert.match(manifest, /if \(typeof this\.adoptIgnoredGlyphs !== 'function'\) \{\s*this\.__sfGlyphWatch\?\.disconnect\(\);\s*this\.__sfGlyphWatch = watchIgnoredGlyphs\(this\);/u);
  assert.match(manifest, /disconnectedCallback\(\) \{\s*super\.disconnectedCallback\?\.\(\);\s*this\.__sfGlyphWatch\?\.disconnect\(\);\s*this\.__sfGlyphWatch = null;/u);
  for (const path of ['src/core/js/composition/manifest-host.mjs', 'src/smart/resizer/index.js']) {
    assert.match(read(path), /elementFromManifest\(manifest, \{/u, `${path} builds its element through elementFromManifest`);
  }
});
