import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {currentItemId, itemsFromList, normaliseItems, openBranches, withoutGroups} from '../src/smart/menu/items.mjs';
import {CHOICE_LAYOUTS, applyChoice, formatValue, normaliseItems as choiceItems, orderValues, parseValue} from '../src/smart/input-choice/js/choice-model.mjs';

// Larena's section navigation (msg-993e1e39 item 4) on sf-menu 1.3.0 and its
// choice cards (item 3) as sf-input-choice 1.0.0: the data halves, in Node.
// tests/browser/menu-groups-choice.browser.mjs measures both on the built bytes.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const SECTIONS = [
  {id: 'site', label: 'Сайт', group: true, items: [
    {id: 'address', label: 'Адрес', href: '#address', status: 'warning'},
    {id: 'data', label: 'Данные', href: '#data', count: 12},
  ]},
  {id: 'watch', label: 'Наблюдение', group: true, collapsible: true, open: false, items: [
    {id: 'journal', label: 'Журнал', href: '#journal', status: 'loud'},
  ]},
];

test('sf-menu: a first-level group holds its items, never a destination; status and count are read', () => {
  const items = normaliseItems(SECTIONS);
  assert.equal(items[0].group, true);
  assert.equal(items[0].collapsible, false);
  assert.equal(items[0].open, true, 'a group is open unless it says open: false');
  assert.equal(items[1].open, false);
  assert.deepEqual(items[0].children.map((one) => one.id), ['address', 'data']);
  assert.equal(items[0].children[0].status, 'warning');
  assert.equal(items[0].children[1].badge, '12', 'count is the counter');
  assert.equal(items[1].children[0].status, '', 'an unknown tone is no status');
  // Only a first-level item is a group.
  assert.equal(normaliseItems([{id: 'a', label: 'A', children: [{id: 'b', group: true, label: 'B'}]}])[0].children[0].group, undefined);
  assert.deepEqual(withoutGroups(items).map((one) => one.id), ['address', 'data', 'journal']);
});

test('sf-menu: a fixed group is always open in a column; a collapsible one follows its state and the current page', () => {
  const items = normaliseItems(SECTIONS);
  assert.deepEqual([...openBranches(items, new Map(), null, true)], ['site']);
  assert.deepEqual([...openBranches(items, new Map(), 'journal', true)], ['site', 'watch'], 'the current page opens its group');
  assert.deepEqual([...openBranches(items, new Map([['watch', true]]), null, false)], ['watch'], 'a row opens no fixed group; a state set stays');
  assert.equal(currentItemId(items, {current: 'site'}), null, 'a group is never the current page');
});

test('sf-menu: a section link is current while the location names its hash', () => {
  const items = normaliseItems(SECTIONS);
  const at = (hash) => currentItemId(items, {pathname: '/sites/12/', hash, base: `http://x/sites/12/${hash}`, fromLocation: true});
  assert.equal(at('#data'), 'data');
  assert.equal(at(''), null);
  assert.equal(currentItemId(normaliseItems([{id: 'p', label: 'P', href: '/sites/12/'}]), {pathname: '/sites/12/', base: 'http://x/sites/12/', fromLocation: true}), 'p');
});

test('sf-menu: groups written in the markup', () => {
  const el = (name, attrs = {}, children = [], textValue = '') => ({
    localName: name, nodeType: 1, children, childNodes: textValue ? [{nodeType: 3, textContent: textValue}, ...children] : children,
    getAttribute: (key) => (key in attrs ? attrs[key] : null), hasAttribute: (key) => key in attrs, querySelector: () => null, classList: {contains: () => false},
  });
  const link = el('a', {href: '#a'}, [], 'A');
  const list = el('ul', {}, [el('li', {'data-group': '', 'data-collapsible': '', 'data-open': 'false'}, [el('ul', {}, [el('li', {'data-status': 'error'}, [link])])], 'Группа')]);
  const [group] = normaliseItems(itemsFromList(list));
  assert.equal(group.group, true);
  assert.equal(group.collapsible, true);
  assert.equal(group.open, false);
  assert.equal(group.label, 'Группа');
  assert.equal(group.children[0].status, 'error');
});

