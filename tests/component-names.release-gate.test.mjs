import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import tagAliases from '../src/core/js/tag-aliases.generated.js';
import {BEM_MARK, TAG, checkComponentNames, familyOf, readFrameworkComponents, splitOpen} from '../scripts/component-names-kit.mjs';

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
const check = (change = {}) => checkComponentNames({registry, framework, packages, tagAliases, today: TODAY, ...change});
// The problems beyond the listed open ones (package-tags.json open), so a
// case below sees only what its change adds.
const run = (change = {}) => splitOpen(check(change), packages.open).fresh;

test('every Smart tag of this checkout passes the naming gate; the open problems are listed, not hidden', () => {
  assert.equal(framework.length, registry.owners.find(({id}) => id === 'framework').names.length, 'every Framework component is read');
  const problems = check({today: new Date().toISOString().slice(0, 10)});
  const {fresh, listed, gone} = splitOpen(problems, packages.open);
  assert.deepEqual(fresh, [], 'a problem the open list does not name');
  assert.deepEqual(gone, [], 'a listed open problem is fixed: take its row out of package-tags.json open');
  assert.equal(listed.length, packages.open.length);
  assert.ok(!problems.some((line) => line.startsWith('framework ')), 'SIMAI Framework itself has no open naming problem');
  for (const row of packages.open) {
    assert.ok(row.owner && row.gap && row.since && row.fix, `open row says who fixes it and how: ${row.problem}`);
    assert.ok(packages.packages.some(({id, repository}) => row.problem.startsWith(`${id} `) && repository === row.owner), `the owner is the package's repository: ${row.problem}`);
  }
});

test('a package passport family is the first word of its tag too (NM-5 in the packages)', () => {
  const withFamily = (id, tag, family) => ({...packages, packages: packages.packages.map((pkg) => (pkg.id === id ? {...pkg, families: {...pkg.families, [tag]: family}} : pkg))});
  const before = new Set(run());
  const added = run({packages: withFamily('chart', 'sf-chart-line', 'graph')}).filter((line) => !before.has(line));
  assert.deepEqual(added, ['chart sf-chart-line: its passport names family "graph", the first word of the tag is "chart" (family first, C174)']);
  const fixed = check({packages: withFamily('view', 'sf-view-flow', 'view')});
  assert.ok(splitOpen(fixed, packages.open).gone.includes('view sf-view-flow: its passport names family "record", the first word of the tag is "view" (family first, C174)'), 'a fixed package is reported, so its row is taken out');
  const unread = {...packages, packages: packages.packages.map((pkg) => (pkg.id === 'chart' ? {...pkg, tags: [...pkg.tags, 'sf-chart-flow']} : pkg))};
  assert.ok(run({packages: unread}).includes('chart sf-chart-flow: no passport family read for it'));
});

test('tag names never carry BEM marks, wherever they are declared (C174 point 4)', () => {
  assert.ok(BEM_MARK.test('sf-list__item') && BEM_MARK.test('sf-button--ghost') && !BEM_MARK.test('sf-list-item'));
  const before = new Set(run());
  const fresh = (change) => run(change).filter((line) => !before.has(line));
  assert.deepEqual(fresh({framework: [...framework, {folder: 'list__row', tag: 'sf-list__row', family: 'list'}]}),
    ['framework sf-list__row: a tag never carries the BEM marks __ or -- (C174 point 4)']);
  const withPro = (change) => ({...packages, packages: packages.packages.map((pkg) => (pkg.id === 'pro' ? {...pkg, ...change(pkg)} : pkg))});
  assert.deepEqual(fresh({packages: withPro((pkg) => ({former_tags: [...pkg.former_tags, {from: 'sf-view--old', to: 'sf-view', remove_after: '2027-01-01'}]}))}),
    ['pro former tag sf-view--old: a tag never carries the BEM marks __ or -- (C174 point 4)']);
  assert.deepEqual(fresh({tagAliases: [...tagAliases, {from: 'sf-alert__bar', to: 'sf-alert-bar', since: '2026-11-16', remove_after: '2027-01-01'}]}),
    ['framework alias sf-alert__bar: a tag never carries the BEM marks __ or -- (C174 point 4)']);
});

test('a tag in two packages needs a declared alias; an old name points to one shipped tag', () => {
  const before = new Set(run());
  const fresh = (change) => run(change).filter((line) => !before.has(line));
  // The five old Pro names (NM-3) are declared: the Framework table and the
  // packages name the same new tag, and that tag is shipped.
  for (const from of ['sf-table', 'sf-data-view', 'sf-property-view', 'sf-thread-list', 'sf-content-editor']) {
    const row = tagAliases.find((alias) => alias.from === from);
    assert.equal(row?.package, 'pro', `${from}: the Framework row names the package that ships ${row?.to}`);
  }
  assert.equal(tagAliases.find(({from}) => from === 'sf-change-confirm')?.to, 'sf-confirm-change', 'sf-change-confirm stays the Framework\'s own alias');
  assert.deepEqual(fresh({tagAliases: [...tagAliases, {from: 'sf-grid', to: 'sf-view-grid', since: '2026-11-16', remove_after: '2027-01-01'}]}),
    ['framework former tag sf-grid: it names sf-view-grid, which no package ships']);
  const twice = {...packages, packages: packages.packages.map((pkg) => (pkg.id === 'view' ? {...pkg, former_tags: pkg.former_tags.map((row) => (row.from === 'sf-table' ? {...row, to: 'sf-view'} : row))} : pkg))};
  assert.deepEqual(fresh({packages: twice}), ['former tag sf-table: framework names sf-view-table, view names sf-view']);
  const shadow = {...packages, packages: packages.packages.map((pkg) => (pkg.id === 'pro' ? {...pkg, alias_elements: [{element: 'sf-table', of: 'sf-list-feed', owner: 'framework', remove_after: '2027-01-01'}]} : pkg))};
  assert.ok(run({packages: shadow}).includes('pro alias element sf-table: of sf-list-feed, but framework names sf-view-table'));
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
  const withTag = (id, tag) => ({...packages, packages: packages.packages.map((pkg) => (pkg.id === id ? {...pkg, tags: [...pkg.tags, tag], ...(pkg.families ? {families: {...pkg.families, [tag]: familyOf(tag)}} : {})} : pkg))});
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
