#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// GB17 L2: the Loader says in public that an element's script could not be
// loaded. sf-view-table read the core's internal pending-tags store
// (SF.__internal.pendingTags.settled) to stop waiting for an sf-view whose
// module failed (ui-control 86db6b49). Now:
//   - the window event sf-loader-module-failed, detail {rule, tags, package},
//     once per rule, when its script failed (the file and its other form);
//   - SF.Loader.settled(tag): "defined" or "failed", never rejecting, waiting
//     without asking;
//   - SF.Loader.ensure(tags, {timeout}) settles at once for a failed tag and
//     lists it in failed (and in missing, as before).
// Through the real Loader against the build served here; sf-tag's script
// answers 404 (both forms), sf-button loads.
//   aborted -- the event once (rule tag, tags [sf-tag]); settled sf-tag
//              "failed", sf-button "defined"; ensure with a 5 s timeout
//              settles within 1 s with failed [sf-tag];
//   stored  -- the next load in the same browser: the Loader does not ask for
//              the stored-missing script again, and still says so (event,
//              settled "failed");
//   served  -- the script served: settled sf-tag "defined", no event.
// Three loads each. No page error; the only console errors allowed are the
// aborted script's own.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const LOADS = 3;
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>module failed</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.__failed = [];
  window.addEventListener('sf-loader-module-failed', (event) => window.__failed.push({...event.detail, at: performance.now()}));
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'loader-module-failed', pluginListVersion: 'loader-module-failed',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script>
<script src="/distr/core/js/core.js"></script>
</head><body><main><sf-button text="Найти"></sf-button> <sf-tag text="Метка"></sf-tag></main></body></html>`;

let variant = 'aborted';
let tagAsked = 0;
const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(page);
  }
  if (/^\/distr\/smart\/tag\/js\/tag(\.min)?\.js$/u.test(path)) {
    tagAsked += 1;
    if (variant !== 'served') { response.writeHead(404); return response.end(); }
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    return response.end(body);
  } catch {
    response.writeHead(404);
    return response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const results = [];
const browser = await chromium.launch({headless: true});
const read = (tab) => tab.evaluate(async () => {
  await SF.ready;
  const settledIn = (tag, ms) => Promise.race([SF.Loader.settled(tag), new Promise((done) => setTimeout(() => done('pending'), ms))]);
  const t0 = performance.now();
  const ensured = await SF.Loader.ensure(['sf-tag', 'sf-button'], {timeout: 5000});
  const ensureMs = Math.round(performance.now() - t0);
  return {
    ensured, ensureMs,
    tag: await settledIn('sf-tag', 5000),
    tagShort: await settledIn('tag', 5000),
    button: await settledIn('sf-button', 5000),
    failed: window.__failed.map(({rule, tags, package: pkg}) => ({rule, tags, package: pkg})),
    publicMember: typeof SF.Loader.settled,
    ownKeys: Object.keys(SF.Loader).filter((key) => /fail|settle|report/iu.test(key)),
  };
});
try {
  for (const name of ['aborted', 'served']) {
    for (let load = 1; load <= LOADS; load += 1) {
      const context = await browser.newContext({viewport: {width: 600, height: 200}});
      const steps = name === 'aborted' ? ['aborted', 'stored'] : ['served'];
      for (const step of steps) {
        const label = `${step} load ${load}`;
        variant = name;
        tagAsked = 0;
        const tab = await context.newPage();
        const errors = [];
        tab.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
        tab.on('console', (message) => {
          if (message.type() !== 'error') return;
          if (name === 'aborted' && /404|tag(\.min)?\.js|Failed to load/u.test(message.text())) return;
          errors.push(message.text());
        });
        await tab.goto(`${base}/page`);
        await tab.waitForFunction(() => customElements.get('sf-button'), null, {timeout: 15000});
        const got = await read(tab);
        results.push({label, tagAsked, ...got});
        const say = (what, detail) => failures.push({label, what, detail});
        if (got.publicMember !== 'function') say('SF.Loader.settled is not a function', got.publicMember);
        if (got.ownKeys.length) say('own Loader names added', got.ownKeys);
        if (got.button !== 'defined') say('sf-button not settled as defined', got.button);
        if (got.ensured.ready.join() !== 'sf-button') say('ensure ready', got.ensured.ready);
        if (step === 'served') {
          if (got.tag !== 'defined' || got.tagShort !== 'defined') say('served sf-tag not defined', [got.tag, got.tagShort]);
          if (got.failed.length) say('event without a failure', got.failed);
          if (got.ensured.failed.length || got.ensured.missing.length) say('ensure lists a served tag', got.ensured);
        } else {
          if (got.tag !== 'failed' || got.tagShort !== 'failed') say('sf-tag not settled as failed', [got.tag, got.tagShort]);
          const events = got.failed.filter((one) => one.tags.includes('sf-tag'));
          if (events.length !== 1) say('sf-loader-module-failed for sf-tag not heard once', got.failed);
          if (got.ensured.failed.join() !== 'sf-tag' || got.ensured.missing.join() !== 'sf-tag') say('ensure failed/missing', got.ensured);
          if (got.ensureMs > 1000) say('ensure waited for a failed tag', got.ensureMs);
          if (step === 'stored' && tagAsked) say('the stored-missing script was asked again', tagAsked);
        }
        if (errors.length) say('console', errors);
        await tab.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({results: results.map(({label, tag, button, ensureMs, ensured, failed, tagAsked: asked}) => ({label, tag, button, ensureMs, ensured, failed, asked}))}, null, 1));
if (failures.length) {
  console.error(JSON.stringify(failures, null, 1));
  console.error(`loader-module-failed: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`loader-module-failed: ${results.length} loads ok`);
