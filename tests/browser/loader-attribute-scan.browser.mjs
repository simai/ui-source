#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// An attribute changes an element, not what is inside it (rules of the road,
// 2026-10-15). The Loader walked the whole subtree of any element whose
// attribute changed, so a table marking itself loading walked its two
// thousand nodes, several times a search. What it holds:
//   1. an attribute set on a large block does not walk the block;
//   2. an element added inside that block is still found and loaded;
//   3. lifting the ignore marker still opens the subtree it held.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'smart', 'smart', 'spinner', 'js', 'spinner.js')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const rows = Array.from({length: 400}, (_, i) => `<div class="row"><span>${i}</span><span>a</span><span>b</span><span>c</span></div>`).join('');
const page = `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8"><title>loader attribute scan</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'loader-attribute-scan', pluginListVersion: 'loader-attribute-scan',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body>
<div id="quiet" data-sf-observer="ignore"><sf-spinner id="held"></sf-spinner></div>
<div id="big">${rows}</div>
<script src="/distr/core/js/core.js"></script></body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`${base}/page.html`);
  await tab.waitForFunction(() => Object.values(window.SF ?? {}).some((one) => one && typeof one === 'object' && 'mutationObserver' in one && one.searchEnd), null, {timeout: 10000});
  await tab.waitForTimeout(300);
  const result = await tab.evaluate(async () => {
    const loader = Object.values(window.SF).find((one) => one && typeof one === 'object' && 'mutationObserver' in one);
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const scanned = [];
    const own = loader.scanCustomElements;
    loader.scanCustomElements = function (root, ...rest) {
      const answer = own.call(this, root, ...rest);
      scanned.push({root: root?.id || root?.tagName?.toLowerCase() || 'body', count: root?.querySelectorAll ? root.querySelectorAll('*').length : 0, subtree: rest[1]?.subtree !== false});
      return answer;
    };
    const held = Boolean(customElements.get('sf-spinner'));
    // 1. Attributes on the big block, the way a table marks itself loading.
    const big = document.getElementById('big');
    for (const state of ['loading', 'populated', 'loading', 'populated']) {
      big.setAttribute('data-state', state);
      big.setAttribute('aria-busy', String(state === 'loading'));
      await wait(30);
    }
    await wait(250);
    const walkedBig = scanned.filter((one) => one.root === 'big' && one.subtree).length;
    // 2. Something new inside it is still found.
    const added = document.createElement('sf-spinner');
    added.id = 'added';
    big.querySelector('.row').append(added);
    await wait(250);
    await Promise.race([customElements.whenDefined('sf-spinner'), wait(4000)]);
    const addedLoaded = Boolean(customElements.get('sf-spinner'));
    // 3. The ignore marker lifted opens what it held.
    const quiet = document.getElementById('quiet');
    const heldBefore = scanned.filter((one) => one.root === 'quiet').length;
    quiet.removeAttribute('data-sf-observer');
    await wait(250);
    const openedQuiet = scanned.some((one, index) => index >= heldBefore && one.root === 'quiet' && one.subtree);
    loader.scanCustomElements = own;
    return {held, walkedBig, addedLoaded, openedQuiet, scans: scanned.length};
  });
  if (result.held) failures.push({case: 'an ignored subtree is not loaded', got: result});
  if (result.walkedBig) failures.push({case: 'an attribute on a block does not walk the block', got: result});
  if (!result.addedLoaded) failures.push({case: 'an element added inside the block is still loaded', got: result});
  if (!result.openedQuiet) failures.push({case: 'lifting the ignore marker opens its subtree', got: result});
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('LOADER_ATTRIBUTE_SCAN_OK');
