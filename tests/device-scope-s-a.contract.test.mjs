import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Device scope (study S-A, decision q-7097831f9f, group build 19 area A):
// core's two words -- layout by the width of a component's place, pointer
// coarse or fine -- the item scope `devices` with the author's mark winning
// over a component's, the long press in core, and sf-settings' use of them
// (hidden items, the «На телефоне» switch of a fields list).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const device = await import('../src/core/js/device.js');
const longPress = await import('../src/core/js/long-press.js');
const settings = await import('../src/smart/settings/js/settings.js');

test('layout: phone below 600 px of the place, desktop from 600; a written word is taken as given', () => {
  assert.equal(device.PHONE_BELOW, 600);
  assert.deepEqual(device.LAYOUTS, ['phone', 'desktop']);
  assert.equal(device.layoutOf(390), 'phone');
  assert.equal(device.layoutOf(599.98), 'phone');
  assert.equal(device.layoutOf(600), 'desktop');
  assert.equal(device.layoutOf(1440), 'desktop');
  assert.equal(device.layoutOf(0), 'desktop', 'an element not laid out yet is not a phone');
  assert.equal(device.layoutOf('phone'), 'phone');
  assert.equal(device.layoutOf('desktop'), 'desktop');
});

test('pointer: coarse only when the coarse query matches (a touch pointer and no fine one)', () => {
  assert.equal(device.COARSE_QUERY, '(pointer: coarse) and (not (any-pointer: fine))');
  const view = (matches) => ({matchMedia: (query) => ({matches: query === device.COARSE_QUERY && matches})});
  assert.equal(device.pointerKind(view(true)), 'coarse');
  assert.equal(device.pointerKind(view(false)), 'fine');
  assert.equal(device.pointerKind({}), 'fine', 'no matchMedia: fine');
});

test('scope: devices names the layouts an item is shown in; unknown words and an empty list are no scope', () => {
  assert.equal(device.devicesOf({}), null);
  assert.deepEqual(device.devicesOf({devices: ['desktop']}), ['desktop']);
  assert.deepEqual(device.devicesOf({devices: 'phone desktop'}), ['phone', 'desktop']);
  assert.equal(device.devicesOf({devices: ['tablet']}), null);
  assert.equal(device.devicesOf({devices: []}), null);
  assert.equal(device.inLayout({devices: ['desktop']}, 'phone'), false);
  assert.equal(device.inLayout({devices: ['desktop']}, 'desktop'), true);
  assert.equal(device.inLayout({devices: ['phone']}, 'desktop'), false);
  assert.equal(device.inLayout({}, 'phone'), true);
  const items = [
    {id: 'a'},
    {id: 'b', devices: ['desktop']},
    {type: 'group', items: [{id: 'c', devices: ['phone']}, {id: 'd'}]},
    {id: 'e', options: [{id: 'x'}, {id: 'y', devices: ['desktop']}]},
  ];
  const phone = device.itemsInLayout(items, 'phone', {options: true});
  assert.deepEqual(phone.map((item) => item.id ?? item.type), ['a', 'group', 'e']);
  assert.deepEqual(phone[1].items.map((item) => item.id), ['c', 'd']);
  assert.deepEqual(phone[2].options.map((option) => option.id), ['x']);
  assert.equal(device.itemsInLayout(items, 'phone')[2].options.length, 2, 'options are left alone unless asked');
  assert.equal(items[3].options.length, 2, 'the given items are not changed');
  const desktop = device.itemsInLayout(items, 'desktop', {options: true});
  assert.deepEqual(desktop.map((item) => item.id ?? item.type), ['a', 'b', 'group', 'e']);
  assert.deepEqual(desktop[2].items.map((item) => item.id), ['d']);
});

test('marks: a component marks its own items; the author\'s mark wins', () => {
  const author = [
    {id: 'nowrap', type: 'switch'},
    {id: 'grid', type: 'switch', devices: ['phone', 'desktop']},
    {type: 'group', items: [{id: 'density', type: 'choice'}, {id: 'stripes', type: 'switch'}]},
  ];
  const marked = device.markDevices(author, {nowrap: ['desktop'], grid: ['desktop'], stripes: ['desktop']});
  assert.deepEqual(marked[0].devices, ['desktop'], 'the component\'s mark on an unmarked item');
  assert.deepEqual(marked[1].devices, ['phone', 'desktop'], 'the author\'s mark wins');
  assert.equal(marked[2].items[0].devices, undefined);
  assert.deepEqual(marked[2].items[1].devices, ['desktop'], 'nested items are marked');
  assert.equal(author[0].devices, undefined, 'the author\'s items are not changed');
  assert.deepEqual(device.markDevices(author, new Map([['nowrap', ['desktop']]]))[0].devices, ['desktop']);
});

