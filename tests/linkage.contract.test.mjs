import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

import {
  checkPassports, collectUnits, compareInventories, contentHash, inventoryOf, passportFor, readCommittedTree, satisfies,
} from '../scripts/linkage.mjs';

// Standard simai.linkage 1.0.0: every unit SIMAI Framework publishes has a
// passport whose hash is its committed files, and a unit whose hash moved
// against the previous release's inventory has moved its version.
const root = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const fixture = (name) => json(`tests/fixtures/linkage/${name}.inventory.json`);

const head = readCommittedTree(root, 'HEAD');
const collected = collectUnits(head.tree);
const byId = new Map(collected.units.map((unit) => [unit.id, unit]));

test('every unit of the committed tree has a passport that matches its files', () => {
  const problems = checkPassports(collected);
  assert.deepEqual(problems.map(({code, message}) => `${code}: ${message}`), [], 'node scripts/linkage.mjs passports --write refreshes files, hashes and dependencies');
});

test('the units are every class component, utility folder, plugin, Smart component and port, and the foundations', () => {
  const folders = (base) => new Set([...head.tree.keys()].filter((file) => file.startsWith(base) && file.slice(base.length).includes('/')).map((file) => file.slice(base.length).split('/')[0]));
  const count = (kind) => collected.units.filter((unit) => unit.kind === kind).length;
  assert.equal(count('component'), folders('src/component/').size);
  assert.equal(count('utility'), folders('src/utility/').size, 'one utility folder, one unit (owner, 2026-10-27)');
  assert.equal(count('plugin'), folders('src/plugin/').size);
  const smart = [...folders('src/smart/')].filter((folder) => head.tree.has(`src/smart/${folder}/component.json`));
  assert.equal(count('smart'), smart.length, 'a Smart component is a folder with component.json');
  assert.equal(count('port'), folders('src/core/contracts/ports/').size);
  for (const id of ['tokens.colour', 'tokens.space', 'tokens.size', 'tokens.radius', 'tokens.border', 'tokens.elevation', 'tokens.typography',
    'tokens.motion', 'tokens.opacity', 'tokens.breakpoint', 'font.inter', 'icons.material-symbols', 'icons.material-icons', 'core.styles', 'core.runtime']) {
    assert.ok(byId.has(id), id);
  }
  // The icon fonts sit in the icons component's folder and are the icon sets'.
  assert.ok(byId.get('icons.material-symbols').files.includes('src/component/icons/fonts/MaterialSymbols-Outlined.woff2'));
  assert.ok(!byId.get('component.icons').files.some((file) => file.includes('/fonts/')));
  assert.ok(byId.get('component.icons').detected.includes('icons.material-symbols'), 'the sheet loads the font by url()');
});

test('a derived Smart passport takes component.json and keeps its former path', () => {
  const tree = byId.get('smart.tree');
  assert.equal(tree.passport.version, json('src/smart/tree/component.json').version);
  assert.ok(tree.files.every((file) => file.startsWith('src/smart/tree/')));
  const badge = byId.get('smart.badge');
  assert.ok(badge.files.includes('src/smart/badges/index.js'), 'a forward folder belongs to the component it forwards to');
  assert.ok(badge.passport.former_ids.some(({id}) => id === 'smart.badges'));
  assert.ok(tree.detected.includes('component.tree') && tree.detected.includes('smart.tree-item'), 'rule relations are dependencies');
});

test('every passport carries what the passport schema requires', () => {
  const schema = json('src/core/contracts/unit-passport.v1.schema.json');
  for (const unit of collected.units.filter((entry) => entry.written)) {
    for (const key of schema.required) assert.ok(key in unit.passport, `${unit.passportFile}: ${key}`);
    assert.deepEqual(Object.keys(unit.passport).filter((key) => !(key in schema.properties)), [], unit.passportFile);
  }
  const inventory = inventoryOf(collected, {revision: head.revision});
  const inventorySchema = json('src/core/contracts/unit-inventory.v1.schema.json');
  for (const key of inventorySchema.required) assert.ok(key in inventory, `inventory: ${key}`);
  assert.equal(inventory.units.length, collected.units.length);
  assert.deepEqual(inventory.units.map(({id}) => id), [...inventory.units.map(({id}) => id)].sort());
});

// The fixtures below are small trees in memory, built the way the committed
// tree is read: path -> bytes.
function fixtureTree(files) {
  const tree = new Map(Object.entries(files).map(([file, text]) => [file, Buffer.from(text)]));
  const units = collectUnits(tree);
  const ids = new Map(units.units.map((unit) => [unit.id, unit]));
  for (const unit of units.units) if (unit.written) tree.set(unit.passportFile, Buffer.from(JSON.stringify(passportFor(unit, ids))));
  return tree;
}
const SOURCES = {
  'src/component/alpha/index.js': "import './scss/index.scss';\n",
  'src/component/alpha/scss/index.scss': '.sf-alpha { color: var(--sf-on-surface); }\n',
  'src/component/alpha/rule.js': "SF.RuleLoader['alpha'] = {type: 'component', css: true};\n",
  'src/core/scss/_sf_css__theme.scss': ':root { --sf-on-surface: #111; }\n',
  'src/core/passports/tokens.colour.json': JSON.stringify({id: 'tokens.colour', version: '1.0.0', includes: ['src/core/scss/_sf_css__theme.scss']}),
};

test('(a) a unit without a passport is refused', () => {
  const tree = fixtureTree(SOURCES);
  assert.deepEqual(checkPassports(collectUnits(tree)), []);
  tree.delete('src/component/alpha/passport.json');
  assert.deepEqual(checkPassports(collectUnits(tree)).map(({code}) => code), ['no-passport']);
  const stray = fixtureTree({...SOURCES, 'src/core/js/loader.js': '// no unit claims me\n'});
  assert.ok(checkPassports(collectUnits(stray)).some(({code, id}) => code === 'no-unit' && id === 'src/core/js/loader.js'), 'a file of no unit');
});

