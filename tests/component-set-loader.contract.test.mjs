import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  CORE_RUNTIME,
  SET_INDEX_URL,
  checkSetIndex,
  compareVersions,
  meetsMinimum,
  npmBase,
  readSetDeclaration,
  readSetsAttribute,
  selectSetRelease,
} from '../src/core/js/sets.js';

// The pure half of the Loader's set support (core/js/sets.js; standard
// simai.component-set 1.0.0, one-line-connection and one-compatibility-index):
// how a page names a set, how a release is chosen from the compatibility
// index, and where it is served. The Loader half is
// tests/loader-packages.contract.test.mjs, the page half
// tests/browser/component-sets.browser.mjs.

const root = new URL('../', import.meta.url);
const json = (relative) => JSON.parse(readFileSync(new URL(relative, root), 'utf8'));
const INDEX = json('tests/fixtures/component-set/index.json');

test('CORE_RUNTIME is the core.runtime passport version', () => {
  assert.equal(CORE_RUNTIME, json('src/core/passports/core.runtime.json').version);
});

test('data-sf-sets names sets, with an optional npm version each', () => {
  assert.deepEqual(readSetsAttribute('effects'), {sets: {effects: true}, refused: []});
  assert.deepEqual(readSetsAttribute(' effects, admin@1.2.0  chart@2.0.0-rc.1 '),
    {sets: {effects: true, admin: '1.2.0', chart: '2.0.0-rc.1'}, refused: []});
  assert.deepEqual(readSetsAttribute('Effects admin@latest ui-admin'),
    {sets: {'ui-admin': true}, refused: ['Effects', 'admin@latest']});
});

test('a declaration is a base, a version or a name for the index', () => {
  assert.deepEqual(readSetDeclaration('/vendor/fx/smart/'), {base: '/vendor/fx/smart', rule: '', version: '', byIndex: false, set: true});
  assert.deepEqual(readSetDeclaration('1.0.0'), {base: '', rule: '', version: '1.0.0', byIndex: false, set: true});
  assert.deepEqual(readSetDeclaration(true), {base: '', rule: '', version: '', byIndex: true, set: true});
  assert.deepEqual(readSetDeclaration({index: true}), {base: '', rule: '', version: '', byIndex: true, set: true});
  assert.deepEqual(readSetDeclaration({base: 'https://x/y/', rule: 'https://x/r.js'}), {base: 'https://x/y', rule: 'https://x/r.js', version: '', byIndex: false, set: false}, 'the component-package form is a plain package');
  assert.equal(readSetDeclaration({base: '/p/smart', version: '1.2.0'}).set, true, 'an object with a version names a set');
  assert.equal(readSetDeclaration({}), null, 'an empty object declares nothing, as before sets');
  assert.equal(readSetDeclaration(''), null);
  assert.equal(readSetDeclaration(false), null);
});

test('a released set is served from its npm package', () => {
  assert.equal(npmBase('effects', '1.0.0'), 'https://cdn.jsdelivr.net/npm/@simai-studio/effects@1.0.0/dist/smart');
  assert.equal(npmBase('effects', '1.0.0', 'http://127.0.0.1:8080/npm/'), 'http://127.0.0.1:8080/npm/@simai-studio/effects@1.0.0/dist/smart');
  assert.equal(SET_INDEX_URL, 'https://cdn.jsdelivr.net/npm/@simai-studio/sets@1/index.json', 'the index is pinned to its format major');
});

test('versions compare as npm does for release and pre-release', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.equal(compareVersions('2', '2.0.0'), null);
  assert.ok(meetsMinimum('>=1.25.0', '1.25.0'));
  assert.ok(meetsMinimum('>=1.24.9', '1.25.0'));
  assert.ok(!meetsMinimum('>=1.25.1', '1.25.0'));
  assert.ok(!meetsMinimum('^1.25.0', '1.25.0'), 'only the >= form a passport writes');
});

test('the index fixture holds, and the newest release this Core meets is chosen', () => {
  assert.deepEqual(checkSetIndex(INDEX), []);
  assert.equal(selectSetRelease(INDEX, 'effects').row.version, '1.0.0', '1.1.0 needs core.runtime 99');
  assert.equal(selectSetRelease(INDEX, 'effects', {coreRuntime: '99.0.0'}).row.version, '1.1.0');
  assert.equal(selectSetRelease(INDEX, 'effects', {version: '1.1.0'}).row.release, 'effects-fedcba987654', 'a pinned version is taken as asked');
  assert.deepEqual(selectSetRelease(INDEX, 'effects', {version: '3.0.0'}), {reason: 'version-not-indexed'});
  assert.deepEqual(selectSetRelease(INDEX, 'admin'), {reason: 'unknown-set'});
  assert.deepEqual(selectSetRelease(INDEX, 'effects', {coreRuntime: '1.0.0'}), {reason: 'no-compatible-release'});
});

test('an index that is not one is refused before a base is made from it', () => {
  assert.notDeepEqual(checkSetIndex({schema: 'simai.framework.set-index', schema_version: 2, releases: []}), []);
  const broken = structuredClone(INDEX);
  broken.releases[0].release = 'effects-main';
  broken.releases[1].framework.core_runtime = '^1.0.0';
  assert.deepEqual(checkSetIndex(broken), ['releases[0].release', 'releases[1].framework.core_runtime']);
});

test('the index schema is pinned by the set standard and the fixture takes it', () => {
  const standard = json('contracts/standards/simai.component-set/1.1.1/standard.json');
  const pin = standard.uses.find(({id}) => id === 'simai.framework.set-index-schema');
  assert.ok(pin, 'the standard pins the index form');
  assert.equal(readFileSync(new URL('contracts/standards/pinned/set-index-1.1.0.schema.json', root), 'utf8'),
    readFileSync(new URL('contracts/schema/set-index.v1.schema.json', root), 'utf8'));
  const schema = json('contracts/schema/set-index.v1.schema.json');
  const required = schema.properties.releases.items.required;
  for (const row of INDEX.releases) for (const key of required) assert.ok(key in row, `${row.release}: ${key}`);
  for (const row of INDEX.releases) {
    for (const key of Object.keys(row)) assert.ok(key in schema.properties.releases.items.properties, `${row.release}: ${key} is in the form`);
  }
});