test('core publishes SF.device and SF.longPress; the list keeps its import', () => {
  assert.equal(globalThis.SF.device.layoutOf, device.layoutOf);
  assert.equal(globalThis.SF.longPress.watch, longPress.watchLongPress);
  assert.equal(globalThis.SF.longPress.ms, 500);
  const index = read('src/core/js/index.js');
  // GB20 I3/I6: core imports markPageLayout and writes the page layout word.
  assert.match(index, /import (?:\{markPageLayout\} from )?'\.\/device\.js';/u);
  assert.match(index, /import '\.\/long-press\.js';/u);
  assert.match(read('src/smart/list-item/js/long-press.js'), /export \{LONG_PRESS_MS, watchLongPress\} from '\.\.\/\.\.\/\.\.\/core\/js\/long-press\.js';/u);
  const api = JSON.parse(read('src/core/contracts/public-js-api.json')).globals;
  for (const name of ['SF.device', 'SF.longPress']) {
    const entry = api.find((one) => one.name === name);
    assert.ok(entry, name);
    assert.equal(entry.layer, 'core');
    const published = name === 'SF.device' ? globalThis.SF.device : globalThis.SF.longPress;
    assert.deepEqual([...entry.members].sort(), Object.keys(published).sort(), `${name} members`);
  }
});

test('long press: a held primary touch presses after ms; a mouse, a cancel and an early lift do not', async () => {
  const target = new EventTarget();
  const pressed = [];
  const watch = longPress.watchLongPress(target, {press: (event) => pressed.push(event.pointerId), ms: 20});
  const pointer = (type, pointerType = 'touch', pointerId = 1) => Object.assign(new Event(type), {pointerType, pointerId, isPrimary: true});
  target.dispatchEvent(pointer('pointerdown', 'mouse'));
  await new Promise((done) => setTimeout(done, 40));
  assert.deepEqual(pressed, [], 'a mouse is not a long press');
  target.dispatchEvent(pointer('pointerdown'));
  target.dispatchEvent(pointer('pointercancel'));
  await new Promise((done) => setTimeout(done, 40));
  assert.deepEqual(pressed, [], 'a scroll (pointercancel) presses nothing');
  target.dispatchEvent(pointer('pointerdown', 'touch', 2));
  await new Promise((done) => setTimeout(done, 40));
  assert.deepEqual(pressed, [2]);
  assert.equal(watch.swallowed(), true, 'the click after the press is the press\'s');
  assert.equal(watch.swallowed(), false, 'once');
  watch.stop();
});

const ITEMS = [
  {type: 'group', text: 'Колонки', items: [
    {id: 'columns', type: 'fields', text: 'Колонки', sortable: true, phoneSwitch: true, options: [
      {id: 'title', text: 'Заказ', checked: true, phone: true, sortable: false, phoneSwitch: false},
      {id: 'client', text: 'Клиент', checked: true, phone: true},
      {id: 'status', text: 'Статус', checked: true},
      {id: 'city', text: 'Город', devices: ['desktop']},
    ]},
  ]},
  {type: 'group', text: 'Вид', items: [
    {id: 'density', type: 'choice', text: 'Плотность', value: 'normal', options: [{id: 'compact', text: 'Плотно'}, {id: 'normal', text: 'Обычно'}]},
    {id: 'nowrap', type: 'switch', text: 'Текст в одну строку', value: false, devices: ['desktop']},
    {id: 'grid', type: 'switch', text: 'Линии между столбцами', value: true, devices: ['desktop']},
  ]},
];

test('sf-settings: an item scoped to the other layout is hidden, its value kept', () => {
  const ids = (groups) => groups.flatMap((group) => group.items.map((item) => item.id));
  assert.deepEqual(ids(settings.panelGroups(ITEMS)), ['columns', 'density', 'nowrap', 'grid']);
  assert.deepEqual(ids(settings.panelGroups(ITEMS, {layout: 'desktop'})), ['columns', 'density', 'nowrap', 'grid']);
  assert.deepEqual(ids(settings.panelGroups(ITEMS, {layout: 'phone'})), ['columns', 'density']);
  const phoneColumns = settings.panelGroups(ITEMS, {layout: 'phone'})[0].items[0];
  assert.deepEqual(phoneColumns.options.map((option) => option.id), ['title', 'client', 'status'], 'an option scoped to the desktop is hidden on a phone');
  // The menu looks: the entries leave the scoped rows out the same way.
  const menu = (layout) => settings.entriesFor(ITEMS, 'rows', {layout}).flatMap((entry) => (entry.items ?? [entry]).map((one) => one.id ?? one.type));
  assert.deepEqual(menu('phone').filter((id) => id !== 'heading'), ['density']);
  assert.deepEqual(menu('desktop').filter((id) => id !== 'heading'), ['density', 'nowrap', 'grid']);
  // Hidden is not lost: the values still carry them.
  const values = settings.valueMap(ITEMS);
  assert.equal(values.grid, true);
  assert.equal(values.nowrap, false);
});

