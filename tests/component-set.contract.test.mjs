import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import test from 'node:test';

import tagAliases from '../src/core/js/tag-aliases.generated.js';

// Standard simai.component-set 1.0.0: a set describes its own components in its
// passport (set.json), and SIMAI Framework keeps only the standard and the shared
// name registry (contracts/registry/names.json). This gate holds the registry:
// a family has one owner, a name starts with a family its owner holds, the
// Framework's own manifests are registered, and the passport form is the one the
// standard pins. Owner decision 2026-11-03 (component sets).

const root = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));

const STANDARD = 'contracts/standards/simai.component-set/1.2.0/standard.json';
const PASSPORT_SCHEMA = 'contracts/schema/component-set.v1.schema.json';
const REGISTRY_SCHEMA = 'contracts/schema/name-registry.v1.schema.json';
const REGISTRY = 'contracts/registry/names.json';
const FIXTURE = 'tests/fixtures/component-set/set.json';
const INDEX_SCHEMA = 'contracts/schema/set-index.v1.schema.json';
const INDEX_FIXTURE = 'tests/fixtures/component-set/index.json';

const PRO_SPDX = 'PolyForm-Small-Business-1.0.0 OR PolyForm-Noncommercial-1.0.0 OR LicenseRef-SIMAI-Commercial';
const LICENCES = {'simai-pro': PRO_SPDX, framework: 'Apache-2.0'};

const familyOf = (element) => element.split('-')[1];

