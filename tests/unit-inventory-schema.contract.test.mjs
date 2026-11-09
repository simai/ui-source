import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

import {collectUnits, inventoryOf, readCommittedTree} from '../scripts/linkage.mjs';
import {validateWithSchema} from '../scripts/manifest-schema.mjs';

// An inventory is checked against the schema a consumer pins, not only for the
// keys it requires: the pinned unit-inventory 1.0.0 closes every object, and a
// ui-pro package inventory once shipped three things it forbids
// (framework_release, a dependency's `former`, a range '*') while every key
// check here passed. ui-control tools/release/package-inventory.test.mjs runs
// the package tool's output through the same validator and schema.
const root = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const pinned = json('contracts/standards/pinned/unit-inventory-1.0.0.schema.json');
const live = json('src/core/contracts/unit-inventory.v1.schema.json');
const said = (schema, value) => validateWithSchema(schema, value).map(({path, message}) => `${path} ${message}`);

test('the live inventory schema is the pinned one, its descriptions aside', () => {
  const strip = (value) => JSON.parse(JSON.stringify(value, (key, item) => (key === 'description' ? undefined : item)));
  assert.deepEqual(strip(live), strip(pinned));
});

test('the inventory of the committed tree validates against the pinned schema', () => {
  const head = readCommittedTree(root, 'HEAD');
  const collected = collectUnits(head.tree);
  for (const files of [false, true]) {
    assert.deepEqual(said(pinned, inventoryOf(collected, {revision: head.revision, release: 'ui-0123456789ab', files})), []);
  }
});

test('the linkage fixtures validate against the pinned schema', () => {
  for (const name of ['previous', 'bumped', 'unbumped', 'went-back']) {
    assert.deepEqual(said(pinned, json(`tests/fixtures/linkage/${name}.inventory.json`)), [], name);
  }
});

test('the pinned schema refuses what the package tool used to write', () => {
  const unit = {id: 'smart.alpha', kind: 'smart', version: '1.0.0', content_sha256: 'a'.repeat(64), files: 2, dependencies: []};
  const base = {schema: 'simai.framework.unit-inventory', schema_version: 1, source: 'simai/ui-pro', revision: 'b'.repeat(40), release: 'pro-0123456789ab', units: [unit]};
  assert.deepEqual(said(pinned, base), []);
  assert.deepEqual(said(pinned, {...base, framework_release: 'ui-0123456789ab'}), ['/framework_release is not a declared property']);
  const withDependency = (dependency) => ({...base, units: [{...unit, dependencies: [dependency]}]});
  assert.deepEqual(said(pinned, withDependency({id: 'smart.beta', range: '^1.0.0', former: 'smart.old-beta'})), ['/units/0/dependencies/0/former is not a declared property']);
  assert.equal(said(pinned, withDependency({id: 'smart.ghost', range: '*'})).length, 1);
  assert.deepEqual(said(pinned, {...base, units: [{...unit, files: -1}]}), ['/units/0/files must be at least 0']);
});
