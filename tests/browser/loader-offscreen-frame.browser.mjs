#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A documentation example below the fold is an iframe out of view: it gets no
// animation frame while its document still says «visible», and the Loader
// waited for one before fetching what it found -- tags the example created by
// script stayed undefined until someone scrolled (DEV, 2026-10-15, on a
// Docara 3 example). Here two sandboxed frames sit far below the viewport, one
// with a preloaded production plan, and each creates Smart tags after load;
// both must define them with nobody scrolling.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'smart', 'smart', 'badges', 'js', 'badges.js')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>offscreen frames</title></head><body style="margin:0">
<div style="block-size:20000px"></div>
<iframe id="plain" src="/frame.html" sandbox="allow-scripts" style="inline-size:600px;block-size:300px"></iframe>
<iframe id="plan" src="/frame-plan.html" sandbox="allow-scripts" style="inline-size:600px;block-size:300px"></iframe>
<script>
  window.reports = {};
  window.addEventListener('message', (event) => { if (event.data?.probe) window.reports[event.data.probe] = event.data; });
</script></body></html>`;
const frame = (plan) => `<!doctype html><html lang="en" class="theme-light"><head><meta charset="utf-8">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'offscreen-${plan ? 'plan' : 'plain'}', pluginListVersion: 'offscreen-${plan ? 'plan' : 'plain'}',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
  ${plan ? "window.SF_PRELOADED = {modules: [], loadedPlugins: {}};" : ''}
</script></head><body>
<script src="/distr/core/js/core.js"></script>
<script>
  window.addEventListener('load', () => setTimeout(() => {
    document.body.insertAdjacentHTML('beforeend', '<sf-badge text="a"></sf-badge><sf-spinner></sf-spinner>');
    const started = performance.now();
    const tick = () => {
      const defined = ['sf-badge', 'sf-spinner'].filter((tag) => customElements.get(tag));
      if (defined.length === 2 || performance.now() - started > 6000) {
        parent.postMessage({probe: '${plan ? 'plan' : 'plain'}', defined, ms: Math.round(performance.now() - started)}, '*');
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  }, 300));
</script></body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page.html' || path === '/frame.html' || path === '/frame-plan.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(path === '/page.html' ? page : frame(path === '/frame-plan.html'));
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    // A sandboxed frame's origin is opaque: what the Loader fetches it
    // fetches cross-origin, as from a documentation site's runtime.
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'access-control-allow-origin': '*'});
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
  const tab = await browser.newPage({viewport: {width: 800, height: 600}});
  await tab.goto(`${base}/page.html`);
  await tab.waitForFunction(() => Object.keys(window.reports).length === 2, null, {timeout: 15000}).catch(() => {});
  const reports = await tab.evaluate(() => window.reports);
  const scrolled = await tab.evaluate(() => window.scrollY);
  for (const name of ['plain', 'plan']) {
    if (reports[name]?.defined?.length !== 2) failures.push({case: `an out-of-view frame (${name}) defines the tags it creates`, got: reports[name] ?? null});
  }
  if (scrolled !== 0) failures.push({case: 'nobody scrolled', got: scrolled});
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('LOADER_OFFSCREEN_FRAME_OK');