// The subset of JSON Schema 2020-12 these two schemas use, checked without a
// schema runtime, as the other contract gates do.
function validate(schema, value, where = '$', defs = schema.$defs ?? {}) {
  const errors = [];
  if (schema.$ref) return validate(defs[schema.$ref.replace('#/$defs/', '')], value, where, defs);
  if ('const' in schema && value !== schema.const) errors.push(`${where}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: must be one of ${schema.enum.join(', ')}`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [...errors, `${where}: must be an object`];
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${where}: ${key} is required`);
    for (const [key, entry] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (property) errors.push(...validate(property, entry, `${where}.${key}`, defs));
      else if (schema.additionalProperties === false) errors.push(`${where}: unknown key ${key}`);
    }
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [...errors, `${where}: must be an array`];
    if (schema.minItems && value.length < schema.minItems) errors.push(`${where}: at least ${schema.minItems}`);
    if (schema.uniqueItems && new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length) errors.push(`${where}: items repeat`);
    value.forEach((entry, index) => errors.push(...validate(schema.items ?? {}, entry, `${where}[${index}]`, defs)));
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [...errors, `${where}: must be a string`];
    if (schema.minLength && value.length < schema.minLength) errors.push(`${where}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${where}: ${value} does not match ${schema.pattern}`);
  }
  return errors;
}

function frameworkElements() {
  return readdirSync(new URL('src/smart/', root), {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`src/smart/${entry.name}/smart.manifest.json`, root)))
    .map((entry) => json(`src/smart/${entry.name}/smart.manifest.json`).custom_element)
    .sort();
}

test('the standard pins the passport and registry forms as frozen copies of the live schemas', () => {
  const standard = json(STANDARD);
  const pins = Object.fromEntries(standard.uses.map((used) => [used.id, used]));
  for (const [id, live] of [['simai.framework.component-set-schema', PASSPORT_SCHEMA], ['simai.framework.name-registry-schema', REGISTRY_SCHEMA]]) {
    const pinned = pins[id];
    assert.ok(pinned, `${id} is pinned`);
    const frozen = pinned.path.replace('../../', 'contracts/standards/');
    // A live schema moves on with additive editions; while it still declares the
    // pinned version, its bytes are the frozen copy's.
    if (json(live)['x-simai-version'] === pinned.version) assert.deepEqual(read(live), read(frozen), `${live} equals ${frozen}`);
  }
  const ids = standard.requirements.map((requirement) => requirement.id);
  for (const id of ['set-describes-its-components', 'family-has-one-owner', 'names-start-with-owned-family', 'one-release-route', 'one-compatibility-index', 'same-gates-for-every-set', 'one-line-connection', 'package-folder-by-component-package']) {
    assert.ok(ids.includes(id), `requirement ${id}`);
  }
  const site = standard.requirements.find(({id}) => id === 'one-site-per-set');
  for (const section of ['Overview', 'Connection', 'Components', 'Demos', 'Changes']) assert.match(site.text, new RegExp(`\\b${section}\\b`, 'u'), `the set site requires ${section}`);
  assert.equal(standard.requirements.find(({id}) => id === 'framework-first').level, 'must', 'what is universal belongs to the Framework');
  const reference = standard.references.find(({id}) => id === 'simai.component-package');
  assert.ok(reference, 'the component package standard is referenced');
  assert.equal(standard.extends, undefined, 'the set standard supersedes the package standard by reference, it does not extend it');
  const replaced = json('contracts/standards/simai.component-package/1.1.2/standard.json').requirements.map(({id}) => id);
  for (const id of ['own-element-prefix', 'delivered-in-owners-distribution']) {
    assert.ok(replaced.includes(id), `${id} exists in the package standard`);
    assert.match(standard.requirements.find(({id: own}) => own === 'package-folder-by-component-package').text, new RegExp(id), `${id} is named as replaced`);
  }
});

test('the standards index lists the set standard', () => {
  assert.match(read('contracts/standards/README.md').toString('utf8'), /\| `simai\.component-set` \| 1\.2\.0 \|/u);
});

test('a set passport takes the pinned form and its own rules', () => {
  const schema = json(PASSPORT_SCHEMA);
  const passport = json(FIXTURE);
  assert.deepEqual(validate(schema, passport), []);
  assert.equal(passport.repository.split('/')[1], `ui-${passport.id}`, 'the set id is the repository name without ui-');
  assert.equal(passport.licence.spdx, LICENCES[passport.licence.class], 'the licence class names its expression');
  for (const component of passport.components) {
    assert.ok(passport.families.includes(familyOf(component.element)), `${component.element} starts with an owned family`);
    assert.equal(component.rule, `cl-${component.folder}`, `${component.element}: rule is cl-<folder>`);
  }

  // The form refuses what the standard forbids.
  const broken = (change) => validate(schema, change(structuredClone(passport)));
  assert.notDeepEqual(broken((value) => { value.licence.class = 'commercial'; return value; }), [], 'a third licence class');
  assert.notDeepEqual(broken((value) => { value.components[0].element = 'fx-effect'; return value; }), [], 'another prefix');
  assert.notDeepEqual(broken((value) => { value.framework.source_revision = 'main'; return value; }), [], 'a floating revision');
  assert.notDeepEqual(broken((value) => { value.repository = 'simai/effects'; return value; }), [], 'a repository without ui-');
  assert.notDeepEqual(broken((value) => { value.families = []; return value; }), [], 'no family');
  assert.notDeepEqual(broken((value) => { value.release = {id: 'effects-main', version: '1.0.0', source_revision: passport.framework.source_revision}; return value; }), [], 'a release id without its commit');
  assert.notDeepEqual(broken((value) => { value.package_reference = 'ui-source'; return value; }), [], 'an unknown key');
});

// Standard 1.1.0 (owner decision 2026-11-07, set pair receipts): a release row
// may list the further pairs its unchanged release was re-receipted over. The
// row's facts never change; pairs only grows, never names the row's own pair
// and names a pair once.
test('the compatibility index takes its pinned form, pairs included', () => {
  const schema = json(INDEX_SCHEMA);
  const index = json(INDEX_FIXTURE);
  assert.equal(schema['x-simai-version'], '1.2.0');
  assert.deepEqual(validate(schema, index), []);
  const listed = index.releases.filter((row) => row.pairs);
  assert.ok(listed.length > 0, 'the fixture holds a row with pairs');
  for (const row of listed) {
    const pairs = row.pairs.map(({pair}) => pair);
    assert.ok(!pairs.includes(row.framework.pair), `${row.release}: pairs never name the row's own pair`);
    assert.equal(new Set(pairs).size, pairs.length, `${row.release}: a pair is listed once`);
    assert.deepEqual(row.pairs.map(({received_on}) => received_on), row.pairs.map(({received_on}) => received_on).sort(), `${row.release}: in the order received`);
    for (const {received_on: received} of row.pairs) assert.ok(received >= row.published_on, `${row.release}: received after the release`);
  }
  const broken = (change) => validate(schema, change(structuredClone(index)));
  assert.notDeepEqual(broken((value) => { value.releases[0].pairs = []; return value; }), [], 'an empty pairs list');
  assert.notDeepEqual(broken((value) => { value.releases[0].pairs[0].pair = 'ui-main'; return value; }), [], 'a pair that is not ui-<12 hex>');
  assert.notDeepEqual(broken((value) => { value.releases[0].pairs[0].version = '1.0.1'; return value; }), [], 'an unknown key in a pair');
  assert.notDeepEqual(broken((value) => { delete value.releases[0].pairs[0].receipt_sha256; return value; }), [], 'a pair without its receipt digest');
  assert.notDeepEqual(broken((value) => { value.releases[0].note = 'x'; return value; }), [], 'an unknown row key');
});

// Standard 1.2.0 (owner decision 2026-11-09, set pair ranges): a release row
// may name its pair range by two digests, the range file's and its interface's.
test('a release row names its pair range by its two digests and nothing else', () => {
  const schema = json(INDEX_SCHEMA);
  const index = json(INDEX_FIXTURE);
  const ranged = index.releases.filter((row) => row.range);
  assert.ok(ranged.length > 0, 'the fixture holds a row with a range');
  for (const row of ranged) assert.deepEqual(Object.keys(row.range).sort(), ['interface_sha256', 'sha256'], row.release);
  const at = index.releases.indexOf(ranged[0]);
  const broken = (change) => validate(schema, change(structuredClone(index)));
  assert.notDeepEqual(broken((value) => { delete value.releases[at].range.interface_sha256; return value; }), [], 'a range without its interface digest');
  assert.notDeepEqual(broken((value) => { value.releases[at].range.sha256 = 'x'; return value; }), [], 'a digest that is not 64 hex');
  assert.notDeepEqual(broken((value) => { value.releases[at].range.pairs = ['ui-1ec283e856cd']; return value; }), [], 'a range is not a list of pairs');
  const standard = json(STANDARD);
  const route = standard.requirements.find(({id}) => id === 'one-release-route');
  assert.match(route.text, /pair-range\.json/u);
  assert.match(route.text, /contracts\/pair-ranges\/<release>\.json/u);
  assert.match(standard.requirements.find(({id}) => id === 'one-framework-pair').text, /pair range/u);
});

