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
