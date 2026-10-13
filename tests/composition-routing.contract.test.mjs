import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BUILTIN_PORT_MANIFESTS, BUILTIN_TYPE_MANIFESTS } from '../src/core/js/composition/builtins.mjs';
import { createRegistry, normalize, render, stableStringify, validate } from '../src/core/js/composition/index.mjs';
import {
  CompositionRouteController,
  PORT_OUTPUT_EVENT,
  ROUTING_LIMITS,
  checkPortValue,
  createPortRegistry,
  parseRoutesAttribute,
} from '../src/core/js/composition/routing.mjs';
import { ROUTING_PORT_BINDINGS, ROUTING_RENDERERS, ROUTING_TYPES } from './fixtures/composition-capabilities/cases/routing.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const registry = createRegistry([...BUILTIN_TYPE_MANIFESTS, ...ROUTING_TYPES], ROUTING_RENDERERS);
const options = { ports: { manifests: BUILTIN_PORT_MANIFESTS, bindings: ROUTING_PORT_BINDINGS } };

// Minimal endpoint that implements the published sf-table port protocol.
class FakeTable extends EventTarget {
  static sfPorts = { outputs: { selection: 'record-ids.v1' }, inputs: { context: 'record-ids.v1' } };

  constructor(name, host) {
    super();
    this.name = name;
    this.host = host;
    this.received = [];
    this.respond = null;
  }

  sfPortInput(port, value, meta) {
    this.received.push({ port, value, sequence: meta.sequence, meta });
    return this.respond ? this.respond(value, meta) : undefined;
  }

  emit(value) {
    this.host.dispatchEvent(new CustomEvent(PORT_OUTPUT_EVENT, { detail: { port: 'selection', value, source: this.name } }));
  }
}

function harness(routes, names = ['orders', 'lines']) {
  const host = new EventTarget();
  const endpoints = new Map(names.map((name) => [name, new FakeTable(name, host)]));
  const states = [];
  const controller = new CompositionRouteController(host, routes, {
    sourceEndpoint: (event) => event.detail.source,
    targetEndpoint: (name) => endpoints.get(name) || null,
    onState: (state) => states.push(state),
  });
  return { host, endpoints, controller, states };
}

const typedRoute = (id, from, to) => ({ id, from: { endpoint: from, port: 'selection', value: 'record-ids.v1' }, to: { endpoint: to, port: 'context', value: 'record-ids.v1' } });

test('publishes the sf-table port manifest with closed value types', () => {
  const ports = createPortRegistry(BUILTIN_PORT_MANIFESTS, { bindings: ROUTING_PORT_BINDINGS });
  const table = ports.elements.get('sf-table');
  assert.equal(table.outputs.selection.value, 'record-ids.v1');
  assert.equal(table.inputs.context.value, 'record-ids.v1');
  assert.throws(() => createPortRegistry([{ ...BUILTIN_PORT_MANIFESTS[0], element: 'sf-x', outputs: { a: { value: 'script.v1' } } }]), /value_type_unknown/u);
  assert.throws(() => createPortRegistry(BUILTIN_PORT_MANIFESTS, { bindings: { 'example.x': 'sf-missing' } }), /binding_unknown/u);
});

test('value types reject coercion, duplicates, control characters and oversize values', () => {
  assert.deepEqual(checkPortValue('record-ids.v1', ['a_1', 'Заказ', 0, 42]), ['a_1', 'Заказ', 0, 42]);
  assert.ok(Object.isFrozen(checkPortValue('record-ids.v1', ['a'])));
  for (const bad of [['1', '1'], [''], [`a${String.fromCharCode(0)}b`], [1.5], [2 ** 53], 'a', null, [{ id: 1 }], Array.from({ length: 1001 }, (_, index) => index)]) {
    assert.throws(() => checkPortValue('record-ids.v1', bad), TypeError, JSON.stringify(bad));
  }
  assert.doesNotThrow(() => checkPortValue('record-ids.v1', ['1', 1]));
  assert.throws(() => checkPortValue('text.v1', 1), TypeError);
  assert.throws(() => checkPortValue('boolean.v1', 'true'), TypeError);
  assert.throws(() => checkPortValue('unknown.v1', 1), TypeError);
});

