import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// SF.Loader.ensure(tags, {timeout}) replaces "ask the Loader, race
// whenDefined against 3 s", copied at eleven call sites, and a portal root
// (SF.Loader.watch, data-sf-portal) is read as the page is: a Smart element in
// it does not wait for an ancestor outside it, and a parent that is not a Smart
// base element holds none of its children (reuse audit 2026-11-02, finding 4).

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');
const slice = (from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `anchor ${from}`);
  return source.slice(start, source.indexOf(to, start));
};

function registry() {
  const defined = new Map();
  const waiting = new Map();
  return {
    asked: 0,
    get: (tag) => defined.get(tag),
    define(tag, constructor = class {}) {
      defined.set(tag, constructor);
      waiting.get(tag)?.resolve(constructor);
    },
    whenDefined(tag) {
      this.asked++;
      if (defined.has(tag)) return Promise.resolve(defined.get(tag));
      if (!waiting.has(tag)) {
        let resolve;
        const promise = new Promise((done) => { resolve = done; });
        waiting.set(tag, {promise, resolve});
      }
      return waiting.get(tag).promise;
    },
  };
}

function ensureLoader(customElements, rules = {'sf-context-menu': 'cl-context-menu', 'sf-radio': 'cl-radio'}) {
  function SFLoaderPlugin() { this.fetched = []; }
  SFLoaderPlugin.prototype.getCustomElementRules = () => rules;
  SFLoaderPlugin.prototype.ensurePlugin = function (name) { this.fetched.push(name); return true; };
  const context = {SFLoaderPlugin, customElements, setTimeout, clearTimeout, Promise, Number, Set, Map, Math, String, Array};
  vm.runInNewContext(slice('// The element a name in SF.Loader.ensure() stands for', 'async function createSmartElementAsync'), context);
  return new SFLoaderPlugin();
}

test('a tag already defined settles at once and asks for nothing', async () => {
  const customElements = registry();
  customElements.define('sf-context-menu');
  const loader = ensureLoader(customElements);
  const result = await loader.ensure(['context-menu']);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-context-menu'], missing: []});
  assert.equal(loader.fetched.length, 0, 'no fetch');
  assert.equal(customElements.asked, 0, 'no wait');
});

test('a tag is fetched through its rule and settles ready when it is defined', async () => {
  const customElements = registry();
  const loader = ensureLoader(customElements);
  const pending = loader.ensure('sf-context-menu', {timeout: 1000});
  assert.deepEqual(loader.fetched, ['cl-context-menu']);
  setTimeout(() => customElements.define('sf-context-menu'), 5);
  const result = await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-context-menu'], missing: []});
});

test('the timeout reports the tags still missing and never rejects', async () => {
  const customElements = registry();
  customElements.define('sf-radio');
  const loader = ensureLoader(customElements);
  const started = Date.now();
  const result = await loader.ensure(['sf-radio', 'sf-context-menu', 'acme-counter'], {timeout: 20});
  assert.ok(Date.now() - started < 1000, 'settled by the timeout');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-radio'], missing: ['sf-context-menu', 'acme-counter']});
  // A package's own name with no rule yet is waited for as it is, not as sf-acme-counter.
  assert.deepEqual(loader.fetched, ['cl-context-menu']);
});

test('concurrent callers share one wait per tag, and each keeps its own timeout', async () => {
  const customElements = registry();
  const loader = ensureLoader(customElements);
  const short = loader.ensure(['sf-context-menu'], {timeout: 10});
  const long = loader.ensure(['sf-context-menu', 'sf-context-menu'], {timeout: 1000});
  assert.equal(customElements.asked, 1, 'one whenDefined for two callers');
  assert.deepEqual(JSON.parse(JSON.stringify(await short)), {ready: [], missing: ['sf-context-menu']});
  customElements.define('sf-context-menu');
  assert.deepEqual(JSON.parse(JSON.stringify(await long)), {ready: ['sf-context-menu'], missing: []}, 'a name given twice is reported once');
});

