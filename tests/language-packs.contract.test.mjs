import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {gzipSync} from 'node:zlib';
import {LEGACY_IDS, buildPack, componentId, packFamilies, packLanguages} from '../scripts/build-language-packs.mjs';
import {languageCoverage, languageFolders, placeholderGaps} from '../scripts/language-coverage.mjs';

// Owner decision C177 (2026-11-14): every language but ru and en is one file
// per language and delivery, fetched only by a page in that language; a
// language may come in parts, what it lacks is said in English and is shown;
// a product adds a language or overrides one word the same way; the format is
// a public standard (src/core/contracts/language-pack.v1.schema.json,
// docs/developer/language-packs.md). The pilot pack was withdrawn by owner
// decision C278 (2026-11-17): the Framework ships no pack until a registry
// language's pilot, and a page in any other language says English.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// The schema's rules, read by hand (the repository's ajv is draft-07).
function packProblems(pack, schema) {
  const problems = [];
  const props = schema.properties;
  for (const key of schema.required) if (!(key in pack)) problems.push(`no ${key}`);
  for (const key of Object.keys(pack)) if (!(key in props)) problems.push(`unknown ${key}`);
  if (pack.schema !== props.schema.const) problems.push('schema');
  if (pack.schema_version !== props.schema_version.const) problems.push('schema_version');
  if (!new RegExp(props.lang.pattern, 'u').test(pack.lang)) problems.push('lang');
  if (pack.dir && !props.dir.enum.includes(pack.dir)) problems.push('dir');
  if (pack.status && !props.status.enum.includes(pack.status)) problems.push('status');
  const component = new RegExp(props.words.propertyNames.pattern, 'u');
  const key = new RegExp(props.words.additionalProperties.propertyNames.pattern, 'u');
  const forms = Object.keys(schema.$defs.word.oneOf[1].properties);
  for (const [id, words] of Object.entries(pack.words)) {
    if (!component.test(id)) problems.push(`component ${id}`);
    for (const [name, word] of Object.entries(words)) {
      if (!key.test(name)) problems.push(`key ${id}.${name}`);
      if (typeof word === 'string') continue;
      if (!word || typeof word !== 'object' || typeof word.other !== 'string') problems.push(`word ${id}.${name}`);
      else for (const form of Object.keys(word)) if (!forms.includes(form) || typeof word[form] !== 'string') problems.push(`form ${id}.${name}.${form}`);
    }
  }
  return problems;
}


test('C177 (1)(3), C278: the Framework packs are written by the script and current; none ships now', () => {
  execFileSync(process.execPath, ['scripts/build-language-packs.mjs', '--check'], {cwd: new URL('..', import.meta.url)});
  assert.deepEqual(packLanguages(), []);
  const index = json('src/core/lang/index.json');
  assert.deepEqual([index.schema, index.schema_version, index.delivery, index.languages], ['simai.language-pack-index', 1, 'framework', []]);
  // A part's family is its component's family (C177 follow-up #46): the map
  // the next pack is split by.
  const families = packFamilies();
  assert.equal(families.get('sf-input'), 'input');
  assert.equal(families.get('sf-pagination'), 'pagination');
  // No language folder and no whole-language file is left in core/lang.
  assert.deepEqual(readdirSync(new URL('../src/core/lang/', import.meta.url)).sort(), ['index.json', 'index.mjs']);
  // ru and en are never packs: they are built into the components (C177 (2)).
  assert.ok(!existsSync(new URL('../src/core/lang/ru.json', import.meta.url)));
  assert.ok(!existsSync(new URL('../src/core/lang/en.json', import.meta.url)));
});

test('C177 (8): the pack is what the public schema says', () => {
  const schema = json('src/core/contracts/language-pack.v1.schema.json');
  assert.equal(schema.$id, 'https://simai.io/contracts/language-pack.v1.schema.json');
  // A pack a product writes by hand: the smallest one the schema takes.
  assert.deepEqual(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'de', words: {'sf-pagination': {'next-label': 'Nächste Seite'}}}, schema), []);
  assert.ok(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'DE', words: {}}, schema).includes('lang'));
  const doc = read('docs/developer/language-packs.md');
  for (const word of ['simai.language-pack', 'schema_version', 'SF.language.registerPack', 'SF.language.addPack', 'SF.language.register(', 'SF_BOOT_CONFIG.languages', 'Intl.PluralRules', 'build-language-packs.mjs', 'language-coverage.mjs', 'status']) {
    assert.ok(doc.includes(word), `the spec names ${word}`);
  }
});

