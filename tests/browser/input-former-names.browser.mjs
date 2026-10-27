#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-input's former names keep working until 2026-12-01 (change journal
// path-smart-inputs-to-input), measured on the built bytes served the way the
// `ui` distribution lays them out:
//
//   1. an old page: core.js with the Loader, and the former path
//      smart/inputs/js/inputs.js and css/inputs.css written by hand. sf-input is
//      defined once and renders its native input, the old path is noted in the
//      deprecation notes, and nothing throws;
//   2. a product rule that still names the former bundle cl-inputs in its
//      relation (as ui-pro's table, property view and admin menu do): the
//      Loader forwards it to cl-input, fetches smart/input/js/input.js, and the
//      product element renders after it; nothing is asked of smart/inputs/.
//      The forward is not in the distribution's rule.json, where a rule of
//      type smart is a Smart component to the registry
//      (src/core/contracts/smart-rule-forwards.v1.json).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [
  join(out, 'core', 'core', 'js', 'core.js'),
  join(out, 'core', 'rule', 'rule.json'),
  join(out, 'smart', 'smart', 'input', 'js', 'input.js'),
  join(out, 'smart', 'smart', 'inputs', 'js', 'inputs.js'),
  join(out, 'smart', 'smart', 'inputs', 'css', 'inputs.css'),
].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} asset(s) not found`);
}

const failures = [];
const report = {};

const rules = JSON.parse(readFileSync(join(out, 'core', 'rule', 'rule.json'), 'utf8'));
report.ruleJson = {
  cl_input: rules.some((rule) => rule.name === 'cl-input'),
  cl_inputs: rules.some((rule) => rule.name === 'cl-inputs'),
};
if (!report.ruleJson.cl_input || report.ruleJson.cl_inputs) {
  failures.push({case: 'rule inventory', got: report.ruleJson, expected: 'cl-input is a rule, cl-inputs is not'});
}

const boot = (packages) => `<!doctype html><html lang="ru" class="theme-light"><head>
<meta charset="utf-8"><title>input former names</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'input-former-names-probe',
    pluginListVersion: 'input-former-names-probe',
    preloader: {enabled: false},
    icons: {enabled: false},
    smart: {base: true},
    theme: false,
    ${packages ? `packages: ${JSON.stringify(packages)},` : ''}
  };
</script>`;

const pages = {
  '/old-path.html': `${boot(null)}
<link rel="stylesheet" href="/distr/smart/inputs/css/inputs.css">
</head><body>
<sf-input id="old" label="Имя" name="name" value="Анна"></sf-input>
<script src="/distr/core/js/core.js"></script>
<script src="/distr/smart/inputs/js/inputs.js"></script>
</body></html>`,
  '/old-relation.html': `${boot({legacy: {base: '/legacy'}})}
