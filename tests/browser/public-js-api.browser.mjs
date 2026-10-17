#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// src/core/contracts/public-js-api.json against the runtime, on the built
// bytes: every name the runtime puts on window.SF -- core, the Smart base, the
// field renderers, the theme generator -- is in the contract, public or
// internal, and every public name and member it lists is there. A name added
// to window.SF without a line here fails, so the reference the documentation
// prints cannot fall behind (week audit, 2026-10-18).
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const contract = JSON.parse(readFileSync(new URL('../../src/core/contracts/public-js-api.json', import.meta.url), 'utf8'));

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => note({said: `page error: ${error.message}`}));
  await page.route('http://probe.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body></body></html>'});
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'js-api', pluginListVersion: 'js-api', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script>
    </head><body><sf-badge text="x"></sf-badge><sf-theme-generator></sf-theme-generator><script src="/distr/core/js/core.js"></script></body></html>`);
  await page.waitForFunction(() => window.SF?.Loader && window.SF?.SfBaseElement, null, {timeout: 10000});
  await page.evaluate(() => window.SF.whenFieldRenderers?.());
  await page.waitForFunction(() => customElements.get('sf-theme-generator'), null, {timeout: 10000}).catch(() => {});
  await page.waitForTimeout(500);
  const runtime = await page.evaluate((globals) => {
    const keys = Object.keys(window.SF).map((key) => `SF.${key}`);
    const missing = [];
    for (const entry of globals) {
      const name = entry.name.slice(3);
      // What this page loads has to be there; a component's script API comes
      // with its component, which the page does not load, and is read only
      // when it is present.
      const loaded = ['core', 'smart-base', 'smart/field-renderers', 'smart/theme-generator'].includes(entry.loaded_by);
      if (!(name in window.SF)) { if (loaded && entry.status === 'public') missing.push(entry.name); continue; }
      for (const member of entry.members ?? []) {
        const value = window.SF[name];
        if (value === null || value === undefined || !(member in Object(value))) missing.push(`${entry.name}.${member}`);
      }
    }
    return {keys, missing};
  }, contract.globals);
  const listed = new Set(contract.globals.map((entry) => entry.name));
  const unlisted = runtime.keys.filter((key) => !listed.has(key));
  if (unlisted.length) note({case: 'every name on window.SF is in the contract', unlisted});
  if (runtime.missing.length) note({case: 'every public name and member the contract lists is on window.SF', missing: runtime.missing});
  console.log(JSON.stringify({names: runtime.keys.length, listed: listed.size}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PUBLIC_JS_API_OK');
