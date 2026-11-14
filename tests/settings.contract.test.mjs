import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import test from 'node:test';
import {COLOR_OPTIONS, HUES, OWN_COLOR, colorCode, colorFill, entriesFor, findItem, itemValue, rewriteValues, tileItems, valueMap, valuePatch} from '../src/smart/settings/js/settings.js';
import {PALETTE} from '../src/smart/input-color/js/color-math.js';

// sf-settings (owner decision 2026-11-06), compact settings over
// sf-menu-context: what its source promises, held without a browser. The
// behaviour is probed on the built bytes by tests/browser/settings.browser.mjs
// and src/smart/settings/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/settings/component.json');
const source = read('src/smart/settings/index.js');
const template = read('src/smart/settings/js/templates/default.js');

const ITEMS = [
  {id: 'theme', type: 'choice', text: 'Тема', value: 'system', options: [{id: 'system', text: 'Авто'}, {id: 'dark', text: 'Тёмная'}]},
  {type: 'group', text: 'Звук', items: [
    {id: 'sound', type: 'switch', text: 'Звук', value: true, tile: true},
    {id: 'volume', type: 'range', text: 'Громкость', value: 50, min: 0, max: 100, step: 10, unit: '%'},
  ]},
  {type: 'separator'},
  {id: 'night', type: 'switch', text: 'Ночь', value: false},
];

test('the manifest: a leaf of family settings with items, look, apply, search, size, for, remember, label; change, changed, reset, open, opened, close, closed; four actions', () => {
  assert.equal(manifest.tag, 'sf-settings');
  assert.equal(manifest.family, 'settings');
  assert.equal(manifest.version, '1.2.1');
  assert.deepEqual(Object.keys(manifest.settings), ['items', 'look', 'apply', 'search', 'size', 'for', 'remember', 'label']);
  // C106: the panel is a value of look (the setting «вид»); view is reserved (standard §3.1).
  assert.deepEqual(manifest.settings.look.values, ['drill', 'rows', 'tiles', 'panel']);
  assert.equal(manifest.settings.view, undefined);
  assert.deepEqual(manifest.settings.apply.values, ['instant', 'button']);
  assert.equal(manifest.settings.apply.default, 'instant');
  assert.equal(manifest.settings.search.type, 'boolean');
  assert.equal(manifest.settings.search.default, false);
  assert.ok(manifest.settings.items.schema.items.properties.type.enum.includes('fields'));
  assert.deepEqual(manifest.settings.size.values, ['1/2', '1']);
  // C106 follow-up: the popup panel of look=panel sends sf-menu-context's open/close events.
  assert.deepEqual(Object.keys(manifest.events), ['change', 'changed', 'reset', 'open', 'opened', 'close', 'closed']);
  assert.equal(manifest.events.open.cancelable, true);
  assert.equal(manifest.events.close.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.close.carries), ['reason', 'unsaved']);
  assert.deepEqual(manifest.events.close.carries.reason.values, ['close', 'escape', 'outside', 'cancelled', 'api']);
  assert.equal(manifest.events.change.cancelable, true);
  assert.equal(manifest.events.reset.cancelable, true);
  assert.equal(manifest.events.changed.cancelable, undefined);
  assert.deepEqual(Object.keys(manifest.actions), ['set-value', 'set-all', 'show', 'reset']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-menu-context', 'cl-input-color', 'cl-button', 'cl-button-icon', 'cl-tabs', 'cl-switch'], 'the colour window of the colour rows (C85) and the panel look\'s parts (C106)');
  assert.ok(manifest.relations.slice(1).every((relation) => relation.lazy), 'the panel look\'s parts do not hold up a menu look');
  assert.equal(manifest['css-variables'], undefined, 'no public variables');
  assert.equal(manifest.styles, 'scss/_smart__settings.scss');
});

test('the name is registered in the Framework\'s family settings; sf-settings-menu stays removed', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('settings'));
  assert.ok(framework.names.some(({element}) => element === 'sf-settings'));
  assert.ok(!framework.names.some(({element}) => element === 'sf-settings-menu'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/settings\/rule\.js';/u);
  assert.equal(existsSync(new URL('../src/smart/settings-menu', import.meta.url)), false);
  assert.doesNotMatch(read('src/smart/settings/rule.js'), /settings-menu/u);
});

