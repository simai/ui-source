// sf-settings look="panel" (owner decision C106, 2026-11-12; R193, the
// dropdown-panels study, defects DP-1..DP-9): a list's view settings in a
// panel of the element's own. Held here without a browser; measured in a
// browser in ui-control control/evidence/2026-11-12-settings-c106/.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  applyCount, choiceOrder, fieldOptions, itemValue, matches, movedField, orderMap, orderPatch, panelGroups, panelLayout, placedField, sameValue,
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
  // The one sheet (owner decision C157 (5)): drawn from the core sheet mixin.
  assert.match(css, /\.sf-settings-panel\[data-sf-sheet\] \{[^}]*@include sheet\.sheet-surface;/su);
  const mixin = readFileSync(new URL('../src/core/scss/mix/_mix__sheet.scss', import.meta.url), 'utf8');
  assert.match(mixin, /@mixin sheet-surface \{[^}]*position: fixed;[^}]*max-inline-size: var\(--sf-measure-96\);/su); // C396: 96 characters (44rem before)
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
  assert.match(panel, /row\.handle \? icon\('drag_indicator', 'sf-settings-row-handle'\) : row\.sorts \? icon\('drag_indicator', 'sf-settings-row-handle-place'\) : nothing\}\n\s+<span class="sf-settings-row-text">/u);
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

test('the popup panel sends sf-menu-context\'s open/close events: open asks, opened, close asks with reason and unsaved, closed (C106 follow-up 6)', () => {
  assert.match(source, /if \(!this\.sfEmit\('open', \{\}, \{cancelable: true\}\)\) return false;/u);
  assert.match(source, /this\.sfEmit\('opened', \{\}\);/u);
  assert.match(source, /if \(ask && !this\.sfEmit\('close', \{reason, unsaved: this\.draftMoved\(\)\}, \{cancelable: true\}\)\) return false;/u);
  assert.match(source, /this\.sfEmit\('closed', \{reason\}\);/u);
  // Leaving the page does not ask; show() answers cancelled when open is prevented.
  assert.match(source, /this\.closePanel\(\{restoreFocus: false, reason: 'api', ask: false\}\);\n    this\._scrollbar\.disconnect\(\);/u);
  assert.match(source, /if \(!\(await this\.openPanel\(anchor\)\)\) return \{outcome: 'cancelled'\};/u);
  // The same names and details as sf-menu-context's.
  const own = JSON.parse(read('src/smart/settings/component.json')).events;
  const menu = JSON.parse(read('src/smart/menu-context/component.json')).events;
  for (const name of ['opened', 'close', 'closed']) assert.deepEqual(own[name].carries, menu[name].carries, name);
  // The menu's open names the object it is opened for (C164 (2)); the panel has no object.
  assert.deepEqual(own.open.carries, {});
  assert.deepEqual(Object.keys(menu.open.carries), ['target', 'targets']);
});

