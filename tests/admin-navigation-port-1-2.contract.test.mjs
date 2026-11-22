import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.admin-navigation-port 1.2.0 (owner decisions C420-C421, 2026-11-22;
// the admin set's sf-admin-notifications and sf-admin-activity): a
// notification may say its object, level and resolved, and the optional
// capability activity asks for the background runs and passes a person's
// retry and cancel of one run. Additive: a 1.1.0 host is a 1.2.0 host whose
// notifications say none of the new fields and that offers no activity.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.admin-navigation-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.2.0');
const before = port('1.1.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const notification = (document) => document.data.notifications_page.schema.properties.groups.items.properties.items.items;

// The subset of JSON Schema the port uses: type, enum, required,
// additionalProperties false, properties, items.
const typeOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array'
  : Number.isInteger(value) ? 'integer' : typeof value);
const validate = (schema, value, path = '$') => {
  const problems = [];
  const types = [schema.type ?? []].flat();
  const actual = typeOf(value);
  if (types.length && !types.includes(actual) && !(actual === 'integer' && types.includes('number'))) {
    return [`${path}: ${actual} is not ${types.join('|')}`];
  }
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${path}: ${JSON.stringify(value)} is not in the enum`);
  if (actual === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) problems.push(`${path}: ${key} is required`);
    for (const [key, entry] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (!property) {
        if (schema.additionalProperties === false) problems.push(`${path}.${key} is not declared`);
        continue;
      }
      problems.push(...validate(property, entry, `${path}.${key}`));
    }
  }
  if (actual === 'array' && schema.items) value.forEach((entry, index) => problems.push(...validate(schema.items, entry, `${path}[${index}]`)));
  return problems;
};

test('a notification may say its object, level and resolved, and none of them is required', () => {
  const item = notification(now);
  assert.deepEqual(item.required, notification(before).required);
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.properties.object.type, ['string', 'null']);
  assert.deepEqual(item.properties.level.enum, ['error', 'warning', 'info', 'success', null]);
  assert.deepEqual(item.properties.resolved.type, ['boolean', 'string', 'null'], 'true, or in words');
  for (const key of ['object', 'level', 'resolved']) assert.match(item.properties[key].description, /^Since 1\.2\.0\./u);
  const page = kase('1.2.0', 'a-notification-says-its-object-level-and-resolved').given.notifications;
  assert.deepEqual(validate(now.data.notifications_page.schema, page), []);
  assert.notDeepEqual(validate(before.data.notifications_page.schema, page), [], '1.1.0 did not declare them');
  assert.notDeepEqual(validate(item, {key: 'a', title: 'A', when: '10:00', unread: true, level: 'red'}), [], 'a level outside the four');
});

test('activity is an optional capability with three intents and its own page of runs', () => {
  assert.deepEqual(now.capabilities.activity.intents, ['activity.load', 'activity.retry', 'activity.cancel']);
  assert.deepEqual(now.capabilities.activity.data, ['activity_page']);
  for (const name of now.capabilities.activity.intents) {
    const intent = now.intents[name];
    assert.equal(intent.capability, 'activity', name);
    assert.equal(intent.carries_revision, false, name);
    assert.deepEqual(intent.answers, ['applied', 'refused', 'unavailable'], name);
    assert.equal(intent.payload.additionalProperties, false, name);
  }
  assert.deepEqual(now.intents['activity.retry'].payload.required, ['id']);
  assert.deepEqual(now.intents['activity.cancel'].payload.required, ['id']);
  const page = now.data.activity_page;
  assert.equal(page.required, false);
  const run = page.schema.properties.runs.items;
  assert.deepEqual(run.required, ['id', 'label', 'state']);
  assert.deepEqual(run.properties.state.enum, ['running', 'failed', 'done', 'cancelled']);
  assert.deepEqual(validate(page.schema, {runs: kase('1.2.0', 'activity-arrives-as-runs').given.runs}), []);
  assert.notDeepEqual(validate(page.schema, {runs: [{id: 'r', label: 'R', state: 'stuck'}]}), []);
  assert.notDeepEqual(validate(page.schema, {runs: [{id: 'r', label: 'R', state: 'done', extra: 1}]}), [], 'closed');
});

test('1.2.0 only adds: every key 1.1.0 declared is still declared the same way', () => {
  const same = (a, b, path) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      for (const key of Object.keys(a)) {
        if (['summary', 'description'].includes(key)) continue;
        assert.ok(b && key in b, `${path}.${key} is kept`);
        if (key === 'recheck' || key === 'cases') continue;
        same(a[key], b[key], `${path}.${key}`);
      }
      return;
    }
    if (path.endsWith('.version') || path.startsWith('$.conformance')) return;
    assert.deepEqual(b, a, path);
  };
  same(before, now, '$');
  assert.deepEqual(Object.keys(now.intents).filter((name) => !name.startsWith('activity.')), Object.keys(before.intents));
  assert.deepEqual(Object.keys(now.capabilities).filter((name) => name !== 'activity'), Object.keys(before.capabilities));
  assert.deepEqual(now.compatibility.recheck.slice(0, before.compatibility.recheck.length), before.compatibility.recheck);
  assert.ok(now.compatibility.recheck.length > before.compatibility.recheck.length);
  assert.ok(now.summary.startsWith(before.summary));
  assert.match(now.summary, /1\.2\.0 adds/u);
});

test('the kit is 1.1.0\'s cases byte for byte, and five of 1.2.0 that a 1.1.0 host passes', () => {
  const old = kit('1.1.0').cases;
  const cases = kit('1.2.0').cases;
  assert.equal(kit('1.2.0').version, '1.2.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.2.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.1.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  const added = cases.slice(old.length);
  assert.deepEqual(added, ['a-notification-says-its-object-level-and-resolved', 'activity-arrives-as-runs',
    'retrying-a-run-is-the-hosts', 'cancelling-a-run-is-the-hosts', 'activity-without-the-capability']);
  assert.equal(now.conformance.cases, cases.length);
  // A 1.1.0 host offers no activity: the only activity case it must answer is
  // the one without the capability, and it answers unavailable.
  const without = kase('1.2.0', 'activity-without-the-capability');
  assert.ok(!without.given.capabilities.includes('activity'));
  assert.equal(without.then.answer, 'unavailable');
  for (const id of added) {
    const one = kase('1.2.0', id);
    assert.equal(one.id, id);
    assert.ok(now.intents[one.when.intent], `${id}: a declared intent`);
    assert.deepEqual(validate(now.intents[one.when.intent].payload, one.when.payload), [], `${id}: the payload is declared`);
  }
  // The notifications case asks only what 1.1.0 asked of a page.
  assert.deepEqual(kase('1.2.0', 'a-notification-says-its-object-level-and-resolved').then.answer_must_include,
    kase('1.1.0', 'notifications-arrive-grouped-by-time').then.answer_must_include);
});
