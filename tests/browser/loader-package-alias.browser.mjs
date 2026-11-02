#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The SIMAI Framework Pro package is named pro since 2026-11-02 (owner
// decision q-4ac7d07595); its former name larena is a dated alias until
// 2027-01-01 (contracts/changes/journal.json, option-package-larena-to-pro).
// On a real page, with the built core:
//   1. packages.pro loads the package's component from its base and notes
//      nothing;
//   2. packages.larena loads the same package -- built as pro or as larena --
//      and notes the old declaration in SF.deprecations, printed when the page
//      opts in with data-sf-deprecations="warn";
//   3. packages.pro over a package built as larena loads it and notes the old
//      registerPackage call;
//   4. both names declared: pro wins, larena is said aloud and not fetched.
// The package is the fake one in tests/fixtures/loader-package, so the probe
// judges the Loader and nothing else.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const fixture = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'loader-package');

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
  ['/pkg/', fixture],
  ['/old/', fixture],
];
const absent = [
  join(out, 'core', 'core', 'js', 'core.js'),
  join(fixture, 'pro-rule.js'),
  join(fixture, 'larena-rule.js'),
].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} asset(s) not found`);
}

const page = (packages) => `<!doctype html><html lang="en" class="theme-light" data-sf-deprecations="warn"><head>
<meta charset="utf-8"><title>package alias</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'loader-package-alias-probe',
    pluginListVersion: 'loader-package-alias-probe',
    preloader: {enabled: false},
    icons: {enabled: false},
    smart: {base: true},
    theme: false,
    packages: ${JSON.stringify(packages)},
  };
</script></head><body>
<sf-probe-badge id="badge"></sf-probe-badge>
<script src="/distr/core/js/core.js"></script></body></html>`;

const DECLARED = 'SF_BOOT_CONFIG.packages.larena';
const REGISTERED = "SF.RuleLoader.registerPackage('larena')";
const cases = [
  {name: 'pro over a pro build', packages: {pro: {base: '/pkg', rule: '/pkg/pro-rule.js'}}, notes: []},
  {name: 'larena over a pro build', packages: {larena: {base: '/pkg', rule: '/pkg/pro-rule.js'}}, notes: [DECLARED]},
  {name: 'larena over a larena build', packages: {larena: {base: '/pkg', rule: '/pkg/larena-rule.js'}}, notes: [DECLARED, REGISTERED]},
  {name: 'pro over a larena build', packages: {pro: {base: '/pkg', rule: '/pkg/larena-rule.js'}}, notes: [REGISTERED]},
  {name: 'both names declared', packages: {larena: {base: '/old', rule: '/old/larena-rule.js'}, pro: {base: '/pkg', rule: '/pkg/pro-rule.js'}}, notes: [DECLARED], warns: 'both "pro" and its former name "larena"'},
];

const types = new Map([
  ['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.css', 'text/css'],
  ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'],
]);
let requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  requests.push(url.pathname);
  try {
    const index = /^\/case-(\d+)\.html$/u.exec(url.pathname);
    if (index && cases[Number(index[1])]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(page(cases[Number(index[1])].packages));
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream',
      'Content-Length': bytes.length,
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const [index, one] of cases.entries()) {
    // A context of its own per case: no cached plugin list or miss crosses over.
    const context = await browser.newContext();
    const tab = await context.newPage();
    const warnings = [];
    tab.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    tab.on('pageerror', (error) => failures.push({case: one.name, said: error.message}));
    requests = [];
    await tab.goto(`${origin}/case-${index}.html`);
    try {
      await tab.waitForFunction(() => Boolean(customElements.get('sf-probe-badge')), null, {timeout: 15000});
    } catch {
      failures.push({case: one.name, expected: 'sf-probe-badge is defined from the package base'});
    }
    const seen = await tab.evaluate(() => {
      const element = document.querySelector('#badge');
      return {
        text: element.textContent,
        from: element.dataset.loadedFrom ?? '',
        packages: Object.keys(window.SF.Loader.packages),
        rulePackage: window.SF.RuleLoader['cl-probe-badge']?.package ?? null,
        notes: (window.SF.deprecations?.list?.() ?? [])
          .filter((note) => note.component === 'loader')
          .map(({from, to, remove_after: removeAfter, count}) => ({from, to, removeAfter, count})),
      };
    });
    seen.warnings = warnings.filter((text) => text.includes('larena'));
    seen.requests = requests.filter((path) => !path.startsWith('/distr/'));
    report[one.name] = seen;
    if (seen.text !== 'package badge' || !new URL(seen.from || 'x:/').pathname.startsWith('/pkg/probe-badge/js/probe-badge.js')) {
      failures.push({case: one.name, got: seen, expected: 'the package component renders, loaded from /pkg'});
    }
    if (JSON.stringify(seen.packages) !== '["pro"]' || seen.rulePackage !== 'pro') {
      failures.push({case: one.name, got: seen, expected: 'one package, pro, owns the rule'});
    }
    const noted = seen.notes.map((note) => note.from).sort();
    if (JSON.stringify(noted) !== JSON.stringify([...one.notes].sort())) {
      failures.push({case: one.name, got: seen.notes, expected: one.notes});
    }
    if (seen.notes.some((note) => note.removeAfter !== '2027-01-01' || !/\.pro\b|'pro'/u.test(note.to))) {
      failures.push({case: one.name, got: seen.notes, expected: 'each note names pro and remove_after 2027-01-01'});
    }
    // Opted in: each old name is printed once, as a legacy name with its date.
    for (const from of one.notes) {
      if (!seen.warnings.some((text) => text.includes(from) && text.includes('until 2027-01-01'))) {
        failures.push({case: one.name, got: seen.warnings, expected: `a warning for ${from}`});
      }
    }
    if (one.warns && !seen.warnings.some((text) => text.includes(one.warns))) {
      failures.push({case: one.name, got: seen.warnings, expected: one.warns});
    }
    if (one.warns && seen.requests.some((path) => path.startsWith('/old/'))) {
      failures.push({case: one.name, got: seen.requests, expected: 'nothing fetched from the ignored larena base'});
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({
  probe: 'loader-package-alias',
  ...report,
  result: failures.length ? 'LOADER_PACKAGE_ALIAS_FAIL' : 'LOADER_PACKAGE_ALIAS_OK',
  failures,
}, null, 2));
if (failures.length) process.exit(1);
