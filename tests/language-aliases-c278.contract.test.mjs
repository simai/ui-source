import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {packAliases, packLanguages} from '../scripts/build-language-packs.mjs';

// Owner decision C278 follow-up (2026-11-18): a page language reaches a
// shipped pack through the aliases of the language registry, matched without
// regard to case, and a region the registry does not name takes its base
// language's pack. zh, zh-CN, zh-SG, zh-Hans: zh-hans; pt, pt-BR: pt-br. Until
// then the lookup was the exact code, its base, English: a zh-CN or pt page
// spoke English beside a shipped pack.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('C278: the index carries the registry aliases of the shipped packs, and none is a pack of its own', () => {
  const index = json('src/core/lang/index.json');
  const expected = {pt: 'pt-br', zh: 'zh-hans', 'zh-cn': 'zh-hans', 'zh-sg': 'zh-hans'};
  assert.deepEqual(index.aliases, expected);
  assert.deepEqual(packAliases(packLanguages()), expected);
  const registry = json('src/core/contracts/language-registry.v1.json');
  const zh = registry.languages.find((one) => one.locale === 'zh-Hans');
  const pt = registry.languages.find((one) => one.locale === 'pt-BR');
  assert.deepEqual(zh.aliases, ['zh', 'zh-CN', 'zh-SG']);
  assert.deepEqual(pt.aliases, ['pt']);
  for (const target of Object.values(index.aliases)) assert.ok(index.languages.includes(target), target);
  for (const alias of Object.keys(index.aliases)) assert.ok(!index.languages.includes(alias), alias);
});

test('C278: a page in an alias, any case, or a region the registry does not name, fetches and speaks the pack', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  const {installLanguagePacks} = await import('../src/core/js/language-packs.js');
  const {fileSizeUnits} = await import('../src/core/js/format-file-size.js');
  const saved = {document: globalThis.document, config: globalThis.SF_BOOT_CONFIG, warn: console.warn};
  const warnings = [];
  console.warn = (text) => warnings.push(String(text));
  const CDN = 'https://cdn.test/distr/core/lang/';
  const WORD = {'zh-hans': '下一页', 'pt-br': 'Próxima página', de: 'Nächste Seite'};
  const UNITS = {'zh-hans': {b: '字节', kb: 'KB', mb: 'MB', gb: 'GB'}, 'pt-br': {b: 'B', kb: 'KB', mb: 'MB', gb: 'GB'}, de: {b: 'B', kb: 'KB', mb: 'MB', gb: 'GB'}};
  let fetched = [];
  const index = json('src/core/lang/index.json');
  const install = (lang) => {
    language.forget();
    globalThis.__sfMissingWords = new Map();
    globalThis.document = {
      documentElement: {getAttribute: () => lang}, baseURI: 'https://example.test/page/', readyState: 'complete',
      querySelectorAll: () => [],
    };
    globalThis.SF_BOOT_CONFIG = undefined;
    fetched = [];
    installLanguagePacks({root: 'https://cdn.test/distr/core/', again: true, packs: index, fetchJson: async (url) => {
      fetched.push(url);
      const [code, file] = url.slice(CDN.length).split('/');
      const family = file.replace(/\.json$/u, '');
      const words = family === 'core' ? {'sf-file-size': UNITS[code]} : family === 'pagination' ? {'sf-pagination': {'next-label': WORD[code]}} : {};
      return {schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: code, words};
    }});
  };
  const settle = () => Promise.all([...globalThis.__sfPageLanguage.packs.pending.values()]);
  const say = (lang) => pageWord({en: {'next-label': 'Next page'}}, 'next-label', {closest: () => ({getAttribute: () => lang}), tagName: 'SF-PAGINATION'});
  const cases = [
    ['zh-CN', 'zh-hans'], ['zh-SG', 'zh-hans'], ['zh', 'zh-hans'], ['zh-Hans', 'zh-hans'], ['ZH-cn', 'zh-hans'],
    ['zh_CN', 'zh-hans'], ['zh-Hans-CN', 'zh-hans'], ['zh-TW', 'zh-hans'],
    ['pt', 'pt-br'], ['pt-BR', 'pt-br'], ['PT-br', 'pt-br'], ['pt-PT', 'pt-br'],
    ['de', 'de'], ['de-AT', 'de'],
  ];
  try {
    for (const [lang, pack] of cases) {
      install(lang);
      await settle();
      assert.deepEqual(fetched, [`${CDN}${pack}/core.json`], `${lang}: core's part of ${pack} at start`);
      say(lang); // the first word asks for its family's part
      await settle();
      assert.ok(fetched.includes(`${CDN}${pack}/pagination.json`), `${lang}: asks ${pack} for the family`);
      assert.equal(say(lang), WORD[pack], `${lang}: ${pack} word`);
      assert.deepEqual(fileSizeUnits(lang), Object.values(UNITS[pack]), `${lang}: core's own words through the alias`);
      assert.deepEqual(language.missing(lang), [], `${lang}: nothing missing`);
      assert.ok(fetched.every((url) => url.startsWith(`${CDN}${pack}/`)), `${lang}: no request under the alias's own code`);
    }
    // A language the registry does not hold still speaks English and asks for nothing.
    for (const lang of ['nl', 'tr-TR']) {
      install(lang);
      await settle();
      assert.deepEqual(fetched, [], lang);
      assert.equal(say(lang), 'Next page', lang);
    }
    // The script form (core/lang/zh-hans.js) before core: a zh-CN page reads it and fetches no part.
    install('zh-CN');
    await settle();
    language.forget();
    language.registerPack({schema: 'simai.language-pack', schema_version: 1, delivery: 'framework', lang: 'zh-hans', words: {'sf-pagination': {'next-label': WORD['zh-hans']}}});
    assert.equal(say('zh-CN'), WORD['zh-hans']);
    // A product's word for the alias itself wins over the Framework pack.
    language.register('sf-pagination', 'zh-CN', {'next-label': '下页'});
    assert.equal(say('zh-CN'), '下页');
    assert.equal(say('zh-SG'), WORD['zh-hans']);
    assert.deepEqual(warnings.filter((text) => text.includes('words missing') && !/"(nl|tr)"/u.test(text)), [], 'only the languages without a pack are said in English');
  } finally {
    language.forget();
    globalThis.document = saved.document;
    globalThis.SF_BOOT_CONFIG = saved.config;
    console.warn = saved.warn;
  }
});