test('sf-settings: phoneSwitch -- the value carries phone, a press turns one field, phoneSwitch false refuses', () => {
  const columns = ITEMS[0].items[0];
  assert.deepEqual(settings.itemValue(columns), [
    {id: 'title', checked: true, pinned: false, phone: true},
    {id: 'client', checked: true, pinned: false, phone: true},
    {id: 'status', checked: true, pinned: false, phone: false},
    {id: 'city', checked: false, pinned: false, phone: false},
  ]);
  assert.equal(settings.optionPhones(columns, columns.options[1]), true);
  assert.equal(settings.optionPhones(columns, columns.options[0]), false, 'phoneSwitch: false on the option');
  assert.equal(settings.optionPhones({...columns, phoneSwitch: false}, columns.options[1]), false);
  const turned = settings.toggledField(columns, 'status', 'phone');
  assert.deepEqual(turned.find((one) => one.id === 'status'), {id: 'status', checked: true, pinned: false, phone: true});
  assert.equal(settings.toggledField(columns, 'title', 'phone'), null, 'a field without the switch is not turned');
  const patch = settings.valuePatch(columns, turned);
  assert.equal(patch.options.find((option) => option.id === 'status').phone, true);
  // A list without phoneSwitch keeps its value shape: {id, checked, pinned}.
  const plain = {id: 'cols', type: 'fields', options: [{id: 'a', checked: true, phone: true}]};
  assert.deepEqual(settings.itemValue(plain), [{id: 'a', checked: true, pinned: false}]);
  assert.equal(settings.toggledField(plain, 'a', 'phone'), null);
});

test('sf-settings: the manifest declares device, devices, phoneSwitch and phone; the words in every language', () => {
  const component = JSON.parse(read('src/smart/settings/component.json'));
  assert.deepEqual(component.settings.device.values, ['auto', 'phone', 'desktop']);
  assert.equal(component.settings.device.default, 'auto');
  const props = component.settings.items.schema.items.properties;
  assert.deepEqual(props.devices.items.enum, ['phone', 'desktop']);
  assert.equal(props.phoneSwitch.type, 'boolean');
  assert.equal(props.phone.type, 'boolean');
  for (const code of ['ru', 'en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt-br', 'zh-hans', 'ar']) {
    const words = JSON.parse(read(`src/smart/settings/lang/${code}.json`)).runtime;
    assert.ok(words.phone, `${code} phone`);
    assert.match(words['phone-of'], /\{text\}/u, `${code} phone-of`);
  }
  assert.equal(JSON.parse(read('src/smart/settings/lang/ru.json')).runtime.phone, 'На телефоне');
  const panel = read('src/smart/settings/js/templates/panel.js');
  assert.match(panel, /class="sf-settings-row-phone" role="switch"/u);
  const sheet = read('src/smart/settings/scss/_smart__settings.scss');
  // Touch screens rule 9: the hit area of 44 on a coarse pointer, from the size scale.
  assert.match(sheet, /@media \(pointer: coarse\) and \(not \(any-pointer: fine\)\) \{[^}]*sf-settings-row-phone[^}]*\{\s*min-inline-size: var\(--sf-d1\);/u);
  // The press stays inside the row: no area reaching over the neighbours.
  assert.doesNotMatch(sheet, /sf-settings-row-phone::after/u);
  assert.match(read('src/smart/settings/index.js'), /if \(target\.closest\('\.sf-settings-row-phone-place'\)\) return;/u);
});

test('the Touch screens page states the numbers core holds', () => {
  const page = read('docs/foundation-touch-screens.md');
  for (const heading of ['## Rules', '## Numbers', '## Known gaps', '## Check']) assert.ok(page.includes(`\n${heading}\n`), heading);
  assert.ok(page.includes('(foundation-standard.md)'));
  assert.ok(page.includes('device-scope-s-a.contract.test.mjs'));
  assert.match(page, /`SF\.device\.PHONE_BELOW` \| core\/js\/device\.js \| 600 \| 600 \| 600/u);
  assert.match(page, /`SF\.longPress\.ms` \| core\/js\/long-press\.js \| 500 \| 500 \| 500/u);
  assert.match(page, /`--sf-d1` \| [^|]* \| 44 \| 44 \| 44/u);
  assert.equal(device.PHONE_BELOW, 600);
  assert.equal(longPress.LONG_PRESS_MS, 500);
  const index = read('docs/foundation-standard.md');
  assert.match(index, /\| Touch screens \| \[foundation-touch-screens\.md\]\(foundation-touch-screens\.md\) \| `tests\/device-scope-s-a\.contract\.test\.mjs`[^|\n]* \|/u);
});
