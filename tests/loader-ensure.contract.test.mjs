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

function ensureLoader(customElements, rules = {'sf-menu-context': 'cl-menu-context', 'sf-radio': 'cl-radio'}) {
  function SFLoaderPlugin() { this.fetched = []; }
  SFLoaderPlugin.prototype.getCustomElementRules = () => rules;
  SFLoaderPlugin.prototype.ensurePlugin = function (name) { this.fetched.push(name); return true; };
  const context = vm.createContext({SFLoaderPlugin, customElements, setTimeout, clearTimeout, Promise, Number, Set, Map, Math, String, Array});
  // ensure() reads a tag's failure and waits through settled() (GB17 L2): both run in the same context.
  vm.runInContext(slice('// The tags of rules whose script failed to load on this page.', 'SFLoaderPlugin.prototype.getAssetVersion'), context);
  vm.runInContext(slice('// The element a name in SF.Loader.ensure() stands for', 'async function createSmartElementAsync'), context);
  return new SFLoaderPlugin();
}

test('a tag already defined settles at once and asks for nothing', async () => {
  const customElements = registry();
  customElements.define('sf-menu-context');
  const loader = ensureLoader(customElements);
  const result = await loader.ensure(['menu-context']);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-menu-context'], missing: [], failed: []});
  assert.equal(loader.fetched.length, 0, 'no fetch');
  assert.equal(customElements.asked, 0, 'no wait');
});

test('a tag is fetched through its rule and settles ready when it is defined', async () => {
  const customElements = registry();
  const loader = ensureLoader(customElements);
  const pending = loader.ensure('sf-menu-context', {timeout: 1000});
  assert.deepEqual(loader.fetched, ['cl-menu-context']);
  setTimeout(() => customElements.define('sf-menu-context'), 5);
  const result = await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-menu-context'], missing: [], failed: []});
});

test('the timeout reports the tags still missing and never rejects', async () => {
  const customElements = registry();
  customElements.define('sf-radio');
  const loader = ensureLoader(customElements);
  const started = Date.now();
  const result = await loader.ensure(['sf-radio', 'sf-menu-context', 'acme-counter'], {timeout: 20});
  assert.ok(Date.now() - started < 1000, 'settled by the timeout');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-radio'], missing: ['sf-menu-context', 'acme-counter'], failed: []});
  // A package's own name with no rule yet is waited for as it is, not as sf-acme-counter.
  assert.deepEqual(loader.fetched, ['cl-menu-context']);
});

