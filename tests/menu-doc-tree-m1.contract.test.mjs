import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Docara audit (ui-control control/research/2026-11-15-docara-audit.md),
// DEV letter msg-e22e231d: RG-M-1 (the documentation tree's hook for a closed
// branch that holds the current page), RG-M-2 (a unitless 0 in the row's
// border width) and the contents' one-heading note.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('RG-M-2: the row border width is a registered length, so a unitless 0 keeps the padding', () => {
  const element = read('src/component/menu/scss/_css__menu_element.scss');
  assert.match(element, /@property --sf-menu-element--border-width \{\s*syntax: '<length>';\s*inherits: true;\s*initial-value: 0;\s*\}/u);
  // Registered before the layer: @property is global and is not layered.
  assert.ok(element.indexOf('@property --sf-menu-element--border-width') < element.indexOf('@layer sf.components'));
  // The padding still gives the border back.
  assert.match(element, /padding-inline-start: calc\(var\(--sf-menu-element--padding-inline-start, var\(--sf-space-1\)\) - var\(--sf-menu-element--border-width\)\);/u);
  // Only the subtracted width is registered: the per-side widths keep their fallbacks.
  assert.doesNotMatch(element, /@property --sf-menu-element--border-(top|bottom|left|right)-width/u);
  assert.match(read('src/component/menu/docs/docs.md'), /`--sf-menu-element--border-width` takes a length/u);
  assert.match(read('src/smart/menu/docs.md'), /`--sf-menu-element--border-width` — длина/u);
});

test('RG-M-1: the documentation tree marks a closed branch holding the current page by its list or by the hook', () => {
  const sheet = read('src/component/menu/scss/_css__menu.scss');
  assert.match(sheet, /\$path-closed: "[^"]*\.sf-menu-element\.sf-menu-element--holds-current:not\(\[aria-current\]\)";/u);
  assert.match(sheet, /\.sf-menu\.sf-menu--documentation-tree \{\s*@include path-weight\(\$path-closed\);\s*\}/u);
  assert.match(read('src/smart/menu/js/templates/default.js'), /holds \? 'sf-menu-element--holds-current' : ''/u);
  const docs = read('src/component/menu/docs/docs.md');
  assert.match(docs, /puts\s+the class `sf-menu-element--holds-current` on that branch's\s+`\.sf-menu-element`/u);
  assert.match(read('src/smart/menu/docs.md'), /`sf-menu-element--holds-current`\. Сайт, который рисует дерево своей/u);
});

test('contents: the docs say a one-heading page reserves no column', () => {
  assert.match(read('src/smart/contents/docs.md'), /a layout should not reserve the contents' column for a page with one\s+heading/u);
});

test('versions: component.menu 1.8.3, sf-menu 1.11.2, sf-contents 1.7.4 with their notes', () => {
  assert.equal(json('src/component/menu/passport.json').version, '1.10.3'); // group build 9: 1.8.3 moved on by the merged branches or a GB9 patch // group build 10: 1.9.1 moved on by the merged branches or a GB10 patch // defects-d11: component.menu 1.10.1: the empty sf.components block left by C273 removed // defects-d12: component.menu 1.10.2: a row's panel's path line clears the corner by its block padding // fix/rtl-direction-icons: one RTL turn
  // group build 9: the current numbers moved on (menu 1.13.5, contents 1.7.7); the notes stay.
  for (const [name, version, current, noted] of [['menu', '1.11.2', '1.14.3', '1.13.5'], ['contents', '1.7.4', '1.8.4', '1.7.7']]) {
    const component = json(`src/smart/${name}/component.json`);
    assert.equal(component.version, current);
    assert.equal(json(`src/smart/${name}/smart.manifest.json`).version, current);
    assert.ok(component['x-decisions'].some((note) => (note.startsWith(`version ${version} `) || note.startsWith(`version ${noted} (written on the branch as ${version};`)) && /msg-e22e231d/u.test(note)), name);
  }
});
