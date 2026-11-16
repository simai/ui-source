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
// docs/developer/language-packs.md). Pilot: Kazakh.

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

// The Framework's pack of a language, read whole from its parts.
const partsOf = (code) => Object.keys(json('src/core/lang/index.json').parts[code]);
const part = (code, family) => json(`src/core/lang/${code}/${family}.json`);
const wholePack = (code) => {
  const parts = partsOf(code).map((family) => part(code, family));
  return {...parts[0], coverage: json('src/core/lang/index.json').coverage[code], words: Object.assign({}, ...parts.map((one) => one.words))};
};

test('C177 (1)(3): one pack per language for the Framework, in parts by family, written by the script and current', () => {
  execFileSync(process.execPath, ['scripts/build-language-packs.mjs', '--check'], {cwd: new URL('..', import.meta.url)});
  assert.deepEqual(packLanguages(), ['kk']);
  const index = json('src/core/lang/index.json');
  assert.deepEqual([index.schema, index.schema_version, index.delivery, index.languages], ['simai.language-pack-index', 1, 'framework', ['kk']]);
  // C177 follow-up (#46): the pack is split by component family before the
  // next word group; index.json says which components each part holds, and
  // every part is a file of that name.
  const families = packFamilies();
  const parts = index.parts.kk;
  assert.ok(Object.keys(parts).length > 40, 'a part per family');
  assert.ok(parts.core.includes('sf-file-size') && parts.core.includes('sf-relative-day'), 'core words are the core part');
  assert.ok(parts.input.includes('sf-input') && parts.pagination.includes('sf-pagination'));
  for (const [family, ids] of Object.entries(parts)) {
    assert.deepEqual(Object.keys(part('kk', family).words), ids, family);
    for (const id of ids) assert.equal(families.get(id), family, id);
  }
  assert.deepEqual(readdirSync(new URL('../src/core/lang/kk/', import.meta.url)).sort(), Object.keys(parts).map((family) => `${family}.json`).sort());
  assert.ok(!existsSync(new URL('../src/core/lang/kk.json', import.meta.url)), 'no whole-language file beside the parts');
  // ru and en are never packs: they are built into the components (C177 (2)).
  assert.ok(!existsSync(new URL('../src/core/lang/ru.json', import.meta.url)));
  assert.ok(!existsSync(new URL('../src/core/lang/en.json', import.meta.url)));
});

test('C177 (8): the pack is what the public schema says', () => {
  const schema = json('src/core/contracts/language-pack.v1.schema.json');
  assert.equal(schema.$id, 'https://simai.io/contracts/language-pack.v1.schema.json');
  // Every part is a whole pack of the public format.
  for (const family of partsOf('kk')) {
    const one = part('kk', family);
    assert.deepEqual(packProblems(one, schema), [], family);
    assert.equal(one.$schema, '../../contracts/language-pack.v1.schema.json', family);
  }
  // A pack a product writes by hand: the smallest one the schema takes.
  assert.deepEqual(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'de', words: {'sf-pagination': {'next-label': 'Nächste Seite'}}}, schema), []);
  assert.ok(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'DE', words: {}}, schema).includes('lang'));
  const doc = read('docs/developer/language-packs.md');
  for (const word of ['simai.language-pack', 'schema_version', 'SF.language.registerPack', 'SF.language.addPack', 'SF.language.register(', 'SF_BOOT_CONFIG.languages', 'Intl.PluralRules', 'build-language-packs.mjs', 'language-coverage.mjs', 'status']) {
    assert.ok(doc.includes(word), `the spec names ${word}`);
  }
});

