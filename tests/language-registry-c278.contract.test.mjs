import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The SIMAI language registry (localization standard §3, decision L4) and
// owner decision C278 (2026-11-17): eleven languages, Arabic the 11th (right
// to left); the Framework ships no interface pack of a language the registry
// does not hold.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const registry = JSON.parse(read('src/core/contracts/language-registry.v1.json'));

test('C278: the registry holds the eleven languages of the standard, Arabic 11th and right to left', () => {
  assert.equal(registry.schema, 'simai.language-registry');
  assert.equal(registry.schema_version, 1);
  const codes = registry.languages.map((one) => one.locale);
  assert.deepEqual(codes, ['en', 'ru', 'zh-Hans', 'es', 'pt-BR', 'de', 'fr', 'it', 'ja', 'ko', 'ar']);
  assert.deepEqual(registry.languages.map((one) => one.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const ar = registry.languages.find((one) => one.locale === 'ar');
  assert.deepEqual([ar.direction, ar.order, ar.priority, ar.name], ['rtl', 11, 10, 'العربية']);
  assert.ok(registry.languages.filter((one) => one.locale !== 'ar').every((one) => one.direction === 'ltr'));
  assert.equal(new Set(registry.languages.map((one) => one.priority).filter((n) => n !== null)).size, 10, 'one translation step each');
});

test('C278: every Framework language pack is of a registry language', () => {
  const index = JSON.parse(read('src/core/lang/index.json'));
  const codes = new Set(registry.languages.map((one) => one.locale.toLowerCase()));
  for (const code of index.languages) assert.ok(codes.has(code), code);
});

test('C278: a page in a registry second name (zh-CN) asks for and reads the registry language (zh-hans); no pack is added', async () => {
  const {language, pageWord} = await import('../src/core/js/page-language.js');
  const {installLanguagePacks, registryAliases} = await import('../src/core/js/language-packs.js');
  const aliases = registryAliases();
  for (const entry of registry.languages) {
    for (const alias of entry.aliases) assert.equal(aliases[alias.toLowerCase()], entry.slug, alias);
  }
  assert.deepEqual(aliases, registryAliases(registry), 'read from the registry, nothing else');
  assert.equal(globalThis.__sfPageLanguage.aliases['zh-cn'], 'zh-hans');
  const saved = {document: globalThis.document, config: globalThis.SF_BOOT_CONFIG};
  const asked = [];
  try {
    language.forget();
    globalThis.document = {documentElement: {getAttribute: () => 'zh-CN'}, baseURI: 'https://example.test/', readyState: 'complete', querySelectorAll: () => []};
    globalThis.SF_BOOT_CONFIG = {languages: {'zh-hans': '/site/lang/zh-hans.json'}};
    installLanguagePacks({root: 'https://cdn.test/core/', again: true, packs: {languages: [], parts: {}}, fetchJson: async (url) => {
      asked.push(url);
      return {schema: 'simai.language-pack', schema_version: 1, delivery: 'site', lang: 'zh-hans', words: {'sf-display-settings': {'skip-link-text': '跳到内容'}}};
    }});
    await Promise.all([...globalThis.__sfPageLanguage.packs.pending.values()]);
    assert.deepEqual(asked, ['https://example.test/site/lang/zh-hans.json']);
    const node = {closest: () => ({getAttribute: () => 'zh-CN'}), tagName: 'SF-DISPLAY-SETTINGS'};
    assert.equal(pageWord({en: {'skip-link-text': 'Skip to content'}}, 'skip-link-text', node), '跳到内容');
    // A word registered for zh-CN itself still comes first.
    language.register('sf-display-settings', 'zh-CN', {'skip-link-text': '跳至内容'});
    assert.equal(pageWord({en: {'skip-link-text': 'Skip to content'}}, 'skip-link-text', node), '跳至内容');
  } finally {
    language.forget();
    globalThis.document = saved.document;
    globalThis.SF_BOOT_CONFIG = saved.config;
  }
});
