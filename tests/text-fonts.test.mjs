import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {startTextFonts, textFontProbes, unicodeRangeCovers} from '../src/core/js/text-fonts.js';

// Ranges as Chrome reports them for the built Inter faces.
const LATIN = 'U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+100-2BA, U+2BD-2C5, U+2C7-2CC';
const CYRILLIC = 'U+301, U+400-45F, U+490-491, U+4B0-4B1, U+2116';
const CYRILLIC_EXT = 'U+460-52F, U+1C80-1C8A';
const GREEK = 'U+370-377, U+37A-37F';

const face = (family, unicodeRange, status = 'unloaded') => ({
  family,
  unicodeRange,
  status,
  loads: 0,
  load() { this.loads += 1; return Promise.resolve(this); },
});

const page = (lang, faces) => ({
  documentElement: {getAttribute: (name) => (name === 'lang' ? lang : null)},
  fonts: {forEach: (fn) => faces.forEach(fn)},
});

const interFaces = () => [
  face('Inter Variable', LATIN),
  face('"Inter Variable"', LATIN_EXT),
  face('Inter Variable', CYRILLIC),
  face('Inter Variable', CYRILLIC_EXT),
  face('Inter Variable', GREEK),
  face('Inter Fallback', ''),
  face('Material Symbols Rounded', ''),
];

test('unicode ranges: single points, spans and wildcards', () => {
  assert.equal(unicodeRangeCovers(LATIN, 0x61), true);
  assert.equal(unicodeRangeCovers(LATIN, 0x430), false);
  assert.equal(unicodeRangeCovers(CYRILLIC, 0x430), true);
  assert.equal(unicodeRangeCovers(CYRILLIC_EXT, 0x430), false);
  assert.equal(unicodeRangeCovers('U+04??', 0x430), true);
  assert.equal(unicodeRangeCovers('', 0x61), true, 'a face without a range covers everything');
});

test('Cyrillic is asked for only where the page language is written in it', () => {
  assert.deepEqual(textFontProbes('en'), [0x61]);
  assert.deepEqual(textFontProbes(''), [0x61]);
  assert.deepEqual(textFontProbes('ru'), [0x61, 0x430]);
  assert.deepEqual(textFontProbes('ru-RU'), [0x61, 0x430]);
  assert.deepEqual(textFontProbes('uk'), [0x61, 0x430]);
  assert.deepEqual(textFontProbes('rus'), [0x61], 'a three-letter code is not taken for ru');
});

test('a Russian page starts the Latin and Cyrillic Inter faces and nothing else', () => {
  const faces = interFaces();
  const started = startTextFonts(page('ru', faces), {});
  assert.deepEqual(started.map((f) => f.unicodeRange), [LATIN, CYRILLIC]);
  assert.deepEqual(faces.map((f) => f.loads), [1, 0, 1, 0, 0, 0, 0]);
});

test('an English page starts the Latin face only', () => {
  const faces = interFaces();
  assert.deepEqual(startTextFonts(page('en', faces), {}).map((f) => f.unicodeRange), [LATIN]);
});

test('a face already loading or loaded is left alone', () => {
  const faces = [face('Inter Variable', LATIN, 'loaded'), face('Inter Variable', CYRILLIC, 'loading')];
  assert.deepEqual(startTextFonts(page('ru', faces), {}), []);
  assert.deepEqual(faces.map((f) => f.loads), [0, 0]);
});

test('SF_BOOT_CONFIG.fonts.early = false turns it off; no document.fonts is a no-op', () => {
  const faces = interFaces();
  assert.deepEqual(startTextFonts(page('ru', faces), {fonts: {early: false}}), []);
  assert.equal(faces.every((f) => f.loads === 0), true);
  assert.deepEqual(startTextFonts({documentElement: null}, {}), []);
  assert.deepEqual(startTextFonts(null, {}), []);
});

test('a face whose load throws or rejects leaves the page as it was', async () => {
  const throwing = {...face('Inter Variable', LATIN), load() { throw new Error('blocked'); }};
  const rejecting = {...face('Inter Variable', CYRILLIC), load() { return Promise.reject(new Error('404')); }};
  assert.equal(startTextFonts(page('ru', [throwing, rejecting]), {}).length, 2);
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test('core.js starts the text faces from its first module after the public path', () => {
  const index = readFileSync(new URL('../src/core/js/index.js', import.meta.url), 'utf8');
  const imports = [...index.matchAll(/^import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(imports.slice(0, 2), ['./public-path', './text-fonts.js']);
});

// The fallback faces: one per weight band and script, with the line box of
// Inter (ascent 1984/2048, descent 494/2048, no gap) once size-adjust scales it.
test('every Inter Fallback face keeps Inter\'s line box under its own size-adjust', () => {
  const scss = readFileSync(new URL('../src/core/scss/_sf_css__fonts.scss', import.meta.url), 'utf8');
  const faces = [...scss.matchAll(/@font-face\s*\{([^}]*"Inter Fallback"[^}]*)\}/g)].map((m) => m[1]);
  assert.equal(faces.length, 8);
  const bands = new Set();
  for (const body of faces) {
    const value = (name) => Number(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(body)?.[1]);
    const size = value('size-adjust') / 100;
    assert.ok(Math.abs(value('ascent-override') / 100 * size - 1984 / 2048) < 1e-5, body);
    assert.ok(Math.abs(value('descent-override') / 100 * size - 494 / 2048) < 1e-5, body);
    assert.equal(value('line-gap-override'), 0);
    const weight = /font-weight:\s*([\d ]+);/.exec(body)[1].trim();
    const bold = /local\("Arial Bold"\)/.test(body);
    assert.equal(bold, Number(weight.split(' ')[0]) >= 550, `${weight} takes Arial${bold ? ' Bold' : ''}`);
    bands.add(`${weight}|${/unicode-range/.test(body) ? 'cyrillic' : 'latin'}`);
  }
  assert.equal(bands.size, 8);
});
