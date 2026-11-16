import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Owner decision C184 (2026-11-14; study control/research/2026-11-14-toolbar-menu-open.md):
// (1) no sf-toolbar, one core roving helper under ordinary groups of tools;
// (2) an unavailable tool dimmed but in the walk, its reason as a tooltip;
// (3) Tab comes back to the tool the person left;
// (4) one core SF.menu.open over the page's one menu instead of a menu per component;
// (5) a list is one Tab stop, ↑ ↓ between rows, Shift+F10 / the menu key open the same menu.
// The browser half is tests/browser/c184-toolbar-menu.browser.mjs.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('C184 (1): no sf-toolbar; one core roving helper the toolbars import', () => {
  const registry = json('contracts/generated/smart-component-contract-registry.json').entries;
  assert.ok(registry.length > 50);
  assert.ok(!registry.some((entry) => /toolbar/u.test(`${entry.custom_element} ${entry.id}`)), 'no toolbar component');
  const roving = read('src/core/js/roving.js');
  assert.match(roving, /export function roving\(container, \{/u);
  // One Tab stop: the item remembered takes tabindex 0, every other -1.
  assert.match(roving, /const next = other === target \? '0' : '-1';/u);
  // Arrows by the row's direction; Home and End; the walk wraps.
  assert.match(roving, /getComputedStyle\(container\)\.direction === 'rtl'/u);
  assert.match(roving, /event\.key === 'Home'/u);
  assert.match(roving, /event\.key === 'End'/u);
  assert.match(roving, /wrap \? list\[0\] : null/u);
  // A part that left into «Ещё» (C155) is out of the walk; ↓ on a menu button opens it.
  assert.match(roving, /const OUT = '\.out, \[hidden\], \[data-sf-out\], \[inert\]';/u);
  assert.match(roving, /target\.getAttribute\('aria-haspopup'\) === 'menu'/u);
  // Every toolbar of the Framework uses it.
  assert.match(read('src/smart/input-rich/index.js'), /import \{roving\} from '\.\.\/\.\.\/core\/js\/roving\.js';/u);
  assert.match(read('src/core/js/composition/overlay.mjs'), /this\.toolbarKeys = roving\(this\.toolbar, \{ items: 'button\[data-action\]' \}\);/u);
  // Group build 7: C155's row keeps «Ещё» in the walk and the parts that left it out (overflow-c155).
  assert.match(read('src/core/js/composition/inline-editor.mjs'), /const toolbarKeys = roving\(toolbar, \{ items: \(\) => \[\.\.\.tools, moreButton\], out: `\.\$\{OUT\}, \[hidden\], \[inert\]` \}\);/u);
  // sf-input-rich has no arrow handling of its own any more.
  assert.doesNotMatch(read('src/smart/input-rich/index.js'), /onToolbarKeydown|event\.key === 'ArrowRight'/u);
  assert.doesNotMatch(read('src/smart/input-rich/js/templates/default.js'), /@keydown=\$\{\(event\) => component\.onToolbarKeydown/u);
});

test('C184 (2): an unavailable tool stays in the walk with its reason', () => {
  const roving = read('src/core/js/roving.js');
  assert.match(roving, /disabled = 'focusable'/u);
  assert.match(roving, /disabled === 'focusable' \|\| !isUnavailable\(target\)/u);
  const source = read('src/smart/input-rich/index.js');
  assert.match(source, /unavailable: \(state\) => !state\.canUndo, reason: 'nothing-to-undo'/u);
  assert.match(source, /unavailable: \(state\) => !state\.canRedo, reason: 'nothing-to-redo'/u);
  assert.equal([...source.matchAll(/reason: 'not-in-list'/gu)].length, 4);
  const template = read('src/smart/input-rich/js/templates/default.js');
  assert.match(template, /title=\$\{reason \|\| /u);
  assert.match(template, /aria-description=\$\{reason \|\| nothing\}/u);
  for (const [lang, words] of Object.entries({
    ru: {'nothing-to-undo': 'Нечего отменять', 'nothing-to-redo': 'Нечего повторять', 'not-in-list': 'Недоступно в списке'},
    en: {'nothing-to-undo': 'Nothing to undo', 'nothing-to-redo': 'Nothing to redo', 'not-in-list': 'Not available in a list'},
  })) {
    const runtime = json(`src/smart/input-rich/lang/${lang}.json`).runtime;
    for (const [key, text] of Object.entries(words)) assert.equal(runtime[key], text, `${lang} ${key}`);
  }
});

test('C184 (3): Tab comes back to the tool left (memory on by default)', () => {
  const roving = read('src/core/js/roving.js');
  assert.match(roving, /memory = true/u);
  assert.match(roving, /if \(memory \|\| container\.contains\(event\.relatedTarget\)\) return;/u);
  assert.match(read('src/smart/input-rich/index.js'), /onMove: \(button\) => \{ this\._roving = button\.dataset\.sfTool; \}/u);
});

test('C184 (4): SF.menu.open, public, one menu on the page', () => {
  const api = json('src/core/contracts/public-js-api.json');
  const entry = api.globals.find((global) => global.name === 'SF.menu');
  assert.ok(entry, 'SF.menu is in the public JS API');
  assert.equal(entry.status, 'public');
  assert.equal(entry.layer, 'core');
  assert.deepEqual(entry.members, ['open']);
  assert.match(entry.summary, /open\(\{anchor \| x, y, entries, label, size, returnTo\}\)/u);
  const index = read('src/core/js/index.js');
  assert.match(index, /import \{publishMenu\} from '\.\/menu-open\.js';/u);
  assert.match(index, /\npublishMenu\(\);\n/u);
  const open = read('src/core/js/menu-open.js');
  // One per page, behind the shared global: every bundle's copy calls the published one.
  assert.match(open, /if \(typeof SF\.menu\.open !== 'function'\) SF\.menu\.open = installMenuOpen\(\);/u);
  assert.match(open, /const SHARED = 'data-sf-menu-shared';/u);
  assert.match(open, /await globalThis\.SF\?\.Loader\?\.ensure\?\.\(\['sf-menu-context'\]\);/u);
  // In the open modal dialog the opener is in, else the body.
  assert.match(open, /anchor\?\.closest\?\.\('dialog\[open\]'\) \|\| doc\.body/u);
  // A second press on the same control closes it; a point opens at its corner.
  assert.match(open, /menu\.isOpen && pending\?\.anchor === anchor/u);
  assert.match(open, /typeof menu\.openAt === 'function'/u);
  // The consumers moved onto it hold no sf-menu-context of their own.
  for (const path of ['src/smart/list/index.js', 'src/smart/tabs/index.js', 'src/smart/contents/index.js']) {
    assert.match(read(path), /import \{ ?menuOpen ?\} from '\.\.\/\.\.\/core\/js\/menu-open\.js';|import \{menuOpen\} from "\.\.\/\.\.\/core\/js\/menu-open\.js";/u, path);
  }
  assert.doesNotMatch(read('src/smart/list/js/templates/default.js'), /<sf-menu-context/u);
  assert.doesNotMatch(read('src/smart/tabs/index.js').slice(read('src/smart/tabs/index.js').indexOf('  async openMore(anchor) {'), read('src/smart/tabs/index.js').indexOf('  standardMenu(field, select) {')), /toggleFor/u);
});

test('C184 (5): a list is one Tab stop; Shift+F10 and the menu key open the same menu as «⋯»', () => {
  const list = read('src/smart/list/index.js');
  assert.match(list, /\(event\.key === "F10" && event\.shiftKey\) \|\| event\.key === "ContextMenu"/u);
  assert.match(list, /const opening = menuOpen\(\{\s*anchor,\s*entries,/u);
  assert.match(list, /returnTo: row \?\? null,/u);
  const template = read('src/smart/list/js/templates/default.js');
  assert.match(template, /class="sf-list__actions[^"]*"\s+tabindex="-1"\s+aria-haspopup="menu"/u);
});

test('C184: versions above every branch and the notes say the decision', () => {
  // Group build 7: the C184 notes as numbered on the integration line; later notes may stand above them.
  const versions = {'input-rich': '1.8.1', list: '1.14.1', tabs: '1.3.3', contents: '1.7.3', 'editor-overlay': '1.11.1', 'editor-inline': '1.11.1'};
  const at = (v) => v.split('.').map(Number).reduce((sum, part) => sum * 1000 + part, 0);
  for (const [name, version] of Object.entries(versions)) {
    const component = json(`src/smart/${name}/component.json`);
    assert.ok(at(component.version) >= at(version), name);
    assert.equal(json(`src/smart/${name}/smart.manifest.json`).version, component.version, `${name} manifest`);
    assert.ok(component['x-decisions'].some((note) => note.startsWith(`version ${version} `) && /C184/u.test(note)), `${name} note`);
  }
  const policy = read('src/core/contracts/dimension-policy.v1.json');
  assert.match(policy, /layer-stack\|menu-open\|position/u);
});
