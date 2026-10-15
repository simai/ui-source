import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// The final shape before the code (rules of the road, rule 5): the shapes a
// manifest may name are the ones core draws, and core draws each of them.
const root = resolve(import.meta.dirname, '..');
const schema = JSON.parse(readFileSync(join(root, 'contracts/schema/smart-component-manifest.v2.schema.json'), 'utf8'));
const sheet = readFileSync(join(root, 'src/core/scss/_sf_css__placeholder.scss'), 'utf8');

test('the manifest names the shapes core draws, and core draws them all', () => {
  const shapes = schema.properties.presentation.properties.skeleton.properties.shape.enum.filter((shape) => shape !== 'none');
  for (const shape of shapes) {
    assert.match(sheet, new RegExp(`\\[data-sf-skeleton="${shape}"\\]\\):not\\(:defined\\)`, 'u'), `core draws «${shape}»`);
  }
  const drawn = [...sheet.matchAll(/\[data-sf-skeleton="([a-z]+)"\]/gu)].map(([, shape]) => shape);
  assert.deepEqual([...new Set(drawn)].sort(), [...shapes].sort());
  assert.match(readFileSync(join(root, 'src/core/scss/index.scss'), 'utf8'), /@use 'sf_css__placeholder';/u);
});

test('a placeholder is only for an element not defined yet, and calms down for reduced motion', () => {
  assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//gu, ''), /\[data-sf-skeleton[^\]]*\](?!\):not\(:defined\))/u);
  assert.match(sheet, /prefers-reduced-motion: reduce[\s\S]*animation: none/u);
  // The region skeleton too (DEV, 2026-10-16: it pulsed for reduced motion).
  assert.match(sheet, /prefers-reduced-motion: reduce\)\s*\{\s*\[data-sf-region-loading\]\s*\{\s*animation: none/u);
});

test('every Smart manifest that declares a skeleton names a known shape', () => {
  const shapes = new Set(schema.properties.presentation.properties.skeleton.properties.shape.enum);
  for (const name of readdirSync(join(root, 'src/smart'))) {
    const path = join(root, 'src/smart', name, 'smart.manifest.json');
    if (!existsSync(path)) continue;
    const skeleton = JSON.parse(readFileSync(path, 'utf8')).presentation?.skeleton;
    if (skeleton) assert.ok(shapes.has(skeleton.shape), `${name}: ${skeleton.shape}`);
  }
});
