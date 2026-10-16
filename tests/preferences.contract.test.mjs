import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';

// A localStorage of this test's own, set before the module is read.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
const {createPreferences} = await import('../src/core/js/preferences.js');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

test('a preference is read back as it was written, from this browser', () => {
  const prefs = createPreferences();
  assert.equal(prefs.read('sf-table/demo'), null);
  assert.equal(prefs.write('sf-table/demo', {v: 1, sort: [{key: 'name', direction: 'asc'}]}), true);
  assert.deepEqual(prefs.read('sf-table/demo'), {v: 1, sort: [{key: 'name', direction: 'asc'}]});
  assert.ok(memory.has('sf-pref:sf-table/demo'), 'the browser keeps the copy a first paint reads');
  // A copy, not the stored object: changing it changes nothing kept.
  prefs.read('sf-table/demo').sort.length = 0;
  assert.equal(prefs.read('sf-table/demo').sort.length, 1);
});

test('no key or a malformed one keeps nothing', () => {
  const prefs = createPreferences();
  assert.equal(prefs.write('', {a: 1}), false);
  assert.equal(prefs.write('has space/x', {a: 1}), false);
  assert.equal(prefs.read(undefined), null);
});

test('reset removes the value and tells who listens', () => {
  const prefs = createPreferences();
  const heard = [];
  prefs.subscribe('sf-admin-menu/main', (value) => heard.push(value));
  prefs.write('sf-admin-menu/main', {v: 1, widths: {first: 300}});
  prefs.remove('sf-admin-menu/main');
  assert.equal(prefs.read('sf-admin-menu/main'), null);
  assert.ok(!memory.has('sf-pref:sf-admin-menu/main'));
  assert.deepEqual(heard, [null]);
});

test("the host's values win over this browser's and replace its copy", () => {
  const prefs = createPreferences();
  prefs.write('sf-table/hosted', {v: 1, density: 'compact'});
  const heard = [];
  prefs.subscribe('sf-table/hosted', (value) => heard.push(value));
  prefs.preload({'sf-table/hosted': {v: 1, density: 'spacious'}, 'not a key': {}});
  assert.deepEqual(prefs.read('sf-table/hosted'), {v: 1, density: 'spacious'});
  assert.equal(JSON.parse(memory.get('sf-pref:sf-table/hosted')).density, 'spacious');
  assert.deepEqual(heard, [{v: 1, density: 'spacious'}]);
  // The same value again is not news.
  prefs.preload({'sf-table/hosted': {v: 1, density: 'spacious'}});
  assert.equal(heard.length, 1);
});

test('the person\'s general preference sits under the particular one, field by field', () => {
  const prefs = createPreferences();
  prefs.write('sf-table/*', {v: 1, density: 'compact', stripes: true});
  prefs.write('sf-table/orders', {v: 1, density: 'spacious', sort: []});
  assert.deepEqual(prefs.readMerged('sf-table/*', 'sf-table/orders'), {v: 1, density: 'spacious', stripes: true, sort: []});
  assert.equal(prefs.readMerged('sf-table/none-a', 'sf-table/none-b'), null);
});

test('a host is told once per burst of writes, and of a reset', async () => {
  const prefs = createPreferences();
  const told = [];
  prefs.useHost({save: (key, value) => told.push(['save', key, value]), remove: (key) => told.push(['remove', key])});
  prefs.write('sf-table/burst', {v: 1, n: 1});
  prefs.write('sf-table/burst', {v: 1, n: 2});
  prefs.write('sf-table/burst', {v: 1, n: 3});
  assert.equal(told.length, 0, 'debounced');
  await wait(450);
  assert.deepEqual(told, [['save', 'sf-table/burst', {v: 1, n: 3}]]);
  prefs.remove('sf-table/burst');
  prefs.flush();
  assert.deepEqual(told.at(-1), ['remove', 'sf-table/burst']);
  assert.throws(() => prefs.useHost({}), TypeError);
});

test('core publishes one registry on SF, and a second bundle reuses it', async () => {
  const first = globalThis.SF?.Preferences;
  assert.ok(first, 'core publishes SF.Preferences');
  const again = await import('../src/core/js/preferences.js?second');
  assert.equal(again.default, first);
  const index = await readFile(new URL('../src/core/js/index.js', import.meta.url), 'utf8');
  assert.match(index, /import '\.\/preferences\.js';/u);
});

// A component that keeps how it looks keeps it through SF.Preferences, so a
// host that keeps preferences for its user gets every one of them, and none is
// applied after the first paint. The Loader's and the icons' own caches are
// not preferences.
test('no Smart component touches localStorage itself', async () => {
  const root = new URL('../src/smart/', import.meta.url);
  const offenders = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(m?js)$/u.test(entry.name)) {
        const source = await readFile(path, 'utf8');
        const lines = source.split('\n').filter((line) => /localStorage/u.test(line) && !/^\s*\/\//u.test(line));
        // The resizer reads and removes the width it kept before the standard.
        const allowed = path.endsWith('resizer/index.js') ? lines.filter((line) => !/sf-resizer:\$\{key\}/u.test(line)) : lines;
        if (allowed.length) offenders.push(`${path}: ${allowed.length}`);
      }
    }
  };
  await walk(root.pathname);
  assert.deepEqual(offenders, []);
});

test('the value already kept is not sent to the host again (docs trial 5)', async () => {
  const prefs = createPreferences();
  const told = [];
  prefs.preload({'sf-resizer/menu': {v: 1, width: 280}});
  prefs.useHost({save: (key, value) => told.push(['save', key, value]), remove: (key) => told.push(['remove', key])});
  // A resizer restoring the width the host gave it.
  assert.equal(prefs.write('sf-resizer/menu', {v: 1, width: 280}), true);
  await wait(450);
  assert.deepEqual(told, []);
  prefs.write('sf-resizer/menu', {v: 1, width: 300});
  await wait(450);
  assert.deepEqual(told, [['save', 'sf-resizer/menu', {v: 1, width: 300}]]);
});