test('the shared name registry takes its pinned form', () => {
  assert.deepEqual(validate(json(REGISTRY_SCHEMA), json(REGISTRY)), []);
  const registry = json(REGISTRY);
  const framework = registry.owners.filter(({kind}) => kind === 'framework');
  assert.deepEqual(framework.map(({id, repository}) => [id, repository]), [['framework', 'simai/ui-source']], 'one Framework owner');
  for (const owner of registry.owners.filter(({kind}) => kind === 'set')) {
    assert.match(owner.id, /^[a-z][a-z0-9-]*$/u);
    assert.equal(owner.repository.split('/')[1], `ui-${owner.id}`, `${owner.id}: the set id is the repository name without ui-`);
  }
  assert.equal(new Set(registry.owners.map(({id}) => id)).size, registry.owners.length, 'an owner is listed once');
  for (const owner of registry.owners.filter(({status}) => status === 'pending')) assert.ok(owner.note?.trim(), `${owner.id}: a pending set says what it waits for`);
});

test('no family belongs to two owners', () => {
  const owners = new Map();
  for (const owner of json(REGISTRY).owners) {
    for (const family of owner.families) {
      assert.ok(!owners.has(family), `family ${family} is owned by ${owners.get(family)} and ${owner.id}`);
      owners.set(family, owner.id);
    }
  }
});

test('every registered name starts with a family its owner holds, or is a listed exception', () => {
  const registry = json(REGISTRY);
  const familyOwner = new Map(registry.owners.flatMap((owner) => owner.families.map((family) => [family, owner.id])));
  const exceptions = new Map(registry.exceptions.map((exception) => [exception.element, exception]));
  const seen = new Map();
  for (const owner of registry.owners) {
    for (const {element} of owner.names) {
      assert.ok(element.startsWith(registry.prefix), `${element}: prefix`);
      assert.ok(!seen.has(element), `${element} is registered to ${seen.get(element)} and ${owner.id}`);
      seen.set(element, owner.id);
      if (owner.families.includes(familyOf(element))) continue;
      const exception = exceptions.get(element);
      assert.ok(exception, `${element} (${owner.id}) is in family ${familyOf(element)}, owned by ${familyOwner.get(familyOf(element)) ?? 'nobody'}`);
      assert.equal(exception.owner, owner.id, `${element}: exception owner`);
      assert.equal(exception.family_owner, familyOwner.get(familyOf(element)), `${element}: exception names the family's owner`);
    }
  }
  // An exception that no longer breaks the rule is stale and leaves the list.
  for (const exception of registry.exceptions) {
    const owner = registry.owners.find(({id}) => id === exception.owner);
    assert.ok(owner?.names.some(({element}) => element === exception.element), `${exception.element}: the exception names a registered element`);
    assert.ok(!owner.families.includes(familyOf(exception.element)), `${exception.element}: the exception is stale`);
  }
});

test('the registry lists exactly the Framework\'s own Smart components', () => {
  const registered = json(REGISTRY).owners.find(({id}) => id === 'framework').names.map(({element}) => element).sort();
  assert.deepEqual(registered, frameworkElements());
});

test('every tag alias points at a registered name, and no former tag is a current name', () => {
  const names = new Set(json(REGISTRY).owners.flatMap(({names: list}) => list.map(({element}) => element)));
  assert.ok(tagAliases.length > 10, 'the tag alias table is read');
  for (const alias of tagAliases) {
    assert.ok(names.has(alias.to), `${alias.from} -> ${alias.to}: the target is registered`);
    assert.ok(!names.has(alias.from), `${alias.from}: a former tag is not a current name`);
  }
});

test('a set passport agrees with the registry', () => {
  const passport = json(FIXTURE);
  const owner = json(REGISTRY).owners.find(({id}) => id === passport.id);
  assert.ok(owner, `${passport.id} is registered`);
  assert.equal(owner.repository, passport.repository);
  assert.deepEqual([...passport.families].sort(), [...owner.families].sort(), 'the passport lists the families the registry gives it');
  // A new name inside an owned family needs no registry change before the set
  // releases it; a name in a family the set does not own is refused.
  for (const {element} of passport.components) assert.ok(owner.families.includes(familyOf(element)), `${element}: family owned by ${passport.id} in the registry`);
});
