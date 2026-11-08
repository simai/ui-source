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
  assert.equal(manifest.version, '1.0.2');
  assert.deepEqual(Object.keys(manifest.settings), ['languages', 'items', 'href', 'mode', 'inline-max', 'search-from', 'compact', 'size', 'apply', 'remember', 'label', 'name', 'disabled']);
  assert.deepEqual(manifest.settings.mode.values, ['auto', 'inline', 'menu', 'search']);
  assert.deepEqual(manifest.settings.size.values, ['1/3', '1/2', '1', '2', '3']);
  assert.equal(manifest.settings['inline-max'].default, 3);
  assert.equal(manifest.settings['search-from'].default, 8);
  assert.deepEqual(Object.keys(manifest.values), ['value', 'look']);
  assert.deepEqual(Object.keys(manifest.events), ['change']);
  assert.equal(manifest.events.change.cancelable, true);
  assert.deepEqual(Object.keys(manifest.events.change.carries), ['value', 'previous', 'href', 'dir', 'reason']);
  assert.deepEqual(Object.keys(manifest.actions), ['select']);
  assert.equal(manifest.form.value, 'value');
  assert.deepEqual(manifest.relations.map((relation) => relation.name), ['cl-button-group', 'cl-button-icon', 'cl-icon', 'cl-menu-context']);
  assert.equal(manifest['css-variables'], undefined, 'no sheet of its own');
});

test('the name is registered in the Framework\'s family language', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('language'));
  assert.ok(framework.names.some(({element}) => element === 'sf-language'));
  assert.match(read('src/core/js/rule.src.js'), /import '\.\.\/\.\.\/smart\/language\/rule\.js';/u);
});

test('the look follows the count: 1 none, 2-3 inline, 4-7 menu, 8+ search; the thresholds move; a mode fixes one', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 12].map((count) => lookFor(count)), ['none', 'none', 'inline', 'inline', 'menu', 'menu', 'search', 'search']);
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
  const items = normalizeLanguages('ru en', [{code: 'kk', label: 'Қазақ тілі', href: '/kz/'}, {code: 'ru'}], '/{code}/');
  assert.deepEqual(items.map((one) => [one.code, one.label, one.href]), [['kk', 'Қазақ тілі', '/kz/'], ['ru', 'Русский', '/ru/']]);
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
  assert.match(template, /<sf-button-group[\s\S]*appearance="segmented"/u);
  assert.match(template, /<sf-button-icon[\s\S]*icon="translate"[\s\S]*scheme="on-surface"/u);
  assert.match(template, /<sf-menu-context[\s\S]*popup/u);
  assert.match(template, /@sf-button-group-change=\$\{stop\}/u);
  assert.match(source, /onGroupChange\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.match(source, /onMenuSelect\(event\) \{\n {4}event\.stopPropagation\(\);/u);
  assert.doesNotMatch(template, /flag|public|globe/u);
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
