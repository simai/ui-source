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
  // Through the runtime's own mark (one owner per glyph, input-choice audit 2026-11-11).
  assert.match(body, /if \(this\.isTrackedIconLoaded\(tracked\)\) \{\s*this\.markIconLoaded\(el\);/u);
  assert.match(body, /window\.addEventListener\("sf-icons-subset:ready", settle\);/u);
  assert.match(body, /if \(added > 0\) this\.mutate\(\(\) => this\.loadFonts\(\)\);/u);
});
