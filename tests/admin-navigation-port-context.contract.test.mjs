import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

// simai.admin-navigation-port 1.1.0 (owner, 2026-11-05, after the Larena Panel
// UX audit; sf-admin-menu 1.7.0): never more than two menus on screen, and the
// second is about where the person is. navigation.load carries the page's
// address as `page`; the answer may carry `context`, the menu of the object the
// page shows. Both optional: a 1.0.0 host is a 1.1.0 host with no object menus.
const root = resolve(import.meta.dirname, '..');
const at = (version) => join(root, `src/core/contracts/ports/simai.admin-navigation-port/${version}`);
const port = (version) => JSON.parse(readFileSync(join(at(version), 'port.json'), 'utf8'));
const now = port('1.1.0');
const before = port('1.0.0');
const kit = (version) => JSON.parse(readFileSync(join(at(version), 'kit/manifest.json'), 'utf8'));
const kase = (version, id) => JSON.parse(readFileSync(join(at(version), `kit/cases/${id}.json`), 'utf8'));
const navigation = (document) => document.data.navigation.schema;
const loadPayload = (document) => document.intents['navigation.load'].payload;

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

test('navigation.load carries `page`, a path and query or null, and nothing more is required', () => {
  const page = loadPayload(now).properties.page;
  assert.deepEqual(page.type, ['string', 'null']);
  assert.match(page.description, /^Since 1\.1\.0\./u);
  assert.deepEqual(loadPayload(now).required, loadPayload(before).required);
  assert.equal(loadPayload(now).additionalProperties, false);
});

test('the answer may carry `context` in the shape sf-admin-menu 1.7.0 draws', () => {
  const context = navigation(now).properties.context;
  assert.deepEqual(navigation(now).required, navigation(before).required, 'context is not required');
  assert.deepEqual(context.type, ['object', 'null']);
  assert.deepEqual(Object.keys(context.properties), ['title', 'subtitle', 'status', 'back', 'groups', 'current']);
  assert.deepEqual(context.required, ['title', 'groups']);
  assert.deepEqual(context.properties.status.type, ['string', 'object', 'null'], 'a string, or {text, status}');
  assert.deepEqual(Object.keys(context.properties.status.properties), ['text', 'status']);
  assert.deepEqual(Object.keys(context.properties.back.properties), ['label', 'href']);
  const group = context.properties.groups.items;
  assert.deepEqual(Object.keys(group.properties), ['label', 'items']);
  const row = group.properties.items.items;
  assert.deepEqual(Object.keys(row.properties), ['key', 'label', 'href', 'icon', 'badge']);
  assert.deepEqual(row.required, ['key', 'label', 'href']);
  assert.deepEqual(Object.keys(row.properties.badge.properties), ['text', 'status']);
  // Every object in it is closed, as every object of the port is.
  const walk = (schema, path) => {
    if ([schema.type].flat().includes('object')) assert.equal(schema.additionalProperties, false, `${path} is closed`);
    for (const [key, entry] of Object.entries(schema.properties ?? {})) walk(entry, `${path}.${key}`);
    if (schema.items) walk(schema.items, `${path}[]`);
  };
  walk(context, 'context');
});

test('the shapes validate: the documented object menu, a plain status, and a wrong one', () => {
  const context = navigation(now).properties.context;
  const given = kase('1.1.0', 'an-object-menu-comes-with-its-page').given.context;
  assert.deepEqual(validate(context, given), []);
  assert.deepEqual(validate(context, null), []);
  assert.deepEqual(validate(context, {title: 'Сайт', status: 'Работает', groups: []}), []);
  assert.notDeepEqual(validate(context, {title: 'Сайт', status: {text: 'x', status: 'red'}, groups: []}), []);
  assert.notDeepEqual(validate(context, {title: 'Сайт', groups: [{items: [{key: 'a', label: 'A'}]}]}), [], 'a row has an address');
  assert.notDeepEqual(validate(context, {title: 'Сайт', groups: [], extra: 1}), [], 'closed');
  for (const id of ['load-carries-the-page-it-is-asked-for', 'an-object-menu-comes-with-its-page']) {
    assert.deepEqual(validate(loadPayload(now), kase('1.1.0', id).when.payload), [], `${id}: the payload is declared`);
    assert.notDeepEqual(validate(loadPayload(before), kase('1.1.0', id).when.payload), [], `${id}: and 1.0.0 did not declare it`);
  }
});

test('1.1.0 only adds: every key 1.0.0 declared is still declared the same way', () => {
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
  assert.deepEqual(Object.keys(now.intents), Object.keys(before.intents), 'no new intent');
  assert.deepEqual(Object.keys(now.capabilities), Object.keys(before.capabilities), 'no new capability');
  assert.deepEqual(now.compatibility.recheck.slice(0, before.compatibility.recheck.length), before.compatibility.recheck);
  assert.ok(now.compatibility.recheck.length > before.compatibility.recheck.length);
  assert.ok(now.summary.startsWith(before.summary));
  assert.match(now.summary, /1\.1\.0 adds the menu of the object a page shows/u);
});

test('the kit is 1.0.0\'s cases byte for byte, and two of 1.1.0 that no host without object menus fails', () => {
  const old = kit('1.0.0').cases;
  const cases = kit('1.1.0').cases;
  assert.equal(kit('1.1.0').version, '1.1.0');
  assert.deepEqual(cases.slice(0, old.length), old);
  for (const id of old) {
    assert.equal(readFileSync(join(at('1.1.0'), `kit/cases/${id}.json`), 'utf8'),
      readFileSync(join(at('1.0.0'), `kit/cases/${id}.json`), 'utf8'), `${id} unchanged`);
  }
  assert.deepEqual(cases.slice(old.length), ['load-carries-the-page-it-is-asked-for', 'an-object-menu-comes-with-its-page']);
  assert.equal(now.conformance.cases, cases.length);
  const whole = kase('1.0.0', 'load-applied-carries-the-whole-menu').then.answer_must_include;
  for (const id of cases.slice(old.length)) {
    const one = kase('1.1.0', id);
    assert.equal(one.when.intent, 'navigation.load');
    assert.equal(one.then.answer, 'applied');
    assert.deepEqual(one.then.answer_must_include, whole, `${id}: requires what 1.0.0 required, not context`);
  }
});
