#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A component package is served from its own base and brings its own rules,
// and the Loader fetches its components from there -- never from the Smart
// base (Pro split, stage 2). Larena's components are the first package; this probe
// uses a fake one, tests/fixtures/loader-package, so it judges the Loader and
// nothing else.
//
// The build output is served the way the `ui` distribution lays it out --
// core, component, utility, rule and smart side by side under one `distr/` --
// and the pages set `sfPath` alone, so every Smart file here is also a check
// that Smart resolves to `<sfPath>/smart` without `sfSmartPath`.
//
// What it holds:
//   1. a declared package's component is fetched from the package base and
//      renders, and nothing is asked of the Smart base for it;
//   2. a package registered after the page is up reaches an element that was
//      already in the document;
//   3. a package rule with no base is said aloud, naming the tag and the
//      package, and nothing is fetched for it;
//   4. a 404 in a package base is cached for that package only: the next page,
//      without the package, loads the same name from the Smart base.
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
  // A package base that holds nothing: every request is a 404.
  ['/ghost/', join(fixture, 'absent-on-purpose')],
];
const absent = [
  join(out, 'core', 'core', 'js', 'core.js'),
  join(out, 'smart', 'smart', 'spinner', 'js', 'spinner.js'),
  join(fixture, 'rule.js'),
].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} asset(s) not found`);
}

const boot = (packages) => `<!doctype html><html lang="en" class="theme-light"><head>
<meta charset="utf-8"><title>loader packages</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    // Both versions set, or the Loader clears its caches on every start and a
    // miss could never reach the second page to be judged there.
    cacheVersion: 'loader-packages-probe',
    pluginListVersion: 'loader-packages-probe',
    preloader: {enabled: false},
    icons: {enabled: false},
    smart: {base: true},
    theme: false,
    ${packages ? `packages: ${JSON.stringify(packages)},` : ''}
  };
</script></head><body>`;
const pages = {
  '/with-packages.html': `${boot({
    probe: {base: '/pkg'},
    ghost: {base: '/ghost', rule: '/pkg/ghost-rule.js'},
  })}
<sf-probe-badge id="badge"></sf-probe-badge>
<sf-probe-late id="late"></sf-probe-late>
<pr-own id="own"></pr-own>
<xx-stray id="stray"></xx-stray>
<script src="/distr/core/js/core.js"></script></body></html>`,
  '/without-packages.html': `${boot(null)}
