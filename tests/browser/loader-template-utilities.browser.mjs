#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The utilities a Smart component's templates draw with are asked for in the
// wave that asks for the component, on the built bytes. Over a network that
// takes 40 ms an answer, every utility sheet the table
// (src/core/js/template-utilities.generated.json) names for a component on
// the page is requested within one answer of that component's script -- they
// used to come in a last wave of their own, after the component had drawn
// without them (2026-10-18: six waves, utilities last, done at 503 ms; five
// and 290 ms with them asked together).
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const table = JSON.parse(readFileSync(new URL('../../src/core/js/template-utilities.generated.json', import.meta.url), 'utf8'));
const LATENCY = 40;
const ON_PAGE = ['tabs', 'help-mark', 'datepicker'];

const failures = [];
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) note({said: `page error: ${error.message}`}); });
  const started = Date.now();
  const asked = [];
  await page.route('http://probe.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru"><head><meta charset="utf-8">
        <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'waves', pluginListVersion: 'waves', preloader: {enabled: false}, icons: {enabled: false}, theme: false};</script></head><body>
        <sf-tabs items="А|Б|В"></sf-tabs><sf-help-mark text="x" label="y"></sf-help-mark><sf-datepicker></sf-datepicker>
        <script src="/distr/core/js/core.js"></script></body></html>`});
    }
    const path = url.pathname.replace(/^\/distr\//u, '');
    asked.push({at: Date.now() - started, path});
    await new Promise((done) => setTimeout(done, LATENCY));
    const [product, ...rest] = path.split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => customElements.get('sf-tabs') && document.querySelector('sf-tabs')?.shadowRoot !== undefined, null, {timeout: 10000});
  await page.waitForTimeout(1500);

  const when = (prefix) => asked.find((request) => request.path.startsWith(prefix))?.at;
  const report = {};
  for (const name of ON_PAGE) {
    const script = when(`smart/${name}/js/`);
    if (script === undefined) { note({case: `sf-${name} is asked for`, got: asked.map((request) => request.path)}); continue; }
    const late = [];
    for (const rule of table[`cl-${name}`] ?? []) {
      const sheet = when(`utility/${rule}/`);
      if (sheet === undefined) late.push(`${rule}: not asked for`);
      else if (sheet - script > LATENCY) late.push(`${rule}: ${sheet - script} ms after the script`);
    }
    report[name] = {script, utilities: (table[`cl-${name}`] ?? []).length};
    if (late.length) note({case: `the utilities sf-${name} draws with come with it`, got: late});
  }
  if (!Object.values(report).some((entry) => entry.utilities > 0)) note({case: 'the page holds components that draw with utilities', got: report});
  console.log(JSON.stringify({requests: asked.length, last: asked.at(-1)?.at, report}));
} finally {
  await browser.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('LOADER_TEMPLATE_UTILITIES_OK');
