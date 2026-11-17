// sf-header-site, collapsed: a tools wrapper that holds the language beside
// other tools (search, language, theme in one row) was labelled «Язык» in the
// open panel. It is the tools row: «Инструменты» / «Tools», a group by that name.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runtime = read('src/smart/header-site/index.js');
const template = read('src/smart/header-site/js/templates/default.js');

test('a wrapper holding a setting beside other tools is the tools row', () => {
  const kind = runtime.slice(runtime.indexOf('function settingKind'), runtime.indexOf('let sequence'));
  assert.match(kind, /if \(setting !== node && node\.children\.length > 1\) return 'tools';/u);
  // A setting alone, or wrapped alone, keeps its own word.
  assert.match(kind, /return setting\.localName === 'sf-language' \? 'language' : 'theme';/u);
});

test('the tools row is a group named by its word', () => {
  assert.match(template, /role=\$\{kind === 'tools' \? 'group' : nothing\} aria-label=\$\{kind === 'tools' \? word : nothing\}/u);
  assert.match(runtime, /kind: settingKind\(node\), label: this\.sfWord\(settingKind\(node\)\)/u);
});

test('the word is in the en and ru files', () => {
  assert.equal(JSON.parse(read('src/smart/header-site/lang/ru.json')).runtime.tools, 'Инструменты');
  assert.equal(JSON.parse(read('src/smart/header-site/lang/en.json')).runtime.tools, 'Tools');
});
