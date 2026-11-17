// Owner decision C171 (2026-11-14, control/docs-review/decisions.md) and the
// sortable study defects (control/research/2026-11-14-sortable.md): the
// handle's move menu, the long press of a row without a handle, the whole copy
// under the pointer and one 2 px drop line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SORTABLE_DROP_LINE } from '../src/core/js/composition/sortable.mjs';
import { moveMenuEntries, moveMenuTarget } from '../src/core/js/composition/sortable-move-menu.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('C171 (1): the handle opens «Выше · Ниже · В начало · В конец», ends disabled in place', async () => {
  const ids = (entries) => entries.map((entry) => entry.type === 'separator' ? '|' : `${entry.id}${entry.disabled ? '-' : ''}`).join(' ');
  assert.equal(ids(moveMenuEntries(0, 3)), 'up- down | first- last');
  assert.equal(ids(moveMenuEntries(1, 3)), 'up down | first last');
  assert.equal(ids(moveMenuEntries(2, 3)), 'up down- | first last-');
  assert.deepEqual(['up', 'down', 'first', 'last'].map((id) => moveMenuTarget(id, 2, 5)), [1, 3, 0, 4]);
  const [menu, core, ru, en] = await Promise.all([
    read('src/core/js/composition/sortable-move-menu.mjs'),
    read('src/core/js/composition/sortable.mjs'),
    read('src/smart/sortable/lang/ru.json').then(JSON.parse),
    read('src/smart/sortable/lang/en.json').then(JSON.parse),
  ]);
  // The standard menu (placed by core's one helper, TL-8), and the very request a drag ends with.
  assert.match(menu, /import \{ standardMenu as placeStandardMenu \} from '\.\.\/overflow-row\.js';/);
  assert.match(menu, /placeStandardMenu\(list, '_sfMoveMenu'/);
  assert.doesNotMatch(menu, /createElement\('sf-menu-context'\)/);
  assert.match(menu, /requestSortableMove\(list, chosen\.item, moveMenuTarget\(id, index, all\.length\)\)/);
  assert.match(core, /export function requestSortableMove\(list, item, index\) \{[\s\S]{0,500}emitIntent\(list, \{ item: id, from: name, to: name, index, mode: 'move' \}\);/);
  // A drop is not a press: the click a pointer drag ends with is swallowed.
  assert.match(core, /if \(started\) \{ swallowNextClick\(\); this\.drop\(\); \}/);
  assert.deepEqual(['move-up', 'move-down', 'move-first', 'move-last'].map((key) => ru.runtime[key]), ['Выше', 'Ниже', 'В начало', 'В конец']);
  assert.deepEqual(['move-up', 'move-down', 'move-first', 'move-last'].map((key) => typeof en.runtime[key]), ['string', 'string', 'string', 'string']);
});

test('C171 (2): a row without a handle is taken by a long press; the page scrolls over it', async () => {
  const core = await read('src/core/js/composition/sortable.mjs');
  assert.match(core, /const LONG_PRESS = 500;/);
  assert.match(core, /const longPress = !handle && event\.pointerType === 'touch';/);
  // SO-3: the whole row no longer stops the page's own scroll.
  assert.doesNotMatch(core, /item\.style\.touchAction = 'none'/);
});

test('C171 (3): the copy under the pointer is whole, on the overlay shadow', async () => {
  const [core, styles] = await Promise.all([read('src/core/js/composition/sortable.mjs'), read('src/smart/sortable/scss/_smart__sortable.scss')]);
  assert.match(core, /for \(const name of \['data-sf-sortable-dragging', 'data-sf-sortable-lifted'/);
  assert.match(styles, /opacity: var\(--sf-sortable-ghost-opacity, 1\);/);
  assert.match(styles, /\.sf-sortable-ghost \{[^}]*box-shadow: var\(--sf-shadow-overlay\);/);
});

test('C171 (4): one drop line, 2 px, one look', async () => {
  assert.equal(SORTABLE_DROP_LINE, 2);
  const core = await read('src/core/js/composition/sortable.mjs');
  assert.doesNotMatch(core, /width: 2,|height: 2 \}|'2px'/);
});

test('SO-1: items say they can be moved', async () => {
  const core = await read('src/core/js/composition/sortable.mjs');
  assert.match(core, /item\.setAttribute\('aria-roledescription', messages\(\)\.roledescription\)/);
  // Russian is sf-sortable's language file (C282), not the module's.
  assert.match(core, /roledescription: 'draggable'/);
  assert.doesNotMatch(core, /перемещаемый/);
  assert.equal(JSON.parse(await read('src/smart/sortable/lang/ru.json')).runtime.roledescription, 'перемещаемый');
});