test('C177 (7): the Kazakh pilot - draft, whole, every part within its budget', () => {
  const pack = wholePack('kk');
  assert.equal(pack.lang, 'kk');
  assert.equal(pack.status, 'draft', 'a machine draft until a native speaker reads it');
  assert.match(pack.review, /native review/u);
  const coverage = languageCoverage('kk');
  assert.equal(pack.coverage.words, coverage.words);
  assert.equal(pack.coverage.translated, coverage.words - coverage.missing);
  // sf-change says one phrase with both values (change-text) since 1.1.0, so
  // the word Kazakh could not say (to-text, C177 (9)) is gone: nothing missing.
  assert.equal(pack.coverage.share, 100, `${pack.coverage.share}`);
  assert.deepEqual(coverage.folders.map((folder) => [folder.id, folder.missing]), []);
  // A trait's words (x-trait-words, field-inherit@1) are the component's own words and ride the pack.
  for (const id of ['sf-input', 'sf-dropdown', 'sf-switch', 'sf-input-textarea', 'sf-input-quantity']) {
    assert.deepEqual(Object.keys(pack.words[id] ?? {}).filter((key) => ['inherited', 'reset', 'described'].includes(key)).sort(), ['described', 'inherited', 'reset'], id);
  }
  // The byte budget is a part's (#46, #113): the whole pack had reached
  // 15.2 KB gzip of its 16 KB cap. A part stays under 8 KB gzip, so a page
  // that shows a few families fetches a few KB, and a family that grows past
  // it is a sign to look at its words, not to raise the cap.
  for (const family of partsOf('kk')) {
    const gzip = gzipSync(readFileSync(new URL(`../src/core/lang/kk/${family}.json`, import.meta.url)), {level: 9}).length;
    assert.ok(gzip <= 8192, `kk/${family}.json gzip ${gzip}`);
    assert.equal(part('kk', family).status, 'draft', family);
  }
  // Kazakh nouns stay singular after a number: one and other say the same.
  for (const words of Object.values(pack.words)) {
    for (const word of Object.values(words)) {
      if (typeof word === 'object') assert.deepEqual(Object.keys(word).sort(), ['one', 'other']);
    }
  }
});

test('C177 (5): no shared dictionary; one component in two folders says each word once', () => {
  const ids = new Map();
  for (const folder of languageFolders()) ids.set(folder.id, componentId(folder));
  assert.equal(ids.get('smart/pagination'), 'sf-pagination');
  assert.equal(ids.get('component/modal'), 'sf-modal');
  assert.equal(ids.get('core/file-size'), 'sf-file-size');
  const {problems} = buildPack('kk');
  assert.deepEqual(problems, []);
});

