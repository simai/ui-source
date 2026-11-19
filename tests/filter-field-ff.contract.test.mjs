// Filter field study FF-1..FF-7 (ui-control
// control/research/2026-11-18-filter-field-choice/README.md): the choice
// list of the single-field filter window and the panels it shares a look
// with. The rules without a browser; the browser probes are
// tests/browser/filter-window.browser.mjs and input-choice-paging.browser.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('FF-1: a dropdown search that finds nothing says so in the language packs', () => {
  const source = read('src/smart/dropdown/index.js');
  const template = read('src/smart/dropdown/js/templates/default.js');
  assert.match(source, /nothingFound: String\(this\._searchValue \|\| ''\)\.trim\(\) && !this\.visibleOptions\.length \? this\.sfWord\('nothing-found'\) : ''/u);
  assert.match(template, /<div class="sf-list-empty" role="status">\$\{context\.nothingFound\}<\/div>/u);
  assert.equal(json('src/smart/dropdown/lang/ru.json').runtime['nothing-found'], 'Ничего не найдено');
  assert.equal(json('src/smart/dropdown/lang/en.json').runtime['nothing-found'], 'Nothing found');
});

test('FF-2, FF-10: list-width field|list|trigger, the list step whatever the field, or the trigger\'s own width', () => {
  const manifest = json('src/smart/dropdown/component.json');
  assert.deepEqual(manifest.settings['list-width'].values, ['field', 'list', 'trigger']);
  assert.equal(manifest.settings['list-width'].default, 'field');
  assert.match(read('src/smart/dropdown/js/templates/default.js'), /data-sf-list-width=\$\{context\.listWidth === "list" \|\| context\.listWidth === "trigger" \? context\.listWidth : nothing\}/u);
  assert.match(read('src/component/dropdown/scss/_css__custom.scss'), /\[data-sf-list-width="list"\]:not\(\.sf-list--free-width\) \{\n\s+inline-size: min\(var\(--sf-popup-list-max-width\), calc\(100vi - var\(--sf-space-1\)\)\);/u);
});

test('FF-3: a multiple dropdown puts the box at the row end on text and icon rows', () => {
  const template = read('src/smart/dropdown/js/templates/default.js');
  assert.match(template, /renderListItemOption\(withBox \? \{\.\.\.named, checkEnd: true\} : named, \{multiple\}\)/u);
  assert.match(read('src/smart/list-item/js/templates/default.js'), /context\.checkEnd === true\)\) \{/u);
});

test('FF-5: «Применить (N)» before «Сбросить»', () => {
  const panel = read('src/smart/settings/js/templates/panel.js');
  assert.match(panel, /<div class="sf-settings-panel-footer"><sf-button size=\$\{size\} text=\$\{label\} data-sf-apply><\/sf-button>\$\{reset\}<\/div>/u);
});

test('FF-6: the settings search text over the rows\' text, its icon at the end', () => {
  const css = read('src/smart/settings/scss/_smart__settings.scss');
  assert.match(css, /\.sf-settings-panel-search-icon \{\n\s+@include panel\.search-icon\(var\(--sf-settings-panel--line\)\);[\s\S]*?@include panel\.search-icon-trailing;/u);
});

test('FF-7: the choice search is the panel search header, a hairline under the chosen, search from ten in the window', () => {
  const template = read('src/smart/input-choice/js/templates/default.js');
  const css = read('src/smart/input-choice/scss/_smart__choice.scss');
  assert.doesNotMatch(template, /<sf-input class="sf-choice-search"/u);
  assert.match(template, /<label class="sf-choice-search">/u);
  assert.match(css, /\.sf-choice--list \.sf-choice-search \{\n\s+@include panel\.search-header\(/u);
  assert.match(css, /@include panel\.search-icon-trailing;/u);
  assert.match(css, /\.sf-choice-row\.sf-choice-row--chosen-last \{/u);
  const renderers = read('src/smart/field-renderers/index.js');
  assert.match(renderers, /\?searchable=\$\{choiceSearchable\(field, host, options, pages\)\}/u);
  assert.match(renderers, /return Boolean\(pages\) \|\| options\.length >= 10;/u);
});
