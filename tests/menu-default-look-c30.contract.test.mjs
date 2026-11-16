import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-menu appearance default (owner decisions C23, C30; recipe admin-frame
// gap check, ui-control control/evidence/2026-11-15-recipe-gaps-check): the
// default look is the C30 site menu -- rows with no frame, the current page
// filled in a column, the 2 px line in a header row -- the navigation preset
// of the class menu. It drew the class menu's framed rows, which marked no
// current page at all.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const template = read('src/smart/menu/js/templates/default.js');
const sheet = read('src/component/menu/scss/_css__menu.scss');

test('C30: appearance default writes the navigation preset on the root list', () => {
  assert.match(template, /const presentation = \(appearance\) => \(appearance === 'default' \? 'navigation' : appearance\);/u);
  const list = template.slice(template.indexOf('const listClasses = joinClasses('), template.indexOf('return html`', template.indexOf('const listClasses')));
  assert.match(list, /`sf-menu--\$\{presentation\(context\.appearance\)\}`,/u);
  // Nothing writes a bare sf-menu root for the default look any more.
  assert.doesNotMatch(list, /context\.appearance !== 'default'/u);
});

test('C23: the navigation preset frames no row and fills the current page', () => {
  assert.match(sheet, /\.sf-menu\.sf-menu--navigation \.sf-menu-element \{\n {2}--sf-menu-element--border-width: calc\(var\(--sf-px\) \* 0\);/u);
  assert.match(sheet, /\.sf-menu\.sf-menu--navigation \.sf-menu-element:not\(:disabled\):not\(\.disabled\):not\(\[aria-disabled='true'\]\):is\(\[aria-current='page'\], \[aria-current='true'\], :has\(> \[aria-current='page'\], > \[aria-current='true'\]\)\) \{\n {2}@include current-plate;/u);
});

test('C30: default and navigation are one look in the manifest and the guide', () => {
  for (const path of ['src/smart/menu/smart.manifest.json', 'src/smart/menu/component.json']) {
    assert.match(read(path), /default, the C30 site menu -- drawn as navigation/u, path);
  }
  assert.match(read('src/smart/menu/docs.md'), /`default` рисуется так же, как `navigation` \(решения C23, C30\)/u);
});