test('concurrent callers share one wait per tag, and each keeps its own timeout', async () => {
  const customElements = registry();
  const loader = ensureLoader(customElements);
  const short = loader.ensure(['sf-menu-context'], {timeout: 10});
  const long = loader.ensure(['sf-menu-context', 'sf-menu-context'], {timeout: 1000});
  assert.equal(customElements.asked, 1, 'one whenDefined for two callers');
  assert.deepEqual(JSON.parse(JSON.stringify(await short)), {ready: [], missing: ['sf-menu-context'], failed: []});
  customElements.define('sf-menu-context');
  assert.deepEqual(JSON.parse(JSON.stringify(await long)), {ready: ['sf-menu-context'], missing: [], failed: []}, 'a name given twice is reported once');
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
  const rules = {'sf-view-table': 'cl-view-table', 'sf-sortable': 'cl-sortable', 'sf-radio': 'cl-radio', 'sf-modal': 'cl-modal'};
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
  const table = node('sf-view-table');
  const portal = node('form', {parent: table});
  const radio = node('sf-radio', {parent: portal});
  assert.equal(loader.shouldDeferNestedSmartElement(radio), true, 'unmarked: it waits for sf-view-table');
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
  // The sortable inserter and move menu place theirs through core's one
  // standardMenu (overflow-row.js, TL-8), which asks the Loader.
  for (const path of ['src/smart/tabs/index.js', 'src/core/js/effects.js', 'src/core/js/overflow-row.js']) {
    const text = read(path);
    assert.match(text, /SF\?\.Loader\?\.ensure\?\.\(/u, path);
    assert.doesNotMatch(text, /Promise\.race\(\[[^\]]*whenDefined/u, path);
  }
});

test('core places the standard menu in one place (TL-8)', () => {
  const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of ['src/core/js/composition/sortable-inserter.mjs', 'src/core/js/composition/sortable-move-menu.mjs']) {
    const text = read(path);
    assert.match(text, /from '\.\.\/overflow-row\.js'/u, path);
    assert.doesNotMatch(text, /createElement\('sf-menu-context'\)/u, path);
  }
});

// GB18 L2 (DEV LM-R2, ui-control evidence 2026-11-23-admin-lazy-menu-accept): a module a person's press asks for
// is not given up after 3 s while its request is in flight; ensure(tags, {press: true}) waits 30 s by default.
function pressLoader(customElements, inFlight = null, rules = {'sf-menu-context': 'cl-menu-context'}) {
  function SFLoaderPlugin() { this.fetched = []; }
  SFLoaderPlugin.prototype.getCustomElementRules = () => rules;
  SFLoaderPlugin.prototype.ensurePlugin = function (name) { this.fetched.push(name); return true; };
  const context = vm.createContext({SFLoaderPlugin, customElements, setTimeout, clearTimeout, Promise, Number, Set, Map, Math, String, Array});
  if (inFlight) context[Symbol.for('simai.sf.loader.assets')] = {scripts: new Map(), styles: new Map(), inFlight};
  vm.runInContext(slice('// The tags of rules whose script failed to load on this page.', 'SFLoaderPlugin.prototype.getAssetVersion'), context);
  vm.runInContext(slice('// The element a name in SF.Loader.ensure() stands for', 'async function createSmartElementAsync'), context);
  return new SFLoaderPlugin();
}

test('press: the default wait is 30 s, a drawing path keeps 3 s', () => {
  const body = slice('SFLoaderPlugin.prototype.ensure = function', 'async function createSmartElementAsync');
  assert.match(body, /timeout = press \? PRESS_WAIT_MS : 3000/u);
  assert.match(source, /const PRESS_WAIT_MS = 30000;/u);
});

test('press: the wait goes on past its timeout while a load is in flight, then reports', async () => {
  const customElements = registry();
  let finish;
  const load = new Promise((done) => { finish = done; });
  const inFlight = new Map([['https://example.test/menu-context.min.js', load]]);
  const loader = pressLoader(customElements, inFlight);
  const started = Date.now();
  const pending = loader.ensure(['sf-menu-context'], {timeout: 20, press: true});
  setTimeout(() => {
    customElements.define('sf-menu-context');
    inFlight.delete('https://example.test/menu-context.min.js');
    finish();
  }, 120);
  const result = await pending;
  assert.ok(Date.now() - started >= 100, 'not given up at the 20 ms timeout');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: ['sf-menu-context'], missing: [], failed: []});
});

test('press: the load settles and the tag is still missing, the wait reports it', async () => {
  const customElements = registry();
  let fail;
  const load = new Promise((done, reject) => { fail = reject; });
  load.catch(() => {});
  const inFlight = new Map([['https://example.test/menu-context.min.js', load]]);
  const loader = pressLoader(customElements, inFlight);
  const pending = loader.ensure(['sf-menu-context'], {timeout: 20, press: true});
  setTimeout(() => { inFlight.clear(); fail(new Error('network')); }, 60);
  const result = await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: [], missing: ['sf-menu-context'], failed: []});
});

test('press: nothing in flight, the timeout still reports what is missing', async () => {
  const customElements = registry();
  const loader = pressLoader(customElements, new Map());
  const started = Date.now();
  const result = await loader.ensure(['sf-menu-context'], {timeout: 20, press: true});
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {ready: [], missing: ['sf-menu-context'], failed: []});
});

test('without press the timeout gives up as before, a load in flight or not', async () => {
  const customElements = registry();
  const loader = pressLoader(customElements, new Map([['x', new Promise(() => {})]]));
  const started = Date.now();
  const result = await loader.ensure(['sf-menu-context'], {timeout: 20});
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(result.missing)), ['sf-menu-context']);
});

test('the Loader keeps its loads in flight in the shared asset registry until they settle', () => {
  const body = slice('function onceByUrl(kind, src, insert) {', '\n}\n');
  assert.match(body, /registry\.inFlight\.set\(key, load\);/u);
  assert.match(body, /load\.then\(settle, settle\);/u);
});
