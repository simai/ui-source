import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {russianWords} from './support/russian-language-file.mjs';

// The display settings (owner decision C196, 2026-11-15): core
// (core/js/display-settings.js, core/scss/_sf_css__display.scss) and the panel
// sf-display-settings say the same. The browser half, on the built core and
// the built panel, is tests/browser/display-settings.browser.mjs; the schemes'
// contrast is tests/browser/display-settings-contrast.browser.mjs.

const settings = await import('../src/core/js/display-settings.js');
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const sheet = read('../src/core/scss/_sf_css__display.scss');
const lang = {ru: json('../src/smart/display-settings/lang/ru.json'), en: json('../src/smart/display-settings/lang/en.json')};

test('the sheet draws exactly the schemes core knows, and only from palette tones', () => {
  const block = sheet.match(/\$schemes: \(([\s\S]*?)\n {2}\);/u)?.[1] ?? '';
  const names = [...block.matchAll(/^ {4}'([a-z-]+)': \(/gmu)].map(([, name]) => name);
  assert.deepEqual(names, [...settings.SCHEMES]);
  const tones = [...block.matchAll(/'(?:ground|text|link)': '(--sf-[a-z0-9-]+)'/gu)].map(([, tone]) => tone);
  assert.equal(tones.length, 3 * settings.SCHEMES.length);
  for (const tone of tones) assert.match(tone, /^--sf-(?:white|black|[a-z]+-\d{1,2})$/u, `${tone} is a palette tone`);
  assert.doesNotMatch(sheet.replace(/\/\/.*$/gmu, ''), /#[0-9a-f]{3,8}\b|rgb\(/iu, 'no literal colour');
});

test('no component background or edge is reset with !important', () => {
  const code = sheet.replace(/\/\/.*$/gmu, '');
  for (const [, property] of code.matchAll(/([a-z-]+):[^;]*!important/gu)) {
    assert.ok(['animation-duration', 'animation-iteration-count', 'transition-duration', 'scroll-behavior'].includes(property), `${property} !important`);
  }
});

test('the words core says are the panel\'s', () => {
  for (const locale of ['ru', 'en']) {
    // English is built in; Russian is core's language file (C282).
    const own = locale === 'en' ? settings.WORDS.en : russianWords('core/js/lang/skip-link');
    assert.equal(own['skip-link-text'], lang[locale].runtime['skip-link-text'], locale);
    for (const name of settings.SCHEMES) assert.ok(lang[locale].runtime[`scheme-${name}`], `${locale} names ${name}`);
  }
  assert.deepEqual(Object.keys(lang.ru.runtime).sort(), Object.keys(lang.en.runtime).sort());
});

test('a choice is made safe, and an old scheme name is the nearest new one', () => {
  assert.deepEqual(settings.normalize({scheme: 'nonsense', textScale: 300, images: 'gray', extra: 1}), {...settings.DEFAULTS, images: 'grey'});
  assert.equal(settings.normalize({textScale: '150'}).textScale, 150);
  for (const [from, to] of Object.entries(settings.LEGACY_SCHEMES)) {
    assert.ok(settings.SCHEMES.includes(to), `${from} -> ${to}`);
    assert.equal(settings.schemeName(from), to);
    assert.equal(settings.schemeName(`special${from}`), to);
  }
  assert.equal(settings.LEGACY_REMOVE_AFTER, '2027-01-01');
  assert.ok(settings.isDefault({}));
  assert.ok(!settings.isDefault({motion: 'reduce'}));
});

test('the choice is kept in localStorage alone, and a default keeps nothing', () => {
  const kept = new Map();
  globalThis.localStorage = {getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, String(value)), removeItem: (key) => kept.delete(key)};
  try {
    settings.writeSettings({scheme: 'blue-on-sky', textScale: 125}, null);
    assert.deepEqual([...kept.keys()], [settings.STORAGE_KEY]);
    assert.equal(JSON.parse(kept.get(settings.STORAGE_KEY)).scheme, 'blue-on-sky');
    assert.equal(settings.readStored().textScale, 125);
    settings.resetSettings(null);
    assert.equal(kept.size, 0);
  } finally {
    delete globalThis.localStorage;
  }
  const code = read('../src/core/js/display-settings.js') + read('../src/smart/display-settings/index.js');
  assert.doesNotMatch(code, /document\.cookie|fetch\(|XMLHttpRequest|sendBeacon/u);
});

test('the legacy sf-special sheets are gone; its classes are read as display settings until 2027-01-01', () => {
  assert.doesNotMatch(read('../src/component/special/scss/index.scss'), /@use '(?:white|black|yellow|blue|green|interval|font|image)'/u);
  const journal = json('../contracts/changes/journal.json');
  const record = (journal.records ?? journal).find((one) => one.id === 'display-settings-replaces-special');
  assert.ok(record, 'journal record');
  assert.equal(record.remove_after, '2027-01-01');
});
