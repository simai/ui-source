// C116 for sf-pagination's band of bulk actions: Apply is a regular button
// (outline on-surface), the outlined danger over an action that deletes, and
// such an action is listed last. The browser side is
// tests/browser/pagination-bulk-c116.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDestructiveAction, orderActions} from '../src/smart/pagination/js/actions.js';

const template = readFileSync(new URL('../src/smart/pagination/js/templates/default.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/smart/pagination/index.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../src/smart/pagination/component.json', import.meta.url), 'utf8'));

test('an action deletes by its danger flag or by a deleting value', () => {
  assert.equal(isDestructiveAction({value: 'delete'}), true);
  assert.equal(isDestructiveAction({value: 'remove-all'}), true);
  assert.equal(isDestructiveAction({value: 'trash'}), true);
  assert.equal(isDestructiveAction({value: 'purge', danger: true}), true);
  assert.equal(isDestructiveAction({value: 'archive'}), false);
  assert.equal(isDestructiveAction({value: 'deleted-view'}), false);
  assert.equal(isDestructiveAction(undefined), false);
});

test('the deleting actions are listed last, the rest keep their order', () => {
  const order = orderActions([{value: 'delete'}, {value: 'archive'}, {value: 'purge', danger: true}, {value: 'export'}]);
  assert.deepEqual(order.map((item) => item.value), ['archive', 'export', 'delete', 'purge']);
});

test('the actions markup takes the danger flag', () => {
  assert.match(source, /danger: flags\.includes\("danger"\)/u);
  assert.match(manifest.settings.actions['x-markup'], /danger/u);
});

test('the band is the group actions bar: the actions in its shape, the danger by the one rule, no question (C295, BA-1)', () => {
  assert.match(template, /<sf-bulk-actions[\s\S]*?\.actions=\$\{context\.bulkActions\}[\s\S]*?@sf-bulk-actions-action=\$\{\(event\) => component\.applyBulkAction\(event\)\}/u);
  assert.match(template, /@sf-bulk-actions-clear=\$\{\(\) => component\.clearSelection\(\)\}/u);
  assert.doesNotMatch(template, /data-sf-bulk="apply"|<sf-dropdown[^>]*aria-label=\$\{context\.actionsLabel\}/u);
  assert.match(source, /status: isDestructiveAction\(item\) \? "danger" : "",\s+confirm: false,/u);
  assert.match(source, /this\.setAction\(detail\.id\);\s+this\.setActionForAll\(detail\.scope === "all"\);\s+return this\.applyAction\(\);/u);
});

test('sf-pagination re-exports the bar\'s danger rule', async () => {
  const bar = await import('../src/smart/bulk-actions/js/danger.js');
  assert.equal(isDestructiveAction, bar.isDestructiveAction);
  assert.equal(orderActions, bar.orderActions);
});