test('routing conformance fixtures reproduce exact outcomes', async () => {
  const fixture = await readJson('src/core/contracts/composition-routing-v1/fixtures/routing.json');
  assert.ok(fixture.cases.filter(({ expect }) => expect === 'valid').length >= 5);
  assert.ok(fixture.cases.filter(({ expect }) => expect === 'invalid').length >= 18);
  for (const entry of fixture.cases) {
    const checked = validate(entry.document, registry, options);
    assert.deepEqual([...new Set(checked.diagnostics.map(({ code }) => code))].sort(), entry.diagnostics, entry.id);
    if (entry.expect === 'valid') {
      const normalized = await normalize(entry.document, registry, options);
      assert.equal(`sha256:${normalized.digest}`, entry.digest, entry.id);
      assert.equal(stableStringify(normalized.document), entry.canonical, entry.id);
      assert.equal((await render(entry.document, { registry, options })).html, entry.html, entry.id);
    }
  }
});

test('renders typed routes and endpoint markers only where declared', async () => {
  const fixture = await readJson('src/core/contracts/composition-routing-v1/fixtures/routing.json');
  const master = fixture.cases.find(({ id }) => id === 'positive.master-detail');
  const output = await render(master.document, { registry, options });
  assert.deepEqual(output.hydration.map(({ element }) => element), ['sf-table', 'sf-table', 'sf-composition-scope']);
  const attribute = /data-sf-routes="([^"]*)"/u.exec(output.html)[1].replaceAll('&quot;', '"');
  assert.deepEqual(parseRoutesAttribute(attribute), [typedRoute('order-lines', 'orders', 'lines')]);
  const plain = await render((await readJson('tests/fixtures/composition/columns.json')));
  assert.doesNotMatch(plain.html, /data-sf-endpoint|sf-composition-scope/u);
});

test('rendered route attributes cannot smuggle untyped or mismatched routes', () => {
  assert.equal(parseRoutesAttribute('not json'), null);
  assert.equal(parseRoutesAttribute(JSON.stringify([{ ...typedRoute('r', 'a', 'b'), to: { endpoint: 'b', port: 'context', value: 'text.v1' } }])), null);
  assert.equal(parseRoutesAttribute(JSON.stringify([{ ...typedRoute('r', 'a', 'b'), from: { endpoint: '/api', port: 'x', value: 'record-ids.v1' } }])), null);
  assert.equal(parseRoutesAttribute(JSON.stringify(Array.from({ length: ROUTING_LIMITS.maxRoutesPerScope + 1 }, (_, index) => typedRoute(`r-${index}`, 'a', 'b')))), null);
});

test('delivers one typed immutable value per output and ignores unrelated ports', () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  controller.connect();
  const ids = ['a', 7];
  endpoints.get('orders').emit(ids);
  ids.push('mutated');
  const lines = endpoints.get('lines');
  assert.equal(lines.received.length, 1);
  assert.deepEqual(lines.received[0].value, ['a', 7]);
  assert.ok(Object.isFrozen(lines.received[0].value));
  endpoints.get('orders').host.dispatchEvent(new CustomEvent(PORT_OUTPUT_EVENT, { detail: { port: 'other', value: [], source: 'orders' } }));
  endpoints.get('lines').emit(['x']);
  assert.equal(lines.received.length, 1);
  assert.equal(controller.getState('order-lines').status, 'settled');
});

test('rejects invalid payloads before they reach the target', () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  controller.connect();
  endpoints.get('orders').emit(['dup', 'dup']);
  endpoints.get('orders').emit('not-a-list');
  assert.equal(endpoints.get('lines').received.length, 0);
  assert.equal(controller.getState('order-lines').error, 'value_invalid');
  assert.equal(controller.counters.rejected, 2);
});

