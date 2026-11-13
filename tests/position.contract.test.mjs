import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {logicalSide, physicalPlacement} from '../src/core/js/position-placement.js';

test('logical placements map to physical sides and follow the writing direction', () => {
  assert.equal(physicalPlacement('block-end', 'start'), 'bottom-start');
  assert.equal(physicalPlacement('block-start', 'end'), 'top-end');
  assert.equal(physicalPlacement('block-end', 'center'), 'bottom');
  assert.equal(physicalPlacement('inline-start', 'start'), 'left-start');
  assert.equal(physicalPlacement('inline-start', 'start', true), 'right-start');
  assert.equal(physicalPlacement('inline-end', 'center', true), 'left');
  assert.throws(() => physicalPlacement('below'), TypeError);
  assert.throws(() => physicalPlacement('block-end', 'middle'), TypeError);
});

test('resolved placements map back to logical sides', () => {
  assert.equal(logicalSide('bottom-start'), 'block-end');
  assert.equal(logicalSide('top'), 'block-start');
  assert.equal(logicalSide('left-end'), 'inline-start');
  assert.equal(logicalSide('left-end', true), 'inline-end');
  assert.equal(logicalSide('right', true), 'inline-start');
});

test('Core publishes the helper and components reuse it or their bundled copy', async () => {
  const core = await readFile(new URL('../src/core/js/index.js', import.meta.url), 'utf8');
  assert.match(core, /import '\.\/position\.js';/);
  const position = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  assert.match(position, /globalThis\.SF\.Position = Position;/);
  assert.match(position, /from '\.\/position-placement\.js'/);
  assert.match(position, /if \(!globalThis\.SF\.Position\) globalThis\.SF\.Position = Position;/);
  // Components prefer Core's helper and fall back to their bundled copy, so an
  // isolated bundle (no core.js) still positions its panels.
  for (const file of ['src/component/dropdown/portal.js', 'src/smart/input-date/index.js']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /import BundledPosition from '\.\.\/\.\.\/core\/js\/position\.js';/, file);
    assert.match(source, /globalThis\.SF\?\.Position \|\| BundledPosition/, file);
    assert.doesNotMatch(source, /@floating-ui/, file);
  }
});

test('stylesheet max-width is read before inline writes and stays the width cap', async () => {
    const {readFile} = await import('node:fs/promises');
    const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
    // A percentage cap is of the viewport (the panel is fixed); read as pixels it
    // made every tooltip 100px wide. Browser: anchor-percent-cap.
    assert.match(source, /const widthCap = cap\(floatingStyle\.maxWidth, document\.documentElement\.clientWidth\);/);
    assert.match(source, /endsWith\('%'\) \? number \/ 100 \* whole : number/);
    assert.match(source, /Math\.min\(availableWidth, viewportWidth, widthCap\)/);
});

