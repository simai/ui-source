import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {buildPack, folderModule, packScript} from '../scripts/build-language-packs.mjs';
import {builtInLanguages, languageCoverage} from '../scripts/language-coverage.mjs';
import {allowedLiterals, bundleWords, literals} from '../scripts/check-bundle-words.mjs';

// Owner decision C282 (2026-11-17): the components embed English only and
// Russian ships as a language file, built from the same lang/ru.json files:
// the parts core/lang/ru/<family>.json core fetches and one script,
// core/lang/ru.js, a page includes before core (offline, one-file builds).
// src/core/lang/built-in.json is the switch: built_in ["en", "ru"] and a
// rebuild put Russian back into the bundles (rollback).

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const json = (file) => JSON.parse(read(file));

test('C282: the bundles carry English; en and ru are kept complete', () => {
  const builtIn = json('src/core/lang/built-in.json');
  assert.equal(builtIn.schema, 'simai.language-built-in');
  assert.deepEqual(builtIn.built_in, ['en']);
  assert.deepEqual(builtIn.complete, ['en', 'ru']);
  assert.deepEqual(builtInLanguages().builtIn, ['en']);
  // Both complete: every word of every folder in both (the gate fails a gap).
  for (const code of ['en', 'ru']) {
    const report = languageCoverage(code);
    assert.equal(report.complete, true, code);
    assert.equal(report.missing, 0, `${code}: no word missing`);
    assert.equal(report.share, 100, `${code} is complete`);
  }
  assert.equal(languageCoverage('ru').built_in, false, 'Russian is a language file');
});

test('C282: a folder module carries the built-in languages only; the rollback carries Russian again', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'c282-folder-'));
  try {
    writeFileSync(path.join(dir, 'en.json'), JSON.stringify({runtime: {more: 'More'}}));
    writeFileSync(path.join(dir, 'ru.json'), JSON.stringify({runtime: {more: 'Ещё'}}));
    const english = folderModule(dir, ['en']);
    assert.match(english, /import en from '\.\/en\.json' with \{ type: 'json' \};/u);
    assert.doesNotMatch(english, /ru\.json/u);
    assert.match(english, /export const files = \{ en: \{ runtime: en\.runtime \} \};/u);
    assert.match(english, /export default \{ en: en\.runtime \};/u);
    const rollback = folderModule(dir, ['en', 'ru']);
    assert.match(rollback, /import ru from '\.\/ru\.json' with \{ type: 'json' \};/u);
    assert.match(rollback, /export const files = \{ en: \{ runtime: en\.runtime \}, ru: \{ runtime: ru\.runtime \} \};/u);
    assert.match(rollback, /export default \{ en: en\.runtime, ru: ru\.runtime \};/u);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
  // Every folder's module is the one the script writes from built-in.json.
  for (const folder of ['src/smart/tabs/lang', 'src/component/tabs/lang', 'src/core/js/lang/notify', 'src/core/js/lang/editor']) {
    const written = read(`${folder}/index.mjs`);
    assert.equal(written, folderModule(new URL(`../${folder}`, import.meta.url).pathname, ['en']), folder);
  }
});

