#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build-output [loads per case, default 6]
//
// Two packages that define the same rule (pro bundles the sets, so a page that
// declares pro and a set gets two copies): the package the page declares first
// keeps the rule on every load, whichever rule file arrives first, and the pair
// is one console error naming both packages and the one in use. Before
// core.runtime's fix the first rule file to arrive won, and 12 loads of one
// page gave two different copies (ui-control research 2026-11-14-component-sets
// §2.3). The server holds back the first-declared package's rule file, so the
// other one always arrives first.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const loads = Number(process.argv[3] || 6);
const fixture = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'loader-package-order');

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/bundle/', join(fixture, 'bundle')],
  ['/set/', join(fixture, 'set')],
];
const core = join(out, 'core', 'core', 'js', 'core.js');
if (!existsSync(core)) throw new Error(`${core} not found`);

const page = (packages) => `<!doctype html><html lang="en" class="theme-light"><head>
<meta charset="utf-8"><title>package order</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'package-order-' + Math.random(),
    pluginListVersion: 'package-order-' + Math.random(),
    // The fixtures ship readable files only.
    minified: false,
    preloader: {enabled: false},
    icons: {enabled: false},
    theme: false,
    packages: ${JSON.stringify(packages)},
  };
</script></head><body>
<sf-probe-shared id="shared"></sf-probe-shared>
<sf-probe-solo id="solo"></sf-probe-solo>
<script src="/distr/core/js/core.js"></script></body></html>`;
const cases = {
  '/bundle-first.html': {packages: {'order-bundle': {base: '/bundle'}, 'order-set': {base: '/set'}}, slow: '/bundle/rule.js', winner: 'order-bundle'},
  '/set-first.html': {packages: {'order-set': {base: '/set'}, 'order-bundle': {base: '/bundle'}}, slow: '/set/rule.js', winner: 'order-set'},
};

const types = new Map([['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8']]);
let slow = '';
const requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  requests.push(url.pathname);
  try {
    if (cases[url.pathname]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(page(cases[url.pathname].packages));
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    if (url.pathname === slow) await new Promise((done) => setTimeout(done, 400));
    response.writeHead(200, {'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream', 'Content-Length': bytes.length});
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
  for (const [path, expected] of Object.entries(cases)) {
    slow = expected.slow;
    report[path] = [];
    for (let load = 1; load <= loads; load++) {
      const context = await browser.newContext();
      const tab = await context.newPage();
      const errors = [];
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
      const missing = [];
      tab.on('response', (response) => { if (response.status() >= 400) missing.push(new URL(response.url()).pathname); });
      requests.length = 0;
      await tab.goto(`${origin}${path}`);
      await tab.waitForFunction(() => Boolean(customElements.get('sf-probe-shared') && customElements.get('sf-probe-solo')), null, {timeout: 15000})
        .catch(() => failures.push({case: path, load, expected: 'both elements defined'}));
      await tab.waitForTimeout(200);
      const got = await tab.evaluate(() => ({
        shared: document.querySelector('#shared').dataset.package ?? '',
        rule: window.SF?.RuleLoader?.['cl-probe-shared']?.package ?? '',
      }));
      const fetched = requests.filter((url) => url.endsWith('/probe-shared/js/probe-shared.js'));
      const own = errors.filter((text) => text.includes('both define'));
      report[path].push({load, ...got, fetched, errors, missing});
      // A 404 is the browser's own line; only the probe's packages must answer.
      if (missing.some((url) => url.startsWith('/bundle/') || url.startsWith('/set/'))) failures.push({case: path, load, missing, expected: 'every package file answers'});
      if (got.shared !== expected.winner || got.rule !== expected.winner) failures.push({case: path, load, got, expected: expected.winner});
      if (fetched.length !== 1 || !fetched[0].startsWith(`/${expected.winner.replace('order-', '')}/`)) failures.push({case: path, load, fetched, expected: `one copy, from ${expected.winner}`});
      if (own.length !== 1 || !own[0].includes(`this page uses package "${expected.winner}" (the page declares it first)`)
        || !own[0].includes('"order-bundle"') || !own[0].includes('"order-set"') || !own[0].includes('<sf-probe-shared>')) {
        failures.push({case: path, load, errors, expected: 'one error naming both packages, the component and the winner'});
      }
      if (errors.filter((text) => !text.startsWith('Failed to load resource')).length !== own.length) failures.push({case: path, load, errors, expected: 'no other console error'});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({loads, report, failures}, null, 2));
if (failures.length) process.exit(1);
