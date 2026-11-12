// C59 stage S1 (owner decision 2026-11-11): one positioning engine and the
// popover kind. sf-popover stands in the top layer and is placed by core
// positioning with engine 'auto' (CSS anchor positioning, Floating UI where the
// browser has none or no CSS area fits); its optional arrow carries the
// overlay shadow as a filter. Browser: tests/browser/popover-top-layer.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the overlay shadow as a filter is the overlay shadow: one geometry, two forms', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  assert.match(theme, /--sf-shadow-overlay: #\{shadow\.sf-shadow\('overlay'\)\};/u);
  assert.match(theme, /--sf-shadow-overlay-filter: #\{shadow\.sf-drop-shadow\('overlay'\)\};/u);
  const mix = read('src/core/scss/mix/_mix__shadow.scss');
  // Both functions walk the same map, so the filter cannot drift from the box-shadow.
  const walks = mix.match(/map\.get\(\$sf-shadow-geometry, \$place\)/gu) || [];
  assert.equal(walks.length, 2);
  assert.match(mix, /@function sf-drop-shadow\(\$place\)[\s\S]*drop-shadow\(#\{\$x\} #\{\$y\} #\{\$blur\} var\(--sf-shadow-#\{\$colour\}-color\)\)/u);
});

test('the floating-surface engine: CSS anchor positioning in the top layer, SF.Position elsewhere, internal', () => {
  const source = read('src/core/js/float-anchor.js');
  assert.match(source, /export function supportsCssAnchoring\(\)/u);
  assert.match(source, /export function floatEngine\(reference, floating, options = \{\}\)/u);
  assert.match(source, /getAttribute\(ENGINE_ATTRIBUTE\) === 'script'\) return 'script';/u);
  assert.match(source, /if \(options\.fitHeight \|\| options\.matchWidth \|\| options\.alignmentOffset\) return 'script';/u);
  assert.match(source, /!inTopLayer\(floating\)\) return 'script';/u);
  // No CSS area keeps it inside the window, or the browser slid it back over
  // its own trigger (390, start/end, S1 acceptance D2): SF.Position shifts it.
  assert.match(source, /releaseAnchorName\(\);\s*startScript\(\);/u);
  assert.match(source, /const covers = Math\.min\(panel\.right, box\.right\) - Math\.max\(panel\.left, box\.left\) > 0\.5\s*&& Math\.min\(panel\.bottom, box\.bottom\) - Math\.max\(panel\.top, box\.top\) > 0\.5;/u);
  assert.match(source, /if \(\(out \|\| covers\) && visible\) \{/u);
  // Behaviour from source, both engines: tests/browser/float-anchor-nested.browser.mjs.
  assert.match(source, /script = Position\.anchor\(reference, floating, \{/u);
  // Flip tactics carry the gap (a margin) and the window padding (insets) to the other side.
  assert.match(source, /'flip-inline, flip-block, flip-block flip-inline'/u);
  assert.match(source, /floating\.dataset\.sfSide = controller\.side;/u);
  assert.match(source, /'--sf-position-arrow-x'/u);
  // Anchor names are shared across bundles, not counted per bundle copy.
  assert.match(source, /Symbol\.for\('sf\.float-anchor\.names'\)/u);
  // A Smart host's style is its author style and its style attribute is
  // rewritten on render: the anchor name comes from a rule in an adopted sheet
  // over data-sf-float-anchor, never from the reference's inline style.
  assert.match(source, /const ANCHOR_ATTRIBUTE = 'data-sf-float-anchor';/u);
  assert.match(source, /Symbol\.for\('sf\.float-anchor\.sheets'\)/u);
  assert.match(source, /adoptedStyleSheets/u);
  assert.doesNotMatch(source, /reference\.style\.setProperty\('anchor-name'/u);
  assert.match(source, /observe\(reference, \{attributes: true, attributeFilter: \[ANCHOR_ATTRIBUTE\]\}\)/u);
  // Internal: not published, not in the public JS API contract, position.js untouched.
  assert.doesNotMatch(source, /globalThis\.SF\.[A-Z]\w* =/u);
  const api = read('src/core/contracts/public-js-api.json');
  for (const name of ['floatEngine', 'anchorFloating', 'float-anchor']) assert.ok(!api.includes(name), name);
  assert.doesNotMatch(read('src/core/js/index.js'), /float-anchor/u);
});

test('sf-popover: the top layer, engine auto, a step down under a window', () => {
  const source = read('src/smart/popover/index.js');
  assert.match(source, /this\._anchor = anchorFloating\(this, surface, \{/u);
  assert.match(source, /arrow: this\.arrow,/u);
  assert.match(source, /topLayer: false,/u, 'the popover lifts the surface itself, so a sheet stays lifted');
  assert.match(source, /positioning\(\)\.liftToTopLayer\?\.\(surface\)/u);
  assert.match(source, /holdOpenSurfaceMark\(this, true, \{place: this\._onLayerPlace\}\);/u);
  assert.match(source, /const under = hasLayerAbove\(this\);/u);
  // Focus moves into a dialog surface, a frame later, unless its content took it.
  assert.match(source, /if \(this\.surfaceRole !== 'dialog'\) return;/u);
  assert.match(source, /surface\.focus\(\{preventScroll: true\}\);/u);
});

test('sf-popover: every placement the manifest names is placed by the script and drawn by the sheet', () => {
  const manifest = json('src/smart/popover/component.json');
  const values = manifest.settings.placement.values;
  assert.equal(manifest.settings.placement.default, 'bottom-end');
  for (const name of ['top', 'bottom', 'start', 'end', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'start-start', 'start-end', 'end-start', 'end-end', 'inline-start', 'inline-end']) {
    assert.ok(values.includes(name), name);
  }
  const source = read('src/smart/popover/index.js');
  const block = source.slice(source.indexOf('const ANCHOR_PLACEMENTS = {'), source.indexOf('function', source.indexOf('const ANCHOR_PLACEMENTS = {')));
  const keys = [...block.matchAll(/^\s+'?([a-z-]+)'?: \{side:/gmu)].map((match) => match[1]);
  // start and end with -start and -end are composed in a loop (no flex-align literal).
  for (const name of ['start', 'end']) for (const align of ['', '-start', '-end']) keys.push(`${name}${align}`);
  assert.match(block, /for \(const \[name, side\] of \[\['start', 'inline-start'\], \['end', 'inline-end'\]\]\)/u);
  assert.deepEqual([...keys].sort(), [...values].sort());
  const css = read('src/smart/popover/js/templates/default.css');
  for (const name of values) assert.match(css, new RegExp(`\\[data-placement='${name}'\\]`, 'u'), `${name}: a closed-state rule`);
  assert.equal(manifest.settings.arrow.default, false);
});

test('sf-popover: the arrow carries the panel\'s shadow, from tokens only', () => {
  const css = read('src/smart/popover/js/templates/default.css');
  const rule = css.match(/sf-popover\[arrow\] > \[slot='content'\] \{([^}]*)\}/u)?.[1] || '';
  assert.match(rule, /box-shadow: none;/u);
  assert.match(rule, /filter: var\(--sf-shadow-overlay-filter\);/u);
  assert.match(rule, /overflow: visible;/u);
  const arrow = css.slice(css.indexOf("sf-popover[arrow] > [slot='content'][data-sf-side]"));
  assert.match(arrow, /background: inherit;/u);
  assert.match(arrow, /z-index: -1;/u);
  assert.match(arrow, /var\(--sf-position-arrow-x, 50%\)/u);
  assert.doesNotMatch(arrow.replace(/\/\*[\s\S]*?\*\//gu, ''), /\d+px|#[0-9a-f]{3,6}\b|rgba?\(/iu, 'no length or colour of its own');
});
