import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';

import {
  DEBT_FILE, GRAPH_SCHEMA, TWINS_FILE, TWIN_DEBT_FILE, buildGraph, checkGraph, graphGate, impactOf, readContracts,
} from '../scripts/dependency-graph.mjs';
import {collectUnits, readCommittedTree} from '../scripts/linkage.mjs';

// Owner decisions C249-C251 (2026-11-16): one dependency graph built at every
// pair, the declared/drawn gate over dated debt, and plain/Smart twins.
const root = resolve(import.meta.dirname, '..');
const head = readCommittedTree(root, 'HEAD');
const collected = collectUnits(head.tree);
const contracts = readContracts(root);
const declaredTwins = contracts.twins.pairs.filter((pair) => pair.smart);
const graph = buildGraph(head.tree, {revision: head.revision, units: collected.units, twins: declaredTwins});
const byId = new Map(graph.nodes.map((node) => [node.id, node]));

// The tree with some files changed, as a pair build would read it.
const withFiles = (changes) => {
  const tree = new Map(head.tree);
  for (const [file, change] of Object.entries(changes)) tree.set(file, Buffer.from(change(tree.get(file).toString('utf8')), 'utf8'));
  return tree;
};
const problemsOf = (tree, options = {}) => checkGraph(buildGraph(tree, {revision: head.revision, units: collected.units, twins: declaredTwins}), contracts, options).problems;

test('the graph has the Mirai Graph shape: nodes id/type/version, edges from/to/kind/source', () => {
  assert.equal(graph.schema, GRAPH_SCHEMA);
  assert.equal(graph.revision, head.revision);
  for (const node of graph.nodes) {
    assert.match(node.id, /^[a-z]+\.[a-z0-9.-]+$/u);
    assert.equal(typeof node.type, 'string');
    assert.ok('version' in node, `${node.id} has a version field`);
    if (node.declared) assert.match(node.version, /^\d+\.\d+\.\d+$/u, `${node.id} is declared and versioned`);
  }
  const kinds = new Set(['depends', 'uses', 'relation', 'loads', 'twin']);
  for (const edge of graph.edges) {
    assert.ok(byId.has(edge.from) && byId.has(edge.to), `${edge.from} -> ${edge.to} joins two nodes`);
    assert.ok(kinds.has(edge.kind), edge.kind);
    assert.equal(typeof edge.source, 'string');
  }
  for (const kind of kinds) assert.ok(graph.stats.by_kind[kind] > 0, `edges of kind ${kind}`);
});

test('every edge but a twin has its reverse link, and only those', () => {
  for (const node of graph.nodes) {
    const out = new Set(graph.edges.filter((edge) => edge.from === node.id && edge.kind !== 'twin').map((edge) => edge.to));
    const into = new Set(graph.edges.filter((edge) => edge.to === node.id && edge.kind !== 'twin').map((edge) => edge.from));
    assert.deepEqual(node.uses, [...out].sort(), `${node.id} uses`);
    assert.deepEqual(node.used_by, [...into].sort(), `${node.id} used_by`);
  }
});

test('the graph is built from the three declarations and the code', () => {
  // A passport dependency, a manifest's composition.uses, a component.json relation.
  const quantity = JSON.parse(head.tree.get('src/smart/input-quantity/smart.manifest.json').toString('utf8'));
  for (const unit of quantity.composition.uses) assert.ok(graph.edges.some((e) => e.from === 'smart.input-quantity' && e.to === unit && e.kind === 'uses'), unit);
  const passport = JSON.parse(head.tree.get('src/component/tooltip/passport.json').toString('utf8'));
  for (const {id} of passport.dependencies) assert.ok(graph.edges.some((e) => e.from === 'component.tooltip' && e.to === id && e.kind === 'depends'), id);
  assert.ok(graph.edges.some((e) => e.from === 'smart.input-quantity' && e.to === 'component.quantity' && e.kind === 'relation'));
  assert.ok(graph.edges.some((e) => e.from === 'smart.input-quantity' && e.to === 'component.quantity' && e.kind === 'loads'));
});

test('the build is deterministic', () => {
  const again = buildGraph(head.tree, {revision: head.revision, units: collected.units, twins: declaredTwins});
  assert.equal(JSON.stringify(again), JSON.stringify(graph));
});

test('C250 and C251 are green on this revision: every mismatch and divergence is dated debt', () => {
  const {problems} = checkGraph(graph, contracts);
  assert.deepEqual(problems.map((p) => `${p.code}: ${p.message}`), []);
  for (const entry of [...contracts.debt.missing, ...contracts.debt.unused]) assert.match(entry.since, /^\d{4}-\d{2}-\d{2}$/u, `${entry.smart} -> ${entry.unit} is dated`);
  for (const entry of contracts.twinDebt.divergences) assert.match(entry.since, /^\d{4}-\d{2}-\d{2}$/u, `${entry.plain} is dated`);
});

