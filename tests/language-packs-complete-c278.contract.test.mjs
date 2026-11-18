import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import {buildPack, packLanguages} from '../scripts/build-language-packs.mjs';
import {FALLBACK, languageCoverage, languageFolders, placeholderGaps, runtimeWords} from '../scripts/language-coverage.mjs';

// Owner decision C278 (2026-11-17): the Framework interface speaks the
// languages of the registry (localization standard §3). Every registry
// language but English, which is built in, ships a language file with every
// word of the authoring pack (Russian): no key missing, the placeholders of
// the Russian word, every plural form of its language (Intl.PluralRules), the
// name and direction the registry gives. A new word written in Russian and
// English is a red unit until every pack says it.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const registry = json('src/core/contracts/language-registry.v1.json');
const index = json('src/core/lang/index.json');
const shipped = registry.languages.filter((one) => one.pack === 'shipped');
const code = (one) => one.locale.toLowerCase();

test('C278: the registry marks English built in and every other language shipped, and the index lists exactly those', () => {
  assert.deepEqual(registry.languages.map((one) => [one.locale, one.pack]), registry.languages.map((one) => [one.locale, one.locale === 'en' ? 'built-in' : 'shipped']));
  assert.deepEqual(index.languages, shipped.map(code).sort());
  assert.deepEqual(packLanguages(), shipped.map(code).sort());
  assert.deepEqual(json('src/core/lang/built-in.json').built_in, ['en'], 'the bundles say English only');
});

test('C278: every pack says every word of the authoring pack', () => {
  const total = languageCoverage('ru').words;
  for (const one of shipped) {
    const coverage = languageCoverage(code(one));
    assert.equal(coverage.words, total, one.locale);
    assert.equal(coverage.missing, 0, `${one.locale}: ${coverage.folders.map((folder) => `${folder.id}: ${folder.missing.join(', ')}`).join('; ')}`);
    assert.deepEqual(coverage.folders.flatMap((folder) => folder.gaps.map((gap) => `${folder.id}: ${gap}`)), [], `${one.locale}: plural forms and placeholders`);
    assert.deepEqual(index.coverage[code(one)], {words: total, translated: total, share: 100}, one.locale);
  }
});

test('C278: every key of every pack is a key of the authoring pack, said with the same placeholders', () => {
  assert.deepEqual(placeholderGaps().map((gap) => `${gap.code} ${gap.id} ${gap.key}`), []);
  for (const {id, dir} of languageFolders()) {
    const russian = runtimeWords(JSON.parse(readFileSync(`${dir}/ru.json`, 'utf8')));
    const english = runtimeWords(JSON.parse(readFileSync(`${dir}/${FALLBACK}.json`, 'utf8')));
    assert.deepEqual(Object.keys(russian).sort(), Object.keys(english).sort(), `${id}: ru and en`);
    for (const one of shipped) {
      const words = runtimeWords(JSON.parse(readFileSync(`${dir}/${code(one)}.json`, 'utf8')));
      assert.deepEqual(Object.keys(words).sort(), Object.keys(russian).sort(), `${id}: ${one.locale}`);
    }
  }
});

test('C278: each pack ships whole and in parts, under the registry name and direction, with no build problem', () => {
  for (const one of shipped) {
    const {pack, problems} = buildPack(code(one));
    assert.deepEqual(problems, [], one.locale);
    assert.deepEqual([pack.lang, pack.name, pack.dir], [code(one), one.name, one.direction], one.locale);
    assert.ok(existsSync(new URL(`../src/core/lang/${code(one)}.js`, import.meta.url)), `${one.locale}: script form`);
    assert.deepEqual(Object.keys(index.parts[code(one)]), Object.keys(index.parts.ru), `${one.locale}: the families of the authoring pack`);
    for (const family of Object.keys(index.parts[code(one)])) assert.ok(existsSync(new URL(`../src/core/lang/${code(one)}/${family}.json`, import.meta.url)), `${one.locale}/${family}`);
  }
  const ar = buildPack('ar').pack;
  assert.equal(ar.dir, 'rtl');
  assert.deepEqual(Object.keys(ar.words['sf-search']['count-text']).sort(), ['few', 'many', 'one', 'other', 'two', 'zero'], 'Arabic says the six forms');
});
