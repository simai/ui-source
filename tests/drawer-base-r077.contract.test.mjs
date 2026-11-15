import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-drawer 1.16.0, from the live record panel (ui-admin.test record r-077,
// study view-property-base): what the Framework base holds so a set can stand
// on it without page rules. The geometry is measured on the built bytes with
// the real Loader (ui-control evidence 2026-11-15-drawer-base-r077).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/drawer/index.js');
const sheet = read('src/smart/drawer/scss/_smart__drawer.scss');
const docs = read('src/smart/drawer/docs.md');
const manifest = JSON.parse(read('src/smart/drawer/component.json'));

test('drawer r-077 (1): edge controls stand outside only while there is room, else in the head', () => {
  // Whole (fills the screen) or without room beside the panel: in the head.
  assert.match(source, /const inHead = whole \|\| \(floating && this\.edgeLacksRoom\(root, panel, edge\)\);/u);
  assert.match(source, /root\.toggleAttribute\('data-sf-drawer-edge-in-head', inHead\);/u);
  // The room the column needs is measured while it stands outside.
  assert.match(source, /if \(!root\.hasAttribute\('data-sf-drawer-edge-in-head'\)\) \{/u);
  assert.match(source, /this\._edgeNeed = Math\.ceil\(seen\.width \+ 2 \* Math\.max\(0, near\)\);/u);
  // A window resize reads the room again (a fixed-width panel does not resize).
  assert.match(source, /this\.recheckOpener\(\);\n\s+\/\/ The room beside a panel of a fixed width[^\n]*\n[^\n]*\n\s+this\.onPanelScroll\(\);/u);
  // In the head the close is ghost, not the glass plate.
  assert.match(source, /const outside = context\.closePlacement === 'outside' && !this\._edgeInHead;/u);
  // The glass plate and the head row follow the in-head state, not «whole».
  assert.equal((sheet.match(/:not\(\[data-sf-drawer-edge-in-head\]\) \.sf-drawer-edge/gu) || []).length, 4);
  assert.doesNotMatch(sheet, /data-sf-drawer-whole/u);
  assert.match(sheet, /\.sf-drawer\[data-sf-drawer-edge-in-head\]:not\(\[data-sf-drawer-column='true'\]\) \.sf-drawer-edge \{[^}]*inset-inline: auto calc\(var\(--sf-drawer-edge-end, calc\(var\(--sf-px\) \* 0\)\) \+ var\(--sf-drawer-gutter, var\(--sf-space-2\)\)\);/u);
  assert.match(sheet, /\.sf-drawer\[data-sf-drawer-edge-in-head\]:has\(\.sf-drawer-edge:not\(:empty\)\) \.sf-drawer-head \{\s*padding-inline-end: calc\(var\(--sf-drawer--inset-end\) \+ var\(--sf-drawer-edge-room/u);
});

test('drawer r-077 (1): the close is first outside and last in the head (C14)', () => {
  assert.match(source, /if \(edge\) this\.orderEdge\(edge, inHead\);/u);
  assert.match(source, /if \(inHead\) edge\.prepend\(\.\.\.items\);\n\s+else edge\.append\(\.\.\.items\);/u);
  // A focused control keeps the focus when it moves.
  assert.match(source, /if \(focused && document\.activeElement !== focused\) focused\.focus\?\.\(\{preventScroll: true\}\);/u);
});

test('drawer r-077 (2): a width off the ladder is drawn and said once, naming the steps', () => {
  assert.match(source, /const LADDER_WIDTHS = \[\['1\/2', 'var\(--sf-g0\)', '20rem'\], \['1', 'var\(--sf-g2\)', '24rem'\], \['2', 'var\(--sf-g5\)', '30rem'\]\];/u);
  assert.match(source, /const OFF_LADDER_UNTIL = '2027-01-01';/u);
  assert.match(source, /if \(!width \|\| this\._offLadderWidth === width/u);
  assert.match(source, /measure\('100vi'\)/u);
  assert.match(source, /noteDeprecated\(\{component: 'sf-drawer', tag: 'sf-drawer', kind: 'value', attribute: 'width', from: width,/u);
  assert.match(source, /off the width ladder \(\$\{ladder\}, size='full' the whole screen; C157 \(2\)\)/u);
  assert.match(source, /this\.noteOffLadderWidth\(root\);/u);
  assert.match(manifest.settings.width.summary, /still drawn until 2027-01-01 and said once per element/u);
});

test('drawer r-077 (3): content headings start below the panel title, by role tokens', () => {
  const rule = sheet.match(/\.sf-drawer-body,\n\s+\.sf-drawer-foot \{([^}]*)\}/u);
  assert.ok(rule, 'the heading shift rule on the body and the foot');
  const body = rule[1];
  assert.match(body, /--sf-heading-1--size: var\(--sf-heading-5--size\);/u);
  for (const level of [2, 3, 4]) {
    assert.match(body, new RegExp(`--sf-heading-${level}--size: var\\(--sf-heading-6--size\\);`, 'u'));
    assert.match(body, new RegExp(`--sf-heading-${level}--height: var\\(--sf-heading-6--height\\);`, 'u'));
  }
  assert.doesNotMatch(body, /\d+px|\d+rem/u, 'roles only, no raw numbers');
  // The title keeps the h4 step: it is in the head, outside the shift.
  assert.match(sheet, /\.sf-drawer-title \{[^}]*font-size: var\(--sf-heading-4--size\);/u);
  assert.match(docs, /`h1` рисуется на ступени `h5`/u);
});

test('drawer r-077: the version and its migration step', () => {
  assert.equal(manifest.version, '1.16.0');
  const steps = JSON.stringify(manifest);
  assert.match(steps, /"from":"1\.13\.0","to":"1\.16\.0"/u);
});
