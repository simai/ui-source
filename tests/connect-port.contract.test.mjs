import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The base action connect-port {port} (standard simai.smart-component 1.3.8
// §4.1, §4.9): every element made by elementFromManifest or on the Smart base
// takes its host port by connectPort(port), setHostPort its alias; the port is
// kept for the instance's scope and the component's hook runs. SF.Assembly
// hands a port through that action to the parts, at any depth, that declare it.

const {elementFromManifest} = await import('../src/core/js/element-manifest.js');
const {connectPort, installPortAction, portIdOf, portOf} = await import('../src/core/js/host-port.js');
const {AssemblyCore, adaptElement, compile, interfaces, journal} = await import('../src/core/js/assembly/index.mjs');

class FakeBase extends EventTarget {
  static get props() { return {}; }
  constructor() {
    super();
    this.localName = 'sf-ported';
    this.attrs = new Map();
    this.isConnected = false;
    this.updates = [];
  }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); return Boolean(force); }
  closest() { return null; }
  requestComponentUpdate(reason) { this.updates.push(reason); }
  connectedCallback() { this.isConnected = true; }
  get sfScope() { return (this.scope ??= new AbortController()).signal; }
}

const manifest = {
  id: 'smart.ported', tag: 'sf-ported', version: '1.0.0', kind: 'leaf',
  port: {id: 'simai.test-port', version: '1.0'},
  settings: {
    open: {type: 'boolean', default: true},
    quiet: {type: 'boolean', default: false},
  },
  actions: {refresh: {}},
};

test('a port id is its id, or the port an adapter names', () => {
  assert.equal(portIdOf({id: 'a'}), 'a');
  assert.equal(portIdOf({port: 'simai.admin-navigation-port', raise() {}}), 'simai.admin-navigation-port');
  assert.equal(portIdOf({}), '');
  assert.equal(portIdOf(null), '');
});

test('every manifest element gets connect-port; the port is kept on its scope and its hook runs (§4.1, §4.9)', () => {
  const heard = [];
  class Ported extends elementFromManifest(manifest, {base: FakeBase}) {
    onPortConnected(port, {signal}) { heard.push([port, signal]); }
  }
  const element = new Ported();
  assert.equal(typeof element.connectPort, 'function');
  assert.equal(typeof element.setHostPort, 'function');
  assert.equal(element.sfPort, null);

  const port = {id: 'simai.test-port', raise() {}};
  assert.deepEqual(element.connectPort(port), {outcome: 'applied'});
  assert.equal(element.sfPort, port);
  assert.equal(heard.length, 1);
  assert.equal(heard[0][0], port);
  assert.equal(heard[0][1], element.sfScope, 'the hook is given the instance scope');
  assert.ok(element.updates.includes('port'));

  // {port} as one object, the way an action takes its parameters (§4.4).
  const second = {id: 'simai.test-port'};
  assert.deepEqual(element.connectPort({port: second}), {outcome: 'applied'});
  assert.equal(element.sfPort, second);
  // setHostPort is the alias.
  const third = {id: 'simai.test-port'};
  assert.deepEqual(element.setHostPort(third), {outcome: 'applied'});
  assert.equal(element.sfPort, third);
  assert.equal(heard.length, 3);

  // A port the manifest does not declare, and nothing at all, are refused.
  assert.deepEqual(element.connectPort({id: 'simai.other-port'}), {outcome: 'refused', reason: 'other-port'});
  assert.deepEqual(element.connectPort(null), {outcome: 'refused', reason: 'no-port'});
  assert.equal(element.sfPort, third, 'a refused port does not replace the kept one');

  // The scope ends: the port goes with it (§7.7).
  element.scope.abort();
  assert.equal(element.sfPort, null);
});

test('a hook that throws refuses the port and keeps the one before', () => {
  class Picky extends elementFromManifest({...manifest, port: undefined}, {base: FakeBase}) {
    onPortConnected(port) { if (!port.raise) throw new TypeError('no raise'); }
  }
  const element = new Picky();
  const good = {id: 'x', raise() {}};
  assert.deepEqual(element.connectPort(good), {outcome: 'applied'});
  assert.deepEqual(element.connectPort({id: 'x'}), {outcome: 'refused', reason: 'port-unsupported'});
  assert.equal(element.sfPort, good);
});

test('a component written before the base action keeps its own setHostPort as the hook', () => {
  const given = [];
  class Older extends elementFromManifest({...manifest, port: undefined}, {base: FakeBase}) {
    setHostPort(host) {
      if (typeof host?.raise !== 'function') throw new TypeError('a host port with raise is required');
      given.push(host);
      this.hostPort = host;
      return this;
    }
  }
  const element = new Older();
  const host = {port: 'simai.admin-navigation-port', version: '1.0.0', raise() {}};
  // An adapter whose `port` is its id is the port, not {port}.
  assert.deepEqual(element.connectPort(host), {outcome: 'applied'});
  assert.equal(element.hostPort, host);
  assert.equal(element.sfPort, host);
  assert.deepEqual(given, [host]);
  assert.deepEqual(element.connectPort({port: 'x'}), {outcome: 'refused', reason: 'port-unsupported'});

  // An override that calls the base alias does not run itself twice.
  let runs = 0;
  class Polite extends elementFromManifest({...manifest, port: undefined}, {base: FakeBase}) {
    setHostPort(host) { runs += 1; return super.setHostPort(host); }
  }
  const polite = new Polite();
  assert.deepEqual(polite.connectPort({id: 'y'}), {outcome: 'applied'});
  assert.equal(runs, 1);
  assert.equal(polite.sfPort.id, 'y');
});