test('(b) a passport whose hash is not its files is refused', () => {
  const tree = fixtureTree(SOURCES);
  tree.set('src/component/alpha/scss/index.scss', Buffer.from('.sf-alpha { color: red; }\n'));
  assert.deepEqual(checkPassports(collectUnits(tree)).map(({code}) => code), ['hash-differs']);
  const added = fixtureTree(SOURCES);
  added.set('src/component/alpha/js/index.js', Buffer.from('export {};\n'));
  assert.deepEqual(checkPassports(collectUnits(added)).map(({code}) => code).sort(), ['files-differ', 'hash-differs']);
});

test('the hash is one SHA-256 over sorted paths and bytes', () => {
  const tree = new Map([['src/b', Buffer.from('2')], ['src/a', Buffer.from('1')]]);
  assert.equal(contentHash(['src/b', 'src/a'], tree), contentHash(['src/a', 'src/b'], tree), 'order does not matter');
  const moved = new Map([['src/a', Buffer.from('')], ['src/b', Buffer.from('12')]]);
  assert.notEqual(contentHash(['src/a', 'src/b'], tree), contentHash(['src/a', 'src/b'], moved), 'bytes cannot slide between files');
});

test('a dependency the code uses but the passport omits is refused', () => {
  const tree = fixtureTree(SOURCES);
  const passport = JSON.parse(tree.get('src/component/alpha/passport.json'));
  assert.deepEqual(passport.dependencies, [{id: 'tokens.colour', range: '^1.0.0'}], 'the token read is found');
  tree.set('src/component/alpha/passport.json', Buffer.from(JSON.stringify({...passport, dependencies: []})));
  assert.deepEqual(checkPassports(collectUnits(tree)).map(({code}) => code), ['dependency-undeclared']);
  assert.ok(satisfies('1.4.2', '^1.0.0') && !satisfies('2.0.0', '^1.0.0') && !satisfies('0.3.0', '^0.2.0') && !satisfies('1.0.0', '^1.0.1'));
});

test('(c) a hash that moved against the previous inventory without a version is refused', () => {
  const report = compareInventories(fixture('previous'), fixture('unbumped'));
  assert.deepEqual(report.violations.map(({id, code}) => `${id} ${code}`), ['component.alpha hash-moved-without-version']);

  const bumped = compareInventories(fixture('previous'), fixture('bumped'));
  assert.deepEqual(bumped.violations, []);
  assert.deepEqual(bumped.added, [{id: 'utility.space', version: '1.0.0'}]);
  assert.deepEqual(bumped.removed, [{id: 'utility.gap', version: '1.2.0'}]);
  assert.deepEqual(bumped.changed.map(({id, step}) => `${id} ${step}`), ['component.alpha patch', 'tokens.colour minor']);
  assert.deepEqual(bumped.dependencies_changed, [{id: 'component.alpha', added: ['utility.space'], removed: [], moved: ['tokens.colour']}]);

  const back = compareInventories(fixture('previous'), fixture('went-back'));
  assert.deepEqual(back.violations.map(({code}) => code), ['version-went-back']);
});

test('(c) the gate reads the inventory of a tree: an edit needs a version', () => {
  const before = fixtureTree(SOURCES);
  const previous = inventoryOf(collectUnits(before), {revision: '1'.repeat(40), release: 'ui-111111111111'});
  const edited = fixtureTree({...SOURCES, 'src/component/alpha/scss/index.scss': '.sf-alpha { color: var(--sf-on-surface); gap: 0; }\n'});
  const current = () => inventoryOf(collectUnits(edited), {revision: '2'.repeat(40)});
  assert.deepEqual(compareInventories(previous, current()).violations.map(({id}) => id), ['component.alpha']);
  const passport = JSON.parse(edited.get('src/component/alpha/passport.json'));
  edited.set('src/component/alpha/passport.json', Buffer.from(JSON.stringify({...passport, version: '1.0.1'})));
  assert.deepEqual(checkPassports(collectUnits(edited)), []);
  assert.deepEqual(compareInventories(previous, current()).violations, []);
});

test('the command line compares two inventories and fails on a violation', () => {
  const run = (...args) => spawnSync(process.execPath, ['scripts/linkage.mjs', ...args], {cwd: root, encoding: 'utf8'});
  const refused = run('compare', 'tests/fixtures/linkage/previous.inventory.json', 'tests/fixtures/linkage/unbumped.inventory.json');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /hash-moved-without-version/u);
  const passed = run('compare', 'tests/fixtures/linkage/previous.inventory.json', 'tests/fixtures/linkage/bumped.inventory.json');
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(JSON.parse(passed.stdout).schema, 'simai.framework.unit-change-report');
  assert.equal(run('nothing').status, 2);
});

// The previous release's inventory, when one is given: no released pair
// carries an inventory yet, so the release route passes the last pair's file
// (SF_LINKAGE_PREVIOUS) once the distribution carries it.
const previousRelease = process.env.SF_LINKAGE_PREVIOUS;
test('(c) against the previous release: every moved hash moved its version', {skip: previousRelease ? false : 'no previous inventory given (SF_LINKAGE_PREVIOUS); no released pair carries one yet'}, () => {
  assert.ok(existsSync(previousRelease), previousRelease);
  const report = compareInventories(JSON.parse(readFileSync(previousRelease, 'utf8')), inventoryOf(collected, {revision: head.revision}));
  assert.deepEqual(report.violations.map(({message}) => message), []);
});
