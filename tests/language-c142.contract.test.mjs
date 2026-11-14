// sf-language 1.4.0, owner decision C142 (ui-control control/docs-review/decisions.md;
// research control/research/2026-11-14-language.md; prototype prototypes/language-study.html):
// the trigger «RU ▾», one button for every count, the second name in the page's
// language, the switch's keys, the phone sheet, a missing translation, the app
// menu row, the field look and regional variants.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {languageRows, lookFor, normalizeLanguages, pageName, shortLabelIn, useNames} from '../src/smart/language/js/languages.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
useNames(JSON.parse(read('src/smart/language/data/names.json')));
const manifest = JSON.parse(read('src/smart/language/component.json'));
const index = read('src/smart/language/index.js');
const template = read('src/smart/language/js/templates/default.js');

test('C142 (1)(2): auto is the button and menu from two languages; inline and field only by mode', () => {
  assert.deepEqual([2, 3, 7, 8].map((count) => lookFor(count)), ['menu', 'menu', 'menu', 'search']);
  assert.equal(lookFor(3, {mode: 'inline'}), 'inline');
  assert.equal(lookFor(12, {mode: 'field'}), 'field');
  assert.equal(manifest.settings['inline-max'].default, 1);
  assert.match(template, /icon-start="translate"\s+icon-end="expand_more"/u);
});

test('C142 (3): the second name is in the page language and left out when it is the same word', () => {
  const list = normalizeLanguages('ru en de fr', []);
  const ru = languageRows(list, list[0], {page: 'ru'});
  assert.deepEqual(ru.map((row) => [row.text, row.value]), [['Русский', undefined], ['English', 'английский'], ['Deutsch', 'немецкий'], ['Français', 'французский']]);
  const en = languageRows(list, list[0], {page: 'en'});
  assert.deepEqual(en.map((row) => row.value), ['Russian', undefined, 'German', 'French']);
  assert.ok(ru.every((row) => row.lang && row.kind === 'radio'));
  assert.equal(ru.filter((row) => row.checked).length, 1);
});

test('C142 (4): the switch walks with the arrows and chooses with Enter or Space', () => {
  assert.match(index, /this\.addEventListener\('keydown', \(event\) => this\.onTrackKeys\(event\), true\)/u);
  assert.match(index, /radios\[next\]\.focus\(\)/u);
  assert.doesNotMatch(index.slice(index.indexOf('onTrackKeys(event) {'), index.indexOf('onFieldChange(event)')), /choose\(/u);
});

test('C142 (5): from searchFrom on a phone the menu is sf-menu-context\'s sheet, no field focused', () => {
  assert.match(index, /const sheet = this\.look === 'search' && onPhone\(this\)/u);
  assert.match(index, /toggleFor\(anchor, sheet \? \{width: 'form', focus: 'none'\} : \{\}\)/u);
});

test('C142 (6): a language without this page stays, says so, and goes home', () => {
  const list = normalizeLanguages('ru en de', [], '/{code}/docs/page/', {missing: 'de', home: '/{code}/'});
  assert.deepEqual(list.map((one) => [one.code, one.href, one.missing]), [['ru', '/ru/docs/page/', false], ['en', '/en/docs/page/', false], ['de', '/de/', true]]);
  const rows = languageRows(list, list[0], {page: 'ru', missing: 'нет перевода — откроется главная'});
  assert.equal(rows[2].caption, 'нет перевода — откроется главная');
  assert.equal(rows[0].caption, undefined);
  const items = normalizeLanguages('', [{code: 'ru'}, {code: 'en', missing: true, href: '/en/'}]);
  assert.deepEqual(items.map((one) => one.missing), [false, true]);
  assert.equal(JSON.parse(read('src/smart/language/lang/ru.json')).runtime.missing, 'нет перевода — откроется главная');
  assert.ok(JSON.parse(read('src/smart/language/lang/en.json')).runtime.missing);
});

test('C142 (7): the app menu row is an entry with the current name and a submenu of the rows', () => {
  assert.match(index, /SfLanguage\.menuEntry = function menuEntry/u);
  assert.match(index, /prefix: 'language:'/u);
  assert.match(index, /SfLanguage\.codeOf = /u);
  const list = normalizeLanguages('ru en de', []);
  const rows = languageRows(list, list[1], {page: 'ru', prefix: 'language:'});
  assert.deepEqual(rows.map((row) => row.id), ['language:ru', 'language:en', 'language:de']);
  assert.ok(rows[1].checked);
});

test('C142 (8): the field look is sf-dropdown with the label above', () => {
  assert.match(template, /<sf-dropdown[\s\S]*mode="select"[\s\S]*label=\$\{context\.label\}/u);
  assert.ok(manifest.relations.some((relation) => relation.name === 'cl-dropdown' && relation.lazy));
});

test('C142 (9): the code shows the region only for two variants; Chinese by its script; the menu the full name', () => {
  assert.equal(shortLabelIn('pt-BR', ['ru', 'pt-BR', 'en']), 'PT');
  assert.equal(shortLabelIn('pt-BR', ['pt-BR', 'pt-PT']), 'PT-BR');
  assert.equal(shortLabelIn('zh-Hans', ['zh-Hans', 'zh-Hant']), '简体');
  assert.equal(shortLabelIn('zh-TW', ['zh-CN', 'zh-TW']), '繁體');
  assert.equal(shortLabelIn('zh', ['ru', 'zh']), 'ZH');
  const list = normalizeLanguages('pt-BR pt-PT zh-Hans zh-Hant ru', []);
  assert.deepEqual(list.map((one) => one.short), ['PT-BR', 'PT-PT', '简体', '繁體', 'RU']);
  assert.deepEqual(list.map((one) => one.label), ['Português (Brasil)', 'Português (Portugal)', '中文（简体）', '中文（繁體）', 'Русский']);
  assert.equal(pageName('pt-BR', 'ru'), 'португальский, Бразилия');
  assert.equal(pageName('zh-Hans', 'ru'), 'китайский, упрощенное письмо');
  assert.doesNotMatch(template, /flag/u);
});
