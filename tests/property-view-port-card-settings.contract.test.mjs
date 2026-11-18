import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.property-view-port 1.19.0: the record card settings of owner decision
// C311 on the levels of C298 -- own edits saved at once in the personal layer,
// «Сохранить для всех» (view.publish), «Вернуть как у всех» (view.reset
// personal), «Сохранить как моё» (view.create shared false), a lock per
// setting (view.lock), a required profile, and the head (subtitle, stage).
// Every new key of record.view is optional: a 1.18.0 host is a 1.19.0 host
// that sends none of them.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.property-view-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.19.0');
const before = port('1.18.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const view = (document) => document.data.record.schema.properties.view;

test('1.19.0 adds required, locked and head to record.view, none of them required', () => {
  assert.equal(now.version, '1.19.0');
  const props = view(now).properties;
  assert.equal(props.profiles.items.properties.required.type, 'boolean');
  assert.deepEqual(props.locked.items, {type: 'string', minLength: 1});
  assert.equal(props.head.properties.subtitle.maxItems, 2);
  assert.deepEqual(props.head.properties.status.type, ['string', 'null']);
  for (const kind of ['personal', 'shared']) assert.ok(props.layers.properties[kind].properties.view.properties.head, `${kind} layer may hold head`);
  assert.ok(now.intents['view.save'].payload.properties.view.properties.head);
  assert.ok(!(view(now).required ?? []).some((key) => ['locked', 'head'].includes(key)));
  assert.deepEqual(props.profiles.items.required, view(before).properties.profiles.items.required);
});

test('view.publish and view.lock are new intents of view-settings; every 1.18.0 intent stays', () => {
  for (const intent of Object.keys(before.intents)) assert.ok(now.intents[intent], `${intent} kept`);
  assert.deepEqual(Object.keys(now.intents).filter((intent) => !before.intents[intent]).sort(), ['view.lock', 'view.publish']);
  assert.ok(now.capabilities['view-settings'].intents.includes('view.publish'));
  assert.ok(now.capabilities['view-settings'].intents.includes('view.lock'));
  assert.deepEqual(now.intents['view.publish'].payload.required, ['collection', 'personal_revision', 'shared_revision']);
  assert.deepEqual(now.intents['view.publish'].answers, ['applied', 'conflict', 'refused', 'unavailable']);
  assert.deepEqual(now.intents['view.lock'].payload.required, ['collection', 'path', 'locked', 'revision']);
  // A 1.18.0 component's shared save is still read: the enum is unchanged.
  assert.deepEqual(now.intents['view.save'].payload.properties.target.properties.kind.enum, ['personal', 'shared']);
});

test('what is read until 2027-01-01 is named', () => {
  const deprecated = now.compatibility.deprecated;
  assert.equal(deprecated['fields.<key>.variant in a view layer'].read_until, '2027-01-01');
  assert.equal(deprecated['view.save target.kind shared'].read_until, '2027-01-01');
});

test('the kit is 1.18.0\'s cases byte for byte, and four of 1.19.0', () => {
  const old = kit('1.18.0').cases;
  const cases = kit('1.19.0').cases;
  assert.equal(kit('1.19.0').version, '1.19.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.19.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.18.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), [
    'view-publish-merges-personal-into-shared',
    'view-publish-against-a-newer-shared-layer-is-a-conflict',
    'view-lock-answers-the-locked-paths',
    'view-save-from-a-1-19-component-is-personal',
  ]);
});
