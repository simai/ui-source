#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// R076: a theme cycle under a host that draws the theme itself. A Docara page
// and its default example frames start the Loader with theme: false and set
// the document's theme-dark / theme-light class themselves; the Loader keeps
// theme = 'light' and setTheme answers false.
//
//   host   -- SF_BOOT_CONFIG.theme false, the page's class set by the "host"
//             (light and dark). The full cycle's name says the drawn theme
//             («сейчас тёмная» in the dark page), the two-theme cycle names
//             it and shows its icon. Two presses: no change event, the class
//             stays, exactly one console warning that names the host-owned
//             theme.
//   loader -- the Loader owns the theme (light and dark system scheme): a
//             press sends change, flips the class, warns nothing.
//
// Three loads of each; no page error and no console error in any load.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;

const page = (owner, theme) => `<!doctype html><html lang="ru"${owner === 'host' ? ` class="theme-${theme}"` : ''}><head><meta charset="utf-8"><title>theme cycle host</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'theme-cycle-host', pluginListVersion: 'theme-cycle-host',
    preloader: {enabled: false}, icons: {enabled: false, accumulate: false}, smart: {base: true}${owner === 'host' ? ', theme: false' : ''}};
</script>
<script src="/distr/core/js/core.js"></script>
</head><body><main>
<sf-button id="full" theme-cycle></sf-button>
<sf-button id="two" theme-cycle="light dark"></sf-button>
</main></body></html>`;

const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const [, owner, theme] = /^\/(host|loader)\/(light|dark)$/u.exec(path) || [];
  if (owner) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page(owner, theme));
  }
  for (const [prefix, root] of mounts) {
    if (!path.startsWith(prefix)) continue;
    const file = resolve(root, path.slice(prefix.length));
    if (!file.startsWith(root + sep) || !existsSync(file)) break;
    const ext = file.slice(file.lastIndexOf('.'));
    response.writeHead(200, {'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store'});
    return response.end(await readFile(file));
  }
  response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
  return response.end('404');
}).listen(0, '127.0.0.1');
await new Promise((done) => server.once('listening', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const failures = [];
const rows = [];
const check = (ok, text) => { if (!ok) failures.push(text); };
const WORD = {light: 'светлая', dark: 'тёмная'};

for (const owner of ['host', 'loader']) for (const theme of ['light', 'dark']) for (let load = 1; load <= LOADS; load++) {
  const context = await browser.newContext({colorScheme: theme});
  const tab = await context.newPage();
  const errors = [];
  const warnings = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  tab.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning' && /theme-cycle/.test(message.text())) warnings.push(message.text());
  });
  await tab.goto(`${origin}/${owner}/${theme}`);
  await tab.waitForFunction(() => ['full', 'two'].every((id) => document.getElementById(id)?.querySelector('button[aria-label]')), null, {timeout: 20000});
  const read = () => tab.evaluate(() => ({
    html: [...document.documentElement.classList].filter((name) => name.startsWith('theme-')).join(' '),
    full: document.querySelector('#full button').getAttribute('aria-label'),
    two: document.querySelector('#two button').getAttribute('aria-label'),
    twoIcon: document.querySelector('#two .sf-icon, #two sf-icon')?.textContent.trim() || document.querySelector('#two sf-icon')?.getAttribute('icon') || '',
  }));
  const before = await read();
  await tab.evaluate(() => { globalThis.__changes = []; document.addEventListener('change', (event) => globalThis.__changes.push(event.detail?.value)); });
  await tab.click('#full button');
  await tab.waitForTimeout(300);
  const once = await read();
  if (owner === 'host') { await tab.click('#full button'); await tab.waitForTimeout(300); }
  const changes = await tab.evaluate(() => globalThis.__changes);
  const label = `${owner} ${theme} load ${load}`;
  if (owner === 'host') {
    check(before.html === `theme-${theme}`, `${label}: class ${before.html}`);
    check(before.full.includes(WORD[theme]), `${label}: full cycle name «${before.full}» does not say ${WORD[theme]}`);
    check(before.two.includes(WORD[theme]), `${label}: two-theme cycle name «${before.two}» does not say ${WORD[theme]}`);
    check(changes.length === 0, `${label}: change sent ${JSON.stringify(changes)}`);
    check(once.html === before.html && once.full === before.full, `${label}: the press moved something`);
    check(warnings.length === 1 && /theme: false/.test(warnings[0]), `${label}: warnings ${JSON.stringify(warnings)}`);
  } else {
    check(changes.length === 1, `${label}: change ${JSON.stringify(changes)}`);
    check(once.html !== before.html, `${label}: the class did not flip (${before.html})`);
    check(warnings.length === 0, `${label}: warnings ${JSON.stringify(warnings)}`);
  }
  check(errors.length === 0, `${label}: errors ${JSON.stringify(errors)}`);
  rows.push({label, before, after: once, changes, warnings: warnings.length, errors: errors.length});
  await context.close();
}
await browser.close();
server.close();
for (const row of rows) console.log(`${row.label}: «${row.before.full}» / «${row.before.two}» ${row.before.html} -> ${row.after.html}; change ${JSON.stringify(row.changes)}; warnings ${row.warnings}; errors ${row.errors}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`theme-cycle-host: PASS (${rows.length} loads)`);