test('sf-menu: the template draws a group as a heading naming its list, the status as the class dot', () => {
  const template = read('src/smart/menu/js/templates/default.js');
  assert.match(template, /<ul class="sf-menu" id=\$\{listId\} aria-labelledby=\$\{headingId\}/u);
  assert.match(template, /sf-dot sf-dot--size-1\/2 sf-dot--\$\{item\.status\}/u);
  const sheet = read('src/component/menu/scss/_css__menu_group.scss');
  assert.match(sheet, /min-block-size: var\(--sf-ui-1\\\/2--control-height\);/u);
  assert.match(sheet, /padding-inline: calc\(var\(--sf-space-1\) \+ var\(--sf-menu-group-heading--border-width\)\);/u);
});

test('sf-input-choice: options, the value and a press', () => {
  const items = choiceItems([{value: 'a', title: 'A', caption: 'one'}, {value: 'a'}, {label: 'no value'}, 'b', {value: 'c', disabled: true}]);
  assert.deepEqual(items.map((one) => [one.value, one.label]), [['a', 'A'], ['b', 'b'], ['c', 'c']]);
  assert.equal(items[0].caption, 'one');
  assert.deepEqual(parseValue('a, b,,a', true), ['a', 'b']);
  assert.deepEqual(parseValue('a', false), ['a']);
  assert.deepEqual(parseValue(['b', 'a'], false), ['b']);
  assert.deepEqual(orderValues(['c', 'x', 'a'], items), ['a', 'c', 'x']);
  assert.deepEqual(applyChoice(['c'], items, 'a', true, true), ['a', 'c']);
  assert.deepEqual(applyChoice(['a', 'c'], items, 'a', false, true), ['c']);
  assert.deepEqual(applyChoice(['a'], items, 'b', true, false), ['b']);
  assert.equal(formatValue(['a', 'c']), 'a,c');
});

test('sf-input-choice 1.1.0 (C28): price, term and image; three layouts', () => {
  const [one] = choiceItems([{value: 'pickup', label: 'Пункт выдачи', caption: 'Больше 2 000 пунктов', price: ' 150 ₽ ', term: '1–2 дня', image: '/t.svg', badge: 'Выгодно'}]);
  assert.deepEqual([one.caption, one.price, one.term, one.image, one.badge], ['Больше 2 000 пунктов', '150 ₽', '1–2 дня', '/t.svg', 'Выгодно']);
  assert.deepEqual([...CHOICE_LAYOUTS], ['tile', 'list', 'picture']);
  const manifest = JSON.parse(read('src/smart/input-choice/component.json'));
  assert.deepEqual(manifest.settings.layout.values, [...CHOICE_LAYOUTS]);
  assert.equal(manifest.settings.layout.default, 'tile');
  const template = read('src/smart/input-choice/js/templates/default.js');
  // The real controls: the class radio and checkbox at size 1, sf-badge, no drawn ring.
  assert.match(template, /'sf-radio-button', 'sf-radio-button--size-1'/u);
  assert.match(template, /'sf-checkbox', 'sf-checkbox--size-1'/u);
  assert.match(template, /<sf-badge class="sf-choice-badge"/u);
  assert.doesNotMatch(template, /sf-badge--tight/u);
  const sheet = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.match(sheet, /--sf-choice--padding: var\(--sf-choice-padding, var\(--sf-space-1\)\);/u);
  assert.match(sheet, /--sf-choice--gap: var\(--sf-choice-gap, calc\(var\(--sf-choice--padding\) \/ 2\)\);/u);
  assert.match(sheet, /--sf-choice-selected-background-color, var\(--sf-primary-container\)/u);
  assert.doesNotMatch(sheet, /--sf-icon--size:/u);
});

test('sf-input-choice: native inputs out of the form, one change per press, registered in the family input', () => {
  const source = read('src/smart/input-choice/index.js');
  const template = read('src/smart/input-choice/js/templates/default.js');
  assert.match(template, /type=\$\{context\.multiple \? 'checkbox' : 'radio'\}/u);
  assert.match(template, /role=\$\{context\.multiple \? 'group' : 'radiogroup'\}/u);
  assert.match(source, /const NO_FORM = 'sf-input-choice-no-form';/u);
  assert.match(source, /this\.sfEmit\('input', detail\);\n    this\.sfEmit\('change', detail\);/u);
  const names = JSON.parse(read('contracts/registry/names.json'));
  assert.ok(names.owners.find((owner) => owner.id === 'framework').names.some((one) => one.element === 'sf-input-choice'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/input-choice\/rule\.js';/u);
});