test('C278: no component ships a language file other than ru and en', () => {
  const others = [];
  for (const folder of languageFolders()) {
    for (const file of readdirSync(folder.dir)) if (/\.json$/u.test(file) && !['ru.json', 'en.json', 'index.json'].includes(file)) others.push(`${folder.id}/${file}`);
  }
  assert.deepEqual(others, []);
});

test('C177 (5): no shared dictionary; one component in two folders says each word once', () => {
  const ids = new Map();
  for (const folder of languageFolders()) ids.set(folder.id, componentId(folder));
  assert.equal(ids.get('smart/pagination'), 'sf-pagination');
  assert.equal(ids.get('component/modal'), 'sf-modal');
  assert.equal(ids.get('core/file-size'), 'sf-file-size');
  const {problems} = buildPack('de');
  assert.deepEqual(problems, []);
});

test('C177: every word in every language says the placeholders of its Russian word, in every component', () => {
  // Group build 6 (2026-11-15): the Russian words of sf-file-preview gained
  // {name} and sf-time's «yesterday at» {day}, and three words of a pack kept the
  // old text, so a name or a day was never said. One check over every folder
  // and every language file beside ru.
  const gaps = placeholderGaps().map((gap) => `${gap.id} ${gap.code}.json ${gap.key}: {${gap.word.join('}, {')}} where ru says {${gap.ru.join('}, {')}}`);
  assert.deepEqual(gaps, []);
  // The check sees a placeholder lost, one added and one in a plural form.
  const root = mkdtempSync(path.join(tmpdir(), 'sf-placeholders-'));
  try {
    const dir = path.join(root, 'src/smart/sample/lang');
    mkdirSync(dir, {recursive: true});
    const write = (code, runtime) => writeFileSync(path.join(dir, `${code}.json`), JSON.stringify({runtime}));
    write('ru', {download: 'Скачать {name}', day: '{day}, {time}', more: {one: 'Ещё {n} файл', few: 'Ещё {n} файла', many: 'Ещё {n} файлов', other: 'Ещё {n} файла'}, plain: 'Файл', blank: ''});
    write('en', {download: 'Download {name}', day: '{day}, {time}', more: {one: '{n} more file', other: '{n} more files'}, plain: 'File', blank: ''});
    write('de', {download: 'Datei herunterladen', day: 'gestern, {time}', more: {one: 'Noch eine Datei', other: 'Weitere Dateien'}, plain: 'Datei {name}', blank: ''});
    assert.deepEqual(placeholderGaps(root).map(({code, key, ru, word}) => [code, key, ru.join(), word.join()]), [
      ['de', 'download', 'name', ''],
      ['de', 'day', 'day,time', 'time'],
      ['de', 'more', 'n', ''],
      ['de', 'plain', '', 'name'],
    ]);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('C177 (9): every word of a legacy component is looked up under the name its pack uses', () => {
  for (const [folder, id] of Object.entries(LEGACY_IDS)) {
    if (!folder.startsWith('component/')) continue;
    const name = folder.slice('component/'.length);
    const dir = new URL(`../src/component/${name}/js/`, import.meta.url);
    for (const file of readdirSync(dir, {recursive: true}).filter((entry) => /\.m?js$/u.test(entry))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      for (const call of source.matchAll(/\b(pageText|pageWord)\(([^;]*?)\)(?=[,;\n )])/gu)) {
        if (/^\s*$/u.test(call[2])) continue;
        assert.ok(call[2].includes(`'${id}'`) || call[2].includes(`"${id}"`) || /COMPONENT\b/u.test(call[2]),
          `src/component/${name}/js/${file}: ${call[0].slice(0, 120)} names no ${id}`);
      }
    }
  }
  // A number or a name has its place in the words, not after them.
  assert.match(json('src/component/swiper/lang/en.json').runtime.goToSlide, /\{n\}/u);
  assert.match(json('src/component/file-upload/lang/en.json').runtime['uploading-name'], /\{name\}/u);
  // Country names in a third language come from Intl, not as English.
  assert.doesNotMatch(read('src/component/country-code/js/_country_code.js'), /locale === 'ru' \? 'ru' : 'en'/u);
  assert.match(read('src/component/country-code/js/_country_code.js'), /new Intl\.DisplayNames\(\[locale\], \{type: 'region'\}\)/u);
});

test('C177 (4)(6): pack words below a product word, a Framework pack below a product pack', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  language.forget();
  const node = {closest: () => ({getAttribute: () => 'de'}), tagName: 'SF-PAGINATION'};
  const shipped = {en: {'next-label': 'Next page', 'pages-label': 'Pages:'}, ru: {'next-label': 'Следующая страница', 'pages-label': 'Страницы:'}};
  // A product's word registered before the Framework pack arrives still wins.
  language.register('sf-pagination', 'de', {'pages-label': 'Seitenliste:'});
  const info = language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: 'de', words: {'sf-pagination': {'next-label': 'Nächste Seite', 'pages-label': 'Seiten:'}}});
  assert.equal(info.words, 2);
  assert.equal(pageWord(shipped, 'next-label', node), 'Nächste Seite');
  assert.equal(pageWord(shipped, 'pages-label', node), 'Seitenliste:');
  // A product pack overrides the Framework's, whichever came first.
  language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'my-product', lang: 'de', words: {'sf-pagination': {'next-label': 'Weiter'}}});
  language.registerPack({schema: 'simai.language-pack', schema_version: 1, lang: 'de', words: {'sf-pagination': {'next-label': 'Nächste Seite'}}});
  assert.equal(pageWord(shipped, 'next-label', node), 'Weiter');
  assert.deepEqual(Object.keys(language.packs()), ['de']);
  assert.equal(language.registerPack({lang: 'de', words: {}}), null, 'not a pack');
  language.forget();
});