test('values live in the items: a choice by its value, else a checked option; a write is checked against the item', () => {
  assert.deepEqual(valueMap(ITEMS), {theme: 'system', sound: true, volume: 50, night: false});
  assert.equal(itemValue({type: 'choice', options: [{id: 'a'}, {id: 'b', checked: true}]}), 'b');
  assert.equal(itemValue({type: 'choice', value: 'x', options: [{id: 'a'}]}), null);
  assert.deepEqual(valuePatch(ITEMS[0], 'dark'), {value: 'dark'});
  assert.equal(valuePatch(ITEMS[0], 'sepia'), null);
  assert.equal(valuePatch(ITEMS[3], 'yes'), null);
  assert.deepEqual(valuePatch(ITEMS[1].items[1], '70'), {value: 70});
  assert.equal(findItem(ITEMS, 'volume').text, 'Громкость');
  const {list, count} = rewriteValues(ITEMS, (item) => (item.id === 'volume' ? {value: 80} : null));
  assert.equal(count, 1);
  assert.equal(list[1].items[1].value, 80);
  assert.equal(ITEMS[1].items[1].value, 50, 'the page\'s list is not written in place');
  assert.equal(list[0], ITEMS[0], 'an item that did not change is the same object');
});

test('drill: every choice opens its options in the panel, the value as the checked option', () => {
  const entries = entriesFor(ITEMS, 'drill');
  assert.equal(entries[0].view, 'drill');
  assert.deepEqual(entries[0].options.map((option) => option.checked), [true, false]);
  assert.deepEqual(entries.map((entry) => entry.type), ['choice', 'heading', 'group', 'separator', 'switch']);
  assert.equal(entries[1].text, 'Звук', 'a group shows its title as a heading');
});

test('rows: no levels, choices quiet; a separator never opens, closes or doubles the list', () => {
  const entries = entriesFor(ITEMS, 'rows');
  assert.equal(entries[0].view, undefined);
  const lonely = entriesFor([{type: 'separator'}, {id: 'a', type: 'switch', text: 'A'}, {type: 'separator'}, {type: 'separator'}, {id: 'b', type: 'switch', text: 'B'}, {type: 'separator'}], 'rows');
  assert.deepEqual(lonely.map((entry) => entry.type), ['switch', 'separator', 'switch']);
  assert.deepEqual(entriesFor([{type: 'unknown'}, {type: 'switch', text: 'no id'}], 'rows'), []);
});

test('tiles: the switches marked tile on top, a separator, the rest as rows; unmarked, the top level\'s switches', () => {
  assert.deepEqual(tileItems(ITEMS).map((item) => item.id), ['sound']);
  const entries = entriesFor(ITEMS, 'tiles', {tilesLabel: 'Быстрые настройки'});
  assert.equal(entries[0].type, 'group');
  assert.equal(entries[0].view, 'tiles');
  assert.equal(entries[0].text, 'Быстрые настройки');
  assert.deepEqual(entries[0].items.map((item) => item.id), ['sound']);
  assert.equal(entries[1].type, 'separator');
  assert.ok(!JSON.stringify(entries.slice(1)).includes('"sound"'), 'a tile is not a row as well');
  const plain = ITEMS.map((item) => (item.type === 'group' ? {...item, items: item.items.map(({tile, ...rest}) => rest)} : item));
  assert.deepEqual(tileItems(plain).map((item) => item.id), ['night']);
});