test('latest result wins when asynchronous answers arrive out of order', async () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  const lines = endpoints.get('lines');
  const resolvers = [];
  lines.respond = () => new Promise((done) => resolvers.push(done));
  controller.connect();
  endpoints.get('orders').emit(['first']);
  endpoints.get('orders').emit(['second']);
  endpoints.get('orders').emit(['third']);
  assert.deepEqual(lines.received.map(({ sequence }) => sequence), [1, 2, 3]);
  assert.equal(lines.received[0].meta.signal.aborted, true);
  assert.equal(lines.received[1].meta.signal.aborted, true);
  assert.equal(lines.received[2].meta.isLatest(), true);
  resolvers[2]();
  await Promise.resolve(); await Promise.resolve();
  resolvers[0]();
  resolvers[1]();
  await Promise.resolve(); await Promise.resolve();
  const state = controller.getState('order-lines');
  assert.equal(state.status, 'settled');
  assert.equal(state.sequence, 3);
  assert.equal(controller.counters.stale, 2);
});

test('connect is idempotent and remount never duplicates subscriptions', () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  assert.equal(controller.connect(), true);
  assert.equal(controller.connect(), false);
  endpoints.get('orders').emit(['a']);
  assert.equal(endpoints.get('lines').received.length, 1);
  for (let index = 0; index < 5; index += 1) {
    controller.disconnect();
    endpoints.get('orders').emit(['ignored']);
    controller.connect();
  }
  endpoints.get('orders').emit(['b']);
  assert.equal(endpoints.get('lines').received.length, 2);
  assert.ok(endpoints.get('lines').received[1].sequence > endpoints.get('lines').received[0].sequence, 'sequence stays monotonic across remounts');
});

test('disconnect aborts pending work and a late answer cannot settle a disposed route', async () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  let finish;
  endpoints.get('lines').respond = () => new Promise((done) => { finish = done; });
  controller.connect();
  endpoints.get('orders').emit(['a']);
  const meta = endpoints.get('lines').received[0].meta;
  controller.disconnect();
  assert.equal(meta.signal.aborted, true);
  assert.equal(meta.isLatest(), false);
  finish();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.getState('order-lines').status, 'disposed');
  assert.equal(controller.counters.stale, 1);
});

test('reports unresolved endpoints and incompatible targets instead of guessing', () => {
  const missing = harness([typedRoute('r', 'orders', 'gone')]);
  missing.controller.connect();
  missing.endpoints.get('orders').emit(['a']);
  assert.equal(missing.controller.getState('r').error, 'endpoint_unresolved');
  const mismatch = harness([{ ...typedRoute('r', 'orders', 'lines'), to: { endpoint: 'lines', port: 'context', value: 'text.v1' }, from: { endpoint: 'orders', port: 'selection', value: 'text.v1' } }]);
  mismatch.controller.connect();
  mismatch.endpoints.get('orders').host.dispatchEvent(new CustomEvent(PORT_OUTPUT_EVENT, { detail: { port: 'selection', value: 'x', source: 'orders' } }));
  assert.equal(mismatch.controller.getState('r').error, 'port_mismatch');
  assert.equal(mismatch.endpoints.get('lines').received.length, 0);
});

test('synchronous re-emission is bounded by the reentrancy limit', () => {
  const names = Array.from({ length: 12 }, (_, index) => `n-${index}`);
  const routes = names.slice(0, -1).map((name, index) => typedRoute(`r-${index}`, name, names[index + 1]));
  const { endpoints, controller } = harness(routes, names);
  for (const endpoint of endpoints.values()) endpoint.respond = (value) => { endpoint.emit(value); };
  controller.connect();
  endpoints.get('n-0').emit(['x']);
  const errors = routes.map(({ id }) => controller.getState(id)).filter((state) => state.error === 'reentrancy_limit');
  assert.equal(errors.length, 1);
  assert.equal(endpoints.get('n-8').received.length, 1);
  assert.equal(endpoints.get('n-9').received.length, 0);
});

