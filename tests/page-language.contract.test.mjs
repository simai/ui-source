import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* The Framework's default language is English (owner, 2026-10-06), and a
   component speaks Russian on a Russian page: the nearest [lang], else the
   document's, else English. Before, admin-menu, country-code and tags fell
   back to Russian on a page that named no language, and swiper and the Core
   admin menu spoke only Russian. */
test('page language: one helper, English when nothing says otherwise', async () => {
  const { pageLanguage, pageText } = await import('../src/core/js/page-language.js');
  assert.equal(pageLanguage(null), 'en');
  assert.equal(pageText({ en: { a: 'Remove' }, ru: { a: 'Удалить' } }, 'a', null), 'Remove');
  const node = { closest: () => ({ getAttribute: () => 'ru-RU' }) };
  assert.equal(pageLanguage(node), 'ru');
  assert.equal(pageText({ en: { a: 'Remove' }, ru: { a: 'Удалить' } }, 'a', node), 'Удалить');
});

test('page language: no component falls back to Russian', async () => {
  const sources = {
    // The page row and the renderer set spoke only Russian until
    // 2026-10-10, so an English page came out a patchwork: a record panel that
    // had switched above a toolbar that had not.
    // Its words are its language files now (standard 1.3.8 §11).
    'src/smart/pagination/index.js': [/this\.sfWord\("page-label"\)/, /import en from "\.\/lang\/en\.json";/],
    'src/smart/field-renderers/index.js': [/pageText\(SET_TEXT, key, host/],
    'src/smart/datepicker/index.js': [/pageLanguage\(node \?\? document\.documentElement\)/],
    // sf-tag's remove label is its language files' runtime.remove (standard 1.3.8 §11).
    'src/smart/tag/component.json': [/"close-label": \{\s*"type": "string",\s*"default-from": "runtime.remove"(,\s*"summary": "[^"]*")?\s*\}/],
    'src/smart/tag/lang/en.json': [/"remove": "Remove"/],
    // The setting comes from the component's manifest (standard 1.3.8 §4).
    'src/smart/country-code/index.js': [/pageLanguage\(this\)/],
    'src/smart/country-code/component.json': [/"locale": \{\s*"type": "string",\s*"default": ""(,\s*"summary": "[^"]*")?\s*\}/],
    'src/component/country-code/js/_country_code.js': [/pageLanguage\(root\)/, /locale: locale === 'ru' \? 'ru' : 'en'/],
    // These two followed the rule and could still only ever say two languages:
    // a ternary on «ru» is not something a product can add to. They ask the
    // registry now, like everything else (owner, 2026-10-11).
    'src/component/swiper/js/index.js': [/pageText\(SWIPER_TEXT, 'goToSlide', root, 'sf-swiper'\)/],
    'src/component/admin-menu/js/_admin_menu.js': [/pageText\(\s*ADMIN_MENU_ITEM_TEXT/],
    'src/component/file-upload/js/_file_upload.js': [/pageText\(FILE_UPLOAD_ITEM_TEXT, 'remove'/],
    'src/component/highlight/js/index.js': [/pageText\(HIGHLIGHT_TEXT, 'copy', block/],
    'src/component/country-code/js/_country_code.js': [/pageText\(COUNTRY_CODE_TEXT, 'phoneLabel'/],
    // Its words are the language files' (standard 1.3.8 §11).
    'src/smart/datepicker/index.js': [/node\.sfWord\(wordKey\(key\)\)/],
    // sf-drawer's words are its language files (standard 1.3.8 §11).
    'src/smart/drawer/index.js': [/this\.sfWord\('close-label'\)/, /import en from '\.\/lang\/en\.json';/],
    // The resizer handle read [lang] itself over its own dictionary until
    // 2026-10-21 (ui-mail feedback ui-mail.resizer-language): a product could
    // neither choose its language nor teach it a third one. Its words are its
    // language files since standard 1.3.8 §11.
    'src/smart/resizer/index.js': [/this\.sfWord\('label'\)/, /import en from '\.\/lang\/en\.json';/, /language\.onChange\(/],
  };
  for (const [path, patterns] of Object.entries(sources)) {
    const source = await read(path);
    for (const pattern of patterns) assert.match(source, pattern, path);
    assert.doesNotMatch(source, /\|\| ['"]ru['"]\)/, `${path}: falls back to Russian`);
  }
  const loader = (await read('src/core/js/loader.js'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  assert.doesNotMatch(loader, /'[^'\n]*[А-Яа-яЁё][^'\n]*'|`[^`]*[А-Яа-яЁё][^`]*`|"[^"\n]*[А-Яа-яЁё][^"\n]*"/, 'loader messages are English');
});
