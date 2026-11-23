// Every Smart manifest names its release by the release pair marker, not by a
// stale commit (group build 18, queue msg-937644d4; ui-control
// control/research/2026-11-23-docara-markdown-admission, finding 1). Before:
// all 87 manifests of every release carried
// compatibility.runtime_pair.ui_revision 094f3d549aa7 (a commit of
// 2026-10-11), carried over by the generator from the committed manifest, so
// a consumer such as Docara could not read the release from it. A source file
// cannot name the release commit that will hold it; the marker (forty zeros,
// manifest schema 2.6.0) names "the release that carries this manifest", whose
// identity is that release's lock and whose inventory lists the component at
// the manifest's own version.

import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {RELEASE_PAIR} from '../scripts/generate-component-files.mjs';

const root = new URL('../', import.meta.url);
const json = (relative) => JSON.parse(readFileSync(new URL(relative, root), 'utf8'));
const ZERO = '0'.repeat(40);

const manifests = () => readdirSync(new URL('src/smart/', root), {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`src/smart/${entry.name}/smart.manifest.json`, root)))
  .map((entry) => ({name: entry.name, manifest: json(`src/smart/${entry.name}/smart.manifest.json`)}));

test('the generator writes the release pair marker', () => {
  assert.deepEqual({...RELEASE_PAIR}, {ui_revision: ZERO, ui_smart_revision: ZERO});
});

test('every Smart manifest names its release by the marker and carries its own version', () => {
  const all = manifests();
  assert.ok(all.length >= 87, `only ${all.length} manifests`);
  for (const {name, manifest} of all) {
    assert.deepEqual(manifest.compatibility.runtime_pair, {ui_revision: ZERO, ui_smart_revision: ZERO}, `${name}: runtime_pair`);
    assert.match(manifest.version, /^[0-9]+\.[0-9]+\.[0-9]+$/u, `${name}: version`);
  }
});

test('the committed registry carries the marker too, and the schema defines it', () => {
  const registry = json('contracts/generated/smart-component-contract-registry.json');
  assert.ok(registry.entries.length >= 87);
  for (const entry of registry.entries) assert.deepEqual(entry.runtime_pair, {ui_revision: ZERO, ui_smart_revision: ZERO}, entry.id);
  const schema = json('contracts/schema/smart-component-manifest.v2.schema.json');
  assert.equal(schema['x-simai-version'], '2.6.0');
  const field = schema.properties.compatibility.properties.runtime_pair;
  assert.match(field.description, /release pair marker/u);
  assert.match(ZERO, new RegExp(field.properties.ui_revision.pattern, 'u'), 'the marker passes the field pattern');
});
