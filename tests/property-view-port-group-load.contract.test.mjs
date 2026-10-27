import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.property-view-port 1.15.0 (standard simai.smart-component 1.3.8 §4.9,
// items 25 and 35): `group.load` reads one group of a record behind the
// capability `group-load`. The revision it answers is the whole record's, and
// group.save compares against it (Larena, msg-f6019c76). A host without the
// capability is not broken: the adapter asks record.load once per revision and
// serves every group from it. Every addition is optional, so a 1.14.0 host is a
// 1.15.0 host that does not announce group-load.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.property-view-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.15.0');
const before = port('1.14.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const groupOf = (document) => document.data.record.schema.properties.sections.items.properties.groups.items;

test('group-load is a capability that names group.load, and group.load answers the record, its group and its revision', () => {
  assert.deepEqual(now.capabilities['group-load'].intents, ['group.load']);
  const intent = now.intents['group.load'];
  assert.equal(intent.capability, 'group-load');
  assert.equal(intent.event, before.intents['record.load'].event);
  assert.equal(intent.carries_revision, false);
  assert.deepEqual(intent.answers, ['applied', 'refused', 'unavailable']);
  assert.deepEqual(intent.payload.required, ['record_id', 'collection', 'group', 'reason']);
  assert.equal(intent.payload.additionalProperties, false);
  assert.deepEqual(intent.payload.properties.group.type, ['string', 'null']);
  assert.deepEqual(intent.answer_data.required, ['record', 'group', 'revision']);
  assert.deepEqual(Object.keys(now.intents).slice(0, 2), ['record.load', 'group.load']);
});

test('a group not read yet carries its field count; the revision is the record\'s, and a conflict carries the current one', () => {
  assert.deepEqual(groupOf(now).required, groupOf(before).required);
  assert.deepEqual(groupOf(now).properties.field_count, {...groupOf(now).properties.field_count, type: 'integer', minimum: 0});
  assert.match(now.data.record.schema.properties.revision.description, /whole record's/u);
  const save = now.intents['group.save'];
  assert.deepEqual(save.payload.required, before.intents['group.save'].payload.required);
  assert.match(save.payload.properties.revision.description, /group\.load's/u);
  assert.deepEqual(save.answer_data.properties.revision.type, ['string', 'integer']);
  assert.ok(save.answers.includes('conflict'));
  for (const key of ['group', 'section']) assert.ok(now.answer.schema.properties[key], `the answer declares ${key}`);
});

test('1.15.0 only adds: every key 1.14.0 declared is still declared the same way', () => {
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
  assert.deepEqual(now.compatibility.recheck.slice(0, before.compatibility.recheck.length), before.compatibility.recheck);
  assert.ok(now.compatibility.recheck.length > before.compatibility.recheck.length);
});

test('the kit is 1.14.0\'s cases byte for byte, and six of 1.15.0', () => {
  const old = kit('1.14.0').cases;
  const cases = kit('1.15.0').cases;
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.15.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.14.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), [
    'group-load-applied-carries-the-group-and-the-revision',
    'group-load-revision-is-the-records',
    'group-load-without-a-group-answers-the-first',
    'group-load-unknown-group-is-refused',
    'group-load-without-the-capability',
    'group-save-after-group-load-stale-is-a-conflict',
  ]);
});

test('every group case raises a payload its intent declares, and expects an answer the intent may give', () => {
  const declared = (intent, payload, where) => {
    const schema = now.intents[intent].payload;
    for (const key of schema.required) assert.ok(key in payload, `${where}: ${intent} carries ${key}`);
    for (const key of Object.keys(payload)) assert.ok(key in schema.properties, `${where}: ${intent} declares ${key}`);
  };
  for (const id of kit('1.15.0').cases.filter((name) => name.includes('group-load'))) {
    const one = kase('1.15.0', id);
    assert.equal(one.id, id);
    declared(one.when.intent, one.when.payload, id);
    if (one.when.after) declared(one.when.after.intent, one.when.after.payload, `${id} (after)`);
    assert.ok(now.intents[one.intent].answers.includes(one.then.answer), `${id}: ${one.then.answer}`);
  }
});

// The adapter of §4.9, as a model: a section asks for its group; with
// group-load the host is asked for that group, without it record.load is asked
// once per revision and every group is served from the one answer.
const SECTIONS = [
  {key: 'main', groups: [{key: 'about', fields: [{key: 'title', propertyType: 'string', value: 'A'}]}]},
  {key: 'contacts', groups: [{key: 'phones', fields: [{key: 'phone', propertyType: 'string', value: '1'}, {key: 'fax', propertyType: 'string', value: '2'}]}]},
];
// The whole record, or (with `only`) one group's fields and every other group counted.
const record = (revision, only) => ({
  record_id: 'record-1', collection: 'pages', revision,
  sections: SECTIONS.map((section) => ({...section, groups: section.groups.map((group) => (only && group.key !== only
    ? {key: group.key, fields: [], field_count: group.fields.length}
    : group))})),
});

const host = (capabilities) => {
  const asked = [];
  let revision = '7';
  return {
    capabilities, asked,
    move() { revision = String(Number(revision) + 1); },
    raise(intent, payload) {
      asked.push(intent);
      if (intent === 'record.load') return {answer: 'applied', record: record(revision)};
      if (intent === 'group.load') {
        if (!capabilities.includes('group-load')) return {answer: 'unavailable', reason: 'no-capability'};
        const group = payload.group ?? 'about';
        if (!['about', 'phones'].includes(group)) return {answer: 'refused', reason: 'unknown-group'};
        return {answer: 'applied', record: record(revision, group), group, revision};
      }
      if (intent === 'group.save') {
        if (payload.revision !== revision) return {answer: 'conflict', reason: 'revision', revision};
        this.move();
        return {answer: 'applied', record: record(revision), revision};
      }
      return {answer: 'unavailable', reason: 'unknown-intent'};
    },
  };
};

const adapter = (to) => {
  let whole = null;
  let held = null;
  return {
    get revision() { return held; },
    group(group) {
      let answer;
      if (to.capabilities.includes('group-load')) {
        answer = to.raise('group.load', {record_id: 'record-1', collection: 'pages', group, reason: 'started'});
      } else {
        whole ??= to.raise('record.load', {record_id: 'record-1', collection: 'pages', reason: 'started'});
        answer = whole;
      }
      if (answer.answer !== 'applied') return answer;
      held = answer.record.revision;
      return answer.record.sections.flatMap((section) => section.groups).find((one) => one.key === group);
    },
    save(group, values) {
      const answer = to.raise('group.save', {record_id: 'record-1', collection: 'pages', section: 'main', group, values, revision: held});
      if (answer.revision !== undefined) held = answer.revision;
      // A new revision makes the next read; the groups served from the old one are read again.
      whole = null;
      return answer;
    },
  };
};

test('without group-load the adapter asks record.load once per revision and serves every group from it', () => {
  const to = host([]);
  const read = adapter(to);
  assert.equal(read.group('about').fields.length, 1);
  assert.equal(read.group('phones').fields.length, 2);
  assert.equal(read.group('about').fields.length, 1);
  assert.deepEqual(to.asked, ['record.load']);
  assert.equal(read.save('about', {title: 'B'}).answer, 'applied');
  read.group('phones');
  assert.deepEqual(to.asked, ['record.load', 'group.save', 'record.load']);
});

test('with group-load each group is read on its own, and every answer carries the record\'s one revision', () => {
  const to = host(['group-load']);
  const read = adapter(to);
  const about = to.raise('group.load', {record_id: 'record-1', collection: 'pages', group: 'about', reason: 'started'});
  const phones = to.raise('group.load', {record_id: 'record-1', collection: 'pages', group: 'phones', reason: 'started'});
  assert.equal(about.revision, phones.revision);
  assert.equal(about.revision, to.raise('record.load', {record_id: 'record-1', collection: 'pages', reason: 'requested'}).record.revision);
  const other = about.record.sections[1].groups[0];
  assert.deepEqual([other.fields.length, other.field_count], [0, 2]);
  assert.equal(to.raise('group.load', {record_id: 'record-1', collection: 'pages', group: null, reason: 'connected'}).group, 'about');
  assert.equal(to.raise('group.load', {record_id: 'record-1', collection: 'pages', group: 'gone', reason: 'requested'}).answer, 'refused');
  assert.equal(read.group('phones').fields.length, 2);
});

test('a group save against a revision another group\'s save moved is a conflict that carries the current revision', () => {
  const to = host(['group-load']);
  const one = adapter(to);
  const two = adapter(to);
  one.group('about');
  two.group('phones');
  assert.equal(two.save('phones', {phone: '3'}).answer, 'applied');
  const lost = one.save('about', {title: 'C'});
  assert.equal(lost.answer, 'conflict');
  assert.equal(lost.revision, two.revision);
  assert.equal(one.revision, lost.revision);
});