</head><body>
<sf-legacy-field id="legacy"></sf-legacy-field>
<script src="/distr/core/js/core.js"></script>
</body></html>`,
  '/legacy/rule.js': `SF.RuleLoader.registerPackage('legacy', {
  rules: {
    'cl-legacy-field': {
      tags: ['sf-legacy-field'],
      type: 'smart',
      mode: 'smart',
      js: true,
      relation: [{name: 'cl-inputs'}],
    },
  },
});`,
};
// The product element: it renders an sf-input, which it does not fetch itself.
const legacyField = `(() => {
  if (customElements.get('sf-legacy-field')) return;
  customElements.define('sf-legacy-field', class extends HTMLElement {
    connectedCallback() {
      this.dataset.inputDefined = String(Boolean(customElements.get('sf-input')));
      this.innerHTML = '<sf-input label="Поле" name="legacy"></sf-input>';
    }
  });
})();`;

const types = new Map([
  ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml'],
]);
const requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  requests.push(url.pathname);
  try {
    if (pages[url.pathname]) {
      const type = url.pathname.endsWith('.js') ? types.get('.js') : 'text/html; charset=utf-8';
      response.writeHead(200, {'Content-Type': type});
      response.end(pages[url.pathname]);
      return;
    }
    if (/^\/legacy\/legacy-field\/js\/legacy-field(\.min)?\.js$/u.test(url.pathname)) {
      response.writeHead(200, {'Content-Type': types.get('.js')});
      response.end(legacyField);
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

const browser = await chromium.launch();
try {
  // 1. The old page.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({case: 'old path', said: error.message}));
    requests.length = 0;
    await page.goto(`${origin}/old-path.html`);
    try {
      await page.waitForFunction(() => Boolean(customElements.get('sf-input'))
        && Boolean(document.querySelector('#old input')), null, {timeout: 15000});
    } catch {
      failures.push({case: 'old path', expected: 'sf-input is defined and renders its native input'});
    }
    await page.waitForTimeout(300);
    report.oldPath = await page.evaluate(() => {
      const input = document.querySelector('#old input');
      const notes = [...(window.SF?.__deprecationNotes?.values() ?? [])];
      return {
        value: input?.value ?? null,
        label: document.querySelector('#old')?.textContent?.includes('Имя') ?? false,
        notedPath: notes.some((note) => note.kind === 'path' && note.from === 'smart/inputs/' && note.to === 'smart/input/'),
        inputScripts: [...document.querySelectorAll('script[src]')]
          .map((script) => new URL(script.src).pathname)
          .filter((path) => /\/smart\/input\/js\/input(\.min)?\.js$/u.test(path)).length,
      };
    });
    report.oldPath.requested = requests.filter((path) => path.includes('/smart/input'));
    if (report.oldPath.value !== 'Анна' || !report.oldPath.label) {
      failures.push({case: 'old path', got: report.oldPath, expected: 'the field renders with its label and value'});
    }
    if (!report.oldPath.notedPath) {
      failures.push({case: 'old path', got: report.oldPath, expected: 'smart/inputs/ -> smart/input/ in the deprecation notes'});
    }
    await context.close();
  }

  // 2. A product rule that names cl-inputs.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({case: 'old relation', said: error.message}));
    requests.length = 0;
    await page.goto(`${origin}/old-relation.html`);
    try {
      await page.waitForFunction(() => Boolean(customElements.get('sf-legacy-field'))
        && Boolean(document.querySelector('#legacy sf-input input')), null, {timeout: 15000});
    } catch {
      failures.push({case: 'old relation', expected: 'the product element renders an sf-input with its native input'});
    }
    report.oldRelation = await page.evaluate(() => ({
      forward: window.SF?.RuleLoader?.['cl-inputs'] ?? null,
      inputDefinedFirst: document.querySelector('#legacy')?.dataset.inputDefined ?? null,
    }));
    report.oldRelation.requested = requests.filter((path) => /\/smart\/inputs?\/|legacy/u.test(path));
    const forward = report.oldRelation.forward;
    if (!forward || forward.type !== 'smart' || forward.tags?.length !== 0 || forward.js !== false
      || forward.relation?.[0]?.name !== 'cl-input') {
      failures.push({case: 'old relation', got: forward, expected: 'the Loader holds cl-inputs as a forward to cl-input'});
    }
    if (report.oldRelation.inputDefinedFirst !== 'true') {
      failures.push({case: 'old relation', got: report.oldRelation, expected: 'sf-input is defined before the element that names it runs'});
    }
    if (!report.oldRelation.requested.some((path) => /^\/distr\/smart\/input\/js\/input(\.min)?\.js$/u.test(path))) {
      failures.push({case: 'old relation', got: report.oldRelation.requested, expected: 'smart/input/js/input.js is fetched'});
    }
    if (report.oldRelation.requested.some((path) => path.startsWith('/distr/smart/inputs/'))) {
      failures.push({case: 'old relation', got: report.oldRelation.requested, expected: 'nothing is asked of smart/inputs/'});
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({passed: failures.length === 0, report, failures}, null, 2));
if (failures.length) process.exit(1);
