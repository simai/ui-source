#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Display group A's former names keep working until 2026-12-01 (change journal
// path-smart-<old>-to-<new>): five folders took the tag's name with standard
// simai.smart-component 1.3.8 §3, §21 -- buttons, icon-buttons, icons, badges
// and tags. Measured on the built bytes served the way the `ui` distribution
// lays them out:
//
//   1. an old page per component: core.js with the Loader, and the former path
//      smart/<old>/js/<old>.js (and css/<old>.css where the bundle had a sheet)
//      written by hand. The element is defined and upgraded, a button renders
//      its native button, the old path is in the deprecation notes, nothing
//      throws;
//   2. a product rule whose relations name the five former bundle names
//      cl-<old> (as ui-pro's rules do until their repin): the Loader forwards
//      each to cl-<new>, fetches smart/<new>/js/<new>.js, and all five elements
//      are defined before the product element runs; nothing is asked of
//      smart/<old>/. The forwards are not in the distribution's rule.json,
//      where a rule of type smart is a Smart component to the registry
//      (src/core/contracts/smart-rule-forwards.v1.json).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const RENAMES = [
  {old: 'buttons', name: 'button', tag: 'sf-button', sheet: false,
    markup: '<sf-button id="old" text="Купить"></sf-button>', renders: 'button'},
  {old: 'icon-buttons', name: 'icon-button', tag: 'sf-icon-button', sheet: true,
    markup: '<sf-icon-button id="old" icon="close" label="Закрыть"></sf-icon-button>', renders: 'button'},
  {old: 'icons', name: 'icon', tag: 'sf-icon', sheet: false,
    markup: '<sf-icon id="old" icon="home"></sf-icon>', renders: null},
  {old: 'badges', name: 'badge', tag: 'sf-badge', sheet: false,
    markup: '<sf-badge id="old" text="7"></sf-badge>', renders: null},
  {old: 'tags', name: 'tag', tag: 'sf-tag', sheet: true,
    markup: '<sf-tag id="old" text="Тег"></sf-tag>', renders: null},
];

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
  ...RENAMES.flatMap(({old, name, sheet}) => [
    join(out, 'smart', 'smart', name, 'js', `${name}.js`),
    join(out, 'smart', 'smart', old, 'js', `${old}.js`),
    ...(sheet ? [join(out, 'smart', 'smart', old, 'css', `${old}.css`)] : []),
  ]),
].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} asset(s) not found`);
}

const failures = [];
const report = {ruleJson: {}, oldPath: {}, oldRelation: null};

const rules = JSON.parse(readFileSync(join(out, 'core', 'rule', 'rule.json'), 'utf8'));
for (const {old, name} of RENAMES) {
  const got = {
    [`cl-${name}`]: rules.some((rule) => rule.name === `cl-${name}`),
    [`cl-${old}`]: rules.some((rule) => rule.name === `cl-${old}`),
  };
  report.ruleJson[name] = got;
  if (!got[`cl-${name}`] || got[`cl-${old}`]) {
    failures.push({case: 'rule inventory', got, expected: `cl-${name} is a rule, cl-${old} is not`});
  }
}

const boot = (packages) => `<!doctype html><html lang="ru" class="theme-light"><head>
<meta charset="utf-8"><title>display former names</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'display-former-names-probe',
    pluginListVersion: 'display-former-names-probe',
    preloader: {enabled: false},
    icons: {enabled: false},
    smart: {base: true},
    theme: false,
    ${packages ? `packages: ${JSON.stringify(packages)},` : ''}
  };
</script>`;

const pages = {
  '/old-relation.html': `${boot({legacy: {base: '/legacy'}})}
</head><body>
<sf-legacy-display id="legacy"></sf-legacy-display>
<script src="/distr/core/js/core.js"></script>
</body></html>`,
  '/legacy/rule.js': `SF.RuleLoader.registerPackage('legacy', {
  rules: {
    'cl-legacy-display': {
      tags: ['sf-legacy-display'],
      type: 'smart',
      mode: 'smart',
      js: true,
      relation: ${JSON.stringify(RENAMES.map(({old}) => ({name: `cl-${old}`})))},
    },
  },
});`,
};
for (const {old, sheet, markup} of RENAMES) {
  pages[`/old-path-${old}.html`] = `${boot(null)}
