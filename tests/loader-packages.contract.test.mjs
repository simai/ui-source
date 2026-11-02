// Where the Loader fetches a Smart component from: the Smart base beside Core,
// or the base of the component package whose rules named it.
//
// Two things changed together (the package split, stage 2). The `ui` distribution
// carries Smart in `distr/smart`, so `sfPath` alone is a whole configuration;
// and a package such as pro is served from its own base and brings
// its own rules, so one Smart base for every rule is no longer true. These
// tests run the Loader's own functions, cut out of loader.js, against a stub
// instance: the page-level behaviour is tests/browser/loader-packages.browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/core/js/loader.js', import.meta.url), 'utf8');

const between = (from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `loader.js no longer has ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, `loader.js no longer has ${to} after ${from}`);
  return source.slice(start, end);
};

const slices = [
  between('function resolveSmartRoot(', 'function SFLoaderPlugin(params)'),
  between('SFLoaderPlugin.prototype.installPackageApi =', 'SFLoaderPlugin.prototype.debug ='),
  between('SFLoaderPlugin.prototype.pathPluginJs =', 'SFLoaderPlugin.prototype.shouldSkipPluginCss ='),
  between('SFLoaderPlugin.prototype.revalidateMissingPlugins =', 'SFLoaderPlugin.prototype.registerComponent ='),
  between('SFLoaderPlugin.prototype.getPersistentMissingFiles =', 'SFLoaderPlugin.prototype.getAssetVersion ='),
].join('\n');

function harness({prepared = false, declared = {}} = {}) {
  const warnings = [];
  const notes = [];
  const stored = new Map();
  const scans = [];
  const scripts = [];
  const rules = {
    'cl-spinner': {tags: ['sf-spinner'], type: 'smart', mode: 'smart', js: true},
    'cl-table': {tags: ['sf-table'], type: 'smart', mode: 'smart', js: true},
  };
  const body = {nodeType: 1};
  const context = {
    console: {warn: (message) => warnings.push(String(message))},
    document: {body},
    localStorage: {
      getItem: (key) => (stored.has(key) ? stored.get(key) : null),
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
    safeSetItem: (key, value) => stored.set(key, value),
    // The Loader reaches storage through page-storage.js (a sandboxed page has none).
    pageStorage: () => context.localStorage,
    encodeCacheValue: (value) => value,
    decodeCacheValue: (value) => value,
    SF: {RuleLoader: rules},
    noteDeprecated: (note) => notes.push(note),
  };
  context.SFLoaderPlugin = function SFLoaderPlugin() {
    this.findPlugins = rules;
    this.module = {};
    this.loadedPlugins = {};
    this.notFoundFiles = {};
    this.attrMatchCache = new Map([['stale', true]]);
    this.regexMatchCache = new Map([['stale', true]]);
    this.attributeRuleIndex = {stale: true};
    this.regexpScanRules = [['stale']];
    this.prepareInit = prepared;
    this.pendingRegex = !prepared;
    this.url = '/distr';
    this.smartPath = '/distr/smart';
    this.componentPath = '/distr/component';
    this.utilyPath = '/distr/utility';
    this.packages = Object.create(null);
    this.packageWarnings = new Set();
    this.installPackageApi();
    this.declarePackages(declared);
  };
  vm.runInNewContext(`${slices}
    SFLoaderPlugin.prototype.clearAttributeRuleIndex = function () { this.attributeRuleIndex = null; };
    SFLoaderPlugin.prototype.clearRegexpScanRules = function () { this.regexpScanRules = null; };
    SFLoaderPlugin.prototype.mutate = function (fn) { fn(); };
    SFLoaderPlugin.prototype.scanCustomElements = function (root) { __scans.push(['custom', root]); };
    SFLoaderPlugin.prototype.scanAttributes = function (root) { __scans.push(['attributes', root]); };
    SFLoaderPlugin.prototype.searchRegexp = function () { __scans.push(['regexp']); };
    SFLoaderPlugin.prototype.addScript = function (url) {
      __scripts.push(url);
      return url.includes('absent') ? Promise.reject(new Error('404')) : Promise.resolve();
    };
    this.resolveSmartRoot = resolveSmartRoot;
  `, Object.assign(context, {__scans: scans, __scripts: scripts}));
  const loader = new context.SFLoaderPlugin();
  return {loader, rules, warnings, notes, stored, scans, scripts, body, resolveSmartRoot: context.resolveSmartRoot};
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test('sfPath alone: Smart resolves to <sfPath>/smart, the ui distribution layout', () => {
  const {resolveSmartRoot} = harness();
  assert.equal(resolveSmartRoot('/distr', undefined), '/distr');
  assert.equal(resolveSmartRoot('/distr', null), '/distr');
  // A lab writes `sfSmartPath = ''` meaning the default; an empty root would
  // resolve every Smart file against the page's own directory.
  assert.equal(resolveSmartRoot('/distr', ''), '/distr');
  assert.equal(resolveSmartRoot('/distr', '   '), '/distr');
  // An existing consumer that still serves ui-smart from its own root keeps it.
  assert.equal(resolveSmartRoot('/distr', '/vendor/ui-smart'), '/vendor/ui-smart');

  // And the constructor goes through it, the Smart path hangs off the result,
  // and the page global still feeds it.
  assert.match(source, /this\.smartUrl = resolveSmartRoot\(this\.url, params\.smartUrl\);/);
  assert.match(source, /this\.smartPath = `\$\{this\.smartUrl\}\/smart`;/);
  assert.match(source, /if \(window\.sfSmartPath\) \{\s*props\.smartUrl = window\.sfSmartPath;/);
  assert.doesNotMatch(source, /params\.smartUrl \?\? this\.url/, 'the fallback is the named rule, not an accident');
});

test('registerPackage is on SF.RuleLoader and is not read as a rule', () => {
  const {rules} = harness();
  assert.equal(typeof rules.registerPackage, 'function');
  assert.ok(!Object.keys(rules).includes('registerPackage'));
  assert.ok(!Object.entries(rules).some(([, rule]) => typeof rule === 'function'));
});

test('a package rule is fetched from its package base, a Core rule from the Smart base', () => {
  const {loader, rules} = harness({declared: {pro: {base: '/assets/pro/smart/'}}});
  const added = loader.registerPackage('pro', {
    rules: {'cl-probe-badge': {tags: ['sf-probe-badge'], type: 'smart', mode: 'smart', js: true, css: true}},
  });
  assert.deepEqual(plain(added), ['cl-probe-badge']);
  assert.equal(rules['cl-probe-badge'].package, 'pro');
  assert.equal(loader.pathPluginJs('cl-probe-badge', true, 'default', 'smart'),
    '/assets/pro/smart/probe-badge/js/probe-badge.js');
  assert.equal(loader.pathPluginCss('cl-probe-badge', 'smart', 'default'),
    '/assets/pro/smart/probe-badge/css/probe-badge.css');
  assert.equal(loader.pathPluginJs('cl-spinner', true, 'default', 'smart'),
    '/distr/smart/spinner/js/spinner.js');
  assert.equal(loader.pathPluginCss('cl-spinner', 'smart', 'default'),
    '/distr/smart/spinner/css/spinner.css');
});

test('the page decides where a package is served; a bundle base is only a default', () => {
  const declared = harness({declared: {pro: {base: '/page/pro'}}});
  declared.loader.registerPackage('pro', {base: '/bundle/pro', rules: {'cl-a': {tags: ['sf-a'], type: 'smart', js: true}}});
  assert.equal(declared.loader.pathPluginJs('cl-a', true, 'default', 'smart'), '/page/pro/a/js/a.js');

  const undeclared = harness();
  undeclared.loader.registerPackage('own', {base: '/bundle/own/', rules: {'cl-b': {tags: ['sf-b'], type: 'smart', js: true}}});
  assert.equal(undeclared.loader.pathPluginJs('cl-b', true, 'default', 'smart'), '/bundle/own/b/js/b.js');
});

test('an unknown package or a missing base is said aloud and never falls back to the Smart base', () => {
  const {loader, rules, warnings} = harness();
  rules['cl-ghost'] = {tags: ['sf-ghost'], type: 'smart', js: true, package: 'ghost'};
  assert.equal(loader.pathPluginJs('cl-ghost', true, 'default', 'smart'), null);
  assert.equal(loader.pathPluginCss('cl-ghost', 'smart', 'default'), null);
  assert.equal(loader.isPluginResolvable('cl-ghost'), false);
  const unknown = warnings.filter((text) => text.includes('<sf-ghost>'));
  assert.equal(unknown.length, 1, 'said once, not on every scan');
  assert.match(unknown[0], /package "ghost"/);
  assert.match(unknown[0], /not declared/);

  loader.registerPackage('nobase', {rules: {'cl-orphan': {tags: ['sf-orphan'], type: 'smart', js: true}}});
  assert.equal(loader.isPluginResolvable('cl-orphan'), false);
  const missing = warnings.find((text) => text.includes('<sf-orphan>'));
  assert.match(missing, /package "nobase", which has no base/);
  assert.ok(warnings.every((text) => !text.includes('/distr/smart')));

  // A Core rule is untouched by any of this.
  assert.equal(loader.isPluginResolvable('cl-spinner'), true);
});

test('a declaration is checked when the page is read, not when a tag is met', () => {
  const {loader, warnings} = harness({declared: {
    pro: {base: '/assets/pro/smart'},
    custom: {base: '/x', rule: '/x/rules/js/rule.js'},
    'Bad Name': {base: '/y'},
    empty: {},
  }});
  assert.equal(loader.packages.pro.rule, '/assets/pro/smart/rule.js');
  assert.equal(loader.packages.custom.rule, '/x/rules/js/rule.js');
  assert.equal(loader.packages['Bad Name'], undefined);
  assert.ok(warnings.some((text) => text.includes('"Bad Name"') && text.includes('not a package name')));
  assert.ok(warnings.some((text) => text.includes('package "empty" is declared without a base')));
});

test('declared package rules are fetched before the first scan, and a failure is reported', async () => {
  const none = harness();
  assert.equal(none.loader.loadDeclaredPackageRules(), null, 'a page without packages starts synchronously');

  const {loader, scripts, warnings} = harness({declared: {
    pro: {base: '/assets/pro/smart'},
    gone: {base: '/absent'},
  }});
  await loader.loadDeclaredPackageRules();
  assert.deepEqual(plain(scripts), ['/assets/pro/smart/rule.js', '/absent/rule.js']);
  assert.ok(warnings.some((text) => text.includes('package "gone"') && text.includes('/absent/rule.js')));
  assert.ok(warnings.some((text) => text.includes('registered nothing for package "pro"')));

  // The constructor waits for them before init.
  assert.match(source, /const packageRulesReady = this\.loadDeclaredPackageRules\(\);/);
  assert.match(source, /packageRulesReady\.then\(\(\) => this\.init\(\)\)/);
});

test('rules registered after the first scan reach elements already on the page', () => {
  const late = harness({prepared: true, declared: {pro: {base: '/pro'}}});
  late.loader.registerPackage('pro', {rules: {'cl-late': {tags: ['sf-late'], type: 'smart', js: true}}});
  assert.equal(late.loader.attributeRuleIndex, null);
  assert.equal(late.loader.regexpScanRules, null);
  assert.equal(late.loader.attrMatchCache.size, 0);
  assert.equal(late.loader.regexMatchCache.size, 0);
  assert.deepEqual(late.scans.map(([kind]) => kind), ['custom', 'attributes', 'regexp']);
  assert.equal(late.scans[0][1], late.body);

  // Before the first scan there is nothing to read again: that scan reads them.
  const early = harness({prepared: false, declared: {pro: {base: '/pro'}}});
  early.loader.registerPackage('pro', {rules: {'cl-early': {tags: ['sf-early'], type: 'smart', js: true}}});
  assert.equal(early.scans.length, 0);
  assert.equal(early.loader.attributeRuleIndex, null);
});

test('a package may take over a Core rule that has not loaded, never one that has', () => {
  const {loader, rules, warnings} = harness({declared: {pro: {base: '/pro'}, other: {base: '/other'}}});
  loader.registerPackage('pro', {rules: {'cl-table': {tags: ['sf-table'], type: 'smart', js: true}}});
  assert.equal(rules['cl-table'].package, 'pro');
  assert.equal(loader.pathPluginJs('cl-table', true, 'default', 'smart'), '/pro/table/js/table.js');

  loader.registerPackage('other', {rules: {'cl-table': {tags: ['sf-table'], type: 'smart', js: true}}});
  assert.equal(rules['cl-table'].package, 'pro');
  assert.ok(warnings.some((text) => text.includes('already belongs to package "pro"')));

  loader.module['cl-spinner'] = 'cl-spinner';
  loader.registerPackage('pro', {rules: {'cl-spinner': {tags: ['sf-spinner'], type: 'smart', js: true}}});
  assert.equal(rules['cl-spinner'].package, undefined);
  assert.ok(warnings.some((text) => text.includes('"cl-spinner" is already loaded from the Smart base')));
});

test('a 404 in one base never marks the same name missing in another', () => {
  const {loader, stored} = harness({declared: {ghost: {base: '/ghost'}}});
  loader.registerPackage('ghost', {rules: {'cl-spinner': {tags: ['sf-spinner'], type: 'smart', js: true}}});
  loader.addToMissingFiles('cl-spinner', 'js');
  assert.deepEqual(Object.keys(loader.notFoundFiles), ['ghost::cl-spinner']);
  assert.deepEqual(JSON.parse(stored.get('SF_MISSING_PLUGINS')), {'ghost::cl-spinner': {js: true}});

  // A Core rule keeps the bare name browsers already hold.
  loader.addToMissingFiles('cl-table', 'js');
  assert.ok(loader.notFoundFiles['cl-table']);

  // The Loader reads its suppression under the same key it writes.
  assert.match(source, /const missKey = this\.getMissingFileKey\(pluginName\);/);
  const loadPlugin = between('SFLoaderPlugin.prototype.loadPlugin =', 'SFLoaderPlugin.prototype.loadRelationPlugins =');
  assert.doesNotMatch(loadPlugin, /notFoundFiles\[pluginName\]/);
});

test('revalidation forgets a package miss only for a rule of that package', () => {
  const {loader, rules, stored} = harness({declared: {pro: {base: '/pro'}}});
  rules['cl-x'] = {tags: ['sf-x'], type: 'smart', js: true, package: 'pro'};
  stored.set('SF_MISSING_PLUGINS', JSON.stringify({
    'pro::cl-x': {js: true},
    'pro::cl-spinner': {js: true},
    'cl-x': {js: true},
    'cl-unknown': {js: true},
  }));
  loader.revalidateMissingPlugins();
  assert.deepEqual(Object.keys(JSON.parse(stored.get('SF_MISSING_PLUGINS'))).sort(),
    ['cl-unknown', 'cl-x', 'pro::cl-spinner']);
});

/* The package was published as `larena` from 2026-10-11 to 2026-11-02 and is
   `pro` since (owner decision q-4ac7d07595). Until the journal's sweep day
   (option-package-larena-to-pro) the old name is the same package: a page
   that declares it, and a package built under it, meet one entry `pro`, and
   each use is noted once in SF.deprecations. */
test('packages.larena is a dated alias of packages.pro, noted in SF.deprecations', async () => {
  const {loader, rules, notes, scripts, warnings} = harness({declared: {larena: {base: '/assets/pro/smart/'}}});
  assert.deepEqual(Object.keys(loader.packages), ['pro'], 'one package, under its current name');
  assert.equal(loader.packages.pro.base, '/assets/pro/smart');
  assert.equal(loader.packages.pro.rule, '/assets/pro/smart/rule.js');
  assert.deepEqual(plain(notes), [{
    component: 'loader', kind: 'option',
    from: 'SF_BOOT_CONFIG.packages.larena', to: 'SF_BOOT_CONFIG.packages.pro',
    since: '2026-11-02', remove_after: '2027-01-01',
  }]);

  // A package built under either name lands in the one entry.
  await loader.loadDeclaredPackageRules();
  assert.deepEqual(plain(scripts), ['/assets/pro/smart/rule.js']);
  loader.registerPackage('pro', {rules: {'cl-table': {tags: ['sf-table'], type: 'smart', js: true}}});
  assert.equal(rules['cl-table'].package, 'pro');
  assert.equal(loader.pathPluginJs('cl-table', true, 'default', 'smart'), '/assets/pro/smart/table/js/table.js');
  assert.ok(!warnings.some((text) => text.includes('larena')), 'the alias itself is no warning');
});

test('a package built as larena registers as pro, under either declaration', () => {
  for (const declared of [{pro: {base: '/p'}}, {larena: {base: '/p'}}]) {
    const {loader, rules, notes, warnings} = harness({declared});
    const added = loader.registerPackage('larena', {rules: {'cl-data-view': {tags: ['sf-data-view'], type: 'smart', js: true}}});
    assert.deepEqual(plain(added), ['cl-data-view']);
    assert.equal(rules['cl-data-view'].package, 'pro');
    assert.equal(loader.pathPluginJs('cl-data-view', true, 'default', 'smart'), '/p/data-view/js/data-view.js');
    assert.ok(notes.some((note) => note.from === "SF.RuleLoader.registerPackage('larena')"
      && note.to === "SF.RuleLoader.registerPackage('pro')" && note.remove_after === '2027-01-01'));
    assert.ok(!warnings.some((text) => text.includes('already belongs')));
  }
});

test('both names declared: pro is the page\'s word, larena is said aloud and ignored', () => {
  const {loader, warnings} = harness({declared: {larena: {base: '/old'}, pro: {base: '/new'}}});
  assert.deepEqual(Object.keys(loader.packages), ['pro']);
  assert.equal(loader.packages.pro.base, '/new');
  assert.ok(warnings.some((text) => text.includes('both "pro" and its former name "larena"')));
});

test('the alias is the journal record and nothing else', () => {
  const journal = JSON.parse(fs.readFileSync(new URL('../contracts/changes/journal.json', import.meta.url), 'utf8'));
  const record = journal.records.find((one) => one.id === 'option-package-larena-to-pro');
  assert.ok(record, 'the journal records the alias');
  assert.equal(record.stage, 'compat');
  assert.match(source, new RegExp(`record: '${record.id}'`));
  assert.match(source, new RegExp(`remove_after: '${record.remove_after}'`));
  assert.match(source, new RegExp(`since: '${record.deprecated_on}'`));
  assert.deepEqual(record.items.map((item) => item.to),
    ['SF_BOOT_CONFIG.packages.pro', "SF.RuleLoader.registerPackage('pro')"]);
});