test('a validated Document never produces a route the runtime would refuse', async () => {
  const fixture = await readJson('src/core/contracts/composition-routing-v1/fixtures/routing.json');
  for (const entry of fixture.cases.filter(({ expect }) => expect === 'valid')) {
    for (const match of entry.html.matchAll(/data-sf-routes="([^"]*)"/gu)) {
      assert.notEqual(parseRoutesAttribute(match[1].replaceAll('&quot;', '"')), null, entry.id);
    }
  }
});

test('Recipe v1 resolves routes to a product type bound through compositionPorts', async () => {
  const { resolveRecipe } = await import('../src/core/js/composition/index.mjs');
  const fixture = await readJson('src/core/contracts/composition-routing-v1/fixtures/routing.json');
  const bound = fixture.cases.find(({ id }) => id === 'positive.product-type-bound-to-published-ports').document;
  const toEntry = (node) => {
    const { id, slots, ...rest } = node;
    const value = (plane) => Object.fromEntries(Object.entries(rest[plane] || {}).map(([key, entry]) => [key, { literal: entry }]));
    const entryNode = { type: rest.type };
    if (rest.props) entryNode.props = value('props');
    if (rest.extensions) entryNode.extensions = rest.extensions;
    if (slots) entryNode.slots = Object.fromEntries(Object.entries(slots).map(([name, children]) => [name, children.map(toEntry)]));
    return { id, node: entryNode };
  };
  const recipe = { schema: 'simai.composition.recipe.v1', id: 'demo.bound-routes', profile: 'ui-layout', locale: 'ru', inputs: {}, root: toEntry(bound.root) };
  const context = {
    trustedContext: { scope: 'example-site' },
    inputs: { schema: 'simai.composition.inputs.v1', scope: 'example-site', values: {} },
    executionContract: { contractDigest: 'sha256:contract', registryDigest: 'sha256:registry', rendererDigest: 'sha256:renderer' },
    ports: { readReference: async () => { throw new Error('no references'); } },
    registry,
  };
  const unbound = await resolveRecipe(recipe, context);
  assert.equal(unbound.document, null);
  assert.equal(unbound.diagnostics[0].code, 'invalid_resolved_document');
  const withPorts = await resolveRecipe(recipe, { ...context, compositionPorts: options.ports });
  assert.deepEqual(withPorts.diagnostics, []);
  const html = (await render(withPorts.document, { registry, options })).html;
  assert.match(html, /<sf-composition-scope data-sf-composition-id="n-[0-9a-f]{64}" data-sf-routes="[^"]*bound-route[^"]*">/u);
  assert.match(html, /<sf-table aria-label="Товары" table-settings-key="example.products" data-sf-endpoint="products"><\/sf-table>/u);
});

test('an invalid newest output makes an older pending delivery stale', async () => {
  const { endpoints, controller } = harness([typedRoute('order-lines', 'orders', 'lines')]);
  let finish;
  endpoints.get('lines').respond = () => new Promise((done) => { finish = done; });
  controller.connect();
  endpoints.get('orders').emit(['a']);
  const meta = endpoints.get('lines').received[0].meta;
  endpoints.get('orders').emit(['dup', 'dup']);
  assert.equal(meta.signal.aborted, true);
  assert.equal(meta.isLatest(), false);
  finish();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.getState('order-lines').status, 'error');
  assert.equal(controller.getState('order-lines').error, 'value_invalid');
});

test('prototype names are never ports, value types or route ids', () => {
  assert.throws(() => checkPortValue('constructor', []), TypeError);
  assert.throws(() => createPortRegistry([{ ...BUILTIN_PORT_MANIFESTS[0], element: 'sf-x', outputs: { a: { value: 'toString', summary: 'x' } } }]), /value_type_unknown/u);
  assert.equal(parseRoutesAttribute(JSON.stringify([{ ...typedRoute('r', 'a', 'b'), from: { endpoint: 'a', port: 'selection', value: 'constructor' }, to: { endpoint: 'b', port: 'context', value: 'constructor' } }])), null);
  assert.equal(parseRoutesAttribute(JSON.stringify([typedRoute('r', 'a', 'b'), typedRoute('r', 'a', 'c')])), null);
});