${sheet ? `<link rel="stylesheet" href="/distr/smart/${old}/css/${old}.css">` : ''}
</head><body>
${markup}
<script src="/distr/core/js/core.js"></script>
<script src="/distr/smart/${old}/js/${old}.js"></script>
</body></html>`;
}
// The product element: it renders the five elements, which it does not fetch itself.
const legacyDisplay = `(() => {
  if (customElements.get('sf-legacy-display')) return;
  const tags = ${JSON.stringify(RENAMES.map(({tag}) => tag))};
  customElements.define('sf-legacy-display', class extends HTMLElement {
    connectedCallback() {
      this.dataset.definedFirst = tags.filter((tag) => customElements.get(tag)).join(' ');
      this.innerHTML = '<sf-button text="Да"></sf-button><sf-icon-button icon="close" label="Нет"></sf-icon-button>'
        + '<sf-icon icon="home"></sf-icon><sf-badge text="3"></sf-badge><sf-tag text="Тег"></sf-tag>';
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
    if (/^\/legacy\/legacy-display\/js\/legacy-display(\.min)?\.js$/u.test(url.pathname)) {
      response.writeHead(200, {'Content-Type': types.get('.js')});
      response.end(legacyDisplay);
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
  // 1. The old pages.
  for (const {old, name, tag, renders} of RENAMES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({case: `old path ${old}`, said: error.message}));
    requests.length = 0;
    await page.goto(`${origin}/old-path-${old}.html`);
    try {
      await page.waitForFunction(({tag, renders}) => {
        const Element = customElements.get(tag);
        const el = document.querySelector('#old');
        return Boolean(Element) && el instanceof Element && (!renders || Boolean(el.querySelector(renders)));
      }, {tag, renders}, {timeout: 15000});
    } catch {
      failures.push({case: `old path ${old}`, expected: `${tag} is defined, upgraded${renders ? ` and renders its ${renders}` : ''}`});
    }
    await page.waitForTimeout(300);
    const got = await page.evaluate(({old, name}) => {
      const notes = [...(window.SF?.__deprecationNotes?.values() ?? [])];
      return {
        notedPath: notes.some((note) => note.kind === 'path' && note.from === `smart/${old}/` && note.to === `smart/${name}/`),
        newScripts: [...document.querySelectorAll('script[src]')]
          .map((script) => new URL(script.src).pathname)
          .filter((path) => path.startsWith(`/distr/smart/${name}/js/${name}`)).length,
      };
    }, {old, name});
    got.requested = requests.filter((path) => path.startsWith(`/distr/smart/${name}/`) || path.startsWith(`/distr/smart/${old}/`));
    report.oldPath[old] = got;
    if (!got.notedPath) {
      failures.push({case: `old path ${old}`, got, expected: `smart/${old}/ -> smart/${name}/ in the deprecation notes`});
    }
    await context.close();
  }

  // 2. A product rule that names the five former bundle names.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({case: 'old relation', said: error.message}));
    requests.length = 0;
    await page.goto(`${origin}/old-relation.html`);
    try {
      await page.waitForFunction(() => Boolean(customElements.get('sf-legacy-display'))
        && Boolean(document.querySelector('#legacy sf-button button')), null, {timeout: 15000});
    } catch {
      failures.push({case: 'old relation', expected: 'the product element renders its sf-button with a native button'});
    }
    report.oldRelation = await page.evaluate((olds) => ({
      forwards: Object.fromEntries(olds.map((old) => {
        const rule = window.SF?.RuleLoader?.[`cl-${old}`];
        return [old, rule ? {type: rule.type, tags: rule.tags?.length, js: rule.js, to: rule.relation?.[0]?.name} : null];
      })),
      definedFirst: document.querySelector('#legacy')?.dataset.definedFirst ?? null,
    }), RENAMES.map(({old}) => old));
    report.oldRelation.requested = requests.filter((path) => path.startsWith('/distr/smart/') || path.startsWith('/legacy/'));
    for (const {old, name, tag} of RENAMES) {
      const forward = report.oldRelation.forwards[old];
      if (!forward || forward.type !== 'smart' || forward.tags !== 0 || forward.js !== false || forward.to !== `cl-${name}`) {
        failures.push({case: 'old relation', got: forward, expected: `the Loader holds cl-${old} as a forward to cl-${name}`});
      }
      if (!(report.oldRelation.definedFirst ?? '').split(' ').includes(tag)) {
        failures.push({case: 'old relation', got: report.oldRelation.definedFirst, expected: `${tag} is defined before the element that names cl-${old} runs`});
      }
      if (!report.oldRelation.requested.some((path) => new RegExp(`^/distr/smart/${name}/js/${name}(\\.min)?\\.js$`, 'u').test(path))) {
        failures.push({case: 'old relation', got: report.oldRelation.requested, expected: `smart/${name}/js/${name}.js is fetched`});
      }
      if (report.oldRelation.requested.some((path) => path.startsWith(`/distr/smart/${old}/`))) {
        failures.push({case: 'old relation', got: report.oldRelation.requested, expected: `nothing is asked of smart/${old}/`});
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({passed: failures.length === 0, report, failures}, null, 2));
if (failures.length) process.exit(1);
