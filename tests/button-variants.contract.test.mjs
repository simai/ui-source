import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const SRC = new URL('../src/component/', import.meta.url);
const SHEETS = [
  ['button', 'buttons/scss/_css__buttons.scss'],
  ['icon-button', 'icon-buttons/scss/_css_icon_buttons.scss'],
];
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Ghost was identical to link at rest and differed only by a hover tint of 8%
   instead of 16%: two names for one choice. It stays as a compatibility name,
   which only holds if ghost goes everywhere link goes and nowhere else. */
test('button variants: ghost is read exactly as link', async () => {
  for (const [name, file] of SHEETS) {
    const css = strip(await readFile(new URL(file, SRC), 'utf8'));
    const link = `.sf-${name}--link`;
    const ghost = `.sf-${name}--ghost`;
    const pair = `:is(${link}, ${ghost})`;
    const bareLink = css.split(pair).join('').split(link).length - 1;
    const bareGhost = css.split(pair).join('').split(ghost).length - 1;
    assert.equal(bareLink, 0, `${file}: every link selector also carries ghost`);
    assert.equal(bareGhost, 0, `${file}: ghost appears only beside link`);
    assert.ok(css.includes(pair), `${file}: the pair is there`);
  }
});

/* The soft accent was tonal secondary, and the secondary palette is close to
   neutral: next to tonal on-surface it read as the same grey. Tonal primary is
   the tinted one, on the primary container roles. */
test('button variants: tonal primary tints with the primary container roles', async () => {
  for (const [name, file] of SHEETS) {
    const css = strip(await readFile(new URL(file, SRC), 'utf8'));
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector]) => selector.includes(`.sf-${name}--tonal.sf-${name}--primary`))
      .map(([, , body]) => body);
    assert.ok(blocks.length >= 4, `${file}: rest, label/icon, hover and active rules`);
    for (const body of blocks) {
      assert.doesNotMatch(body, /secondary/, `${file}: tonal primary borrows no secondary role`);
    }
    assert.ok(blocks.some((body) => /var\(--sf-primary-container\)/.test(body)), `${file}: rest fill`);
    assert.ok(blocks.some((body) => /var\(--sf-primary-container-hover\)/.test(body)), `${file}: hover fill`);
    assert.ok(blocks.some((body) => /var\(--sf-primary-container-active\)/.test(body)), `${file}: active fill`);
    assert.ok(blocks.some((body) => /var\(--sf-on-primary-container\)/.test(body)), `${file}: ink`);
  }
});