// The portal scan, over a small element tree.
function node(localName, {attrs = {}, parent = null} = {}) {
  const el = {
    localName, tagName: localName.toUpperCase(), nodeType: 1, parentElement: parent, isConnected: true, attrs: {...attrs},
    hasAttribute(name) { return name in this.attrs; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    matches(selector) { return selector.split(',').map((part) => part.trim().replace(/^\[|\]$/gu, '')).some((name) => name in this.attrs); },
  };
  return el;
}

function portalLoader(customElements) {
  function SFLoaderPlugin() { this.scanned = []; }
  const rules = {'sf-table': 'cl-table', 'sf-sortable': 'cl-sortable', 'sf-radio': 'cl-radio', 'sf-modal': 'cl-modal'};
  SFLoaderPlugin.prototype.getSmartElementRuleName = (el) => rules[el?.localName] || '';
  SFLoaderPlugin.prototype.scanCustomElements = function (root) { this.scanned.push(root); };
  const context = {SFLoaderPlugin, customElements, WeakSet};
  vm.runInNewContext(slice('// A portal root:', '// Leaves the element for later when it sits in a closed container'), context);
  return new SFLoaderPlugin();
}

class SmartBase { captureSlotTemplates() {} }

test('a Smart element in a portal does not wait for the element the portal sits in', () => {
  const customElements = registry();
  const loader = portalLoader(customElements);
  const table = node('sf-table');
  const portal = node('form', {parent: table});
  const radio = node('sf-radio', {parent: portal});
  assert.equal(loader.shouldDeferNestedSmartElement(radio), true, 'unmarked: it waits for sf-table');
  const unwatch = loader.watch(portal);
  assert.equal(portal.attrs['data-sf-portal'], '');
  assert.equal(loader.scanned.at(-1), portal, 'watch reads the portal at once');
  assert.equal(loader.shouldDeferNestedSmartElement(radio), false, 'marked: read as the page');
  unwatch();
  assert.equal(portal.hasAttribute('data-sf-portal'), false);
  const drawerPortal = node('div', {attrs: {'data-sf-drawer-portal': 'd1'}, parent: table});
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: drawerPortal})), false, "sf-drawer's own marker counts");
});

test('a parent that is not a Smart base element holds none of its children', () => {
  const customElements = registry();
  const loader = portalLoader(customElements);
  customElements.define('sf-sortable', class {});
  customElements.define('sf-modal', SmartBase);
  const list = node('sf-sortable');
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: list})), false, 'sf-sortable captures nothing');
  const modal = node('sf-modal');
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: modal})), true, 'a Smart base parent still captures first');
  modal.__sfSourceCaptured = true;
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: modal})), false);
});

test('a parent not defined yet is read again when it turns out to hold nothing', async () => {
  const customElements = registry();
  const loader = portalLoader(customElements);
  const list = node('sf-sortable');
  const modal = node('sf-modal');
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: list})), true);
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: list})), true);
  assert.equal(loader.shouldDeferNestedSmartElement(node('sf-radio', {parent: modal})), true);
  customElements.define('sf-sortable', class {});
  customElements.define('sf-modal', SmartBase);
  await new Promise((done) => setTimeout(done, 0));
  assert.deepEqual(loader.scanned, [list], 'the list once; the modal reads itself on sf-after-render');
});

test('the components ask through SF.Loader.ensure, not a race of their own', () => {
  const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of ['src/smart/tabs/index.js', 'src/core/js/effects.js', 'src/core/js/composition/sortable-inserter.mjs']) {
    const text = read(path);
    assert.match(text, /SF\?\.Loader\?\.ensure\?\.\(/u, path);
    assert.doesNotMatch(text, /Promise\.race\(\[[^\]]*whenDefined/u, path);
  }
});