<sf-spinner id="spinner"></sf-spinner>
<script src="/distr/core/js/core.js"></script></body></html>`,
};

const types = new Map([
  ['.js', 'text/javascript'], ['.mjs', 'text/javascript'], ['.css', 'text/css'],
  ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'],
]);
const requests = [];
// Served by the probe itself rather than python's http.server, which truncates
// a file now and then under parallel requests (loader-hidden-tab.browser.mjs).
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  requests.push(url.pathname);
  try {
    if (pages[url.pathname]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(pages[url.pathname]);
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
const browser = await chromium.launch();
const report = {};
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('pageerror', (error) => failures.push({case: 'page error', said: error.message}));

  // 1. A declared package.
  await page.goto(`${origin}/with-packages.html`);
  try {
    await page.waitForFunction(() => Boolean(customElements.get('sf-probe-badge')), null, {timeout: 15000});
  } catch {
    failures.push({case: 'declared package', expected: 'sf-probe-badge is defined from the package base'});
  }
  const badge = await page.evaluate(() => {
    const element = document.querySelector('#badge');
    return {text: element.textContent, from: element.dataset.loadedFrom ?? ''};
  });
  report.badge = badge;
  if (badge.text !== 'package badge') {
    failures.push({case: 'declared package', got: badge, expected: 'the package component renders'});
  }
  if (!new URL(badge.from || 'x:/').pathname.startsWith('/pkg/probe-badge/js/probe-badge.js')) {
    failures.push({case: 'declared package', got: badge, expected: 'loaded from /pkg/probe-badge/js/probe-badge.js'});
  }
  if (requests.some((path) => path.startsWith('/distr/smart/probe-badge'))) {
    failures.push({case: 'declared package', expected: 'nothing asked of the Smart base for a package component'});
  }

  // 5. An element with the package's own prefix loads from the package, and
  // SF.create keeps its full name; a rule that is not a package's cannot claim
  // a tag outside sf-.
  try {
    await page.waitForFunction(() => Boolean(customElements.get('pr-own')), null, {timeout: 10000});
  } catch {
    failures.push({case: 'own prefix', expected: 'pr-own is defined from the package base'});
  }
  report.own = await page.evaluate(async () => {
    const element = document.querySelector('#own');
    window.SF.RuleLoader['cl-stray'] = {tags: ['xx-stray'], type: 'smart', mode: 'smart', js: true};
    window.SF.Loader.rulesChanged?.();
    await new Promise((settle) => setTimeout(settle, 400));
    return {
      text: element.textContent,
      from: element.dataset.loadedFrom ?? '',
      created: window.SF.create('pr-own').tagName.toLowerCase(),
      shorthand: window.SF.create('spinner').tagName.toLowerCase(),
      strayClaimed: Boolean(window.SF.Loader.getCustomElementRules()['xx-stray']),
    };
  });
  if (report.own.text !== 'own prefix' || !new URL(report.own.from || 'x:/').pathname.startsWith('/pkg/probe-own/js/probe-own.js')) {
    failures.push({case: 'own prefix', got: report.own, expected: 'pr-own renders, loaded from /pkg/probe-own/js/probe-own.js'});
  }
  if (report.own.created !== 'pr-own' || report.own.shorthand !== 'sf-spinner') {
    failures.push({case: 'own prefix', got: report.own, expected: 'SF.create keeps pr-own and still expands a short name'});
  }
  if (report.own.strayClaimed || requests.some((path) => path.includes('stray'))) {
    failures.push({case: 'own prefix', got: report.own, expected: 'a rule without a package claims no tag outside sf-'});
  }

  // 4, first half: the package base 404s for a name Core also ships. The
  // element arrives after the page has loaded, because the Loader forgets, at
  // load, a cached miss whose rule is registered: a 404 met before that would
  // be forgotten either way, and the second page could not tell a miss keyed
  // per package from one that poisons the Smart base.
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const spinner = document.createElement('sf-spinner');
    spinner.id = 'spinner';
    document.body.append(spinner);
  });
  try {
    await page.waitForFunction(
      () => Boolean(window.SF?.Loader?.notFoundFiles?.['ghost::cl-spinner']),
      null,
      {timeout: 10000},
    );
  } catch {
    failures.push({case: 'package 404', expected: 'the miss is recorded as ghost::cl-spinner'});
  }
  const miss = await page.evaluate(() => ({
    keys: Object.keys(window.SF.Loader.notFoundFiles),
    stored: localStorage.getItem('SF_MISSING_PLUGINS'),
    spinnerDefined: Boolean(customElements.get('sf-spinner')),
  }));
  report.packageMiss = miss;
  if (miss.keys.includes('cl-spinner')) {
    failures.push({case: 'package 404', got: miss, expected: 'the bare name is not marked missing'});
  }
  const stored = Object.keys(JSON.parse(String(miss.stored ?? '{}').replace(/^sf-json-v1:/u, '') || '{}'));
  if (!stored.includes('ghost::cl-spinner') || stored.includes('cl-spinner')) {
    failures.push({case: 'package 404', got: stored, expected: 'the browser keeps ghost::cl-spinner, not cl-spinner'});
  }
  if (miss.spinnerDefined) {
    failures.push({case: 'package 404', got: miss, expected: 'no fallback: sf-spinner stays undefined on this page'});
  }
  if (!requests.includes('/ghost/spinner/js/spinner.js')) {
    failures.push({case: 'package 404', expected: 'sf-spinner was asked of the package base'});
  }
  if (requests.some((path) => path.startsWith('/distr/smart/spinner/'))) {
    failures.push({case: 'package 404', expected: 'no quiet fallback to the Smart base'});
  }

  // 2. A package registered after the page is up.
  const before = await page.evaluate(() => Boolean(customElements.get('sf-probe-late')));
  await page.evaluate(() => window.SF.RuleLoader.registerPackage('late', {
    base: '/pkg',
    rules: {'cl-probe-late': {tags: ['sf-probe-late'], type: 'smart', mode: 'smart', js: true}},
  }));
  try {
    await page.waitForFunction(() => Boolean(customElements.get('sf-probe-late')), null, {timeout: 10000});
  } catch {
    failures.push({case: 'late registration', expected: 'an element already on the page is loaded once its rule arrives'});
  }
  const late = await page.evaluate(() => {
    const element = document.querySelector('#late');
    return {text: element.textContent, from: element.dataset.loadedFrom ?? ''};
  });
  report.late = {definedBefore: before, ...late};
  if (before || late.text !== 'late package element') {
    failures.push({case: 'late registration', got: report.late});
  }

  // 3. A package without a base.
  const warningsBefore = warnings.length;
  await page.evaluate(() => {
    document.body.append(document.createElement('sf-probe-orphan'));
    window.SF.RuleLoader.registerPackage('orphan', {
      rules: {'cl-probe-orphan': {tags: ['sf-probe-orphan'], type: 'smart', mode: 'smart', js: true}},
    });
  });
  await page.waitForTimeout(800);
  const said = warnings.slice(warningsBefore).filter((text) => text.includes('<sf-probe-orphan>'));
  report.orphan = said;
  if (!said.some((text) => text.includes('package "orphan"'))) {
    failures.push({case: 'missing base', got: warnings.slice(warningsBefore), expected: 'a warning naming <sf-probe-orphan> and package "orphan"'});
  }
  if (requests.some((path) => path.includes('probe-orphan'))) {
    failures.push({case: 'missing base', expected: 'nothing fetched for a package with no base'});
  }
  await page.close();

  // 4, second half: same browser storage, no package -- the Smart base serves.
  const second = await context.newPage();
  second.on('pageerror', (error) => failures.push({case: 'page error (second page)', said: error.message}));
  await second.goto(`${origin}/without-packages.html`);
  try {
    await second.waitForFunction(() => Boolean(customElements.get('sf-spinner')), null, {timeout: 15000});
  } catch {
    failures.push({case: 'Smart base after a package 404', expected: 'sf-spinner loads from the Smart base'});
  }
  report.smartAfterMiss = await second.evaluate(() => ({
    defined: Boolean(customElements.get('sf-spinner')),
    missing: Object.keys(window.SF?.Loader?.notFoundFiles ?? {}),
  }));
  // Either form: the Loader fetches the minified twin unless debugging.
  if (!requests.some((path) => /^\/distr\/smart\/spinner\/js\/spinner(\.min)?\.js/u.test(path))) {
    failures.push({case: 'Smart base after a package 404', expected: 'spinner.js fetched from /distr/smart (sfPath alone)'});
  }
  // The element appearing is not by itself the proof: a Smart rule with
  // relations is fetched once its relations are, whatever the miss cache says
  // (checkToFullRelationLoad), and every Smart rule has relations. What a 404
  // keyed by the bare name poisons is the Smart base's own suppression on the
  // next page, so that is what is read. Measured: with the key reduced to the
  // bare name, this and the three package-404 checks above fail, and
  // sf-spinner still appears.
  if (report.smartAfterMiss.missing.includes('cl-spinner')) {
    failures.push({case: 'Smart base after a package 404', got: report.smartAfterMiss, expected: 'cl-spinner is not marked missing for the Smart base'});
  }
  await second.close();
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({
  probe: 'loader-packages',
  ...report,
  result: failures.length ? 'LOADER_PACKAGES_FAIL' : 'LOADER_PACKAGES_OK',
  failures,
}, null, 2));
if (failures.length) process.exit(1);
