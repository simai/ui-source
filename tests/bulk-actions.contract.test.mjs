// sf-bulk-actions, the group actions bar (owner decisions C291 (1), C295,
// 2026-11-17; study ui-control control/research/2026-11-17-sf-bulk-actions).
// The browser side is the component's probe.json (manifest probes) and
// tests/browser/bulk-actions.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDestructiveAction, orderActions} from '../src/smart/bulk-actions/js/danger.js';
import {VISIBLE, VISIBLE_COMPACT, normalizeAction, splitActions} from '../src/smart/bulk-actions/js/actions.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/bulk-actions/component.json'));
const en = JSON.parse(read('src/smart/bulk-actions/lang/en.json'));
const ru = JSON.parse(read('src/smart/bulk-actions/lang/ru.json'));
const template = read('src/smart/bulk-actions/js/templates/default.js');
const element = read('src/smart/bulk-actions/index.js');
const sheet = read('src/smart/bulk-actions/scss/_smart__bulk-actions.scss');
const names = JSON.parse(read('contracts/registry/names.json'));

const SITE = [
  {id: 'publish', text: 'Опубликовать', icon: 'public'},
  {id: 'move', text: 'Переместить'},
  {id: 'export', text: 'Экспорт'},
  {id: 'unpublish', text: 'Снять с публикации'},
  {id: 'archive', text: 'В архив', undo: true},
  {id: 'delete', text: 'Удалить'},
];

test('BA-1: one danger rule -- status danger, the danger flag, or an id that deletes', () => {
  assert.equal(isDestructiveAction({id: 'delete'}), true);
  assert.equal(isDestructiveAction({value: 'remove-all'}), true);
  assert.equal(isDestructiveAction({id: 'purge', status: 'danger'}), true);
  assert.equal(isDestructiveAction({id: 'wipe', status: 'error'}), true, "sf-view-table's old word");
  assert.equal(isDestructiveAction({value: 'purge', danger: true}), true, "sf-pagination's flag");
  assert.equal(isDestructiveAction({id: 'archive'}), false);
  assert.equal(isDestructiveAction({id: 'deleted-view'}), false);
  assert.equal(isDestructiveAction(null), false);
  assert.deepEqual(orderActions([{id: 'delete'}, {id: 'a'}, {id: 'b'}]).map((one) => one.id), ['a', 'b', 'delete']);
});

test('an action is read in the bar\'s shape and in the shapes of the copies it replaces', () => {
  assert.deepEqual(
    [normalizeAction({value: 'archive', text: 'В архив', danger: false}), normalizeAction({id: 'p', name: 'Опубликовать'})].map((one) => [one.id, one.text]),
    [['archive', 'В архив'], ['p', 'Опубликовать']],
  );
  const danger = normalizeAction({id: 'delete', text: 'Удалить'});
  assert.equal(danger.status, 'danger');
  assert.deepEqual(danger.confirm, {}, 'a danger asks by default (C39)');
  assert.equal(normalizeAction({id: 'delete', text: 'Удалить', confirm: false}).confirm, null, 'unless it says confirm false');
  assert.deepEqual(normalizeAction({id: 'x', text: 'X', confirm: {question: 'Точно?'}}).confirm, {question: 'Точно?'});
  assert.equal(normalizeAction({id: 'x', text: 'X', confirm: true}).confirm !== null, true);
});

test('up to three labelled actions, the rest in «⋯», the dangerous one always last in it (C295 (2))', () => {
  assert.equal(VISIBLE, 3);
  assert.equal(VISIBLE_COMPACT, 1);
  const {visible, rest} = splitActions(SITE);
  assert.deepEqual(visible.map((one) => one.id), ['publish', 'move', 'export']);
  assert.deepEqual(rest.map((one) => one.id), ['unpublish', 'archive', 'delete']);
  const two = splitActions([{id: 'publish', text: 'P'}, {id: 'delete', text: 'D'}]);
  assert.deepEqual([two.visible.map((one) => one.id), two.rest.map((one) => one.id)], [['publish'], ['delete']]);
  const phone = splitActions(SITE, VISIBLE_COMPACT);
  assert.deepEqual(phone.visible.map((one) => one.id), ['publish']);
  const ranked = splitActions([{id: 'a', text: 'A', priority: 3}, {id: 'b', text: 'B'}, {id: 'c', text: 'C', priority: 'pin'}, {id: 'd', text: 'D', priority: 1}]);
  assert.deepEqual(ranked.visible.map((one) => one.id), ['c', 'd', 'a'], 'pin first, then by C155 priority, none last');
});

