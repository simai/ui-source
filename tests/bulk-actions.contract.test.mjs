// sf-bulk-actions, the group actions bar (owner decisions C291 (1), C295,
// 2026-11-17; study ui-control control/research/2026-11-17-sf-bulk-actions).
// The browser side is the component's probe.json (manifest probes) and
// tests/browser/bulk-actions.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDestructiveAction, orderActions} from '../src/smart/bulk-actions/js/danger.js';
import {LONG_OVER, VISIBLE, VISIBLE_COMPACT, isLongAction, normalizeAction, resultRoute, splitActions} from '../src/smart/bulk-actions/js/actions.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/bulk-actions/component.json'));
const en = JSON.parse(read('src/smart/bulk-actions/lang/en.json'));
const ru = JSON.parse(read('src/smart/bulk-actions/lang/ru.json'));
const template = read('src/smart/bulk-actions/js/templates/default.js');
const element = read('src/smart/bulk-actions/index.js');
const actionsSource = read('src/smart/bulk-actions/js/actions.js');
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
  // GB15 A7: on a phone an action is an icon button; one without an icon would
  // draw as a second «⋯», so it goes in «⋯» with its label.
  const bare = [{id: 'archive', text: 'В архив'}, {id: 'export', text: 'Экспорт', icon: 'download'}, {id: 'tag', text: 'Метка'}];
  const phoneBare = splitActions(bare, VISIBLE_COMPACT, {iconOnly: true});
  assert.deepEqual(phoneBare.visible.map((one) => one.id), ['export']);
  assert.deepEqual(phoneBare.rest.map((one) => one.id), ['archive', 'tag']);
  assert.deepEqual(splitActions(bare.filter((one) => !one.icon), VISIBLE_COMPACT, {iconOnly: true}).visible, []);
  assert.deepEqual(splitActions(bare).visible.map((one) => one.id), ['archive', 'export', 'tag'], 'the desktop row keeps its labels');
  const ranked = splitActions([{id: 'a', text: 'A', priority: 3}, {id: 'b', text: 'B'}, {id: 'c', text: 'C', priority: 'pin'}, {id: 'd', text: 'D', priority: 1}]);
  assert.deepEqual(ranked.visible.map((one) => one.id), ['c', 'd', 'a'], 'pin first, then by C155 priority, none last');
});

test('the manifest: a new component of family bulk with the contract of C295', () => {
  assert.equal(manifest.tag, 'sf-bulk-actions');
  assert.equal(manifest.version, '1.2.3'); // GB16 G6: the static phone row leaves the offer out
  assert.equal(manifest.family, 'bulk');
  for (const name of ['count', 'page-count', 'total', 'all-selected', 'count-text', 'place', 'size', 'label', 'actions']) {
    assert.ok(manifest.settings[name], name);
  }
  assert.deepEqual(manifest.settings.place.values, ['dock', 'top', 'float', 'inline']);
  assert.equal(manifest.settings.place.default, 'dock');
  assert.deepEqual(Object.keys(manifest.settings.actions.of),
    ['id', 'text', 'icon', 'status', 'confirm', 'undo', 'long', 'done-text', 'min', 'max', 'reason', 'priority', 'disabled']);
  assert.deepEqual(Object.keys(manifest.events).sort(), ['action', 'clear', 'select-all', 'select-page', 'undo']);
  assert.equal(manifest.events.action.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.action.carries), ['id', 'scope', 'count', 'long']);
  assert.deepEqual(Object.keys(manifest.actions.result.with), ['id', 'ok', 'failed', 'text']);
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
  assert.match(element, /SHORT_RUN = LONG_OVER/u, 'a longer run is sf-progress-run (C34)');
  assert.match(actionsSource, /LONG_OVER = 100/u);
});

