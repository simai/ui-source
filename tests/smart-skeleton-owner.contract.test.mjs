import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {URL} from 'node:url';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('ordinary and Smart Skeleton expose decorative bounded geometry', async () => {
  const [ordinary, smart, template] = await Promise.all([
    read('src/component/skeleton/js/_skeleton.js'),
    read('src/smart/skeleton/index.js'),
    read('src/smart/skeleton/js/templates/default.js'),
  ]);

  assert.match(ordinary, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(template, /aria-hidden="true"/);
  assert.match(template, /Math\.min\(20, Math\.max\(1, Math\.trunc\(countValue\)\)\)/);
  assert.match(ordinary, /Math\.min\(20, Math\.max\(1, Math\.trunc\(total\)\)\)/);
  assert.match(smart, /\^\(\?:aria-/);
  assert.doesNotMatch(template, /tabindex|@click/);
});

test('Skeleton uses Framework semantic tokens and reduced motion', async () => {
  const styles = await read('src/component/skeleton/scss/_skeleton.scss');

  assert.match(styles, /--sf-skeleton-base: var\(--sf-ui-skeleton\)/);
  assert.match(styles, /--sf-skeleton-highlight: var\(--sf-surface-container-active\)/);
  assert.match(styles, /--sf-skeleton-duration: calc\(var\(--sf-duration-slow\) \* 3\)/);
  assert.match(styles, /border-radius: var\(--sf-radius--ui\)/);
  assert.match(styles, /\.sf-skeleton-rounded[\s\S]*var\(--sf-radius--ui\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /1\.6s|#e0e0e0|rgba\(/);
});

test('Skeleton public variants are normalized instead of becoming arbitrary classes', async () => {
  const [ordinary, template, manifest] = await Promise.all([
    read('src/component/skeleton/js/_skeleton.js'),
    read('src/smart/skeleton/js/templates/default.js'),
    read('src/smart/skeleton/smart.manifest.json').then(JSON.parse),
  ]);

  assert.match(ordinary, /\['pulse', 'wave', 'none'\]/);
  assert.match(template, /\['text', 'circle', 'square', 'rounded'\]/);
  assert.deepEqual(manifest.inputs.properties.animation.enum, ['pulse', 'wave', 'none']);
  assert.deepEqual(manifest.inputs.properties.variant.enum, ['text', 'circle', 'square', 'rounded']);
  assert.deepEqual(manifest.composition.uses, ['component.skeleton']);
});

test('Skeleton size projection accepts Framework tokens and relative widths only', async () => {
  const [ordinary, template, fixture] = await Promise.all([
    read('src/component/skeleton/js/_skeleton.js'),
    read('src/smart/skeleton/js/templates/default.js'),
    read('src/smart/skeleton/studio.fixture.json').then(JSON.parse),
  ]);

  for (const source of [ordinary, template]) {
    assert.match(source, /\^var\\\(--sf-/);
    assert.match(source, /\(\?:100\|\[0-9\]\{1,2\}/);
    assert.match(source, /return ''/);
  }
  assert.equal(fixture.props.height, 'b4');
});
