import assert from 'node:assert/strict';
import test from 'node:test';

// SF.EarlyPort (core/js/early-port.js; standard simai.smart-component §4.9
// proposal, stand 27 variant c): a port declared on the element as a
// data-sf-port island. Core sends its first call when it runs and hands the
// element the port when it is defined; the port's first matching call takes
// that answer. One request; a call that differs asks again; a malformed island
// changes nothing; a page with no island is left as it was.

const {installEarlyPort, callKey, canonical, islandOf} = await import('../src/core/js/early-port.js');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeWindow() {
  const defined = new Map();
  const waiters = new Map();
  const calls = [];
  const warnings = [];
  const listeners = {};
  const answers = [];
  const all = [];
  const win = {
    console: {warn: (...args) => warnings.push(args.map(String).join(' '))},
    performance: {now: () => win.clock},
    clock: 0,
    location: {pathname: '/admin/catalog'},
    AbortController,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    dispatch(type, event) { (listeners[type] || []).forEach((fn) => fn(event)); },
    customElements: {
      get: (tag) => defined.get(tag),
      whenDefined: (tag) => new Promise((resolve) => (waiters.get(tag) ?? waiters.set(tag, []).get(tag)).push(resolve)),
      define(tag, ctor) {
        defined.set(tag, ctor);
        (waiters.get(tag) || []).forEach((resolve) => resolve(ctor));
        waiters.delete(tag);
      },
    },
    // The host: answers in order; `hold` keeps an answer until released.
    fetch(url, init) {
      const body = JSON.parse(init.body);
      const call = {url, init, body};
      calls.push(call);
      const reply = answers.shift() ?? ((sent) => ({answer: 'applied', sequence: sent.payload?.sequence ?? null, data: {records: [{id: calls.length}]}}));
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => { call.aborted = true; reject(Object.assign(new Error('aborted'), {name: 'AbortError'})); });
        Promise.resolve().then(() => reply(body)).then((value) => {
          if (value instanceof Error) reject(value);
          else resolve({json: async () => value});
        });
      });
    },
    document: {
      readyState: 'interactive',
      querySelectorAll(selector) {
        assert.equal(selector, 'script[type="application/json"][data-sf-port]');
        return all.filter((node) => node.localName === 'script' && node.attrs.has('data-sf-port') && node.isConnected);
      },
      querySelector() { return null; },
      addEventListener() {},
    },
  };
  return {win, calls, warnings, answers, all, define: (tag, ctor = class {}) => win.customElements.define(tag, ctor)};
}

function node(world, localName, {attrs = {}, text = '', parent = null} = {}) {
  const n = {
    localName, attrs: new Map(Object.entries(attrs)), textContent: text, children: [], parentElement: parent, isConnected: true,
    get type() { return this.attrs.get('type') ?? ''; },
    hasAttribute(name) { return this.attrs.has(name); },
    getAttribute(name) { return this.attrs.get(name) ?? null; },
    querySelectorAll() { const out = []; const walk = (x) => x.children.forEach((c) => { out.push(c); walk(c); }); walk(this); return out; },
  };
  if (parent) parent.children.push(n);
  world.all.push(n);
  return n;
}

const QUERY = {filters: {}, search: '', sort: [], page: 1, per_page: 20};
const DECLARED = {
  port: 'simai.dataview-port', version: '1.12.0', url: '/host/cms/dataview', capabilities: ['row-actions', 'count-on-request'],
  first: {intent: 'query.change', payload: {query: QUERY}},
};

// An element that takes its port by the base action, as the Smart base gives it.
function listElement(world, declared = DECLARED, {island = true, raw = null} = {}) {
  const element = node(world, 'sf-data-view', {attrs: {id: 'list'}});
  if (island) node(world, 'script', {attrs: {type: 'application/json', 'data-sf-port': ''}, text: raw ?? JSON.stringify(declared), parent: element});
  node(world, 'sf-pagination', {attrs: {slot: 'pagination'}, parent: element});
  element.connected = [];
  element.connectPort = (params) => { element.connected.push(params.port); element.sfPort = params.port; return {outcome: 'applied'}; };
  return element;
}

test('canonical JSON and the call key: keys sorted, the asker\'s sequence and reason left out', () => {
  assert.equal(canonical({b: 1, a: [2, {d: null, c: undefined}]}), '{"a":[2,{"c":null,"d":null}],"b":1}');
  const one = callKey({port: 'p', version: '1', intent: 'query.change', payload: {query: {a: 1, b: 2}, sequence: 4, reason: 'connected'}});
  const two = callKey({port: 'p', version: '1', intent: 'query.change', payload: {query: {b: 2, a: 1}}});
  assert.equal(one, two);
  assert.notEqual(one, callKey({port: 'p', version: '1.1', intent: 'query.change', payload: {query: {a: 1, b: 2}}}));
});