test('the sheet takes every value from the systems: gaps 16 and 8 from the roles, padding space-1/4, no literal colour or length', () => {
  assert.match(sheet, /--sf-bulk-actions--gap: var\(--sf-bulk-actions-gap, var\(--sf-gap--groups\)\)/u);
  assert.match(sheet, /--sf-bulk-actions--group-gap: var\(--sf-gap--actions\)/u);
  assert.match(sheet, /padding-block: var\(--sf-space-1\\\/4\)/u);
  const values = sheet.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  assert.doesNotMatch(values, /#[0-9a-f]{3,8}\b|rgba?\(|\b\d+px\b/iu);
});

test('C387: a result goes where the action\'s length says -- fast in the bar, long in a notice, a failure in «Уведомления»', () => {
  assert.equal(LONG_OVER, 100, 'C34\'s limit');
  const plain = normalizeAction({id: 'publish', text: 'Опубликовать'});
  assert.equal(plain.long, null, 'unset: by the count');
  assert.equal(plain.doneText, '');
  assert.equal(isLongAction(plain, 100), false);
  assert.equal(isLongAction(plain, 101), true);
  const forced = normalizeAction({id: 'export', text: 'Экспорт', long: true, 'done-text': 'Экспортировано'});
  assert.equal(isLongAction(forced, 2), true, 'the author\'s long');
  assert.equal(forced.doneText, 'Экспортировано');
  assert.equal(normalizeAction({id: 'x', text: 'X', doneText: 'Сделано'}).doneText, 'Сделано', 'doneText is read too');
  assert.equal(isLongAction(normalizeAction({id: 'move', text: 'Переместить', long: false}), 5000), false, 'long false keeps it in the bar');
  assert.deepEqual(resultRoute({long: false, failed: 0}), {bar: 'done', notice: null, record: false});
  assert.deepEqual(resultRoute({long: false, failed: 2}), {bar: 'failed', notice: null, record: true});
  assert.deepEqual(resultRoute({long: false, failed: 0, undo: true}), {bar: null, notice: null, record: false}, 'the undo notice said it (C25)');
  assert.deepEqual(resultRoute({long: true, failed: 0}), {bar: null, notice: 'success', record: false});
  assert.deepEqual(resultRoute({long: true, failed: 3}), {bar: null, notice: 'error', record: true});
});

test('C387: the element routes through SF.notify with its source, silently for a fast failure, and draws the done line', () => {
  assert.match(element, /const detail = \{id: action\.id, scope, count, long\}/u, 'the action event carries long');
  assert.match(element, /source: 'sf-bulk-actions'/u);
  assert.match(element, /silent: !show/u, 'a fast failure is recorded, not shown again');
  assert.match(element, /DONE_FOR = 4000/u);
  assert.match(template, /data-sf-bulk-done=\$\{shown\.kind\}/u);
  for (const key of ['done-text', 'done-own-text', 'background-text', 'failure-text', 'more-failed-text']) {
    assert.ok(ru.runtime[key] && en.runtime[key], key);
  }
  assert.equal(ru.runtime['done-text'], 'Готово: {n}');
  assert.equal(ru.runtime['background-text'], '{action}: идёт в фоне');
});

test('the live region makes its own words when it speaks (GB16 G3, view round 10 V10-1)', () => {
  const source = read('src/smart/bulk-actions/index.js');
  // The count, select-all, cleared and run lines are passed as functions that hold their numbers.
  assert.match(source, /this\.say\(\(\) => \(all \? this\.word\('all-text', all\) : this\.word\('count-text', count\)\)\)/u);
  assert.match(source, /this\.say\(\(\) => this\.sfWord\('cleared-text'\)\)/u);
  assert.match(source, /this\.say\(\(\) => this\.progressText\(made, all, text\)\)/u);
  // The drawing reads the line through the getter, which calls a function line.
  assert.match(source, /announcement: this\.announcement,/u);
  assert.match(source, /get announcement\(\) \{\n    const said = this\._announcement;\n    if \(typeof said !== 'function'\) return said \?\? '';/u);
});

test('the static phone row leaves the offer out, as the code folds it (GB16 G6, H7 first paint)', () => {
  const sheet = read('src/smart/bulk-actions/scss/_smart__bulk-actions.scss');
  const phone = sheet.slice(sheet.indexOf('@container sf-bulk-actions (width <'), sheet.indexOf('.sf-bulk-actions__lead,'));
  assert.match(phone, /\.sf-bulk-actions\[data-sf-static\] \.sf-bulk-actions__offer > button \{\n    display: none;\n  \}/u);
});