test('C177: every word in every language says the placeholders of its Russian word, in every component', () => {
  // Group build 6 (2026-11-15): the Russian words of sf-file-preview gained
  // {name} and sf-time's «yesterday at» {day}, and three Kazakh words kept the
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
    write('kk', {download: 'Файлды жүктеп алу', day: 'кеше, {time}', more: {one: 'Тағы файл', other: 'Тағы файл'}, plain: '{name} файлы', blank: ''});
    assert.deepEqual(placeholderGaps(root).map(({code, key, ru, word}) => [code, key, ru.join(), word.join()]), [
      ['kk', 'download', 'name', ''],
      ['kk', 'day', 'day,time', 'time'],
      ['kk', 'more', 'n', ''],
      ['kk', 'plain', '', 'name'],
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
  assert.equal(json('src/component/swiper/lang/kk.json').runtime.goToSlide, '{n}-слайдқа өту');
  // Country names in a third language come from Intl, not as English.
  assert.doesNotMatch(read('src/component/country-code/js/_country_code.js'), /locale === 'ru' \? 'ru' : 'en'/u);
  assert.match(read('src/component/country-code/js/_country_code.js'), /new Intl\.DisplayNames\(\[locale\], \{type: 'region'\}\)/u);
});

test('C177 (4)(6): pack words below a product word, a Framework pack below a product pack', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  language.forget();
  const node = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-PAGINATION'};
  const shipped = {en: {'next-label': 'Next page', 'pages-label': 'Pages:'}, ru: {'next-label': 'Следующая страница', 'pages-label': 'Страницы:'}};
  // A product's word registered before the Framework pack arrives still wins.
  language.register('sf-pagination', 'kk', {'pages-label': 'Парақтар:'});
  const info = language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: 'kk', words: {'sf-pagination': {'next-label': 'Келесі бет', 'pages-label': 'Беттер:'}}});
  assert.equal(info.words, 2);
  assert.equal(pageWord(shipped, 'next-label', node), 'Келесі бет');
  assert.equal(pageWord(shipped, 'pages-label', node), 'Парақтар:');
  // A product pack overrides the Framework's, whichever came first.
  language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'my-product', lang: 'kk', words: {'sf-pagination': {'next-label': 'Әрі қарай'}}});
  language.registerPack({schema: 'simai.language-pack', schema_version: 1, lang: 'kk', words: {'sf-pagination': {'next-label': 'Келесі бет'}}});
  assert.equal(pageWord(shipped, 'next-label', node), 'Әрі қарай');
  assert.deepEqual(Object.keys(language.packs()), ['kk']);
  assert.equal(language.registerPack({lang: 'kk', words: {}}), null, 'not a pack');
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
  const install = (lang, config, tags = []) => {
    language.forget();
    globalThis.__sfMissingWords = new Map();
    globalThis.document = {
      documentElement: {getAttribute: () => lang}, baseURI: 'https://example.test/page/', readyState: 'complete',
      querySelectorAll: (selector) => tags.filter((tag) => selector.split(',').includes(tag)).map((tag) => ({localName: tag})),
    };
    globalThis.SF_BOOT_CONFIG = config;
    fetched = [];
    installLanguagePacks({root: 'https://cdn.test/distr/core/', again: true, fetchJson: async (url) => {
      fetched.push(url);
      if (url.startsWith(CDN)) return json(`src/core/lang/${url.slice(CDN.length)}`);
      return {schema: 'simai.language-pack', schema_version: 1, delivery: 'shop', lang: 'kk', words: {'sf-empty-state': {'no-data-title': 'Тауар әзірге жоқ'}}};
    }});
  };
  const settle = () => Promise.all([...globalThis.__sfPageLanguage.packs.pending.values()]);
  try {
    for (const lang of ['ru', 'en', 'de']) {
      install(lang, undefined, ['sf-change']);
      await settle();
      assert.deepEqual(fetched, [], `${lang}: nothing is asked (built in, or no Framework pack)`);
    }
    // A Kazakh page: core's words and the families of the elements already
    // in the document, nothing else.
    install('kk', undefined, ['sf-change', 'sf-pagination']);
    await settle();
    assert.deepEqual(fetched.sort(), [`${CDN}kk/change.json`, `${CDN}kk/core.json`, `${CDN}kk/pagination.json`]);
    install('kk-KZ', undefined, []);
    await settle();
    assert.deepEqual(fetched, [`${CDN}kk/core.json`], 'the region asks for its language');
    // A component drawn later asks for its family's part with its first word;
    // the English said meanwhile is a moment, not a gap.
    const empty = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-EMPTY-STATE'};
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'No records yet');
    assert.ok(fetched.includes(`${CDN}kk/empty.json`));
    await settle();
    assert.deepEqual(language.missing('kk'), []);
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Әзірге жазба жоқ');
    // The word no pack has: English, one warning, listed by SF.language.missing().
    const node = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-CHANGE'};
    install('kk', undefined, ['sf-change']);
    await settle();
    assert.equal(pageWord({en: {'gone-text': 'gone'}, ru: {'gone-text': 'нет'}}, 'gone-text', node), 'gone');
    assert.deepEqual(language.missing('kk'), ['sf-change|gone-text']);
    // An English word that is empty on purpose (a placeholder left blank) has nothing to translate.
    const country = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-INPUT-COUNTRY'};
    assert.equal(pageWord({en: {placeholder: ''}, ru: {placeholder: ''}}, 'placeholder', country), '');
    assert.deepEqual(language.missing('kk'), ['sf-change|gone-text']);
    assert.ok(warnings.some((text) => text.includes('"kk": words missing')));
    assert.equal(pageWord({en: {'show-text': 'Show changes'}, ru: {}}, 'show-text', node), 'Өзгерістерді көрсету');
    // SF.language.load fetches every part.
    await language.load('kk');
    assert.equal(fetched.filter((url) => url.startsWith(`${CDN}kk/`)).length, Object.keys(json('src/core/lang/index.json').parts.kk).length);
    // A product's pack, one line in its boot config, one file, rides with the Framework's.
    install('kk', {languages: {kk: '/shop/lang/kk.json'}}, []);
    await settle();
    assert.deepEqual(fetched.sort(), [`${CDN}kk/core.json`, 'https://example.test/shop/lang/kk.json']);
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Тауар әзірге жоқ');
    await settle();
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Тауар әзірге жоқ', 'a product word stays over the Framework part that came after');
    assert.deepEqual(language.packs().kk.map((info) => info.delivery).sort(), ['framework', 'framework', 'shop']);
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
