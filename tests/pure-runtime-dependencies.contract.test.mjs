import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {decodeCacheValue, encodeCacheValue} from '../src/core/js/cacheCodec.js';
import {stableHash} from '../src/core/js/stableHash.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(target);
  }
  return files;
}

test('ordinary runtime has no third-party JavaScript imports', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  // Lit renders Smart components; Floating UI computes anchored geometry.
  assert.deepEqual(manifest.dependencies, {'@floating-ui/dom': '1.8.0', lit: '3.3.3'});
  const files = await sourceFiles(path.join(root, 'src'));
  const floating = [];
  const forbidden = /(?:from\s+|require\()['"](?:axios|blueimp-md5|clipboard|flag-icons|google-libphonenumber|highlight\.js|highlightjs-line-numbers\.js|i18n-iso-countries|imask|lodash|lz-string|nouislider|prettier|swiper)/;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, forbidden, path.relative(root, file));
    if (/from\s+['"]@floating-ui\//.test(source)) floating.push(path.relative(root, file));
  }
  // Floating UI is imported only by the shared helper module.
  assert.deepEqual(floating, ['src/core/js/position.js']);
});

test('project-owned cache codec round-trips Unicode and rejects old opaque values safely', () => {
  const value = JSON.stringify({language: 'Русский', count: 5});
  assert.equal(decodeCacheValue(encodeCacheValue(value)), value);
  assert.equal(decodeCacheValue('legacy-compressed-value'), 'null');
});

test('stable hash is deterministic and separates neighboring values', () => {
  assert.equal(stableHash('SIMAI'), stableHash('SIMAI'));
  assert.notEqual(stableHash('SIMAI'), stableHash('SIMAI Framework'));
  assert.match(stableHash('SIMAI'), /^[0-9a-f]{16}$/);
});
