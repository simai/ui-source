import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// Popup head round 3 (DEV msg-161b24f8, group build 16): PH-7 one step for the
// whole filter window, set once; the owner's scroll variant B -- the rows give
// the scrollbar its room from their end padding, so nothing shifts.
test('PH-7: the filter window has one step, set once, for every part', () => {
  const shell = read('src/smart/field-renderers/filter-window.js');
  assert.match(shell, /export const FILTER_WINDOW_STEP = '1';/u);
  assert.match(shell, /size: FILTER_WINDOW_STEP,/u, 'what the window draws reads one step (filterSize)');
  assert.match(shell, /const footSize = FILTER_WINDOW_STEP;/u);
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /function windowStep\(\) \{\s*return FILTER_WINDOW_STEP;\s*\}/u);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.3') // GB19 B: include view owns no lit DOM // GB18 L6; // FS-9 (feat/form-defects-fs, merged in GB17); // group build 17 F4: option badge hue // group build 16 returns GB16-3: the phone sheet fills
});

test('Variant B: a panel list gives the scrollbar its rows\' end padding; its search does not move', () => {
  const sheet = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.match(sheet, /\.sf-choice--list\[data-panel\]\[data-sf-choice-track\] :is\(\.sf-choice-row, \.sf-choice-status, \.sf-choice-message\) \{\s*padding-inline-end: max\(calc\(var\(--sf-px\) \* 0\), calc\(var\(--sf-choice--panel-inset\) - var\(--sf-scroll-bg-width\)\)\);/u);
  // GB20 integration I1 (DEV answer 1): the panel keeps the track's room (scrollbar-gutter: stable), so the
  // search's end follows the larger of the inset and the track, the same with and without a scrollbar.
  assert.match(sheet, /\[data-panel\]\[data-sf-choice-track\] \.sf-choice-search \{\s*padding-inline-end: max\(var\(--sf-choice--panel-inset\), var\(--sf-scroll-bg-width\)\);/u);
  assert.match(sheet, /\.sf-choice--list:not\(\[data-panel\]\)\[data-sf-choice-track\] \.sf-choice-search \{/u);
  assert.doesNotMatch(read('src/smart/field-renderers/filter-window.js'), /--sf-dropdown-band-end/u); // the choice sheet writes it (GB20 I1)
  assert.equal(json('src/smart/input-choice/component.json').version, '1.12.1'); // GB20 integration I1: the kept scrollbar room // group build 17 F3/F4
});
