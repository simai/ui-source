import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {validateWithSchema} from '../scripts/manifest-schema.mjs';

// Every Smart manifest is valid against the manifest schema itself. sf-contract
// used to check a hand-picked subset of it, and 21 manifests that passed broke
// ui-studio, which validates with the schema (2026-10-12).

const root = new URL('..', import.meta.url).pathname;
const schema = JSON.parse(readFileSync(join(root, 'contracts/schema/smart-component-manifest.v2.schema.json'), 'utf8'));
const manifests = readdirSync(join(root, 'src/smart'))
  .map((folder) => join(root, 'src/smart', folder, 'smart.manifest.json'))
  .filter((path) => existsSync(path))
  .map((path) => ({path, manifest: JSON.parse(readFileSync(path, 'utf8'))}))
  .filter(({manifest}) => manifest.schema_version === 2);

test('every v2 Smart manifest is valid against the manifest schema', () => {
  assert.ok(manifests.length >= 40, `found only ${manifests.length} manifests`);
  const failures = manifests
    .map(({manifest}) => ({id: manifest.id, errors: validateWithSchema(schema, manifest)}))
    .filter(({errors}) => errors.length > 0)
    .map(({id, errors}) => `${id}: ${errors.slice(0, 5).map(({path, message}) => `${path || '/'} ${message}`).join('; ')}`);
  assert.deepEqual(failures, []);
});

test('an older event name points at the canonical event of its own manifest', () => {
  for (const {manifest} of manifests) {
    for (const [name, event] of Object.entries(manifest.events ?? {})) {
      if (event.alias_of === undefined) continue;
      assert.notEqual(event.canonical, true, `${manifest.id} ${name}: an alias is not canonical`);
      assert.equal(manifest.events[event.alias_of]?.canonical, true, `${manifest.id} ${name}: alias_of ${event.alias_of} is not a canonical event`);
    }
  }
});

test('the validator reports what the schema forbids', () => {
  const [{manifest}] = manifests;
  const broken = structuredClone(manifest);
  broken.unknown = true;
  broken.state.visual_states = ['default', 'starred'];
  delete broken.persistence.mode;
  const messages = validateWithSchema(schema, broken).map(({path, message}) => `${path} ${message}`);
  assert.ok(messages.includes('/unknown is not a declared property'), messages.join('\n'));
  assert.ok(messages.some((line) => line.startsWith('/state/visual_states/1 must be one of')), messages.join('\n'));
  assert.ok(messages.includes('/persistence must have mode'), messages.join('\n'));
});

test('the validator refuses a schema keyword it does not implement', () => {
  assert.throws(() => validateWithSchema({type: 'object', oneOf: []}, {}), /manifest_schema_keyword_unsupported:oneOf/);
});