test('the menu\'s panel head chooses a tab on sf-tabs-change and only stops the former sf-tab-change (C106 follow-up 3)', () => {
  const head = read('src/smart/menu-context/js/templates/default.js');
  assert.match(head, /@sf-tabs-change=\$\{\(event\) => \{\n\s+event\.stopPropagation\(\);\n\s+context\.component\.chooseTab\(/u);
  assert.match(head, /@sf-tab-change=\$\{\(event\) => event\.stopPropagation\(\)\}/u);
  assert.equal((head.match(/chooseTab\(/gu) || []).length, 1);
});

test('ST-2, C166: the pin is sf-button-icon that names itself; RT-1: the footer buttons a button group apart', () => {
  const panel = read('src/smart/settings/js/templates/panel.js');
  assert.match(panel, /<sf-button-icon class="sf-settings-row-pin" icon="push_pin" appearance="ghost"/u);
  assert.doesNotMatch(panel, /<button type="button" class="sf-settings-row-pin"/u);
  assert.match(panel, /title=\$\{row\.pinned \? words\.unpin : words\.pin\}/u);
  assert.match(panel, /tabindex="-1"/u);
  assert.match(css, /\.sf-settings-row-pin > \.sf-icon-button \{/u);
  // Its icon is the row's line: the panel's size, height low; its place is its square.
  assert.match(panel, /size=\$\{size === '1' \? '1' : '1\/2'\} height="low"/u);
  assert.match(css, /--sf-settings-panel--pin: calc\(var\(--sf-text-height-1\\\/2\) \+ 2 \* var\(--sf-ui-1\\\/2--space-y-tightness-low\)\);/u);
  assert.match(css, /--sf-settings-panel--pin: calc\(var\(--sf-text-height-1\) \+ 2 \* var\(--sf-ui-1--space-y-tightness-low\)\);/u);
  const footer = css.match(/\.sf-settings-panel-footer \{([^}]*)\}/u)[1];
  // Group build 7: the role (C173 (9) RT-ROLE-STEP); --sf-gap--actions is --sf-space-1/3, compact 4.
  assert.match(footer, /gap: var\(--sf-gap--actions\);/u);
});

test('C166 follow-up, C144: the footer labels stay on one line; the buttons grow from their labels and wrap as a whole', () => {
  const footer = css.match(/\.sf-settings-panel-footer \{([^}]*)\}/u)[1];
  assert.match(footer, /flex-wrap: wrap;/u);
  const share = css.match(/\.sf-settings-panel-footer > \*,\n\.sf-settings-panel-footer > sf-button > \.sf-button \{([^}]*)\}/u)[1];
  // Equal halves from a zero basis squeezed «Применить (12)» to two lines at size 1/2.
  assert.match(share, /flex: 1 1 auto;/u);
  assert.doesNotMatch(share, /flex: 1 1 0;/u);
  assert.match(css, /\.sf-settings-panel-footer \.sf-button-text-container \{\s*white-space: nowrap;\s*\}/u);
  const component = JSON.parse(read('src/smart/settings/component.json'));
  assert.equal(component.version, '1.10.1'); // group build 16: VR11-4 head step; // FF-5, FF-6: 1.9.0 above 1.8.0 // C106 order // group build 10: 1.7.2 moved on by the merged branches or a GB10 patch // group build 14: 1.9.0 moved on by the merged branches or the C278 language patch // group build 15: moved on by the merged branches or a GB15 assembly item
});

// The SIMAI Framework order of the sf-view-table move (C106; ui-control
// control/evidence/2026-11-17-view-c106-settings «Left»).
const TEMPLATES = {id: 'template', type: 'choice', text: 'Шаблоны', sortable: true, pinnable: true, value: 'mine', options: [
  {id: 'all', text: 'Все', sortable: false, pinnable: false},
  {id: 'mine', text: 'Мои'},
  {id: 'late', text: 'Просроченные', pinned: true},
  {id: 'week', text: 'Эта неделя'},
]};

test('C106 (3), (6): a choice that orders and pins -- its value the chosen id, its order [{id, pinned}] apart', () => {
  assert.equal(itemValue(TEMPLATES), 'mine');
  assert.deepEqual(choiceOrder(TEMPLATES), [{id: 'late', pinned: true}, {id: 'all', pinned: false}, {id: 'mine', pinned: false}, {id: 'week', pinned: false}]);
  assert.deepEqual(orderMap([{type: 'group', items: [TEMPLATES]}]), {template: choiceOrder(TEMPLATES)});
  assert.deepEqual(orderMap([{...TEMPLATES, sortable: false, pinnable: false}]), {}, 'a plain choice reports no order');
  // Moving passes the option that does not move; it keeps its place.
  assert.deepEqual(movedField(TEMPLATES, 'week', -1).map((one) => one.id), ['late', 'all', 'week', 'mine']);
  assert.deepEqual(movedField(TEMPLATES, 'mine', -1), null, 'the fixed «Все» is not passed above the block start');
  assert.equal(movedField(TEMPLATES, 'all', 1), null, 'sortable: false does not move');
  assert.deepEqual(placedField(TEMPLATES, 'week', 'all').map((one) => one.id), ['late', 'all', 'week', 'mine'], '«Все» stays second');
  // A pin: toggled, the order patched, the chosen option kept.
  const pinned = toggledField(TEMPLATES, 'mine', 'pinned');
  assert.deepEqual(pinned.find((one) => one.id === 'mine'), {id: 'mine', pinned: true});
  const patched = {...TEMPLATES, ...orderPatch(TEMPLATES, pinned)};
  assert.deepEqual(patched.options.map((one) => one.id), ['late', 'mine', 'all', 'week']);
  assert.equal(itemValue(patched), 'mine');
  assert.equal(toggledField(TEMPLATES, 'all', 'pinned'), null, 'pinnable: false is never pinned');
  assert.equal(toggledField(TEMPLATES, 'mine', 'checked'), null, 'a choice has no checks');
  assert.equal(orderPatch(TEMPLATES, ['nope']), null);
  assert.deepEqual(orderPatch(TEMPLATES, ['week']).options.map((one) => one.id), ['late', 'week', 'all', 'mine']);
});

test('per option: sortable false and pinnable false in a fields list keep their places; the rows keep the handle and pin places', () => {
  const columns = {...COLUMNS, options: [{id: 'select', text: 'Выбор', checked: true, sortable: false, pinnable: false}, ...COLUMNS.options]};
  assert.deepEqual(movedField(columns, 'name', -1), null, 'not passed above a pinned one');
  assert.equal(movedField(columns, 'select', 1), null);
  assert.deepEqual(placedField(columns, 'due', 'name').map((one) => one.id), ['tags', 'select', 'due', 'name', 'status']);
  assert.equal(toggledField(columns, 'select', 'pinned'), null);
  assert.ok(toggledField(columns, 'select', 'checked'), 'it is still checked or not');
  assert.match(panel, /handle: optionMoves\(item, option\), pin: optionPins\(item, option\),/u);
  assert.match(panel, /\$\{row\.pins \? html`<span class="sf-settings-row-pin-place" aria-hidden="true"><\/span>` : nothing\}/u);
  assert.match(css, /\.sf-settings-row-handle-place \{\n\s+visibility: hidden;/u);
});

test('the order: words per element, open({tab}) and close(), tab, apply-count, the arrange events, C22 sizes, C157 (3) footer', () => {
  for (const [name, word] of [['closeLabel', 'close'], ['searchPlaceholder', 'search'], ['emptyText', 'empty'], ['pinLabel', 'pin'], ['unpinLabel', 'unpin'], ['moveLabel', 'move-hint']]) {
    assert.match(source, new RegExp(`this\\.${name} \\|\\| this\\.sfWord\\('${word}'\\)`, 'u'), name);
  }
  assert.match(source, /async open\(given\) \{/u);
  assert.match(source, /close\(\) \{\n\s+if \(!this\._open\) return \{outcome: 'refused', reason: 'not-open'\};/u);
  assert.match(source, /get tab\(\) \{/u);
  assert.match(source, /count: Number\.isInteger\(this\.applyCount\) && this\.applyCount >= 0 \? this\.applyCount : applyCount\(items\),/u);
  assert.match(source, /if \(!this\.sfEmit\('arrange', detail, \{cancelable: true\}\)\) \{/u);
  assert.match(source, /this\.sfEmit\('arranged', detail\);/u);
  assert.match(source, /if \(!same\(was\[id\], value\)\) this\.writeOrdered\(id, value\);/u, 'a draft order goes out on Apply');
  assert.doesNotMatch(panel.replace(/\/\/.*$/gmu, ''), /<sf-button[^>]* size="1\/2"/u, 'no hand size 1/2 on the panel\'s buttons (C22)');
  assert.match(panel, /<div class="sf-settings-panel-footer"><sf-button size=\$\{size\} text=\$\{label\} data-sf-apply><\/sf-button>\$\{reset\}<\/div>/u);
  assert.equal(applyCount([COLUMNS, VIEW]), 3);
});

test('C22: compact density steps the panel once -- no rule of the panel moves its rows and text to the 1/2 tokens again', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  assert.doesNotMatch(rules, /\[data-sf-density='compact'\] \.sf-settings-panel--size-1/u);
  assert.doesNotMatch(rules, /\.sf-settings-panel--size-1\[data-sf-density='compact'\]/u);
});
