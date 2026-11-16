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

test('Apply is outline on-surface, danger over a deleting action, drawn anew when that changes', () => {
  assert.doesNotMatch(template, /appearance="default"\s*scheme="primary"\s*text=\$\{context\.actionApplyText\}/u);
  assert.match(template, /keyed\(danger, html`<sf-button\s+data-sf-bulk="apply"[\s\S]*?appearance="outline"\s*scheme="on-surface"\s*status=\$\{danger \? "danger" : nothing\}/u);
  assert.match(template, /\.\.\.orderActions\(context\.actions\)\.map/u);
});
