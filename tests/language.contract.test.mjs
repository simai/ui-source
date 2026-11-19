import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {canonicalCode, dirOf, englishName, lookFor, matchLanguage, nameIn, nativeName, normalizeLanguages} from '../src/smart/language/js/languages.js';

// sf-language (owner decision 2026-11-06), the site's language picker: what
// its source promises, held without a browser. The behaviour is probed on the
// built bytes by tests/browser/language.browser.mjs and
// src/smart/language/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/language/component.json');
const source = read('src/smart/language/index.js');
const template = read('src/smart/language/js/templates/default.js');

test('the manifest: a leaf of family language, a form field with one cancellable change and select', () => {
  assert.equal(manifest.tag, 'sf-language');
  assert.equal(manifest.family, 'language');
  assert.equal(manifest.version, '1.7.0'); // C369: trigger icon (1.7.0, above 1.6.1 on fix/lang-follow) // tt and ba back (dispatcher, C278) // C278 follow-up: 1.6.0, CIS language names withdrawn, words through the registry aliases // fix/returns-gb67: TT-11, the trigger's name is the Framework tooltip // group build 5 patch above 1.4.1 on fix/language-first-paint // group build 7: the integrated number (the branch wrote 1.4.2) // queue #70: the field look takes the dropdown of the same size // C282: 1.5.0 moved on by the language-file patch (Russian is a language file) // group build 10: 1.5.2 moved on by the merged branches or a GB10 patch
  assert.deepEqual(Object.keys(manifest.settings), ['languages', 'items', 'href', 'missing', 'home', 'mode', 'inline-max', 'search-from', 'labels', 'size', 'trigger', 'apply', 'remember', 'label', 'name', 'disabled']);
  assert.deepEqual(manifest.settings.mode.values, ['auto', 'inline', 'menu', 'search', 'field']);
  assert.deepEqual(manifest.settings.size.values, ['1/3', '1/2', '1', '2', '3']);
  assert.equal(manifest.settings['inline-max'].default, 1);
  assert.equal(manifest.settings['search-from'].default, 8);
  assert.deepEqual(Object.keys(manifest.values), ['value', 'look']);
  assert.deepEqual(Object.keys(manifest.events), ['change']);
  assert.equal(manifest.events.change.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.change.carries), ['value', 'previous', 'href', 'dir', 'reason']);
  assert.deepEqual(Object.keys(manifest.actions), ['select']);
  assert.equal(manifest.form.value, 'value');
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-segmented', 'cl-button', 'cl-button-icon', 'link', 'cl-icon', 'cl-menu-context', 'cl-dropdown', 'tooltip']); // tooltip: the trigger's name tooltip, TT-11; cl-button-icon: trigger icon, C369; link: trigger name, C381
  assert.deepEqual(manifest.settings.trigger.values, ['code', 'icon', 'name']);
  assert.equal(manifest.settings.trigger.default, 'code');
  assert.equal(manifest['css-variables'], undefined, 'no sheet of its own');
});

test('the name is registered in the Framework\'s family language', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('language'));
  assert.ok(framework.names.some(({element}) => element === 'sf-language'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/language\/rule\.js';/u);
});

test('the look follows the count (C142): 1 none, 2-7 menu, 8+ search; inline only by mode or a written inline-max; a mode fixes one', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 12].map((count) => lookFor(count)), ['none', 'none', 'menu', 'menu', 'menu', 'menu', 'search', 'search']);
  assert.equal(lookFor(2, {mode: 'inline'}), 'inline');
  assert.equal(lookFor(3, {inlineMax: 3}), 'inline');
  assert.equal(lookFor(4, {inlineMax: 4}), 'inline');
  assert.equal(lookFor(5, {searchFrom: 5}), 'search');
  assert.equal(lookFor(12, {mode: 'inline'}), 'inline');
  assert.equal(lookFor(2, {mode: 'search'}), 'search');
  assert.equal(lookFor(1, {mode: 'menu'}), 'none');
});

test('names come from the browser: in itself with its own capital, in English, in the page language', () => {
  assert.equal(nativeName('ru'), 'Русский');
  assert.equal(nativeName('de'), 'Deutsch');
  assert.equal(nativeName('es'), 'Español');
  assert.equal(nativeName('ar'), 'العربية');
  assert.equal(englishName('de'), 'German');
  assert.equal(nameIn('de', 'ru'), 'немецкий');
  // No dictionary ships: the source names no language itself.
  assert.doesNotMatch(read('src/smart/language/js/languages.js').split('\n').filter((line) => !/^\s*(\/\/|\/?\*)/u.test(line)).join('\n'), /Deutsch|Русский|German/u);
});

