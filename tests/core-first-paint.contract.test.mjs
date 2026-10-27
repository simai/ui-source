import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

import {
  holdUndefinedElements,
  installPendingTags,
  pendingTagRule,
  PENDING_TAGS_ID,
} from '../src/core/js/pending-tags.js';

// The first paint (standard simai.smart-component 1.3.8 §5.4, §7.2.1):
//   - Core never hides the page; it hides only undefined Smart elements that
//     have nothing to show, each in its own box (simai/ui-source#39);
//   - a Smart element replaces the static markup printed inside it in its
//     first render (#40);
//   - the Loader fetches nothing for a tag inside a closed container until it
//     opens, nothing lazy in idle time, and no script for skeleton bars (#47).
// tests/browser/core-first-paint.browser.mjs holds the same on the built bytes,
// frame by frame.

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const loader = read('src/core/js/loader.js');
const slice = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `anchor not found: ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `anchor not found: ${to}`);
  return source.slice(start, end);
};

// ---------- a window just big enough for pending-tags.js ----------
function fakeWindow() {
  const defined = new Map();
  const waiting = new Map();
  const timers = [];
  const appended = [];
  const style = () => ({
    id: '', textContent: '', attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    remove() { appended.splice(appended.indexOf(this), 1); },
  });
  const win = {
    document: {
      head: {append: (node) => appended.push(node)},
      createElement: () => style(),
    },
    customElements: {
      get: (tag) => defined.get(tag),
      whenDefined: (tag) => new Promise((resolve) => {
        if (defined.has(tag)) resolve();
        else waiting.set(tag, resolve);
      }),
    },
  };
  return {
    win,
    appended,
    define(tag) { defined.set(tag, class {}); waiting.get(tag)?.(); },
    timers,
  };
}

test('the page is never hidden: Core holds undefined elements, not the body', () => {
  const index = read('src/core/js/index.js');
  assert.doesNotMatch(index, /hideBodyUntilReady/u);
  assert.doesNotMatch(index, /body\.style\.opacity/u);
  assert.match(index, /import \{holdUndefinedElements, installPendingTags\} from '\.\/pending-tags\.js';/u);
  // SF_PRELOADED pages define their modules at once and are left as they were.
  assert.match(
    index,
    /const holdUndefinedUntilDefined = \(\) => \{\s*if \(\s*window\.SF_PRELOADED &&\s*Object\.keys\(window\.SF_PRELOADED\.modules \|\| \{\}\)\.length\s*\) \{\s*return;\s*\}\s*installPendingTags\(window\);\s*holdUndefinedElements\(window\);\s*\};\s*holdUndefinedUntilDefined\(\);/u,
  );
});

test('a held tag hides its undefined elements that carry no static markup and no skeleton, keeping the box', () => {
  assert.equal(
    pendingTagRule('sf-switch'),
    'sf-switch:not(:defined):not([data-sf-skeleton]):not(:has(> [data-sf-static])){visibility:hidden}',
  );
});

test('a hold is one rule in one sheet, dropped when the tag is defined', async () => {
  const fake = fakeWindow();
  const pending = installPendingTags(fake.win);
  assert.equal(installPendingTags(fake.win), pending, 'one store on the shared global');
  assert.equal(fake.win.SF.__internal.pendingTags, pending);

  assert.equal(pending.hold('sf-switch', {asked: true}), true);
  assert.equal(pending.hold('sf-quantity'), true);
  assert.equal(pending.hold('not a tag'), false);
  assert.equal(fake.appended.length, 1, 'one sheet');
  const [sheet] = fake.appended;
  assert.equal(sheet.id, PENDING_TAGS_ID);
  assert.equal(sheet.attrs['data-sf-observer'], 'ignore', 'the Loader does not read its own sheet');
  assert.equal(sheet.textContent, `${pendingTagRule('sf-switch')}\n${pendingTagRule('sf-quantity')}`);

  fake.define('sf-switch');
  await new Promise((settle) => setTimeout(settle, 0));
  assert.deepEqual(pending.held(), ['sf-quantity']);
  assert.equal(sheet.textContent, pendingTagRule('sf-quantity'));

  fake.define('sf-quantity');
  await new Promise((settle) => setTimeout(settle, 0));
  assert.deepEqual(pending.held(), []);
  assert.equal(fake.appended.length, 0, 'no sheet once nothing is held');
  assert.equal(pending.hold('sf-switch'), false, 'a defined tag is never held');
  for (const tag of ['sf-switch', 'sf-quantity']) pending.release(tag);
});

test('nothing stays hidden when a module fails: the hold times out, and a module the Loader asked for says so', async () => {
  const fake = fakeWindow();
  const pending = installPendingTags(fake.win);
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  try {
    pending.hold('sf-broken', {asked: true, timeout: 5});
    pending.hold('sf-closed', {timeout: 5});
    await new Promise((settle) => setTimeout(settle, 30));
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(pending.held(), []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /<sf-broken> was not defined within 5 ms/u);
});

test('the Loader asking starts the timer again; sf-loader-ready lets go what nobody asked for', () => {
  const fake = fakeWindow();
  const pending = installPendingTags(fake.win);
  pending.hold('sf-switch');
  pending.hold('sf-unclaimed');
  pending.hold('sf-switch', {asked: true});
  pending.releaseUnasked();
  assert.deepEqual(pending.held(), ['sf-switch']);
  pending.release('sf-switch');
});

test('Core holds every undefined sf- element met while the page is parsed, until sf-loader-ready', () => {
  const fake = fakeWindow();
  installPendingTags(fake.win);
  const element = (localName, descendants = []) => ({
    nodeType: 1, localName,
    querySelectorAll: (selector) => (selector === ':not(:defined)' ? descendants : []),
  });
  let observer = null;
  const listeners = {};
  fake.win.MutationObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target, options) { this.options = options; }
    disconnect() { this.disconnected = true; }
  };
  fake.win.addEventListener = (name, fn) => { listeners[name] = fn; };
  fake.win.document.documentElement = element('html', [element('sf-switch'), element('lr-records')]);

  holdUndefinedElements(fake.win);
  const pending = fake.win.SF.__internal.pendingTags;
  assert.deepEqual(pending.held(), ['sf-switch'], 'only sf- tags: a package tag is held by the Loader, which knows its rule');
  assert.deepEqual(observer.options, {childList: true, subtree: true});

  observer.callback([{addedNodes: [element('sf-quantity'), {nodeType: 3}]}]);
  assert.deepEqual(pending.held(), ['sf-switch', 'sf-quantity']);

  pending.hold('sf-quantity', {asked: true});
  listeners['sf-loader-ready']();
  assert.equal(observer.disconnected, true);
  assert.deepEqual(pending.held(), ['sf-quantity'], 'what the Loader asked for stays held until defined');
  pending.release('sf-quantity');
});

// ---------- #40: static markup ----------
test('the first render replaces static markup in the same task, and keeps slots', () => {
  const base = read('src/core/js/smart-base.js');
  // Class methods, read as an object literal's: a comma between them.
  const methods = slice(base, '  staticMarkup() {', '  template() {').replace(/\n  \}\n\n  (?=\w+\()/gu, '\n  },\n\n  ');
  const host = vm.runInNewContext(`({
    _hasRendered: false,
    children: [],
    shouldClearLightDomBeforeFirstRender() { return false; },
    ${methods}
  })`);
  const node = (attrs) => ({
    attrs,
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); },
    remove() { host.children.splice(host.children.indexOf(this), 1); },
  });
  const printed = node({'data-sf-static': ''});
  const content = node({'data-sf-static': '', slot: 'content'});
  const authored = node({});
  host.children.push(printed, content, authored);
  host.prepareRenderContainer();
  assert.deepEqual([...host.children], [content, authored], 'static markup goes; page content stays');

  host.children.push(printed);
  host._hasRendered = true;
  host.prepareRenderContainer();
  assert.ok(host.children.includes(printed), 'only the first render takes static markup');

  // The render reads its values from the host's attributes: static markup is
  // not a child template either.
  assert.match(base, /!child\.hasAttribute\?\.\("data-sf-static"\) && matches\(child\)/u);
  // Removed right before lit draws, in the same synchronous run: no frame
  // shows both and none shows neither.
  assert.match(
    slice(base, '  async renderComponent(', '  shouldWaitForStylesReady() {'),
    /this\.prepareRenderContainer\(changedAttributes\);\s*this\.markStylePending\(this\);\s*render\(templateResult, this\);/u,
  );
});

// ---------- #47 (1): closed containers ----------
function closedContainers() {
  const source = slice(loader, '// A Smart element inside a closed container', '// A Smart tag is one a rule claims.');
  return vm.runInNewContext(`${source}; ({CLOSED_CONTAINER, CLOSED_CONTAINER_ATTRIBUTES, isClosedContainer, closedContainerOf})`);
}

function el(localName, attrs = {}, parent = null) {
  return {
    nodeType: 1, localName, attrs, parentElement: parent,
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); },
    matches(selector) {
      assert.equal(selector, '[hidden], [inert], details:not([open]), dialog:not([open])');
      return this.hasAttribute('hidden') || this.hasAttribute('inert')
        || (['details', 'dialog'].includes(this.localName) && !this.hasAttribute('open'));
    },
    closest(name) {
      for (let node = this; node; node = node.parentElement) if (node.localName === name) return node;
      return null;
    },
  };
}

test('a tag in a closed container is not a reason to fetch its code', () => {
  const {CLOSED_CONTAINER_ATTRIBUTES, closedContainerOf} = closedContainers();
  assert.deepEqual([...CLOSED_CONTAINER_ATTRIBUTES], ['hidden', 'inert', 'open']);
  const body = el('body');
  const inBody = el('sf-modal', {}, body);
  assert.equal(closedContainerOf(inBody), null);

  for (const [tag, attrs] of [['div', {hidden: ''}], ['div', {inert: ''}], ['details', {}], ['dialog', {}], ['div', {role: 'tabpanel', hidden: ''}]]) {
    const container = el(tag, attrs, body);
    const wrapper = el('div', {}, container);
    assert.equal(closedContainerOf(el('sf-modal', {}, wrapper)), container, `${tag} ${JSON.stringify(attrs)}`);
  }
  assert.equal(closedContainerOf(el('sf-modal', {}, el('details', {open: ''}, body))), null);
  assert.equal(closedContainerOf(el('sf-modal', {}, el('dialog', {open: ''}, body))), null);

  // A closed <details> still shows its summary.
  const details = el('details', {}, body);
  const summary = el('summary', {}, details);
  assert.equal(closedContainerOf(el('sf-badge', {}, summary)), null);
  // ...but not a closed container further up.
  const hidden = el('div', {hidden: ''}, body);
  const inner = el('details', {}, hidden);
  assert.equal(closedContainerOf(el('sf-badge', {}, el('summary', {}, inner))), hidden);
  // The element itself carrying hidden is not a container of itself.
  assert.equal(closedContainerOf(el('sf-alert', {hidden: ''}, body)), null);
});

test('both scans leave a closed container for later and hold the tags they ask for', () => {
  const custom = slice(loader, 'SFLoaderPlugin.prototype.scanCustomElements =', 'SFLoaderPlugin.prototype.scanAttributes =');
  assert.match(custom, /this\.shouldDeferNestedSmartElement\(el\) \|\|\s*this\.deferClosedSmartElement\(el\)\s*\) \{\s*return;\s*\}\s*this\.holdSmartTag\(tagName\);\s*keys\.push\(componentName\);/u);
  const dom = slice(loader, 'SFLoaderPlugin.prototype.scanDom =', 'SFLoaderPlugin.prototype.getMutationNodeHost =');
  assert.match(dom, /!this\.shouldDeferNestedSmartElement\(el\) &&\s*!this\.deferClosedSmartElement\(el\)\s*\) \{\s*this\.holdSmartTag\(tagName\);\s*customKeys\.push\(componentName\);/u);
  // The page-text scan does not read a deferred element's tag either: sf-modal
  // matches the modal class rule by name.
  const filtered = slice(loader, 'SFLoaderPlugin.prototype.getObserverFilteredHTML =', 'SFLoaderPlugin.prototype.stripIgnoredBlocks =');
  assert.match(filtered, /if \(hostClosed \|\| closedContainerOf\(el\)\) el\.remove\(\);/u);
});

test('a closed container is watched and read again once, when it opens', () => {
  const helpers = slice(loader, '// A Smart element inside a closed container', '// A Smart tag is one a rule claims.');
  const methods = slice(loader, 'SFLoaderPlugin.prototype.deferClosedSmartElement =', 'SFLoaderPlugin.prototype.prepareSmartChildScanEvents =');
  const observers = [];
  const holds = [];
  const context = {
    SFLoaderPlugin: function SFLoaderPlugin() { this.scanned = []; },
    window: {},
    WeakSet,
    installPendingTags: () => ({hold: (tag, options) => holds.push([tag, options ?? null])}),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
      observe(target, options) { this.targets.push([target, options]); }
    },
  };
  vm.runInNewContext(`${helpers}\n${methods}\nSFLoaderPlugin.prototype.scanCustomElements = function (root) { this.scanned.push(root); };`, context);
  const plugin = new context.SFLoaderPlugin();

  const body = el('body');
  const panel = el('div', {role: 'tabpanel', hidden: ''}, body);
  panel.isConnected = true;
  assert.equal(plugin.deferClosedSmartElement(el('sf-modal', {}, panel)), true);
  assert.equal(plugin.deferClosedSmartElement(el('sf-tabs', {}, panel)), true);
  assert.equal(plugin.deferClosedSmartElement(el('sf-modal', {}, body)), false);
  assert.equal(observers.length, 1);
  assert.equal(observers[0].targets.length, 1, 'a container is watched once');
  assert.equal(JSON.stringify(observers[0].targets[0][1]), JSON.stringify({attributes: true, attributeFilter: ['hidden', 'inert', 'open']}));
  assert.deepEqual(holds, [['sf-modal', null], ['sf-tabs', null]], 'held, not asked: no module is on its way');

  // Still closed: nothing is read.
  observers[0].callback([{target: panel}]);
  assert.deepEqual(plugin.scanned, []);
  delete panel.attrs.hidden;
  observers[0].callback([{target: panel}, {target: panel}]);
  assert.deepEqual(plugin.scanned, [panel], 'read once when it opens');
  observers[0].callback([{target: panel}]);
  assert.deepEqual(plugin.scanned, [panel], 'and not again');

  plugin.holdSmartTag('sf-modal');
  assert.equal(JSON.stringify(holds.at(-1)), JSON.stringify(['sf-modal', {asked: true}]));
});

// ---------- #47 (2): lazy relations ----------
test('a lazy relation is not fetched in idle time unless the page asks for it', () => {
  const ready = slice(loader, 'SFLoaderPlugin.prototype.dispatchReadyOnce =', 'SFLoaderPlugin.prototype.getAssets =');
  const run = (config, params) => {
    const calls = [];
    const context = {
      SFLoaderPlugin: function SFLoaderPlugin() {
        this.params = params;
        this.prefetchLazyRelations = () => calls.push('prefetch');
      },
      window: {SF: {}, SF_BOOT_CONFIG: config, dispatchEvent: () => calls.push('ready')},
      createReadyEvent: () => ({}),
      console,
    };
    vm.runInNewContext(ready, context);
    new context.SFLoaderPlugin().dispatchReadyOnce();
    return calls;
  };
  assert.deepEqual(run({}, {}), ['ready']);
  assert.deepEqual(run({prefetchLazyRelations: true}, {}), ['ready', 'prefetch']);
  assert.deepEqual(run({}, {prefetchLazyRelations: true}), ['ready', 'prefetch']);
});

// ---------- #47 (5): skeleton bars are CSS ----------
test('the skeleton class fetches its sheet alone; the script comes with the API that builds skeletons', () => {
  const rules = {};
  vm.runInNewContext(read('src/component/skeleton/rule.js'), {SF: {RuleLoader: rules}});
  assert.equal(rules.skeleton.css, true);
  assert.equal(rules.skeleton.js, false, 'a page with .sf-skeleton bars loads no script');
  assert.equal(rules.skeleton.jsOnCall, true);

  const method = slice(loader, 'SFLoaderPlugin.prototype.loadScriptOnCall =', '// The lazy relations');
  const context = {
    SFLoaderPlugin: function SFLoaderPlugin() {
      this.findPlugins = {...rules, buttons: {type: 'component', css: true, js: true}};
      this.ComponentRegistry = {};
      this.added = [];
      this.pathPluginJs = (name, smart, point, type) => `/component/${name}/js/${name}.min.js|${smart}|${type}`;
      this.addScript = (file) => { this.added.push(file); return Promise.resolve(); };
    },
    console,
  };
  vm.runInNewContext(method, context);
  const plugin = new context.SFLoaderPlugin();
  assert.equal(plugin.loadScriptOnCall('buttons'), false, 'an ordinary rule is untouched');
  assert.equal(plugin.loadScriptOnCall('skeleton'), true);
  assert.deepEqual(plugin.added, ['/component/skeleton/js/skeleton.min.js|false|component']);
  plugin.ComponentRegistry.skeleton = class {};
  assert.equal(plugin.loadScriptOnCall('skeleton'), false, 'not again once the constructor is registered');

  // Called by the shortcode path and by ensurePlugin.
  assert.match(slice(loader, 'SFLoaderPlugin.prototype.findShortCodes =', 'function generateTemplateParamsFromString'), /this\.loadScriptOnCall\(originItem\);/u);
  assert.match(slice(loader, 'SFLoaderPlugin.prototype.ensurePlugin =', 'SFLoaderPlugin.prototype.loadScriptOnCall ='), /this\.loadScriptOnCall\(key\);\s*if \(this\.module\[key\]\) return true;/u);
});