test('a base that has connect-port keeps its own', () => {
  class Own extends FakeBase { connectPort() { return {outcome: 'applied', own: true}; } }
  const element = new (elementFromManifest(manifest, {base: Own}))();
  assert.deepEqual(element.connectPort({}), {outcome: 'applied', own: true});
  const proto = {connectPort() {}};
  installPortAction(proto);
  assert.equal(Object.keys(proto).length, 1, 'installPortAction leaves a prototype that has it alone');
  assert.deepEqual(connectPort({}, 'nothing', null), {outcome: 'refused', reason: 'no-port'});
  assert.equal(portOf({}), null);
});

test('the Smart base declares the base action for every element', () => {
  const base = readFileSync(new URL('../src/core/js/smart-base.js', import.meta.url), 'utf8');
  assert.match(base, /connectPort\(port\) \{\s*return connectHostPort\(this, port, SfBaseElement\.prototype\.setHostPort\);\s*\}/);
  assert.match(base, /setHostPort\(port\) \{\s*return this\.connectPort\(port\);\s*\}/);
  assert.match(base, /get sfPort\(\) \{\s*return portOf\(this\);\s*\}/);
});

test('a boolean on by default is written off as "false", not taken away', () => {
  const element = new (elementFromManifest(manifest, {base: FakeBase}))();
  element.open = false;
  assert.equal(element.getAttribute('open'), 'false');
  assert.equal(element.open, false);
  element.open = true;
  assert.equal(element.getAttribute('open'), '');
  element.quiet = true;
  element.quiet = false;
  assert.equal(element.hasAttribute('quiet'), false, 'one off by default is still taken away');
});

// SF.Assembly with a manifest element as its part, through the interface
// adapter (assembly/link.mjs adaptElement): connect-port on the top assembly
// reaches a part two levels down, which keeps it as its sfPort.
test('SF.Assembly hands a port through the part\'s connect-port, at any depth (§4.9)', () => {
  journal.force(true);
  const Ported = elementFromManifest(manifest, {base: FakeBase});
  interfaces.register('sf-ported', manifest);
  const inner = {tag: 'x-port-inner', kind: 'assembly', roles: {list: {part: 'sf-ported'}}};
  const top = {tag: 'x-port-top', kind: 'assembly', roles: {inner: {part: 'x-port-inner'}, own: {part: 'sf-ported'}}};
  const definitions = new Map([[inner.tag, compile(inner)]]);
  const elements = new Map();
  const errors = [];
  const viewOf = (definitionsMap) => ({
    interfaceOf: (tag) => interfaces.of(tag),
    isAssembly: (tag) => definitionsMap.has(tag),
    roleFlags: () => [],
    locale: () => 'en',
    error: (kind, text) => errors.push(`${kind}: ${text}`),
    createPart(rec, context) {
      const child = definitionsMap.get(rec.def.tag);
      if (child) {
        const core = new AssemblyCore(child, {instanceId: rec.instanceId, signal: context.signal, definitions: definitionsMap, view: viewOf(definitionsMap),
          frame: {report: (values) => context.report(values), emit: (verb, detail, options) => context.emit(verb, detail, options)}});
        return {set: (n, v) => core.setSetting(n, v), get: (n) => core.value(n), act: (a, args, o) => core.act(a, args, o),
          connectPort: (port) => core.connectPort(port), start: () => core.start(), dispose: () => core.dispose()};
      }
      const element = new Ported();
      elements.set(rec.instanceId, element);
      return adaptElement(element, interfaces.of(rec.def.tag), context);
    },
  });
  const core = new AssemblyCore(compile(top), {instanceId: 'page/ports', definitions, view: viewOf(definitions), frame: {report() {}, emit() {}}});
  core.start();
  const port = {id: 'simai.test-port', raise() {}};
  assert.deepEqual(core.act('connect-port', {port}), {answer: 'applied'});
  const own = elements.get('page/ports/own');
  const nested = [...elements].find(([path]) => path.startsWith('page/ports/inner/'))?.[1];
  assert.equal(own.sfPort, port, 'a part of the top assembly');
  assert.ok(nested, 'the nested part was placed');
  assert.equal(nested.sfPort, port, 'a part one assembly down');

  // A port another adapter names by `port` is taken too.
  const navigation = {port: 'simai.admin-navigation-port', raise() {}};
  assert.deepEqual(core.connectPort(navigation), {answer: 'applied'});
  assert.equal(own.sfPort, port, 'a part that does not declare that port is not handed it');
  assert.deepEqual(errors, []);
  core.dispose();
});
