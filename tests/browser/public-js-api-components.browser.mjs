#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The component layer of src/core/contracts/public-js-api.json against the
// runtime, on the built bytes. tests/browser/public-js-api.browser.mjs loads
// core, the Smart base and two components; a component's script API (SF.Toast,
// SF.Tree, ...) arrives only with its component. This page holds every Smart
// tag of the build at once, so every Smart component's script API is there,
// and for each name on window.SF:
//   - every member the contract lists is on the object;
//   - every enumerable key is a member or an internal member (unless the keys
//     are data, open_members);
//   - every internal member is still there;
//   - a public component-layer name declares its keys, so the documentation
//     page it links to has a list to print (js-api acceptance M2, 2026-11-11:
//     22 names declared none of their 74 keys).
// A second page holds the plain components that give a script API --
// SF.AdminMenu, SF.Clipboard, SF.Flag, SF.Highlight, SF.Tab -- each loaded by
// the markup its rule names, and holds the same four rules for them.
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-js-api.json', import.meta.url), 'utf8'));
const smartDir = join(out, 'smart', 'smart');
const tags = readdirSync(smartDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name))
  .map((entry) => `sf-${entry.name}`);
if (tags.length < 50) throw new Error(`only ${tags.length} Smart components under ${smartDir}`);

const typeOf = (file) => file.endsWith('.css') ? 'text/css; charset=utf-8'
  : file.endsWith('.json') ? 'application/json; charset=utf-8'
  : file.endsWith('.svg') ? 'image/svg+xml'
  : file.endsWith('.woff2') ? 'font/woff2'
  : 'text/javascript; charset=utf-8';

// The plain components' markup: each rule (src/component/<name>/rule.js)
// loads its component when the page holds it.
const PLAIN = [
  '<nav class="sf-admin-menu"><ul><li><a href="#a">A</a></li></ul></nav>',
  '<button type="button" data-sf-copy="text">Copy</button>',
  '<span class="sf-flag" data-country="ru"></span>',
  '<pre><code class="language-js">const a = 1;</code></pre>',
  '<div class="sf-tab "><button type="button">One</button></div>',
].join('');

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
async function check(label, markup) {
  const page = await browser.newPage({viewport: {width: 1440, height: 4000}});
  page.on('pageerror', (error) => note({page: label, said: `page error: ${error.message}`}));
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body></body></html>'});
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: typeOf(file), body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><link rel="stylesheet" href="/distr/core/css/core.css">
    <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'js-api-components', pluginListVersion: 'js-api-components', preloader: {enabled: false}, icons: {enabled: false}};</script>
    </head><body>${markup}<script src="/distr/core/js/core.js"></script></body></html>`);
  await page.waitForFunction(() => window.SF?.Loader && window.SF?.SfBaseElement, null, {timeout: 20000});
  if (label === 'smart') await page.evaluate((list) => Promise.all(list.map((tag) => Promise.race([window.SF.whenDefined(tag), new Promise((done) => setTimeout(done, 8000))]))), tags);
  await page.evaluate(() => window.SF.whenFieldRenderers?.());
  // Wait until window.SF stops gaining names: a component's script API is set
  // by its module, which may run after the element is defined.
  await page.evaluate(() => new Promise((done) => {
    const keys = () => Object.keys(window.SF).sort().join();
    let last = keys(), still = 0, waited = 0;
    const tick = () => {
      const now = keys();
      still = now === last ? still + 250 : 0;
      last = now;
      waited += 250;
      if (still >= 2000 || waited >= 15000) done(); else setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  }));
  const runtime = await page.evaluate((globals) => {
    const missing = [];
    const undeclared = [];
    const stale = [];
    const bare = [];
    const present = [];
    for (const entry of globals) {
      const name = entry.name.slice(3);
      if (!(name in window.SF)) continue;
      present.push(entry.name);
      // A dated alias's getter notes each read; SF.whenDefine is a function.
      const own = Object.getOwnPropertyDescriptor(window.SF, name);
      const value = own && 'value' in own ? own.value : undefined;
      if (value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function')) continue;
      for (const member of entry.members ?? []) if (!(member in Object(value))) missing.push(`${entry.name}.${member}`);
      const declared = new Set([...(entry.members ?? []), ...(entry.internal_members ?? [])]);
      if (!entry.open_members) for (const key of Object.keys(value)) if (!declared.has(key)) undeclared.push(`${entry.name}.${key}`);
      for (const key of entry.internal_members ?? []) if (!(key in value)) stale.push(`${entry.name}.${key}`);
      if (entry.layer === 'component' && entry.audience === 'public' && Object.keys(value).length && !declared.size && !entry.open_members) bare.push(entry.name);
    }
    return {names: Object.keys(window.SF).length, present, missing, undeclared, stale, bare};
  }, contract.globals);
  await page.close();
  return runtime;
}

try {
  for (const [label, markup, expected] of [
    ['smart', tags.map((tag) => `<div><${tag}></${tag}></div>`).join(''), []],
    ['plain', PLAIN, ['SF.AdminMenu', 'SF.Clipboard', 'SF.Flag', 'SF.Highlight', 'SF.Tab']],
  ]) {
    const runtime = await check(label, markup);
    for (const name of expected) if (!runtime.present.includes(name)) note({page: label, case: 'the page loads the component that gives this name', absent: name});
    if (runtime.missing.length) note({page: label, case: 'every member the contract lists is on window.SF', missing: runtime.missing});
    if (runtime.undeclared.length) note({page: label, case: 'every enumerable member at runtime is declared, as a member or an internal member', undeclared: runtime.undeclared});
    if (runtime.stale.length) note({page: label, case: 'every internal member the contract lists is still there', stale: runtime.stale});
    if (runtime.bare.length) note({page: label, case: 'a public component-layer name declares its members', bare: runtime.bare});
    const components = contract.globals.filter((entry) => entry.layer === 'component' && runtime.present.includes(entry.name)).length;
    console.log(JSON.stringify({page: label, tags: label === 'smart' ? tags.length : undefined, names: runtime.names, present: runtime.present.length, components}));
  }
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_JS_API_COMPONENTS_OK');
