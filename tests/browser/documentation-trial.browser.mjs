#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The five Framework defects the documentation trial confirmed at runtime
// (2026-10-12), on a Russian page that loads everything through the Loader:
//   1. radius-ui, radius-surface and radius-4 load and round the box;
//   2. sf-dropdown.value is the selected value, a string, and setting it selects;
//   3. (composition built-ins: a module, tests/composition.contract.test.mjs);
//   4. a checkbox tag with closable has a remove action beside its toggle;
//   5. sf-modal's close and minimize actions are named in the page's language.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error(`no core.js under ${out}`);

const page = `<!doctype html><html lang="ru" class="theme-light"><head>
<meta charset="utf-8"><title>documentation trial</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'documentation-trial-probe', pluginListVersion: 'documentation-trial-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false,
  };
</script></head><body>
<div id="r-ui" class="radius-ui" style="width:40px;height:40px"></div>
<div id="r-surface" class="radius-surface" style="width:40px;height:40px"></div>
<div id="r-4" class="radius-4" style="width:40px;height:40px"></div>
<sf-dropdown id="dropdown" mode="select" value="b">
  <sf-list-item value="a" text="A"></sf-list-item>
  <sf-list-item value="b" text="B"></sf-list-item>
  <sf-list-item value="c" text="C"></sf-list-item>
</sf-dropdown>
<sf-tag id="tag" text="Фильтр" closable></sf-tag>
<sf-modal id="modal" title="Окно"><div>Текст</div></sf-modal>
<script src="/distr/core/js/core.js"></script></body></html>`;

const types = new Map([['.js', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'], ['.svg', 'image/svg+xml']]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (url.pathname === '/trial.html') {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(page);
      return;
    }
    const mount = mounts.find(([prefix]) => url.pathname.startsWith(prefix));
    if (!mount) throw new Error('not served');
    const file = resolve(mount[1], decodeURIComponent(url.pathname.slice(mount[0].length)));
    if (!file.startsWith(mount[1] + sep)) throw new Error('path escape');
    const bytes = await readFile(file);
    response.writeHead(200, {'Content-Type': types.get(file.slice(file.lastIndexOf('.'))) ?? 'application/octet-stream'});
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
  const tab = await browser.newPage();
  tab.on('pageerror', (error) => failures.push({case: 'page error', said: error.message}));
  await tab.goto(`${origin}/trial.html`);
  await tab.waitForFunction(() => ['sf-dropdown', 'sf-tag', 'sf-modal'].every((tag) => customElements.get(tag)), null, {timeout: 20000});
  await tab.waitForFunction(() => getComputedStyle(document.querySelector('#r-ui')).borderTopLeftRadius !== '0px', null, {timeout: 10000}).catch(() => {});
  await tab.waitForTimeout(300);

  // 1. The semantic radii and step 4 load.
  report.radius = await tab.evaluate(() => Object.fromEntries(['r-ui', 'r-surface', 'r-4']
    .map((id) => [id, getComputedStyle(document.getElementById(id)).borderTopLeftRadius])));
  for (const [id, radius] of Object.entries(report.radius)) {
    if (radius === '0px') failures.push({case: 'radius', id, got: radius, expected: 'a radius from the loaded utility'});
  }

  // 2. The dropdown's value is its value.
  report.dropdown = await tab.evaluate(async () => {
    const dropdown = document.querySelector('#dropdown');
    const before = dropdown.value;
    dropdown.value = 'c';
    await new Promise((settle) => setTimeout(settle, 50));
    return {before, after: dropdown.value, attribute: dropdown.getAttribute('value')};
  });
  if (report.dropdown.before !== 'b' || report.dropdown.after !== 'c' || report.dropdown.attribute !== 'c') {
    failures.push({case: 'dropdown value', got: report.dropdown, expected: {before: 'b', after: 'c', attribute: 'c'}});
  }

  // 4. A removable checkbox tag: two controls, side by side.
  report.tag = await tab.evaluate(() => {
    const tag = document.querySelector('#tag');
    const toggle = tag.querySelector('button[aria-pressed]');
    const remove = tag.querySelector('sf-icon-button');
    return {
      kind: tag.kind,
      toggle: Boolean(toggle),
      remove: Boolean(remove),
      nested: Boolean(toggle && remove && toggle.contains(remove)),
      removeName: remove?.getAttribute('aria-label') ?? null,
    };
  });
  if (!report.tag.toggle || !report.tag.remove || report.tag.nested) {
    failures.push({case: 'tag closable', got: report.tag, expected: 'a toggle and a remove action, not nested'});
  }

  // 5. The modal's actions speak Russian on a Russian page.
  report.modal = await tab.evaluate(async () => {
    const modal = document.querySelector('#modal');
    modal.open?.();
    await new Promise((settle) => setTimeout(settle, 300));
    const close = modal.querySelector('.sf-modal-close-button') ?? document.querySelector('.sf-modal-close-button');
    return {close: close?.getAttribute('aria-label') ?? null, iconName: close?.querySelector('.sf-close')?.getAttribute('aria-label') ?? null};
  });
  if (report.modal.close !== 'Закрыть' || report.modal.iconName !== null) {
    failures.push({case: 'modal close label', got: report.modal, expected: {close: 'Закрыть', iconName: null}});
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures, report}, null, 2));
  throw new Error(`${failures.length} documentation trial defect(s) still present`);
}
process.stdout.write(`Documentation trial defects: PASS ${JSON.stringify(report)}\n`);
