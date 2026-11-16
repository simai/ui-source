// Owner decision C170 (2026-11-14, control/docs-review/decisions.md, with its
// revision of (2) after R253) and the overlay study defects
// (control/research/2026-11-14-composition-overlay.md): the toolbar in groups
// with «Ещё», no label above the frame, the frame 2 clear of its block, the
// «+» under the selected block, a phone's bottom bar and the one drop line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkOverlayActions } from '../src/core/js/composition/overlay.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('C170 (1): an action takes C155\'s priority, a whole number from 1 or "pin"', () => {
  const [one, pin] = checkOverlayActions([{ id: 'up', label: 'Выше', icon: 'arrow_upward', priority: 1 }, { id: 'settings', label: 'Настройки', icon: 'settings', priority: 'pin' }]);
  assert.equal(one.priority, 1);
  assert.equal(pin.priority, 'pin');
  for (const priority of [0, 1.5, '1', 'first', null]) {
    assert.throws(() => checkOverlayActions([{ id: 'up', label: 'Выше', priority }]), TypeError, String(priority));
  }
});

test('C170 (1): up to five icons in groups, the rest under «Ещё» by the row engine; no text button (CO-1)', async () => {
  const [core, styles] = await Promise.all([read('src/core/js/composition/overlay.mjs'), read('src/smart/editor-overlay/scss/_smart__composition-overlay.scss')]);
  assert.match(core, /const ROW_ICONS = 5;/);
  assert.match(core, /import \{ drawnBox, fitByPriority, measureShown, openRowMenu, readPriority \} from '\.\.\/overflow-row\.js';/);
  assert.match(core, /if \(!action\.icon \|\| icons >= ROW_ICONS\) \{\s*this\.menuOnly\.push\(action\);/);
  assert.doesNotMatch(core, /className = 'sf-composition-overlay-action'/);
  assert.doesNotMatch(styles, /\.sf-composition-overlay-action\b/);
  // C144: 4 within a group, a 1 px separator with 4 on each side (CO-2).
  assert.match(styles, /\.sf-composition-overlay-group \{[^}]*gap: var\(--sf-space-1\\\/4\);/);
  assert.match(styles, /\.sf-composition-overlay-separator \{[^}]*inline-size: var\(--sf-px\);[^}]*margin-block: var\(--sf-space-1\\\/4\);[^}]*background-color: var\(--sf-outline-variant\);/);
});

test('C170 (2): no label above the frame; the toolbar starts with the kind icon and the name, which gives way first', async () => {
  const [core, styles] = await Promise.all([read('src/core/js/composition/overlay.mjs'), read('src/smart/editor-overlay/scss/_smart__composition-overlay.scss')]);
  assert.doesNotMatch(core, /sf-composition-overlay-label/);
  assert.doesNotMatch(styles, /sf-composition-overlay-label/);
  assert.match(core, /const roots = \[this\.nameItem, this\.nameSeparator\];/);
  assert.match(styles, /\.sf-composition-overlay-name \{[^}]*flex: 0 1 auto;/);
  assert.match(styles, /\.sf-composition-overlay-name-text \{[^}]*text-overflow: ellipsis;/);
});

test('C170 (2b): the selected frame is a 2 px line 2 clear of the block, the hover a 1 px line (CO-7, CO-8)', async () => {
  const styles = await read('src/smart/editor-overlay/scss/_smart__composition-overlay.scss');
  assert.match(styles, /\.sf-composition-overlay-frame \{[^}]*box-sizing: content-box;[^}]*padding: var\(--sf-a2\);[^}]*border: var\(--sf-px\) solid/);
  assert.match(styles, /\.sf-composition-overlay-frame--selected \{[^}]*margin: calc\(-2 \* var\(--sf-a2\)\);[^}]*border-width: var\(--sf-a2\);/);
});

test('C170 (3): the «+» under the selected block is shown, the icon button above the line with a ring', async () => {
  const [core, styles] = await Promise.all([read('src/core/js/composition/overlay.mjs'), read('src/smart/editor-overlay/scss/_smart__composition-overlay.scss')]);
  assert.match(core, /if \(after\) add\(after\.parent_id, after\.slot, after\.index, !this\.isPhone\(\)\);/);
  assert.match(core, /sf-composition-overlay-insert-mark sf-icon-button sf-icon-button--icon sf-icon-button--default sf-icon-button--primary sf-icon-button--size-1\/3/);
  assert.match(styles, /box-shadow: 0 0 0 var\(--sf-space-1\\\/4\) var\(--sf-surface-page, Canvas\);/);
});

test('C170 (4): below sm the toolbar is the bottom bar, 44 px buttons, the «+» in it, no grip', async () => {
  const [core, styles] = await Promise.all([read('src/core/js/composition/overlay.mjs'), read('src/smart/editor-overlay/scss/_smart__composition-overlay.scss')]);
  assert.match(core, /const PHONE_BELOW = 'sm';/);
  assert.match(core, /this\.phoneQuery = breakpointMedia\(PHONE_BELOW, \{ below: true \}\);/);
  assert.match(core, /button\.setAttribute\('size', phone \? '2' : '1\/2'\);/);
  assert.match(core, /const hide = phone && group\.grip;/);
  assert.match(styles, /\[data-sf-overlay-phone\] \.sf-composition-overlay-toolbar \{[^}]*position: fixed;[^}]*inset: auto 0 0;/);
});

test('C171 (4) in the overlay: its drop place is the drag module\'s one 2 px line and class', async () => {
  const core = await read('src/core/js/composition/overlay.mjs');
  assert.match(core, /height: SORTABLE_DROP_LINE \}/);
  assert.match(core, /'sf-composition-overlay-drop sf-sortable-indicator'/);
  assert.doesNotMatch(core, /height: 3 \}/);
});

test('CO-6: places are named by their block, a pick and a drop are said', async () => {
  const [core, ru, en] = await Promise.all([
    read('src/core/js/composition/overlay.mjs'),
    read('src/smart/editor-overlay/lang/ru.json').then(JSON.parse),
    read('src/smart/editor-overlay/lang/en.json').then(JSON.parse),
  ]);
  assert.doesNotMatch(core, /format\(this\.messages\.insertAt, \{ slot(,| \})/);
  assert.match(core, /this\.showKeyboardPlace\(format\(this\.messages\.picked/);
  assert.match(core, /format\(this\.messages\.dropped,/);
  for (const key of ['more', 'insert-after', 'dropped']) {
    assert.equal(typeof ru.runtime[key], 'string', key);
    assert.equal(typeof en.runtime[key], 'string', key);
  }
});