test('the manifest: a new component of family bulk with the contract of C295', () => {
  assert.equal(manifest.tag, 'sf-bulk-actions');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.family, 'bulk');
  for (const name of ['count', 'page-count', 'total', 'all-selected', 'count-text', 'place', 'size', 'label', 'actions']) {
    assert.ok(manifest.settings[name], name);
  }
  assert.deepEqual(manifest.settings.place.values, ['dock', 'top', 'float', 'inline']);
  assert.equal(manifest.settings.place.default, 'dock');
  assert.deepEqual(Object.keys(manifest.settings.actions.of),
    ['id', 'text', 'icon', 'status', 'confirm', 'undo', 'min', 'max', 'reason', 'priority', 'disabled']);
  assert.deepEqual(Object.keys(manifest.events).sort(), ['action', 'clear', 'select-all', 'select-page', 'undo']);
  assert.equal(manifest.events.action.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.action.carries), ['id', 'scope', 'count']);
  assert.deepEqual(manifest.events.action.carries.scope.values, ['selection', 'all']);
  assert.deepEqual(Object.keys(manifest.actions).sort(), ['clear', 'progress', 'result']);
  assert.equal(manifest.accessibility.role, 'region');
  const framework = names.owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('bulk'));
  assert.ok(framework.names.some(({element}) => element === 'sf-bulk-actions'));
});

test('every word in both languages', () => {
  assert.deepEqual(Object.keys(ru.runtime).sort(), Object.keys(en.runtime).sort());
  assert.equal(ru.runtime['label-text'], 'Действия с выбранными');
  assert.equal(ru.runtime['select-all-text'], 'Выбрать все {n}');
  assert.equal(ru.runtime['undo-text'], 'Отменить');
});

test('the markup: a region, a plain row of buttons, the live region outside the hidden bar, nothing moves the focus', () => {
  assert.match(template, /role="region" aria-label=\$\{context\.label\} \?hidden=\$\{!context\.shown\}/u);
  assert.match(template, /<\/div><span class="sf-bulk-actions__status sr-only" role="status" aria-live="polite">/u);
  assert.match(template, /appearance="outline" scheme="on-surface"/u, 'C116');
  assert.match(template, /icon="more_horiz"/u, 'C155 (2)');
  const code = (template + element).replace(/^\s*\/\/.*$/gmu, '');
  assert.doesNotMatch(code, /roving|tabindex/u, 'an action row, not a roving toolbar');
  assert.doesNotMatch(element, /\.focus\(\)/u, 'the focus is never moved into the bar');
  assert.match(element, /SF\?\.menu\?\.open/u, 'the page\'s one menu (C184 (4))');
  assert.match(element, /modal\.setAttribute\('size', 'question'\)/u, 'the question window (C39)');
  assert.match(element, /confirm\.setAttribute\('appearance', 'window'\)/u);
  assert.match(element, /SHORT_RUN = 100/u, 'a longer run is sf-progress-run (C34)');
});

test('the sheet takes every value from the systems: gaps 16 and 8, padding space-1/4, no literal colour or length', () => {
  assert.match(sheet, /--sf-bulk-actions--gap: var\(--sf-bulk-actions-gap, var\(--sf-space-1\)\)/u);
  assert.match(sheet, /--sf-bulk-actions--group-gap: var\(--sf-space-1\\\/3\)/u);
  assert.match(sheet, /padding-block: var\(--sf-space-1\\\/4\)/u);
  const values = sheet.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  assert.doesNotMatch(values, /#[0-9a-f]{3,8}\b|rgba?\(|\b\d+px\b/iu);
});