test('it composes sf-menu-context: a fixed panel at the menu\'s ceiling (C32), drill as the menu\'s submenu, the menu\'s events kept inside', () => {
  assert.match(template, /<sf-menu-context[\s\S]*\?popup=\$\{context\.popup\}/u);
  assert.match(template, /submenu=\$\{context\.look === 'drill' \? 'drill' : 'flyout'\}/u);
  assert.match(template, /--sf-context-menu-inline-size, var\(--sf-popup-menu-max-width\)/u);
  assert.match(template, /class="sf-settings-parts" style="display: contents"/u);
  for (const verb of ['select', 'reset']) assert.match(template, new RegExp(`@sf-menu-context-${verb}=\\$\\{stop\\}`, 'u'));
  assert.match(source, /onMenuChange\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.match(source, /onMenuChanged\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.match(source, /tagSelector\('sf-menu-context'\)/u);
});

test('a change asks first, then writes and remembers through SF.Preferences; words in both languages', () => {
  const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /localStorage|sessionStorage|document\.cookie|fetch\(/u);
  assert.match(code, /this\.sfEmit\('change', detail, \{cancelable: true\}\)/u);
  assert.match(code, /this\.sfEmit\('reset', \{\}, \{cancelable: true\}\)/u);
  assert.match(code, /preferences\(\)\.write\(key, valueMap\(this\.items\)\)/u);
  const ru = json('src/smart/settings/lang/ru.json');
  const en = json('src/smart/settings/lang/en.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime.label, 'Настройки');
  assert.equal(en.runtime.label, 'Settings');
});

test('a colour row (C85): a hue by its name or an own code; the row leads with its circle, the level holds the hue circles and «Свой цвет…»', () => {
  assert.deepEqual([...HUES], [...PALETTE], 'the names sf-input-color stores');
  assert.equal(COLOR_OPTIONS.length, 10);
  const item = {id: 'accent', type: 'color', text: 'Цвет оформления', icon: 'palette', value: 'blue'};
  assert.equal(itemValue(item), 'blue');
  assert.deepEqual(valuePatch(item, 'teal'), {value: 'teal'});
  assert.equal(valuePatch(item, 'lime'), null, 'a hue the row does not offer');
  assert.deepEqual(valuePatch(item, '#ABC'), {value: '#aabbcc'});
  assert.equal(valuePatch({...item, custom: false}, '#aabbcc'), null, 'no own colour with custom false');
  assert.equal(valuePatch(item, '#aabbcc80'), null, 'no alpha');
  assert.equal(colorCode('#1F6FEB'), '#1f6feb');
  assert.equal(colorFill('blue'), 'light-dark(var(--sf-blue-50), var(--sf-blue-70))');
  const words = (key, vars = {}) => ({'hue-blue': 'Синий', 'own-color': 'Свой цвет…', 'own-color-value': `Свой: ${vars.value}`}[key] ?? key);
  const [row] = entriesFor([item], 'drill', {word: words});
  assert.equal(row.type, 'choice');
  assert.equal(row.view, 'drill');
  assert.equal(row.swatch, colorFill('blue'), 'the current colour is the row\'s circle');
  assert.equal(row.options.length, 11);
  const blue = row.options.find((option) => option.id === 'blue');
  assert.deepEqual(blue, {id: 'blue', text: 'Синий', swatch: colorFill('blue'), checked: true});
  assert.deepEqual(row.options.at(-1), {id: OWN_COLOR, text: 'Свой цвет…', icon: 'colorize', checked: false});
  const [own] = entriesFor([{...item, value: '#1f6feb'}], 'drill', {word: words});
  assert.deepEqual(own.options.at(-1), {id: OWN_COLOR, text: 'Свой: #1f6feb', swatch: '#1f6feb', checked: true});
  assert.equal(own.swatch, '#1f6feb');
  const [closed] = entriesFor([{...item, custom: false, options: ['red', {id: 'sky', text: 'Небо'}, 'nope']}], 'drill', {word: words});
  assert.deepEqual(closed.options.map((option) => option.id), ['red', 'sky']);
  assert.equal(closed.options[1].text, 'Небо');
  const ru = json('src/smart/settings/lang/ru.json').runtime;
  for (const hue of HUES) assert.ok(ru[`hue-${hue}`], hue);
  assert.equal(ru['own-color'], 'Свой цвет…');
});

test('a colour row opens sf-input-color\'s window on «Своё» against the trigger; its holder is inert while closed', () => {
  const element = read('src/smart/settings/index.js');
  const template = read('src/smart/settings/js/templates/default.js');
  assert.match(element, /item\.type === 'color' && value === OWN_COLOR\) \{\s*event\.preventDefault\(\);/u);
  assert.match(element, /picker\.openPicker\(\{anchor, view: 'own'\}\)/u);
  assert.match(template, /<span class="sf-settings-color" inert/u);
  assert.match(template, /<sf-input-color palette="false"/u);
  const menu = read('src/smart/menu-context/js/templates/default.js');
  assert.match(menu, /if \(hasSwatch\(entry\)\) return swatch\(entry\.swatch\);/u, 'the menu draws a swatch where an icon stands');
});
