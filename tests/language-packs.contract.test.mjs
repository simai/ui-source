import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {gzipSync} from 'node:zlib';
import {LEGACY_IDS, buildPack, componentId, packLanguages} from '../scripts/build-language-packs.mjs';
import {languageCoverage, languageFolders} from '../scripts/language-coverage.mjs';

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

test('C177 (1)(3): one pack per language for the Framework, written by the script and current', () => {
  execFileSync(process.execPath, ['scripts/build-language-packs.mjs', '--check'], {cwd: new URL('..', import.meta.url)});
  assert.deepEqual(packLanguages(), ['kk']);
  assert.deepEqual(json('src/core/lang/index.json'), {schema: 'simai.language-pack-index', schema_version: 1, delivery: 'framework', languages: ['kk']});
  // ru and en are never packs: they are built into the components (C177 (2)).
  assert.ok(!existsSync(new URL('../src/core/lang/ru.json', import.meta.url)));
  assert.ok(!existsSync(new URL('../src/core/lang/en.json', import.meta.url)));
});

test('C177 (8): the pack is what the public schema says', () => {
  const schema = json('src/core/contracts/language-pack.v1.schema.json');
  assert.equal(schema.$id, 'https://simai.io/contracts/language-pack.v1.schema.json');
  const pack = json('src/core/lang/kk.json');
  assert.deepEqual(packProblems(pack, schema), []);
  // A pack a product writes by hand: the smallest one the schema takes.
  assert.deepEqual(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'de', words: {'sf-pagination': {'next-label': 'Nächste Seite'}}}, schema), []);
  assert.ok(packProblems({schema: 'simai.language-pack', schema_version: 1, lang: 'DE', words: {}}, schema).includes('lang'));
  const doc = read('docs/developer/language-packs.md');
  for (const word of ['simai.language-pack', 'schema_version', 'SF.language.registerPack', 'SF.language.addPack', 'SF.language.register(', 'SF_BOOT_CONFIG.languages', 'Intl.PluralRules', 'build-language-packs.mjs', 'language-coverage.mjs', 'status']) {
    assert.ok(doc.includes(word), `the spec names ${word}`);
  }
});

test('C177 (7): the Kazakh pilot - draft, nearly whole, 11-14 KB, the gaps named', () => {
  const pack = json('src/core/lang/kk.json');
  assert.equal(pack.lang, 'kk');
  assert.equal(pack.status, 'draft', 'a machine draft until a native speaker reads it');
  assert.match(pack.review, /native review/u);
  const coverage = languageCoverage('kk');
  assert.equal(pack.coverage.words, coverage.words);
  assert.equal(pack.coverage.translated, coverage.words - coverage.missing);
  assert.ok(pack.coverage.share >= 99, `${pack.coverage.share}`);
  // The one word left out on purpose: sf-change reads «A to B» as three
  // pieces, which Kazakh cannot say without endings on the values (C177 (9)).
  assert.deepEqual(coverage.folders.map((folder) => [folder.id, folder.missing]), [['smart/change', ['to-text']]]);
  // A trait's words (x-trait-words, field-inherit@1) are the component's own words and ride the pack.
  for (const id of ['sf-input', 'sf-dropdown', 'sf-switch', 'sf-input-textarea', 'sf-input-quantity']) {
    assert.deepEqual(Object.keys(pack.words[id] ?? {}).filter((key) => ['inherited', 'reset', 'described'].includes(key)).sort(), ['described', 'inherited', 'reset'], id);
  }
  const gzip = gzipSync(readFileSync(new URL('../src/core/lang/kk.json', import.meta.url)), {level: 9}).length;
  assert.ok(gzip >= 9000 && gzip <= 14336, `kk.json gzip ${gzip}`);
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

test('C177 (1)(4): core fetches one pack, only for a language that has one; a missing word is said in English and listed', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  const {installLanguagePacks} = await import('../src/core/js/language-packs.js');
  const saved = {document: globalThis.document, config: globalThis.SF_BOOT_CONFIG, warn: console.warn};
  const warnings = [];
  console.warn = (text) => warnings.push(String(text));
  const run = async (lang, config) => {
    language.forget();
    globalThis.__sfMissingWords = new Map();
    globalThis.document = {documentElement: {getAttribute: () => lang}, baseURI: 'https://example.test/page/'};
    globalThis.SF_BOOT_CONFIG = config;
    const fetched = [];
    const pack = json('src/core/lang/kk.json');
    installLanguagePacks({root: 'https://cdn.test/distr/core/', again: true, fetchJson: async (url) => {
      fetched.push(url);
      if (url.endsWith('/core/lang/kk.json')) return pack;
      return {schema: 'simai.language-pack', schema_version: 1, delivery: 'shop', lang: 'kk', words: {'sf-empty-state': {'no-data-title': 'Тауар әзірге жоқ'}}};
    }});
    await language.load(lang ?? 'en');
    return fetched;
  };
  try {
    assert.deepEqual(await run('ru'), [], 'a Russian page asks for nothing');
    assert.deepEqual(await run('en'), [], 'an English page asks for nothing');
    assert.deepEqual(await run('de'), [], 'no Framework pack of de: nothing is asked');
    assert.deepEqual(await run('kk'), ['https://cdn.test/distr/core/lang/kk.json'], 'one file');
    assert.deepEqual(await run('kk-KZ'), ['https://cdn.test/distr/core/lang/kk.json'], 'the region asks for its language');
    const node = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-CHANGE'};
    // The word the pack lacks: English, one warning, listed by SF.language.missing().
    assert.equal(pageWord({en: {'to-text': 'to'}, ru: {'to-text': 'на'}}, 'to-text', node), 'to');
    assert.deepEqual(language.missing('kk'), ['sf-change|to-text']);
    // An English word that is empty on purpose (a placeholder left blank) has nothing to translate.
    const country = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-INPUT-COUNTRY'};
    assert.equal(pageWord({en: {placeholder: ''}, ru: {placeholder: ''}}, 'placeholder', country), '');
    assert.deepEqual(language.missing('kk'), ['sf-change|to-text']);
    assert.ok(warnings.some((text) => text.includes('"kk": words missing')));
    assert.equal(pageWord({en: {'show-text': 'Show changes'}, ru: {}}, 'show-text', node), 'Өзгерістерді көрсету');
    // A product's pack, one line in its boot config, rides with the Framework's.
    const both = await run('kk', {languages: {kk: '/shop/lang/kk.json'}});
    assert.deepEqual(both, ['https://cdn.test/distr/core/lang/kk.json', 'https://example.test/shop/lang/kk.json']);
    const empty = {closest: () => ({getAttribute: () => 'kk'}), tagName: 'SF-EMPTY-STATE'};
    assert.equal(pageWord({en: {'no-data-title': 'No records yet'}}, 'no-data-title', empty), 'Тауар әзірге жоқ');
    assert.equal(language.packs().kk.length, 2);
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