test('one request: the first call leaves when core runs, the element takes it when defined (§4.9)', async () => {
  const world = fakeWindow();
  const element = listElement(world);
  const api = installEarlyPort(world.win);
  assert.equal(world.win.SF.EarlyPort, api);
  assert.equal(world.calls.length, 1, 'the early call left before the element was defined');
  assert.deepEqual(world.calls[0].body, {intent: 'query.change', payload: {query: QUERY, sequence: 0}, page: '/admin/catalog'});
  assert.equal(world.calls[0].init.credentials, 'same-origin');
  assert.ok(islandOf(element), 'the island stays: the element reads its capabilities and first query from it');
  assert.deepEqual([...api.firstTags()].sort(), ['sf-data-view', 'sf-pagination']);

  world.define('sf-data-view');
  await tick();
  assert.equal(element.connected.length, 1, 'core handed the port in the definition task');
  const port = element.connected[0];
  assert.equal(port.port, 'simai.dataview-port');
  assert.equal(port.version, '1.12.0');
  assert.deepEqual(port.capabilities, ['row-actions', 'count-on-request']);

  const answer = await port.raise('query.change', {sequence: 3, query: {...QUERY}, reason: 'host-connected'});
  assert.equal(answer.answer, 'applied');
  assert.equal(answer.sequence, 3, 'the early answer carries the asker\'s sequence');
  assert.equal(world.calls.length, 1, 'one request in all');
  assert.deepEqual(api.firstTags(), new Set(), 'nothing waits once the element is defined');

  // Taken once: the next call asks the port.
  const next = await port.raise('query.change', {sequence: 4, query: {...QUERY, page: 2}, reason: 'page'});
  assert.equal(next.sequence, 4);
  assert.equal(world.calls.length, 2);
  assert.deepEqual(api.log.map((entry) => entry.what), ['declare', 'start', 'connect', 'adopt']);
});

test('a query that changed before the element took the answer asks again, and the early call is let go', async () => {
  const world = fakeWindow();
  let release;
  world.answers.push(() => new Promise((resolve) => { release = resolve; }));
  const element = listElement(world);
  installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  const port = element.connected[0];
  // The person kept page size 40: the view's first query is not the declared one.
  const answer = await port.raise('query.change', {sequence: 1, query: {...QUERY, per_page: 40}, reason: 'connected'});
  assert.equal(world.calls.length, 2);
  assert.equal(world.calls[0].aborted, true, 'the early call still running is aborted');
  assert.equal(world.calls[1].body.payload.query.per_page, 40);
  assert.equal(answer.sequence, 1);
  release?.({answer: 'applied', sequence: 0, data: {records: []}});
  assert.deepEqual(world.win.SF.EarlyPort.log.map((entry) => entry.what).slice(-1), ['mismatch']);
});

test('an early answer too old, or from a page restored from the back/forward cache, is not taken', async () => {
  const world = fakeWindow();
  const element = listElement(world);
  installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  world.win.clock = 10001;
  await element.connected[0].raise('query.change', {sequence: 1, query: {...QUERY}});
  assert.equal(world.calls.length, 2, 'older than 10 s: asked again');

  const again = fakeWindow();
  const restored = listElement(again);
  installEarlyPort(again.win);
  again.win.dispatch('pageshow', {persisted: true});
  again.define('sf-data-view');
  await tick();
  await restored.connected[0].raise('query.change', {sequence: 1, query: {...QUERY}});
  assert.equal(again.calls.length, 2, 'restored from the cache: asked again');
});

test('a later call answered out of turn: the early answer keeps its own sequence, the element drops it', async () => {
  // «late» (stand 27): the person searches while the early answer is on its way.
  const world = fakeWindow();
  let release;
  world.answers.push(() => new Promise((resolve) => { release = resolve; }));
  const element = listElement(world);
  installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  const port = element.connected[0];
  const first = port.raise('query.change', {sequence: 1, query: {...QUERY}, reason: 'connected'});
  const search = await port.raise('query.change', {sequence: 2, query: {...QUERY, search: 'invoice'}, reason: 'search'});
  assert.equal(search.sequence, 2);
  release({answer: 'applied', sequence: 0, data: {records: []}});
  assert.equal((await first).sequence, 1, 'the superseded answer is the first call\'s, which the element\'s sequence check drops');
  assert.equal(world.calls.length, 2);
});

test('an early call that failed is asked again, not reported as the element\'s failure', async () => {
  const world = fakeWindow();
  world.answers.push(() => new Error('offline'));
  const element = listElement(world);
  installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  const answer = await element.connected[0].raise('query.change', {sequence: 1, query: {...QUERY}});
  assert.equal(answer.answer, 'applied');
  assert.equal(world.calls.length, 2);
});

