#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build/output
//   PLAYWRIGHT_MODULE=/abs/playwright/index.mjs picks another Playwright.
//
// Component sets in a real browser (standard simai.component-set 1.0.0,
// src/core/js/sets.js and the Loader): the built Core of the output, and a
// fixture set "demo" served on the same stand from the hosts a page would use
// -- an npm root holding three versions of @simai-studio/demo and the one
// compatibility index. The demo bundle defines <sf-demo-card> and gives its
// version as the set's exports.
//
// - data-sf-sets="demo": the index is read once, and the newest release this
//   Core runs (1.2.0; 2.0.0 asks for core.runtime >=99.0.0) is loaded from its
//   npm base; packageOf names the version and release; SF.package('demo')
//   resolves with the exports, before and after the Loader starts;
// - data-sf-sets="demo@1.0.0": that version's npm base, without the index;
// - SF_BOOT_CONFIG.packages.demo = '<base>': that base, without the index;
// - a set the index does not know is warned about with its reason, and draws
//   nothing; SF.package of an undeclared set rejects with the line to add;
// - no request leaves the stand;
// - debug (minified: false): a set named by the index, by a version or by a
//   base string has its passport, <base>/../set.json, read once; a plain
//   component package declared as {base} (the Pro package's form) asks for no
//   set.json, logs no console error and still draws (core.runtime 1.26.1).
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {existsSync, readFileSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';

const OUTPUT = process.argv[2] ? resolve(process.argv[2]) : null;
if (!OUTPUT || !existsSync(join(OUTPUT, 'core', 'core'))) throw new Error('Build output root is required (the directory holding core/, smart/, component/, utility/)');
const ORIGIN = 'http://sets.test/';
const DISTR = {
  core: join(OUTPUT, 'core', 'core'), rule: join(OUTPUT, 'core', 'rule'), component: join(OUTPUT, 'component', 'component'),
  utility: join(OUTPUT, 'utility', 'utility'), smart: join(OUTPUT, 'smart', 'smart'),
};
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const JS = TYPES['.js'];

const ruleFile = `SF.RuleLoader.registerPackage("demo", {
  api: "cl-demo-card",
  rules: {"cl-demo-card": {"js": true, "mode": "smart", "tags": ["sf-demo-card"], "type": "smart"}},
});
`;
const bundle = (version) => `class SfDemoCard extends HTMLElement {
  connectedCallback() { this.textContent = 'demo ${version}'; this.setAttribute('data-version', '${version}'); }
}
if (!customElements.get('sf-demo-card')) customElements.define('sf-demo-card', SfDemoCard);
SF.RuleLoader.registerPackage('demo', {exports: {version: '${version}', hello: () => 'hello from demo ${version}'}});
`;
const proRule = `SF.RuleLoader.registerPackage("pro", {
  rules: {"cl-pro-card": {"js": true, "mode": "smart", "tags": ["sf-pro-card"], "type": "smart"}},
});
`;
const proBundle = `class SfProCard extends HTMLElement {
  connectedCallback() { this.textContent = 'pro'; this.setAttribute('data-version', 'pro'); }
}
if (!customElements.get('sf-pro-card')) customElements.define('sf-pro-card', SfProCard);
`;
const PASSPORT = JSON.stringify({schema: 'simai.framework.component-set', id: 'demo', requires_sets: []});
const row = (version, coreRuntime) => ({
  set: 'demo', release: `demo-${version.replaceAll('.', '').padEnd(12, 'a')}`, version, source_revision: `${version.replaceAll('.', '').padEnd(12, 'a')}${'b'.repeat(28)}`,
  framework: {core_runtime: coreRuntime, source_revision: 'c'.repeat(40), pair: 'ui-000000000000'},
  requires_sets: [], receipt_sha256: 'd'.repeat(64), published_on: '2026-11-03',
});
const INDEX = {
  schema: 'simai.framework.set-index', schema_version: 1, summary: 'The fixture index.',
  sets: [{id: 'demo', title: 'Demo', repository: 'simai/ui-demo', npm: '@simai-studio/demo', licence: {class: 'framework', spdx: 'Apache-2.0'}, docs: 'https://example.org/'}],
  releases: [row('1.0.0', '>=1.0.0'), row('1.2.0', '>=1.25.0'), row('2.0.0', '>=99.0.0')],
};

const page = (boot, script = '', body = '<sf-demo-card id="card"></sf-demo-card>') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<script>
  window.sfPath = ${JSON.stringify(`${ORIGIN}distr/`)};
  window.SF_BOOT_CONFIG = ${JSON.stringify({preloader: {enabled: false}, setIndex: `${ORIGIN}sets/index.json`, setNpm: `${ORIGIN}npm`, ...boot})};
  window.early = (window.SF && SF.package) ? 'defined-before-core' : 'later';
</script>
<script src="${ORIGIN}distr/core/js/core.min.js"${script}></script>
</head><body>${body}</body></html>`;
const pages = {
  'index.html': page({}, ' data-sf-sets="demo"'),
  'version.html': page({setIndex: `${ORIGIN}missing/index.json`}, ' data-sf-sets="demo@1.0.0"'),
  'base.html': page({setIndex: `${ORIGIN}missing/index.json`, packages: {demo: `${ORIGIN}vendor/demo/dist/smart`}}),
  'unknown.html': page({}, ' data-sf-sets="ghost"', '<p>nothing to draw</p>'),
  'debug-index.html': page({minified: false}, ' data-sf-sets="demo"'),
  'debug-version.html': page({minified: false, setIndex: `${ORIGIN}missing/index.json`}, ' data-sf-sets="demo@1.0.0"'),
  'debug-base.html': page({minified: false, setIndex: `${ORIGIN}missing/index.json`, packages: {demo: `${ORIGIN}vendor/demo/dist/smart`}}),
  'debug-package.html': page({minified: false, setIndex: `${ORIGIN}missing/index.json`, packages: {pro: {base: `${ORIGIN}packages/pro/978d513/smart`}}}, '', '<sf-pro-card id="card"></sf-pro-card>'),
};

function serve(path) {
  if (pages[path]) return [TYPES['.html'], pages[path]];
  if (path === 'sets/index.json') return [TYPES['.json'], JSON.stringify(INDEX)];
  if (/^(npm\/@simai-studio\/demo@\d+\.\d+\.\d+|vendor\/demo)\/dist\/set\.json$/u.test(path)) return [TYPES['.json'], PASSPORT];
  const pro = /^packages\/pro\/978d513\/smart\/(.*)$/u.exec(path);
  if (pro) {
    if (pro[1] === 'rule.js' || pro[1] === 'rule.min.js') return [JS, proRule];
    if (/^pro-card\/js\/pro-card(\.min)?\.js$/u.test(pro[1])) return [JS, proBundle];
    return null;
  }
  const npm = /^npm\/@simai-studio\/demo@(\d+\.\d+\.\d+)\/dist\/smart\/(.*)$/u.exec(path);
  const vendor = /^vendor\/demo\/dist\/smart\/(.*)$/u.exec(path);
  if (npm || vendor) {
    const [version, rest] = npm ? [npm[1], npm[2]] : ['vendor', vendor[1]];
    if (rest === 'rule.js' || rest === 'rule.min.js') return [JS, ruleFile];
    if (/^demo-card\/js\/demo-card(\.min)?\.js$/u.test(rest)) return [JS, bundle(version)];
    return null;
  }
  if (path.startsWith('distr/')) {
    const [part, ...rest] = path.slice('distr/'.length).split('/');
    if (!DISTR[part]) return null;
    const file = resolve(DISTR[part], rest.join('/'));
    if (!file.startsWith(DISTR[part] + sep) || !existsSync(file)) return null;
    return [TYPES[extname(file)] ?? 'application/octet-stream', readFileSync(file)];
  }
  return null;
}

const checks = [];
const check = (page, id, got, want) => checks.push({page, id, pass: JSON.stringify(got) === JSON.stringify(want), got, want});
const browser = await chromium.launch();

async function open(name) {
  const tab = await browser.newPage();
  const requests = [];
  const warnings = [];
  const errors = [];
  tab.on('request', (request) => requests.push(request.url()));
  tab.on('console', (message) => (message.type() === 'warning' ? warnings : message.type() === 'error' ? errors : []).push(message.text()));
  tab.on('pageerror', (error) => errors.push(String(error)));
  await tab.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(ORIGIN)) return route.abort();
    const answer = serve(new URL(url).pathname.slice(1));
    return answer ? route.fulfill({contentType: answer[0], body: answer[1]}) : route.fulfill({status: 404, body: ''});
  });
  await tab.goto(`${ORIGIN}${name}`);
  await tab.waitForFunction(() => window.SF?.Loader?.packageExports, null, {timeout: 15000});
  const seen = await tab.evaluate(async () => {
    const settle = (promise, ms = 8000) => Promise.race([promise.then((value) => ({value}), (error) => ({error: String(error?.message ?? error)})), new Promise((done) => setTimeout(() => done({timeout: true}), ms))]);
    const exported = await settle(SF.package('demo'));
    const other = await settle(SF.package('other'));
    const record = SF.RuleLoader.packageOf('demo');
    const pro = SF.RuleLoader.packageOf('pro');
    const card = document.getElementById('card');
    return {
      exported: exported.value ? {version: exported.value.version, hello: exported.value.hello()} : exported,
      other,
      record: record && {base: record.base, version: record.version, release: record.release, api: record.api, registered: record.registered},
      drawn: card?.getAttribute('data-version') ?? null,
      early: window.early,
      pro: pro && {base: pro.base, registered: pro.registered},
    };
  });
  await tab.close();
  return {...seen, requests, warnings, errors};
}

const indexed = await open('index.html');
check('index', 'the newest release this Core runs, from its npm base', indexed.record, {base: `${ORIGIN}npm/@simai-studio/demo@1.2.0/dist/smart`, version: '1.2.0', release: 'demo-120aaaaaaaaa', api: 'cl-demo-card', registered: true});
check('index', 'SF.package resolves with the exports', indexed.exported, {version: '1.2.0', hello: 'hello from demo 1.2.0'});
check('index', 'the element of that release draws', indexed.drawn, '1.2.0');
check('index', 'the index is read once', indexed.requests.filter((url) => url.endsWith('sets/index.json')).length, 1);
check('index', 'an undeclared set rejects with the line to add', /not declared on this page; add data-sf-sets="other"/u.test(indexed.other.error ?? ''), true);
check('index', 'no request leaves the stand', indexed.requests.filter((url) => !url.startsWith(ORIGIN)), []);
check('index', 'no page error', indexed.errors, []);

const versioned = await open('version.html');
check('version', 'a version is its npm base', versioned.record && {base: versioned.record.base, version: versioned.record.version}, {base: `${ORIGIN}npm/@simai-studio/demo@1.0.0/dist/smart`, version: '1.0.0'});
check('version', 'the index is not read', versioned.requests.filter((url) => url.includes('index.json')), []);
check('version', 'that version draws', [versioned.drawn, versioned.exported.version], ['1.0.0', '1.0.0']);

const based = await open('base.html');
check('base', 'a base is used as given', based.record?.base, `${ORIGIN}vendor/demo/dist/smart`);
check('base', 'the index is not read', based.requests.filter((url) => url.includes('index.json')), []);
check('base', 'the set draws from the base', based.drawn, 'vendor');

const unknown = await open('unknown.html');
check('unknown', 'a set the index does not know is warned about with its reason', unknown.warnings.some((text) => /set "ghost" could not be placed from the compatibility index \(unknown-set\)/u.test(text)), true);
check('unknown', 'and nothing more is fetched for it', unknown.requests.filter((url) => url.includes('ghost')), []);

const passports = (seen) => seen.requests.filter((url) => url.endsWith('/set.json'));
const debugIndexed = await open('debug-index.html');
check('debug-index', 'the set\'s passport is read once, beside its npm base', passports(debugIndexed), [`${ORIGIN}npm/@simai-studio/demo@1.2.0/dist/set.json`]);
check('debug-index', 'the set draws', debugIndexed.drawn, '1.2.0');
check('debug-index', 'no console error', debugIndexed.errors, []);

const debugVersioned = await open('debug-version.html');
check('debug-version', 'the set\'s passport is read beside its npm version', passports(debugVersioned), [`${ORIGIN}npm/@simai-studio/demo@1.0.0/dist/set.json`]);
check('debug-version', 'the set draws', debugVersioned.drawn, '1.0.0');

const debugBased = await open('debug-base.html');
check('debug-base', 'the set\'s passport is read beside the base given', passports(debugBased), [`${ORIGIN}vendor/demo/dist/set.json`]);
check('debug-base', 'the set draws', debugBased.drawn, 'vendor');

const debugPackage = await open('debug-package.html');
check('debug-package', 'a plain package asks for no set.json', passports(debugPackage), []);
check('debug-package', 'no 404 at all', debugPackage.requests.filter((url) => !serve(new URL(url).pathname.slice(1))), []);
check('debug-package', 'no console error', debugPackage.errors, []);
check('debug-package', 'the package element draws', debugPackage.drawn, 'pro');
check('debug-package', 'the package is registered from its base', debugPackage.pro, {base: `${ORIGIN}packages/pro/978d513/smart`, registered: true});

await browser.close();
const failed = checks.filter((item) => !item.pass);
console.log(`${checks.length - failed.length}/${checks.length} component-set checks on ${OUTPUT}`);
for (const item of failed) console.log(`FAIL ${item.page}: ${item.id}\n  got  ${JSON.stringify(item.got)}\n  want ${JSON.stringify(item.want)}`);
process.exit(failed.length ? 1 : 0);
