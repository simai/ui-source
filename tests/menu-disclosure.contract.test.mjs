import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';

const js=await readFile(new URL('../src/component/menu/js/_menu.js',import.meta.url),'utf8');
const menuCss=await readFile(new URL('../src/component/menu/scss/_css__menu.scss',import.meta.url),'utf8');
const elementCss=await readFile(new URL('../src/component/menu/scss/_css__menu_element.scss',import.meta.url),'utf8');

test('Menu assigns one native-first interaction owner only to branches',()=>{
  assert.match(js,/:scope > \.sf-menu-element > \.sf-menu-element-wrap \.sf-menu-element-text/);
  assert.match(js,/document\.createElement\(isBranch \? 'button' : 'span'\)/);
  assert.match(js,/if \(isBranch\) element\.type = 'button'/);
  assert.match(js,/usesRowController = isBranch && !isNativeInteractive\(element\) && !suppliedToggle/);
  assert.match(js,/else if \(!usesRowController && ownedRoles\.has\(element\)\)/);
  assert.match(js,/trailing = document\.createElement\('span'\)/);
  assert.match(js,/controller\.setAttribute\('aria-expanded', String\(expanded\)\)/);
  assert.match(js,/controller\.setAttribute\('aria-controls', ensureSubmenuId\(submenu\)\)/);
  assert.match(js,/submenu\.hidden = !expanded/);
  assert.match(js,/if \(!hasSubmenu\(root\)\) return;\s*event\.preventDefault\(\)/);
});

test('Menu preserves authored nodes and dynamic branch ownership',()=>{
  assert.match(js,/\.\.\.mutation\.addedNodes, \.\.\.mutation\.removedNodes/);
  assert.match(js,/function ensureText\(root, wrap\) \{\s*const content = getTextContent\(root\);/);
  assert.match(js,/if \(text\) wrap\.append\(text\)/);
  assert.match(js,/if \(leading\) wrap\.append\(leading\)/);
  assert.match(js,/directTextNodes\.forEach\(\(node\) => node\.remove\(\)\)/);
  assert.match(js,/generatedElements\.has\(element\)/);
  assert.match(js,/generatedLeadingIcons\.has\(leading\)/);
  assert.match(js,/generatedTrailingControls\.has\(trailing\)/);
  assert.match(js,/target\.closest\('a\[href\], button, input, select, textarea'\) !== element/);
});

test('Menu uses disclosure glyph semantics and keyboard-visible paint',()=>{
  assert.match(js,/expanded \? 'keyboard_arrow_down' : 'chevron_right'/);
  assert.match(elementCss,/:focus-visible/);
  // The ring is the shared outline turned inwards, so it stays inside the item
  // instead of covering the edge of its neighbour.
  assert.match(elementCss,/outline: var\(--sf-focus--width\) var\(--sf-focus--style\) var\(--sf-focus--color\)/);
  assert.match(elementCss,/outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  assert.match(elementCss,/:dir\(rtl\)[^}]*transform: scaleX\(-1\)/s);
  assert.match(elementCss,/\.sf-menu-element:focus \{\s*outline: none/);
  assert.match(elementCss,/@media \(forced-colors: active\)/);
});

test('Menu owns complete token-based geometry without mandatory layout utilities',()=>{
  assert.match(menuCss,/\.sf-menu \{[\s\S]*display: flex[\s\S]*flex-direction: column/);
  assert.match(elementCss,/display: flex/);
  assert.match(elementCss,/min-inline-size: var\(--sf-0\)/);
  assert.match(elementCss,/overflow-wrap: anywhere/);
  assert.match(elementCss,/--sf-menu-element--radius: var\(--sf-radius--ui\)/);
  assert.match(elementCss,/--sf-menu-element--border-width: var\(--sf-px\)/);
  assert.match(elementCss,/--sf-menu-element--padding-top/);
  assert.match(elementCss,/--sf-menu-element--padding-bottom/);
  assert.match(elementCss,/--sf-menu-element--padding-right/);
  assert.match(elementCss,/--sf-menu-element--border-top-left-radius/);
  assert.doesNotMatch(elementCss,/:\s*-?(?:\d*\.)?\d+(?:px|rem|em)\b/);
});

test('Menu exposes one horizontal presentation with vertical flyout submenus',()=>{
  assert.match(menuCss,/\.sf-menu\.sf-menu--horizontal \{[\s\S]*flex-direction: row[\s\S]*flex-wrap: nowrap/);
  assert.match(menuCss,/\.sf-menu\.sf-menu--horizontal > \.sf-menu-item > \.sf-menu \{\s*inset-block-start: 100%;\s*inset-inline-start: 0;/);
  assert.match(menuCss,/\.sf-menu\.sf-menu--horizontal \.sf-menu \.sf-menu-item > \.sf-menu \{\s*inset-block-start: 0;\s*inset-inline-start: 100%;/);
  // Open flyouts are anchored by SF.Position (flip and shift), not a flip class.
  assert.doesNotMatch(menuCss,/\.sf-menu--flip-inline/);
  assert.match(js,/positioning\(\)\.anchor\(root, submenu, \{\s*side: topLevel \? 'block-end' : 'inline-end'/);
  assert.match(js,/releaseHorizontalSubmenu\(root\);/);
  assert.match(js,/function closeHorizontalSiblings\(root\)/);
  assert.match(js,/function closeHorizontalDescendants\(root\)/);
  assert.match(js,/function positionHorizontalSubmenu\(root\)/);
  assert.match(js,/horizontalTopLevel[\s\S]*'keyboard_arrow_down'/);
  assert.match(js,/event\.key === 'Escape'/);
  assert.match(js,/getDisclosureController\(root\)\?\.focus\(\)/);
});

test('Menu keeps legacy expanded markup without emitting it for canonical branches',()=>{
  assert.match(js,/const legacyExpandedOwners = new WeakSet\(\)/);
  assert.match(js,/if \(root\.hasAttribute\('expanded'\)\) legacyExpandedOwners\.add\(root\)/);
  assert.match(js,/if \(legacyExpandedOwners\.has\(root\)\) root\.setAttribute\('expanded', ''\)/);
  assert.match(js,/if \(legacyExpandedOwners\.has\(root\)\) root\.removeAttribute\('expanded'\)/);
});

// An item written expanded got its state on the element and the submenu but not
// the .open class the stylesheet opens it by, so it stayed shut.
test('an item written expanded carries the class that opens it', () => {
  const source = readFileSync(new URL('../src/component/menu/js/_menu.js', import.meta.url), 'utf8');
  const init = source.slice(source.indexOf('function initMenuItem'));
  assert.match(init.slice(0, 1500), /root\.classList\.toggle\('open', expanded && isBranch\)/u);
  const css = readFileSync(new URL('../src/component/menu/scss/_css__menu_custom.scss', import.meta.url), 'utf8');
  assert.match(css, /\.sf-menu-item:not\(\.open\) > \.sf-menu \{\s*display: none;/u);
});
