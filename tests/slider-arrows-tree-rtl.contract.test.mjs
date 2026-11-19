import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

// component.slider 1.3.2: the two arrows are buttons of one group (C105 H5),
// 8 apart wherever the pair stands in a row of its own (they touched outside a
// slider). component.tree 1.5.1: right to left the closed chevron points to the
// start (class tree and sf-tree draw the same .sf-tree-chevron).

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const rule = (sheet, selector) => {
  const at = sheet.indexOf(`\n${selector} {`) >= 0 ? sheet.indexOf(`\n${selector} {`) : sheet.indexOf(`  ${selector} {`);
  assert.ok(at >= 0, selector);
  const open = sheet.indexOf('{', at + selector.length);
  return sheet.slice(open + 1, sheet.indexOf('}', open));
};

test('slider: the arrow pair is a row 8 apart', () => {
  const arrows = rule(read('src/component/slider/scss/_css__slider_arrows.scss'), '.sf-slider-arrows');
  assert.match(arrows, /display: inline-flex;/u);
  assert.match(arrows, /gap: var\(--sf-space-1\\\/3\);/u);
  assert.equal(JSON.parse(read('src/component/slider/passport.json')).version, '1.4.2'); // GB10 fix/misc-m10: the ratio slider has no slide floor (1.3.3 in group build 9) // group build 10: 1.4.1 moved on by the merged branches or a GB10 patch
});

test('tree: the chevron is mirrored right to left', () => {
  const sheet = read('src/component/tree/scss/_css__tree.scss');
  // With the scale property the icons sheet turns a directional glyph with:
  // one turn whatever the glyph (a transform as well turned chevron_right
  // back; RTL icons, 2026-11-19).
  assert.match(rule(sheet, '.sf-tree .sf-tree-chevron:dir(rtl)'), /scale: -1 1;/u);
  assert.doesNotMatch(rule(sheet, '.sf-tree .sf-tree-chevron:dir(rtl)'), /transform/u);
  assert.equal(JSON.parse(read('src/component/tree/passport.json')).version, '1.6.1'); // fix/rtl-direction-icons: one turn // group build 10: 1.5.1 moved on by the merged branches or a GB10 patch
});
