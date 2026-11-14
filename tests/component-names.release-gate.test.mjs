import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import tagAliases from '../src/core/js/tag-aliases.generated.js';
import {TAG, checkComponentNames, familyOf, readFrameworkComponents} from '../scripts/component-names-kit.mjs';

// The naming gate (owner decision C174, 2026-11-14, point 6): run by the
// candidate with every contract, so a pair cannot carry a tag that breaks
// «family first» or that another package already ships. The data:
// contracts/registry/names.json (who owns each family) and
// contracts/registry/package-tags.json (what every other package ships).

const root = new URL('../', import.meta.url);
const json = (relative) => JSON.parse(readFileSync(new URL(relative, root), 'utf8'));
const registry = json('contracts/registry/names.json');
const packages = json('contracts/registry/package-tags.json');
const framework = readFrameworkComponents(new URL('.', root).pathname);
const TODAY = '2026-11-14';
const run = (change = {}) => checkComponentNames({registry, framework, packages, tagAliases, today: TODAY, ...change});

test('every Smart tag of this checkout passes the naming gate', () => {
  assert.equal(framework.length, registry.owners.find(({id}) => id === 'framework').names.length, 'every Framework component is read');
  assert.deepEqual(run({today: new Date().toISOString().slice(0, 10)}), []);
});

test('the passport family is the first word of the tag (NM-5)', () => {
  for (const {tag, family} of framework) assert.equal(family, familyOf(tag), tag);
  const segmented = framework.map((row) => (row.tag === 'sf-segmented' ? {...row, family: 'button'} : row));
  assert.deepEqual(run({framework: segmented}), ['framework sf-segmented: its passport names family "button", the first word of the tag is "segmented" (family first, C174)']);
});

test('a new tag with the head noun last is refused', () => {
  const problems = run({framework: [...framework, {folder: 'page-header', tag: 'sf-page-header', family: 'page'}]});
  assert.match(problems[0], /^framework sf-page-header: "page" is not a family of SIMAI Framework/);
  assert.deepEqual(problems.slice(1), ['framework former tag sf-page-header: it is a current tag of framework'], 'and a former name is never reused (C174 point 3)');
  assert.match(run({framework: [...framework, {folder: 'icon-button', tag: 'sf-icon-button', family: 'icon'}]})[0], /former tag sf-icon-button: it is a current tag of framework/);
});

test('a Framework tag in a set family, or one another package ships, is refused', () => {
  assert.match(run({framework: [...framework, {folder: 'view-grid', tag: 'sf-view-grid', family: 'view'}]})[0],
    /^framework sf-view-grid: "view" is not a family of SIMAI Framework in the name registry \(it belongs to view\)/);
  const copied = run({framework: [...framework, {folder: 'chart-line', tag: 'sf-chart-line', family: 'chart'}]});
  assert.ok(copied.includes('sf-chart-line: shipped by framework and chart; a tag lives in one package'), copied.join('\n'));
});

test('a package tag starts with a family its owner holds, and lives in one package', () => {
  const withTag = (id, tag) => ({...packages, packages: packages.packages.map((pkg) => (pkg.id === id ? {...pkg, tags: [...pkg.tags, tag]} : pkg))});
  assert.deepEqual(run({packages: withTag('chart', 'sf-graph-line')}), ['chart sf-graph-line: "graph" is not a family of chart in the name registry']);
  assert.deepEqual(run({packages: withTag('chart', 'sf-view-table')}), [
    'chart sf-view-table: "view" is not a family of chart in the name registry (it belongs to view)',
    'sf-view-table: shipped by pro and view and chart; a tag lives in one package',
  ]);
  assert.deepEqual(run({packages: withTag('pro', 'sf-chart-pie')}), [
    'pro sf-chart-pie: the bundle carries no set that owns family "chart"',
    'sf-chart-pie: shipped by pro and chart; a tag lives in one package',
  ]);
  assert.match(run({packages: withTag('view', 'sf-view-table-row-cell')})[0], /not sf-<family>\[-<word>\] with at most three words/);
});

test('the pro bundle may copy a set until the bundle ends, never after', () => {
  const pro = packages.packages.find(({id}) => id === 'pro');
  assert.equal(pro.kind, 'bundle');
  assert.equal(pro.bundle_until, '2027-03-01', 'owner decision 2026-11-03: the last pro bundle');
  const after = run({today: '2027-03-02'});
  for (const tag of ['sf-view', 'sf-view-table', 'sf-view-properties', 'sf-editor', 'sf-chat-window']) {
    assert.ok(after.includes(`${tag}: shipped by pro and ${familyOf(tag)}; a tag lives in one package`), `${tag}\n${after.join('\n')}`);
  }
  assert.ok(after.some((line) => line.includes('sf-message-log: the alias element ended on 2027-01-01')));
});

test('the package list is the registry\'s sets and the bundle, each read at a revision', () => {
  const sets = new Set(registry.owners.filter(({kind}) => kind === 'set').map(({id}) => id));
  for (const pkg of packages.packages) {
    assert.match(pkg.revision, /^[0-9a-f]{12}$/u, `${pkg.id}: revision`);
    if (pkg.kind === 'set') assert.ok(sets.has(pkg.id), `${pkg.id} is a set of the registry`);
    else for (const id of pkg.bundles) assert.ok(sets.has(id), `${pkg.id} bundles ${id}, a set of the registry`);
    for (const tag of pkg.tags) assert.ok(TAG.test(tag), `${pkg.id} ${tag}`);
  }
  assert.ok(TAG.test('sf-header-page') && !TAG.test('sf-a-b-c-d') && !TAG.test('sf-header__page'), 'tags never carry BEM marks or a fourth word');
});
