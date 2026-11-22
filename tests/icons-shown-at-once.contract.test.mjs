// GB17 L1 (View list register LV2-5): a class-markup icon added or renamed to a
// name the font already draws is marked loaded straight from the observer,
// ahead of its 100 ms debounce. The browser probe
// tests/browser/icons-shown-at-once.browser.mjs drives it through the Loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const loader = read('src/core/js/loader.js');
const icons = read('src/core/js/iconSubsetRuntime.js');

test('the observer shows a drawn name before the debounce', () => {
  const at = loader.indexOf('_this.holdChangedStaticIcon?.(change.target);');
  assert.ok(at > 0);
  const near = loader.slice(at, at + 700);
  assert.match(near, /_this\.showDrawnStaticIcon\?\.\(change\.target\);/u);
  assert.match(near, /change\.addedNodes\.forEach\(\(node\) => \{\n\s+if \(node\.nodeType === 1 && !_this\.shouldSkipNode\(node\)\) _this\.showDrawnStaticIconsIn\(node\);/u);
  assert.ok(at < loader.indexOf('debounceTimer = setTimeout(() => {'), 'ahead of the debounce');
});

test('only names the font is known to draw, without a computed style', () => {
  const start = icons.indexOf('SFLoaderPlugin.prototype.isTrackedIconKnownDrawn');
  const end = icons.indexOf('SFLoaderPlugin.prototype.syncStaticIconLoadedState');
  assert.ok(start > 0 && end > start);
  const part = icons.slice(start, end);
  assert.doesNotMatch(part, /getComputedStyle|isIconDrawnByPageFace/u);
  assert.match(part, /registeredIcon\(tracked\.icon\)/u);
  assert.match(part, /isIconCoveredByManifest\(tracked\.icon, loadAttrs\)/u);
  assert.match(part, /this\.loadedIcons\.has\(this\.getLoadedIconDescriptorKey\(tracked\.icon, tracked\.attrs\)\)/u);
  // An ignored region stays the page's: getStaticIconElement skips it.
  assert.match(part, /const el = this\.getStaticIconElement\(node\);/u);
  assert.match(part, /node\.getElementsByClassName\?\.\("sf-icon"\)/u);
});
