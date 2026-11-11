import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, stat} from 'node:fs/promises';

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
  // The metric fallback has regular and bold faces: one face at 400 drew
  // bold Latin at 400 on a cold visit (2026-10-19). Since font.inter 1.1.0 a
  // face per weight band (and per band for Cyrillic), each sized to Inter
  // (the line-box test below).
  for (const band of ['100 449', '450 549']) {
    assert.match(faces, new RegExp(`font-family: "Inter Fallback";\\s*font-weight: ${band};\\s*src: local\\("Arial"\\)`), band);
  }
  for (const band of ['550 649', '650 1000']) {
    assert.match(faces, new RegExp(`font-family: "Inter Fallback";\\s*font-weight: ${band};\\s*src: local\\("Arial Bold"\\)`), band);
  }
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

// The fallback faces: one per weight band and script, with the line box of
// Inter (ascent 1984/2048 plus 0.12 %, descent 494/2048, no gap) once size-adjust
// scales it.
test('every Inter Fallback face keeps Inter\'s line box under its own size-adjust', () => {
  const scss = readFileSync(new URL('../src/core/scss/_sf_css__fonts.scss', import.meta.url), 'utf8');
  const faces = [...scss.matchAll(/@font-face\s*\{([^}]*"Inter Fallback"[^}]*)\}/g)].map((m) => m[1]);
  assert.equal(faces.length, 8);
  const bands = new Set();
  for (const body of faces) {
    const value = (name) => Number(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(body)?.[1]);
    const size = value('size-adjust') / 100;
    // 0.12 % above Inter's ascent: an exact quotient rounds 15.5 px down (16 px text).
    const ascent = value('ascent-override') / 100 * size / (1984 / 2048);
    assert.ok(ascent > 1.0008 && ascent < 1.0016, `${body}: ascent ${ascent}`);
    assert.ok(Math.abs(value('descent-override') / 100 * size - 494 / 2048) < 1e-5, body);
    assert.equal(value('line-gap-override'), 0);
    const weight = /font-weight:\s*([\d ]+);/.exec(body)[1].trim();
    const bold = /local\("Arial Bold"\)/.test(body);
    assert.equal(bold, Number(weight.split(' ')[0]) >= 550, `${weight} takes Arial${bold ? ' Bold' : ''}`);
    bands.add(`${weight}|${/unicode-range/.test(body) ? 'cyrillic' : 'latin'}`);
  }
  assert.equal(bands.size, 8);
});
