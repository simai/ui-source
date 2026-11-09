import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import test from 'node:test';
import {entriesFor, findItem, itemValue, rewriteValues, tileItems, valueMap, valuePatch} from '../src/smart/settings/js/settings.js';

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

test('the manifest: a leaf of family settings with items, look, size, for, remember, label; change, changed, reset; four actions', () => {
  assert.equal(manifest.tag, 'sf-settings');
  assert.equal(manifest.family, 'settings');
  assert.equal(manifest.version, '1.0.3');
  assert.deepEqual(Object.keys(manifest.settings), ['items', 'look', 'size', 'for', 'remember', 'label']);
  assert.deepEqual(manifest.settings.look.values, ['drill', 'rows', 'tiles']);
  assert.deepEqual(manifest.settings.size.values, ['1/2', '1']);
  assert.deepEqual(Object.keys(manifest.events), ['change', 'changed', 'reset']);
  assert.equal(manifest.events.change.cancelable, true);
  assert.equal(manifest.events.reset.cancelable, true);
  assert.equal(manifest.events.changed.cancelable, undefined);
  assert.deepEqual(Object.keys(manifest.actions), ['set-value', 'set-all', 'show', 'reset']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-menu-context']);
  assert.equal(manifest['css-variables'], undefined, 'no sheet of its own');
  assert.equal(existsSync(new URL('../src/smart/settings/scss', import.meta.url)), false);
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

test('it composes sf-menu-context: a fixed 280 px panel, drill as the menu\'s submenu, the menu\'s events kept inside', () => {
  assert.match(template, /<sf-menu-context[\s\S]*\?popup=\$\{context\.popup\}/u);
  assert.match(template, /submenu=\$\{context\.look === 'drill' \? 'drill' : 'flyout'\}/u);
  assert.match(template, /--sf-context-menu-inline-size, calc\(var\(--sf-f7\) \+ var\(--sf-a8\)\)/u);
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