test('C282: the script form registers the pack before core, under any words already there, and marks it whole', () => {
  const {pack} = buildPack('ru');
  const script = packScript(pack);
  assert.match(script, /^\/\* SIMAI Framework language file: Русский \(ru\), delivery framework, 100 % of \d+ words\./u);
  // No core on the page yet: the words go into the shared registry.
  const page = {};
  page.globalThis = page;
  vm.runInNewContext(script, page);
  const store = page.__sfPageLanguage;
  assert.equal(store.registered.get('sf-tabs').get('ru').more, json('src/smart/tabs/lang/ru.json').runtime.more);
  assert.equal(store.registered.get('sf-notify').get('ru').close, json('src/core/js/lang/notify/ru.json').runtime.close);
  const [info] = store.packs.loaded.get('ru');
  assert.equal(info.whole, true);
  assert.equal(info.delivery, 'framework');
  // A word a product registered first stays: the Framework's goes beneath it.
  const product = {__sfPageLanguage: {listeners: new Set(), registered: new Map([['sf-tabs', new Map([['ru', {more: 'Дальше'}]])]]), chosen: null}};
  product.globalThis = product;
  vm.runInNewContext(script, product);
  assert.equal(product.__sfPageLanguage.registered.get('sf-tabs').get('ru').more, 'Дальше');
  // With core on the page, the pack is handed to SF.language.registerPack.
  const handed = [];
  const withCore = {SF: {language: {registerPack: (one, url) => (handed.push([one.lang, url]), {lang: one.lang})}}};
  withCore.globalThis = withCore;
  vm.runInNewContext(script, withCore);
  assert.deepEqual(handed, [['ru', null]]);
});

test('C282: core fetches nothing for a language whose script form came before it', () => {
  const source = read('src/core/js/language-packs.js');
  assert.match(source, /const whole = \(code\) => \(PACKS\.loaded\.get\(code\) \?\? \[\]\)\.some\(\(info\) => info\?\.whole/u);
  // A class component's class finds its family's part as a tag does.
  assert.match(source, /tags\.flatMap\(\(id\) => \[id, `\.\$\{id\}`\]\)/u);
  // The loader holds a definition until the page language's words are here,
  // at most SF_BOOT_CONFIG.languageWait (800 ms), and preloads meanwhile.
  const loader = read('src/core/js/loader.js');
  assert.match(loader, /const LANGUAGE_WAIT_MS = 800;/u);
  assert.match(loader, /globalThis\.SF_BOOT_CONFIG\?\.languageWait/u);
  assert.match(loader, /const hold = languageHold\(\);\s*if \(!hold\) return this\.insertScript\(src, pluginURL, param\);\s*this\.preloadScript\(pluginURL\);\s*return hold\.then\(\(\) => this\.insertScript\(src, pluginURL, param\)\);/u);
  // The builder ships the script form (ui-builder generatedPackaging LANGUAGE_SCRIPT).
  assert.match(read('docs/developer/language-packs.md'), /<script src="[^"]*core\/lang\/ru\.js"><\/script>/u);
});

test('C282: the bundle-words gate reads literals, JSON payloads and the allowed parsing rules', () => {
  assert.deepEqual(literals("const a = 'Привет'; const r = /ё/gu; const t = `из ${n}`;").map((one) => [one.kind, one.value]), [['string', 'Привет'], ['regexp', 'ё'], ['template', 'из ']]);
  assert.deepEqual(literals(`var m = JSON.parse('{"a":"Ещё","b":["Да"]}');`).map((one) => one.value), ['a', 'Ещё', 'b', 'Да']);
  const {values, places} = allowedLiterals();
  for (const word of ['ё', 'е', 'мб', 'ооо', 'беларуская']) assert.ok(values.has(word), word);
  assert.ok(places.every((place) => !place.file.startsWith('src/core/lang/')));
  const dir = mkdtempSync(path.join(tmpdir(), 'c282-bundle-'));
  try {
    mkdirSync(path.join(dir, 'smart/x'), {recursive: true});
    mkdirSync(path.join(dir, 'core/lang'), {recursive: true});
    writeFileSync(path.join(dir, 'smart/x/x.min.js'), "var u={'мб':'megabyte'};var f=s=>s.replace(/ё/gu,'е');var w='Отмена';");
    writeFileSync(path.join(dir, 'core/lang/ru.js'), "var p={'more':'Ещё'};");
    writeFileSync(path.join(dir, 'smart/x/clean.js'), "var w='Cancel';");
    const found = bundleWords([dir], {allowed: values});
    assert.deepEqual(found.map((one) => [one.file.split(path.sep).slice(1).join('/'), one.values]), [['smart/x/x.min.js', ['Отмена']]]);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