test('C250: a unit drawn but not declared is red', () => {
  // sf-badge drawing a spinner it does not declare.
  const tree = withFiles({'src/smart/badge/js/templates/default.js': (text) => `${text}\nexport const injected = '<span class="sf-spinner"></span>';\n`});
  const problems = problemsOf(tree);
  assert.ok(problems.some((p) => p.code === 'graph-new-missing' && /smart\.badge draws (component|smart)\.spinner/u.test(p.message)), JSON.stringify(problems));
});

test('C250: a unit declared but not drawn is red', () => {
  const tree = withFiles({'src/smart/badge/smart.manifest.json': (text) => {
    const manifest = JSON.parse(text);
    manifest.composition.uses.push('component.quantity');
    return JSON.stringify(manifest);
  }});
  const problems = problemsOf(tree);
  assert.ok(problems.some((p) => p.code === 'graph-new-unused' && /smart\.badge declares component\.quantity/u.test(p.message)), JSON.stringify(problems));
});

test('C250: fixed debt still listed is red', () => {
  const debt = contracts.debt.missing.find((entry) => entry.smart === 'smart.badge');
  assert.ok(debt, `${DEBT_FILE} lists a smart.badge mismatch`);
  const tree = withFiles({'src/smart/badge/smart.manifest.json': (text) => {
    const manifest = JSON.parse(text);
    manifest.composition.uses.push(debt.unit);
    return JSON.stringify(manifest);
  }});
  const problems = problemsOf(tree);
  assert.ok(problems.some((p) => p.code === 'graph-debt-fixed' && p.message.includes(`smart.badge -> ${debt.unit}`)), JSON.stringify(problems));
});

test('C251: the twins are declared, and a new divergence or a fixed one is red', () => {
  assert.equal(declaredTwins.length, graph.stats.twins, `${TWINS_FILE} declares every twin pair`);
  const debtless = {...contracts, twinDebt: {divergences: contracts.twinDebt.divergences.slice(1)}};
  const dropped = contracts.twinDebt.divergences[0];
  assert.ok(checkGraph(graph, debtless).problems.some((p) => p.code === 'twin-new-divergence' && p.id === dropped.plain), `${TWIN_DEBT_FILE} without ${dropped.plain}`);
  const extra = {...contracts, twinDebt: {divergences: [...contracts.twinDebt.divergences, {plain: 'component.alerts', smart: 'smart.alert', since: '2026-11-16', codes: ['size-ladder']}]}};
  assert.ok(checkGraph(graph, extra).problems.some((p) => p.code === 'twin-divergence-fixed' && p.id === 'component.alerts'));
});

test('C251: one twin changed without the other is red unless marked intended', () => {
  const twin = graph.checks.twins.find((t) => t.plain === 'component.quantity');
  const changes = {from: {release: 'ui-000000000000', revision: '0'.repeat(40)}, to: {}, added: [], removed: [], dependencies_changed: [], violations: [],
    changed: [{id: twin.plain, from_version: '0.0.1', to_version: byId.get(twin.plain).version, step: 'major'}]};
  const red = checkGraph(graph, contracts, {changes}).problems;
  assert.ok(red.some((p) => p.code === 'twin-one-sided-change' && p.id === twin.plain && p.message.includes(twin.smart)), JSON.stringify(red));
  const marked = {...contracts, twinIntent: {marks: [{unit: twin.plain, version: byId.get(twin.plain).version, twin: twin.smart, reason: 'test', decision: 'C251'}]}};
  assert.deepEqual(checkGraph(graph, marked, {changes}).problems, []);
  const both = {...changes, changed: [...changes.changed, {id: twin.smart, from_version: '0.0.1', to_version: byId.get(twin.smart).version, step: 'major'}]};
  assert.deepEqual(checkGraph(graph, contracts, {changes: both}).problems, []);
});

test('the impact list names the Smart components, the twin and the probes of a changed unit', () => {
  const [row] = impactOf(graph, ['component.quantity'], {root});
  assert.equal(row.twin, 'smart.input-quantity');
  assert.ok(row.smart.includes('smart.input-quantity'));
  assert.ok(row.probes.length > 0);
  for (const probe of row.probes) assert.ok(existsSync(join(root, 'tests', 'browser', `${probe}.browser.mjs`)), probe);
});

test('the gate against the previous pair is green when its inventory is at hand', (t) => {
  const result = graphGate({tree: head.tree, revision: head.revision, collected, root});
  if (!result.changes) { t.skip('no released inventory of an ancestor (../ui/contracts/releases or UI_RELEASES_ROOT)'); return; }
  assert.deepEqual(result.problems.map((p) => `${p.code}: ${p.message}`), []);
});

test('linkage.mjs inventory writes the graph beside the inventory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-graph-'));
  try {
    const out = join(dir, 'ui-000000000000.inventory.json');
    const run = spawnSync(process.execPath, [join(root, 'scripts', 'linkage.mjs'), 'inventory', '--out', out, '--release', 'ui-000000000000'], {cwd: root, encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr);
    const shipped = JSON.parse(readFileSync(join(dir, 'ui-000000000000.graph.json'), 'utf8'));
    assert.equal(shipped.release, 'ui-000000000000');
    assert.equal(shipped.stats.edges, graph.stats.edges);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
