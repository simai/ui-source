import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-drawer, owner decision C104 (4) (2026-11-12, done for sf-header-site
// first): the close stands on the axis of the switch that opened the panel,
// and a panel that covers that switch always offers a close (recipe
// admin-frame, 2026-11-15). The geometry is measured on the built bytes by
// tests/browser/drawer-close-axis.browser.mjs.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/drawer/index.js');
const sheet = read('src/smart/drawer/scss/_smart__drawer.scss');
const docs = read('src/smart/drawer/docs.md');

test('drawer C104 (4): the opener is a switch naming the drawer, noted on every opening', () => {
  assert.match(source, /\['aria-controls', 'data-sf-drawer-open', 'data-sf-drawer-toggle'\]/u);
  assert.match(source, /if \(drawer && operation !== 'close'\) drawer\._openerHint = trigger;/u);
  assert.equal((source.match(/this\.noteOpener\(\);/gu) || []).length, 3);
  // Where a press gave no focus, the focus goes back to the switch.
  assert.match(source, /if \(nowhere && opener\) this\._lastActive = focusTarget\(opener\) \|\| this\._lastActive;/u);
});

test('drawer C104 (4): the close is drawn first in the head when its side is the start', () => {
  assert.match(source, /context\.closePlacement === 'inside' && context\.closeAxis === 'start' \? closeButton : nothing/u);
  assert.match(source, /context\.closePlacement === 'inside' && context\.closeAxis !== 'start' \? closeButton : nothing/u);
  assert.match(source, /if \(this\.sheet \|\| this\.closePlacement === 'outside' \|\| \(this\.docked && this\._dockColumn\)\) return '';/u);
  assert.match(sheet, /\[data-sf-drawer-close-axis='start'\] \.sf-drawer-head \{\s*padding-inline-start: var\(--sf-drawer--close-axis, var\(--sf-drawer--inset-start\)\);/u);
  assert.match(sheet, /\[data-sf-drawer-close-axis='end'\] \.sf-drawer-head \{\s*padding-inline-end: var\(--sf-drawer--close-axis, var\(--sf-drawer--inset-end\)\);/u);
});

test('drawer C104: a panel covering its switch is not «switch on screen» and draws a close', () => {
  assert.match(source, /return !\(this\.openState && this\.coversElement\(element\)\);/u);
  assert.match(source, /showClose: \(this\.showClose && !this\._switchVisible\) \|\| coveredWithoutClose,/u);
  assert.match(source, /this\._coversOpener && !this\.showClose && !this\.hasOwnClose\(\)/u);
  assert.match(docs, /C104 \(4\)/u);
});