test('C177 (1)(4): core fetches only the parts a page shows, only for a language that has a pack; a missing word is said in English and listed', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  const {installLanguagePacks} = await import('../src/core/js/language-packs.js');
  const saved = {document: globalThis.document, config: globalThis.SF_BOOT_CONFIG, warn: console.warn};
  const warnings = [];
  console.warn = (text) => warnings.push(String(text));
  const CDN = 'https://cdn.test/distr/core/lang/';
  let fetched = [];
  // A document in `lang` holding the elements `tags`.
  // A Framework index of a made-up de pack in four parts (none ships, C278).
  const PACKS = {schema: 'simai.language-pack-index', schema_version: 1, delivery: 'framework', languages: ['de'],
    parts: {de: {core: ['sf-file-size', 'sf-relative-day'], change: ['sf-change'], pagination: ['sf-pagination'], empty: ['sf-empty-state']}}};
  const PART_WORDS = {core: {'sf-file-size': {b: 'B'}}, change: {'sf-change': {'show-text': 'Änderungen zeigen'}},
    pagination: {'sf-pagination': {'next-label': 'Nächste Seite'}}, empty: {'sf-empty-state': {'no-data-title': 'Noch keine Einträge'}}};
  const install = (lang, config, tags = [], packs = PACKS) => {
    language.forget();
    globalThis.__sfMissingWords = new Map();
    globalThis.document = {
      documentElement: {getAttribute: () => lang}, baseURI: 'https://example.test/page/', readyState: 'complete',
      querySelectorAll: (selector) => tags.filter((tag) => selector.split(',').includes(tag)).map((tag) => ({localName: tag})),
    };
    globalThis.SF_BOOT_CONFIG = config;
    fetched = [];
    installLanguagePacks({root: 'https://cdn.test/distr/core/', again: true, packs, fetchJson: async (url) => {
      fetched.push(url);
      if (url.startsWith(CDN)) {
        const [code, file] = url.slice(CDN.length).split('/');
        return {schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: code, words: PART_WORDS[file.replace(/\.json$/u, '')]};
      }
      return {schema: 'simai.language-pack', schema_version: 1, delivery: 'shop', lang: 'de', words: {'sf-empty-state': {'no-data-title': 'Noch keine Waren'}}};
    }});
  };
  const settle = () => Promise.all([...globalThis.__sfPageLanguage.packs.pending.values()]);
  try {
    for (const lang of ['ru', 'en', 'de', 'fr']) {
      install(lang, undefined, ['sf-change'], json('src/core/lang/index.json'));
      await settle();
      assert.deepEqual(fetched, [], `${lang}: nothing is asked (built in, or no Framework pack)`);
    }
    // A German page over the made-up index: core's words and the families of the elements already
    // in the document, nothing else.
    install('de', undefined, ['sf-change', 'sf-pagination']);
    await settle();
    assert.deepEqual(fetched.sort(), [`${CDN}de/change.json`, `${CDN}de/core.json`, `${CDN}de/pagination.json`]);
    install('de-CH', undefined, []);
    await settle();
    assert.deepEqual(fetched, [`${CDN}de/core.json`], 'the region asks for its language');
    // A component drawn later asks for its family's part with its first word;
    // the English said meanwhile is a moment, not a gap.
    const empty = {closest: () => ({getAttribute: () => 'de'}), tagName: 'SF-EMPTY-STATE'};
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'No records yet');
    assert.ok(fetched.includes(`${CDN}de/empty.json`));
    await settle();
    assert.deepEqual(language.missing('de'), []);
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Noch keine Einträge');
    // The word no pack has: English, one warning, listed by SF.language.missing().
    const node = {closest: () => ({getAttribute: () => 'de'}), tagName: 'SF-CHANGE'};
    install('de', undefined, ['sf-change']);
    await settle();
    assert.equal(pageWord({en: {'gone-text': 'gone'}, ru: {'gone-text': 'нет'}}, 'gone-text', node), 'gone');
    assert.deepEqual(language.missing('de'), ['sf-change|gone-text']);
    // An English word that is empty on purpose (a placeholder left blank) has nothing to translate.
    const country = {closest: () => ({getAttribute: () => 'de'}), tagName: 'SF-INPUT-COUNTRY'};
    assert.equal(pageWord({en: {placeholder: ''}, ru: {placeholder: ''}}, 'placeholder', country), '');
    assert.deepEqual(language.missing('de'), ['sf-change|gone-text']);
    assert.ok(warnings.some((text) => text.includes('"de": words missing')));
    assert.equal(pageWord({en: {'show-text': 'Show changes'}, ru: {}}, 'show-text', node), 'Änderungen zeigen');
    // SF.language.load fetches every part.
    await language.load('de');
    assert.equal(fetched.filter((url) => url.startsWith(`${CDN}de/`)).length, Object.keys(PACKS.parts.de).length);
    // A product's pack, one line in its boot config, one file, rides with the Framework's.
    install('de', {languages: {de: '/shop/lang/de.json'}}, []);
    await settle();
    assert.deepEqual(fetched.sort(), [`${CDN}de/core.json`, 'https://example.test/shop/lang/de.json']);
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Noch keine Waren');
    await settle();
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Noch keine Waren', 'a product word stays over the Framework part that came after');
    assert.deepEqual(language.packs().de.map((info) => info.delivery).sort(), ['framework', 'framework', 'shop']);
  } finally {
    language.forget();
    globalThis.document = saved.document;
    globalThis.SF_BOOT_CONFIG = saved.config;
    console.warn = saved.warn;
  }
});

test('C177: a bundle built before packs does not hide SF.language.registerPack', async () => {
  const saved = globalThis.window;
  globalThis.window = {SF: {language: {use() {}, register() {}}}};
  try {
    const copy = await import(`../src/core/js/page-language.js?publish=${Date.now()}`);
    assert.equal(globalThis.window.SF.language, copy.language);
    // An older copy published later: the one with packs stays.
    globalThis.window.SF.language = {use() {}, register() {}};
    assert.equal(typeof globalThis.window.SF.language.registerPack, 'function');
    // A newer copy replaces it.
    const newer = {...copy.language, registerPack() {}};
    globalThis.window.SF.language = newer;
    assert.equal(globalThis.window.SF.language, newer);
  } finally {
    globalThis.window = saved;
  }
});
