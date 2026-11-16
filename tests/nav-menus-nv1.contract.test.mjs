import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {URL} from 'node:url';

// Section navigation review, area c (DEV letter RG-NV 13-29; owner decisions
// C238, C239, C240). Measured in a browser by ui-control's helper probe
// (control/evidence: nav-c); these pins keep the sources from drifting back.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const menu = read('src/component/menu/scss/_css__menu.scss');
const menuJs = read('src/component/menu/js/_menu.js');
const cm = read('src/component/context-menu/scss/_css__context_menu.scss');
const cmCustom = read('src/component/context-menu/scss/_css__context_menu_custom.scss');
const list = read('src/component/dropdown/scss/_css__list.scss');
const ddJs = read('src/component/dropdown/js/_dropdown.js');
const ddTemplate = read('src/smart/dropdown/js/templates/default.js');

test('C238: a menu without a look modifier draws the navigation look; framed is a dated legacy name', () => {
  assert.match(menu, /\$nav: ":is\(\.sf-menu--navigation, :where\(:not\(\.sf-menu--framed, \.sf-menu--documentation-tree, \.sf-menu \.sf-menu\)\)\)";/u);
  assert.doesNotMatch(menu, /\.sf-menu\.sf-menu--navigation/u);
  const table = read('src/core/js/retired-classes.table.js');
  assert.match(table, /"journal": "class-c238-menu-default-navigation"[\s\S]*?"remove_after": "2027-01-01"[\s\S]*?"sf-menu--framed": "sf-menu"/u);
  assert.match(read('contracts/changes/journal.json'), /class-c238-menu-default-navigation/u);
});

test('C239 / C240: a row panel rounds --sf-radius--surface, keeps 4 round its rows, text 16 from the edge', () => {
  assert.match(menu, /var\(--sf-menu-submenu-radius, var\(--sf-radius--surface\)\)/u);
  assert.match(read('src/core/contracts/public-variables.v1.json'), /"--sf-menu-submenu-radius"[\s\S]{0,200}var\(--sf-radius--surface\)/u);
  assert.match(menu, /--sf-menu--inset: var\(--sf-menu-horizontal-submenu--padding, calc\(var\(--sf-space-1\\\/4\) - var\(--sf-px\)\)\)/u);
});

test('RG-NV 22, 25, 26: own submenu ids, split link rows, hover open and close delays', () => {
  assert.match(menuJs, /submenu\.id = partId\(rootMenuPath\(root\), `submenu-\$\{places\.join\('-'\)\}`\);/u);
  assert.match(menuJs, /element = splitLinkRow\(element\);/u);
  assert.match(menuJs, /const HOVER_OPEN_DELAY = 300;/u);
  assert.match(menuJs, /const HOVER_CLOSE_DELAY = 500;/u);
});

test('RG-NV 13-16: context-menu icons follow the row, buttons are rows, the scrollbar takes the inset', () => {
  assert.match(cm, /--sf-icon--color: var\(--sf-context-menu-item--icon, var\(--sf-on-surface-variant\)\)/u);
  assert.match(cm, /animation-timeline: scroll\(self block\);/u);
  assert.match(cmCustom, /--sf-button--background-color: var\(--sf-surface-state-select\);/u);
});

test('RG-NV 17, 18: the chosen option keeps its fill under the pointer; value tags are not active', () => {
  assert.match(list, /\.selected:hover/u);
  for (const source of [ddJs, ddTemplate]) {
    assert.doesNotMatch(source, /sf-tag[^'"`]*\bactive\b/u);
  }
});
