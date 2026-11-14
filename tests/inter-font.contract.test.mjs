import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, stat} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';

const SRC = new URL('../src/', import.meta.url);
const SCRIPTS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'];

/* The family tokens named Inter for a year while nothing shipped it: a page got
   Inter only where the reader had it installed, and everyone else saw their
   system font. The font is part of Core now, and these checks keep the name
   and the files together. */
test('inter: every script file the faces name is in the source', async () => {
  const faces = await readFile(new URL('core/scss/_sf_css__fonts.scss', SRC), 'utf8');
  for (const script of SCRIPTS) {
    const file = `inter-${script}-wght-normal.woff2`;
    assert.match(faces, new RegExp(`url\\("\\.\\./fonts/inter/${file}"\\)`), `${file} is declared`);
    const {size} = await stat(new URL(`core/fonts/inter/${file}`, SRC));
    assert.ok(size > 1000, `${file} is a font, not a placeholder`);
  }
  assert.equal((faces.match(/font-family: "Inter Variable"/g) || []).length, SCRIPTS.length);
  assert.match(faces, /font-display: optional/);
  // The metric fallback has a regular and a bold face: one face at 400 drew
  // bold Latin at 400 on a cold visit (2026-10-19).
  assert.match(faces, /font-family: "Inter Fallback";\s*font-weight: 100 549;\s*src: local\("Arial"\)/);
  assert.match(faces, /font-family: "Inter Fallback";\s*font-weight: 550 1000;\s*src: local\("Arial Bold"\)/);
});

test('inter: the family tokens lead with the shipped face and its metric fallback', async () => {
  for (const file of ['core/scss/_sf_css__typograpy.scss', 'core/figma_variables/figma_typography_styles.scss']) {
    const source = await readFile(new URL(file, SRC), 'utf8');
    for (const role of ['text', 'heading', 'display']) {
      assert.match(source, new RegExp(`--sf-${role}--family: "Inter Variable", "Inter Fallback",`), `${file}: ${role}`);
    }
  }
});

test('inter: the licence ships with the notices', async () => {
  const notices = JSON.parse(await readFile(new URL('core/contracts/third-party-notices.v1.json', SRC), 'utf8'));
  const inter = notices.entries.find((entry) => entry.name === 'Inter');
  assert.ok(inter, 'Inter has a notice entry');
  assert.equal(inter.spdx, 'OFL-1.1');
  assert.match(inter.license_text, /SIL OPEN FONT LICENSE Version 1\.1/);
  const ofl = await readFile(new URL('core/fonts/inter/OFL.txt', SRC), 'utf8');
  assert.equal(inter.license_text, ofl);
});

/* WOFF2 keeps GSUB untransformed in one brotli stream; read the stream and the
   table directory, nothing else. */
function woff2Table(bytes, wanted) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0), 0x774f4632, 'wOF2 signature');
  const count = view.getUint16(12);
  const compressedSize = view.getUint32(20);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i += 1) {
      const byte = bytes[at++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('bad UIntBase128');
  };
  const KNOWN = {10: 'glyf', 11: 'loca', 27: 'GPOS', 28: 'GSUB'};
  const tables = [];
  for (let i = 0; i < count; i += 1) {
    const flags = bytes[at++];
    let tag = KNOWN[flags & 0x3f] || `#${flags & 0x3f}`;
    if ((flags & 0x3f) === 0x3f) { tag = String.fromCharCode(...bytes.subarray(at, at + 4)); at += 4; }
    const version = flags >> 6;
    let length = base128();
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    if (transformed) length = base128();
    tables.push({tag, length});
  }
  const stream = brotliDecompressSync(bytes.subarray(at, at + compressedSize));
  let offset = 0;
  for (const table of tables) {
    if (table.tag === wanted) return stream.subarray(offset, offset + table.length);
    offset += table.length;
  }
  return null;
}

function gsubFeatures(gsub) {
  const view = new DataView(gsub.buffer, gsub.byteOffset, gsub.byteLength);
  const list = view.getUint16(6);
  const features = new Map();
  for (let i = 0; i < view.getUint16(list); i += 1) {
    const record = list + 2 + i * 6;
    const tag = String.fromCharCode(...gsub.subarray(record, record + 4));
    const lookups = view.getUint16(list + view.getUint16(record + 4) + 2);
    features.set(tag, (features.get(tag) || 0) + lookups);
  }
  return features;
}

/* Tables right-align numbers with tabular digits (C146 (3)) and the tile value
   sets them too: every shipped subset has to keep the tnum feature, or a re-cut
   of the files silently turns tabular-nums into a no-op. */
test('inter: every script file keeps the tnum feature for tabular digits', async () => {
  for (const script of SCRIPTS) {
    const file = `inter-${script}-wght-normal.woff2`;
    const gsub = woff2Table(await readFile(new URL(`core/fonts/inter/${file}`, SRC)), 'GSUB');
    assert.ok(gsub, `${file} has GSUB`);
    const features = gsubFeatures(gsub);
    assert.ok(features.get('tnum') > 0, `${file} keeps tnum (has ${[...features.keys()].join(' ')})`);
    assert.ok(features.get('pnum') > 0, `${file} keeps pnum`);
  }
});
