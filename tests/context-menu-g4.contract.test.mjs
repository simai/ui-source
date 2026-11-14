// sf-menu-context 1.18.0 and component.kbd 1.3.3: the defects CM-2, CM-5,
// CM-6 and CM-9 of ui-control research 2026-11-14-context-menu.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {shortcutView} from '../src/component/kbd/js/shortcut.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the menu keeps size 1/2 by default (owner decision C134); the region ladder moves it (C79)', () => {
  const component = JSON.parse(read('src/smart/menu-context/component.json'));
  assert.equal(component.settings.size.default, '1/2');
  assert.deepEqual(component.settings.size.values, ['1/2', '1']);
  assert.match(read('src/smart/menu-context/index.js'), /size: \{ default: "1\/2" \}/u);
});

test('CM-5 and CM-2: a point anchor opens at the point and gives the focus back to what is under it', () => {
  const menu = read('src/smart/menu-context/index.js');
  assert.match(menu, /const point = pointOf\(anchor, this\);/u);
  // no --sf-space-1/4 gap under the pointer; a page's own offset still wins
  assert.match(menu, /offset === undefined \|\| offset === null \|\| offset === "" \? \(point \? \{offset: 0\} : \{\}\) : \{offset\}/u);
  // a host without a box of its own (sf-button) is never a point
  assert.match(menu, /if \(!anchor\.getClientRects\?\.\(\)\.length\) return null;/u);
  assert.match(menu, /: point \? point\.focusable : focusable\(anchor\),/u);
  assert.match(menu, /if \(owned\.lent && owned\.returnTo\?\.isConnected\) focusLent\(owned\.returnTo, \{preventScroll: true\}\);/u);
  assert.match(menu, /element\.setAttribute\("tabindex", "-1"\);/u);
});

test('CM-6: an example opens the menu on a right-click over a row', () => {
  const {examples} = JSON.parse(read('src/smart/menu-context/examples.json'));
  const example = examples.find(({name}) => name === 'right-click');
  assert.ok(example, 'the right-click example');
  assert.match(example.markup, /oncontextmenu="event\.preventDefault\(\);/u);
  assert.match(example.markup, /menu\.openFor\(point\)/u);
  assert.match(example.markup, /tabindex="0"/u);
  assert.ok(example.settings.popup);
  assert.ok(example.settings.entries.some((entry) => entry.shortcut === 'delete' && entry.danger));
  assert.match(read('src/smart/menu-context/static/default/right-click.html'), /Действия с файлом/u);
});

test('CM-9: delete reads ⌦ on a Mac and Del elsewhere; backspace ⌫ on both', () => {
  assert.deepEqual(shortcutView('delete', true).keys.map(({text}) => text), ['⌦']);
  assert.deepEqual(shortcutView('delete', false).keys.map(({text}) => text), ['Del']);
  assert.deepEqual(shortcutView('mod+delete', true).keys.map(({text}) => text), ['⌘', '⌦']);
  assert.deepEqual(shortcutView('backspace', true).keys.map(({text}) => text), ['⌫']);
  assert.equal(shortcutView('delete', true).keys[0].square, true);
});