test('codes are canonical; an item overrides the name and carries an href; a pattern gives the rest one', () => {
  assert.equal(canonicalCode('pt_br'), 'pt-BR');
  assert.equal(canonicalCode('not a code'), '');
  const list = normalizeLanguages('ru, en de ru  bad!', [], '/{code}/');
  assert.deepEqual(list.map((one) => one.code), ['ru', 'en', 'de']);
  assert.deepEqual(list.map((one) => one.href), ['/ru/', '/en/', '/de/']);
  assert.deepEqual(list.map((one) => one.short), ['RU', 'EN', 'DE']);
  const items = normalizeLanguages('ru en', [{code: 'es', label: 'Español (España)', href: '/es-es/'}, {code: 'ru'}], '/{code}/');
  assert.deepEqual(items.map((one) => [one.code, one.label, one.href]), [['es', 'Español (España)', '/es-es/'], ['ru', 'Русский', '/ru/']]);
});

test('right to left by the language and by the script', () => {
  for (const code of ['ar', 'he', 'fa', 'ur', 'ps', 'ug', 'yi', 'ku-Arab']) assert.equal(dirOf(code), 'rtl', code);
  for (const code of ['ru', 'en', 'de', 'ja', 'az-Latn', 'tr']) assert.equal(dirOf(code), 'ltr', code);
});

test('the page language picks the value: the same code, else the same primary language', () => {
  const list = normalizeLanguages('ru en-GB pt-BR', []);
  assert.equal(matchLanguage(list, 'en-GB').code, 'en-GB');
  assert.equal(matchLanguage(list, 'en').code, 'en-GB');
  assert.equal(matchLanguage(list, 'pt-PT').code, 'pt-BR');
  assert.equal(matchLanguage(list, 'de'), null);
});

test('it composes the Framework\'s parts and keeps their events inside', () => {
  assert.match(template, /<sf-segmented[\s\S]*appearance="track"/u);
  assert.match(template, /<sf-button\n[\s\S]*icon-start="translate"[\s\S]*icon-end="expand_more"[\s\S]*scheme="on-surface"/u);
  assert.match(template, /slot="text" class="sf-language-code" style=\$\{wide \? 'display: inline-grid; inline-size: auto; grid-template-columns: auto' : 'display: inline-grid'\}/u, 'every code in one grid cell: one width; only a list with a longer code sizes the cell to it');
  // The icon-button is the trigger icon only (C369): the glyph alone.
  assert.match(template, /function renderIconTrigger\(context\) \{\n  return html`<sf-button-icon\n[\s\S]*icon="translate"[\s\S]*appearance="ghost"[\s\S]*aria-haspopup="menu"/u);
  assert.equal((template.match(/<sf-button-icon/gu) || []).length, 1);
  assert.match(template, /<sf-menu-context[\s\S]*popup/u);
  assert.match(template, /@sf-button-group-change=\$\{stop\}/u);
  assert.match(source, /onGroupChange\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.match(source, /onMenuSelect\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.doesNotMatch(template, /flag|public|globe/u);
});

test('the trigger\'s code slot is the width core holds before the code (C130)', () => {
  const placeholder = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(placeholder, /:where\(sf-language \.sf-language-code\) \{\n  inline-size: var\(--sf-language--line\);\n  min-inline-size: var\(--sf-language--line\);\n  grid-template-columns: minmax\(0, 1fr\);\n  justify-items: center;/u);
  const narrow = new RegExp(template.match(/const NARROW_CODE = \/(.+)\/u;/u)[1], 'u');
  for (const code of ['RU', 'EN', 'DE', 'MN', 'PT', 'ΕΛ', 'Ру']) assert.ok(narrow.test(code), code);
  for (const code of ['PT-BR', '简体', '繁體', 'Срп', '', 'ع']) assert.ok(!narrow.test(code), code);
});

test('a choice asks first, then remembers through SF.Preferences and applies or follows', () => {
  const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /localStorage|sessionStorage|document\.cookie|fetch\(/u);
  assert.match(code, /if \(!this\.sfEmit\('change', detail, \{cancelable: true\}\)\)/u);
  assert.match(code, /preferences\(\)\.write\(key, code\)/u);
  assert.match(code, /shared\.use\(language\.code\)/u);
  assert.match(code, /root\.setAttribute\('dir', language\.dir\)/u);
  const ru = json('src/smart/language/lang/ru.json');
  const en = json('src/smart/language/lang/en.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime.label, 'Язык');
  assert.equal(en.runtime.label, 'Language');
  assert.equal(ru.runtime.trigger, '{label}: {name}');
});