test('a malformed island is warned about and changes nothing: no call, no port, the page connects its own', async () => {
  for (const raw of ['{"port": "simai.dataview-port", ', '[]', '{"url": "/x"}', '{"port": "p", "url": 5}']) {
    const world = fakeWindow();
    const element = listElement(world, null, {raw});
    const api = installEarlyPort(world.win);
    world.define('sf-data-view');
    await tick();
    assert.equal(world.calls.length, 0, raw);
    assert.equal(element.connected.length, 0, raw);
    assert.equal(world.warnings.length, 1, raw);
    assert.deepEqual(api.firstTags(), new Set(), raw);
  }
  // A first call without an intent: the port is still declared, no early call.
  const world = fakeWindow();
  const element = listElement(world, {...DECLARED, first: {payload: {}}});
  installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  assert.equal(world.calls.length, 0);
  assert.equal(element.connected.length, 1);
  assert.equal(world.warnings.length, 1);
});

test('no island, no change: nothing is sent, connected or preferred', async () => {
  const world = fakeWindow();
  const element = listElement(world, null, {island: false});
  const api = installEarlyPort(world.win);
  world.define('sf-data-view');
  await tick();
  assert.equal(world.calls.length, 0);
  assert.equal(element.connected.length, 0);
  assert.deepEqual(api.firstTags(), new Set());
  assert.equal(api.take({port: 'simai.dataview-port', url: '/host/cms/dataview', intent: 'query.change', payload: {}}), null);
  assert.deepEqual(world.warnings, []);
});

test('a port the page connected first is left alone', async () => {
  const world = fakeWindow();
  const element = listElement(world);
  installEarlyPort(world.win);
  element.sfPort = {port: 'simai.dataview-port', raise() {}};
  world.define('sf-data-view');
  await tick();
  assert.equal(element.connected.length, 0);
});

test('an island without a url takes its port from the page\'s registry, registered before or after core', async () => {
  const world = fakeWindow();
  const {url, ...declared} = DECLARED;
  void url;
  const element = listElement(world, declared);
  const api = installEarlyPort(world.win);
  assert.equal(world.calls.length, 0, 'no url, no adapter yet: nothing sent');
  const raised = [];
  const adapter = {port: 'simai.dataview-port', version: '1.12.0', capabilities: ['row-actions'],
    raise: async (intent, payload) => { raised.push([intent, payload]); return {answer: 'applied', sequence: payload.sequence, data: {}}; }};
  assert.equal(api.register('simai.dataview-port', adapter), true);
  assert.equal(raised.length, 1, 'the early call is the adapter\'s');
  world.define('sf-data-view');
  await tick();
  const port = element.connected[0];
  assert.deepEqual(port.capabilities, ['row-actions']);
  const answer = await port.raise('query.change', {sequence: 7, query: {...QUERY}});
  assert.equal(answer.sequence, 7);
  assert.equal(raised.length, 1, 'one call to the host');
  await port.raise('record.open', {record_id: 'a'});
  assert.equal(raised.length, 2);
});

test('connect: false starts the call only; the page\'s own adapter takes it; first.body is sent as is with a CSRF header', async () => {
  const world = fakeWindow();
  world.win.document.querySelector = (selector) => (selector === 'meta[name="csrf-token"]' ? {getAttribute: () => 'tok'} : null);
  const element = listElement(world, {...DECLARED, connect: false, csrf: 'meta:csrf-token',
    first: {...DECLARED.first, body: {scope_ref: 's1', structure_id: 9, query: QUERY}}});
  const api = installEarlyPort(world.win);
  assert.deepEqual(world.calls[0].body, {scope_ref: 's1', structure_id: 9, query: QUERY});
  assert.equal(world.calls[0].init.headers['x-csrf-token'], 'tok');
  world.define('sf-data-view');
  await tick();
  assert.equal(element.connected.length, 0);
  const taken = api.take({port: DECLARED.port, version: DECLARED.version, url: DECLARED.url, intent: 'query.change', payload: {query: {...QUERY}, sequence: 5}});
  assert.ok(taken);
  assert.equal((await taken).sequence, 5);
  assert.equal(api.take({port: DECLARED.port, version: DECLARED.version, url: DECLARED.url, intent: 'query.change', payload: {query: QUERY}}), null, 'taken once');
});

test('installed once: a second copy finds the first', () => {
  const world = fakeWindow();
  listElement(world);
  const one = installEarlyPort(world.win);
  const two = installEarlyPort(world.win);
  assert.equal(one, two);
  assert.equal(world.calls.length, 1);
});
