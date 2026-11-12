// sf-settings look="panel" (owner decision C106, 2026-11-12; R193, the
// dropdown-panels study, defects DP-1..DP-9): a list's view settings in a
// panel of the element's own. Held here without a browser; measured in a
// browser in ui-control control/evidence/2026-11-12-settings-c106/.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  applyCount, fieldOptions, itemValue, matches, movedField, panelGroups, panelLayout, placedField, sameValue,
  toggledField, valueMap, valuePatch, entriesFor,
} from '../src/smart/settings/js/settings.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/smart/settings/index.js');
const panel = read('src/smart/settings/js/templates/panel.js');
const css = read('src/smart/settings/scss/_smart__settings.scss');

const COLUMNS = {id: 'columns', type: 'fields', text: 'Поля', sortable: true, pinnable: true, options: [
  {id: 'name', text: 'Название', checked: true},
  {id: 'status', text: 'Статус', checked: true},
  {id: 'due', text: 'Срок'},
  {id: 'tags', text: 'Тёги', pinned: true},
]};
const VIEW = {type: 'group', text: 'Вид', items: [
  {id: 'density', type: 'choice', text: 'Плотность', value: 'normal', options: [{id: 'compact', text: 'Плотно'}, {id: 'normal', text: 'Обычно'}]},
  {id: 'stripes', type: 'switch', text: 'Полосы', value: true},
]};

test('a fields list keeps its value in its options: in order, the pinned first', () => {
  assert.deepEqual(fieldOptions(COLUMNS).map((option) => option.id), ['tags', 'name', 'status', 'due']);
  assert.deepEqual(itemValue(COLUMNS), [
    {id: 'tags', checked: false, pinned: true}, {id: 'name', checked: true, pinned: false},
    {id: 'status', checked: true, pinned: false}, {id: 'due', checked: false, pinned: false},
  ]);
  assert.deepEqual(valueMap([COLUMNS]).columns.map((one) => one.id), ['tags', 'name', 'status', 'due']);
  // The ids to check, order kept; an unknown id makes the value invalid.
  assert.deepEqual(valuePatch(COLUMNS, ['due']).options.filter((option) => option.checked).map((option) => option.id), ['due']);
  assert.equal(valuePatch(COLUMNS, ['nope']), null);
  assert.equal(valuePatch(COLUMNS, 'name'), null);
  // A new order: the ones left out follow, the pinned stay first.
  assert.deepEqual(valuePatch(COLUMNS, [{id: 'due'}, {id: 'name', checked: false}]).options.map((option) => [option.id, Boolean(option.checked)]),
    [['tags', false], ['due', false], ['name', false], ['status', true]]);
  assert.ok(sameValue(itemValue(COLUMNS), itemValue({...COLUMNS})));
  assert.ok(!sameValue(itemValue(COLUMNS), movedField(COLUMNS, 'status', 1)));
});

test('order: Alt+arrows move a row within its block; a drag lands in its block; a pin moves it to the top', () => {
  assert.deepEqual(movedField(COLUMNS, 'status', -1).map((one) => one.id), ['tags', 'status', 'name', 'due']);
  assert.equal(movedField(COLUMNS, 'name', -1), null, 'a field does not pass above a pinned one');
  assert.equal(movedField(COLUMNS, 'due', 1), null);
  assert.deepEqual(placedField(COLUMNS, 'due', 'tags').map((one) => one.id), ['tags', 'due', 'name', 'status'], 'held below the pinned');
  assert.deepEqual(placedField(COLUMNS, 'name', null).map((one) => one.id), ['tags', 'status', 'due', 'name']);
  assert.equal(placedField(COLUMNS, 'name', 'status'), null, 'no move, no value');
  const pinned = valuePatch(COLUMNS, toggledField(COLUMNS, 'status', 'pinned')).options;
  assert.deepEqual(pinned.map((option) => option.id), ['tags', 'status', 'name', 'due']);
  assert.equal(toggledField({...COLUMNS, options: [{id: 'x', disabled: true}]}, 'x', 'checked'), null);
});

test('groups: sections by default; tabs only with a search and a group that holds a fields list', () => {
  const items = [{type: 'group', text: 'Поля', items: [COLUMNS]}, VIEW];
  assert.deepEqual(panelGroups(items).map((group) => group.text), ['Поля', 'Вид']);
  assert.equal(panelLayout(items), 'sections');
  assert.equal(panelLayout(items, {search: true}), 'tabs');
  assert.equal(panelLayout([VIEW, {type: 'group', text: 'Ещё', items: VIEW.items}], {search: true}), 'sections');
  assert.equal(panelLayout([COLUMNS], {search: true}), 'sections', 'one group is never a tab');
  assert.deepEqual(panelGroups([COLUMNS, VIEW]).map((group) => group.text), ['', 'Вид'], 'loose settings make an untitled group');
});