test('a panel may reach the viewport edge its field reaches, and no further in', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  assert.match(source, /left: Math\.min\(padding, Math\.max\(0, box\.left\)\)/);
  assert.match(source, /right: Math\.min\(padding, Math\.max\(0, clientWidth - box\.right\)\)/);
  assert.match(source, /shift\(\{padding: edges, crossAxis: false\}\)/);
  assert.match(source, /size\(\{\s*padding: edges,/);
});

test('an anchored surface is lifted into the top layer, unless it is already there', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  // Default on, opt out per call; Core publishes the lift for components that place by hand.
  assert.match(source, /autoUpdate: true, topLayer: true, onPosition: null, \.\.\.options/);
  assert.match(source, /const lower = settings\.topLayer \? liftToTopLayer\(floating\) : null;/);
  assert.match(source, /lower\?\.\(\);/);
  assert.match(source, /const Position = Object\.freeze\(\{anchor, anchorReference, referenceRect, liftToTopLayer,/);
  // A surface the component lifted is left as it is; one inside a lifted or
  // modal layer is lifted too, so it stands above its parent (C59 S1 D1).
  assert.match(source, /return !floating\.hasAttribute\('popover'\) && !inTopLayer\(floating\);/);
  const liftable = source.slice(source.indexOf('function liftable(floating)'), source.indexOf('export function liftToTopLayer'));
  assert.doesNotMatch(liftable, /parentElement/, 'an ancestor in the top layer does not stop the lift');
  assert.match(source, /floating\.setAttribute\('popover', 'manual'\);/);
  // The lift is measured before the caps are read, so caps come from the lifted box.
  assert.ok(source.indexOf('liftToTopLayer(floating) : null') < source.indexOf('const floatingStyle = getComputedStyle(floating);'));
});

test('the user-agent popover look is taken back by a rule of no specificity', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  const rule = source.match(/const LIFTED_RULE = `([^`]+)`;/u)?.[1];
  assert.ok(rule, 'LIFTED_RULE');
  // In the lowest Framework layer: unlayered, it outranked every component rule.
  assert.match(rule, /^@layer sf\.reset\{:where\(\[\$\{LIFTED\}\]\)\{/u);
  for (const declaration of ['inset:auto', 'margin:0', 'padding:0', 'border:0 none', 'overflow:visible', 'color:inherit', 'background-color:transparent']) {
    assert.ok(rule.includes(declaration), declaration);
  }
});

test('a container query box is asked whether it contains fixed panels, not assumed to', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  assert.match(source, /css\.containerType !== 'normal' && probesFixedOrigin\(element\)/);
  assert.doesNotMatch(source, /\|\| \(Boolean\(css\.containerType\) && css\.containerType !== 'normal'\);/);
  assert.match(source, /probe\.style\.cssText = 'position:fixed;left:0;top:0;/);
});

test('a density switch restates the gap while open (C59 S1 acceptance M1)', async () => {
  const source = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  // The length cache is keyed by the window's size and by the computed values
  // of the tokens the lengths are written with, so a density switch misses it.
  assert.match(source, /const key = `\$\{window\.innerWidth\}x\$\{window\.innerHeight\}\|\$\{values\}`;/);
  assert.match(source, /getComputedStyle\(context\)\.getPropertyValue\(name\)/);
  // A switch that moves no box still asks for a full fit.
  assert.match(source, /attributeFilter: \['data-sf-density'\]/);
  assert.match(source, /\.\.\.\(tokens\.length \? \[watchDensity\(floating\.ownerDocument, controller\.update\)\] : \[\]\)/);
  // Behaviour: tests/browser/float-anchor-nested.browser.mjs (nested overlays, 390 start/end, density).
});

test('measuring the natural height puts back what was scrolled inside the panel (R171)', async () => {
  const position = await readFile(new URL('../src/core/js/position.js', import.meta.url), 'utf8');
  // The cap comes off to measure; a list scrolling inside the panel would be
  // thrown back to its start on every reposition. Only a fit that measures
  // (full, or the first) takes the cap off; a light fit keeps it.
  assert.match(position, /let scrolled = settings\.fitHeight && \(full \|\| !measures\) \? scrollOffsets\(floating\) : null;/);
  assert.match(position, /return await place\(full, putBack\);\s*\} finally \{\s*putBack\(\);/);
  // Put back before onPosition: sf-menu scrolls its panel there (syncScroll).
  assert.match(position, /putBack\(\);\s*settings\.onPosition\?\.\(/);
  assert.match(position, /function scrollOffsets\(floating\) \{[\s\S]*?floating\.querySelectorAll\('\*'\)/);
  // At once, never through the sheet's smooth scrolling (R171 follow-up):
  // an assigned scrollTop glided from 0 and a reposition kept a value short.
  assert.match(position, /if \(element\.scrollTop !== top \|\| element\.scrollLeft !== left\) element\.scrollTo\(\{top, left, behavior: 'instant'\}\);/);
  assert.doesNotMatch(position, /element\.scrollTop = top;/);
});