test('search: no case, ё as е; «Применить (N)» counts the checked fields and the switches on', () => {
  assert.ok(matches('тег', 'Тёги'));
  assert.ok(matches('', 'anything'));
  assert.ok(!matches('срок', 'Статус'));
  assert.equal(applyCount([COLUMNS, VIEW]), 3);
});

test('a fields list is the panel look\'s alone: the menu looks leave it out', () => {
  assert.deepEqual(entriesFor([COLUMNS, {id: 's', type: 'switch', text: 'S'}], 'rows').map((entry) => entry.id), ['s']);
});

test('the panel is not the action menu: a dialog popup or a group, its own closing, a sheet on a phone (DP-7, C106 (8))', () => {
  assert.match(panel, /role=\$\{context\.popup \? 'dialog' : 'group'\}/u);
  assert.match(source, /onEscape: \(\) => \{\n\s+this\.closePanel\(\{reason: 'escape'\}\);/u);
  assert.match(source, /onOutsidePress: \(event\) =>/u);
  assert.match(source, /closePanel\(\{restoreFocus: false, reason: 'api'\}\)/u, 'Tab out closes it');
  assert.match(source, /panel\.toggleAttribute\('data-sf-sheet', sheet\)/u);
  assert.match(source, /aria-haspopup', 'dialog'/u);
  assert.match(css, /\.sf-settings-panel\[data-sf-sheet\] \{[^}]*position: fixed;[^}]*max-inline-size: var\(--sf-h1\);/su);
});

test('a list is one Tab stop with the arrows inside; Alt+arrows move a row and say its place (DP-4, C106 (6))', () => {
  assert.match(panel, /tabindex=\$\{row\.current \? '0' : '-1'\}/u);
  assert.match(source, /if \(event\.key === 'ArrowDown'\) next = rows\[\(at \+ 1\) % rows\.length\];/u);
  assert.match(source, /event\.altKey && \(event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'\)/u);
  assert.match(source, /this\.announce\(this\.sfWord\('position', \{vars: \{text: label, index, count: options\.length\}\}\)\)/u);
  assert.match(panel, /aria-live="polite"/u);
  assert.equal(JSON.parse(read('src/smart/settings/lang/ru.json')).runtime.position, '{text}: {index} из {count}');
});

test('a checked field is the light fill with a check at the end; one choice the fill alone; the handle at the start (C106 (2), (3); DP-3)', () => {
  assert.match(panel, /if \(kind === 'field'\) return icon\('check', 'sf-settings-row-check'\);/u);
  assert.match(panel, /row\.handle \? icon\('drag_indicator', 'sf-settings-row-handle'\) : nothing\}\n\s+<span class="sf-settings-row-text">/u);
  assert.match(css, /\.sf-settings-row:is\(\.sf-settings-row--field, \.sf-settings-row--option\)\[data-checked\] \{\n\s+background-color: var\(--sf-primary-container\);/u);
  assert.match(css, /\.sf-settings-row:not\(\[data-disabled\]\):hover \{\n\s+background-color: var\(--sf-surface-state-select\);/u);
  assert.doesNotMatch(panel, /sf-checkbox/u, 'no checkboxes: a field is a check mark, a choice a fill');
});

test('apply: at once with one «Сбросить»; by the button «Сбросить» and «Применить (N)» (C106 (4))', () => {
  assert.match(panel, /if \(apply !== 'button'\) return html`<div class="sf-settings-panel-footer">\$\{reset\}<\/div>`;/u);
  assert.match(panel, /const label = count \? `\$\{words\.apply\} \(\$\{count\}\)` : words\.apply;/u);
  assert.match(source, /if \(this\.applyMode === 'button'\) \{\n\s+const draft = this\.shownItems\(\);/u);
});

test('geometry from the systems: the C32 panel step, inset 1/4, H4 row inset, the scroll-area inset rule without a gutter (DP-9)', () => {
  assert.match(css, /inline-size: var\(--sf-popup-panel-width\);/u);
  assert.match(css, /--sf-settings-panel--inset: var\(--sf-space-1\\\/4\);/u);
  assert.match(css, /--sf-settings-panel--pad: var\(--sf-ui-1--space-x\);/u);
  assert.match(css, /@include panel\.scrollbar\(var\(--sf-settings-panel--inset\), --sf-settings-panel--track, var\(--sf-settings-panel--row-height\), var\(--sf-scroll-thumb-width\)\);/u);
  assert.match(css, /\.sf-settings-panel-body\.sf-settings-panel-body--scrollbar \{\n\s+padding-inline-end: 0;/u);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//gu, ''), /scrollbar-gutter/u);
  assert.match(source, /this\._scrollbar\.watch\(body, 'sf-settings-panel-body--scrollbar'\)/u);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//gu, ''), /\d+px|\d+rem/u, 'no lengths of its own');
});
