#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The page host and the fragment boundary (simai.interface-fragment 1.0.0,
// host-is-an-endpoint and failure-is-contained; Larena handoff 2026-10-15), on
// the built core:
//   1. effects from a port answer are published on sf-page-host's outputs and
//      the page's routes deliver them; an effect that fails its value type is
//      refused and the others still go;
//   2. a fragment that throws while it draws, beside a working one, is replaced
//      by the error state with a retry -- and the working one's route still
//      delivers;
//   3. a fragment whose element never arrives fails after its load time;
//   4. «Повторить» puts the fragment back and it starts again;
//   5. value types named without a version (value-types-without-version,
//      2026-10-19): an effect {type: 'record-removed'} reaches the page as
//      {type: 'record-removed.v1'} does, over a route that names one side bare
//      and the other by the older label, to an element that declares the bare
//      name.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'smart', 'smart', 'empty-state', 'js', 'empty-state.js')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>page host</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'page-host', pluginListVersion: 'page-host', preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body>
<sf-composition-scope data-sf-routes='[{"id":"files-refresh","from":{"endpoint":"host","port":"collection-changed","value":"collection-changed.v1"},"to":{"endpoint":"list","port":"changed","value":"collection-changed.v1"}},{"id":"removed","from":{"endpoint":"host","port":"record-removed","value":"record-removed.v1"},"to":{"endpoint":"bare","port":"removed","value":"record-removed"}},{"id":"counted","from":{"endpoint":"host","port":"counter","value":"counter"},"to":{"endpoint":"bare","port":"counted","value":"counter"}}]'>
  <sf-page-host data-sf-endpoint="host"></sf-page-host>
  <probe-bare data-sf-endpoint="bare"></probe-bare>
  <sf-fragment data-sf-fragment="probe.list"><probe-list data-sf-endpoint="list"></probe-list></sf-fragment>
  <sf-fragment data-sf-fragment="probe.broken"><probe-broken></probe-broken></sf-fragment>
  <sf-fragment data-sf-fragment="probe.never" load-timeout="600"><probe-never></probe-never></sf-fragment>
</sf-composition-scope>
<script>
  window.received = [];
  customElements.define('probe-list', class extends HTMLElement {
    static sfPorts = {outputs: {}, inputs: {changed: 'collection-changed.v1'}};
    sfPortInput(port, value) { window.received.push({port, value}); }
  });
  window.receivedBare = [];
  customElements.define('probe-bare', class extends HTMLElement {
    static sfPorts = {outputs: {}, inputs: {removed: 'record-removed', counted: 'counter.v1'}};
    sfPortInput(port, value) { window.receivedBare.push({port, value}); }
  });
</script>
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
const note = (detail) => failures.push(detail);
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  tab.on('pageerror', () => {});
  await tab.goto(`${base}/page.html`);
  await tab.waitForFunction(() => customElements.get('sf-page-host') && customElements.get('sf-fragment') && window.SF?.Composition?.publishEffects, null, {timeout: 10000});
  // A Smart element that throws while it draws -- the first time only, so a
  // retry can show it working.
  await tab.waitForFunction(() => window.SF?.SfBaseElement || (window.SF?.loadRuntime && window.SF.loadRuntime() && false), null, {timeout: 10000}).catch(() => {});
  await tab.evaluate(async () => {
    await window.SF.loadSmartBase?.();
    const Base = window.SF.SfBaseElement;
    window.breaks = 1;
    customElements.define('probe-broken', class extends Base {
      template() {
        if (window.breaks > 0) { window.breaks -= 1; throw new Error('probe: drawing failed'); }
        return window.SF.html`<p class="probe-drawn">Нарисовано</p>`;
      }
    });
  });
  await tab.waitForTimeout(1500);
  const result = await tab.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const list = document.querySelector('probe-list');
    const fragment = (name) => document.querySelector(`sf-fragment[data-sf-fragment="${name}"]`);
    const state = (name) => ({state: fragment(name).getAttribute('data-sf-fragment-state'),
      emptyState: fragment(name).querySelector('sf-empty-state')?.getAttribute('kind') ?? null,
      drawn: Boolean(fragment(name).querySelector('.probe-drawn'))});
    const answer = window.SF.Composition.publishEffects([
      {type: 'collection-changed.v1', value: {collection: 'files', reason: 'moved'}},
      {type: 'counter.v1', value: {key: 'n', value: -1}},
    ], {origin: list});
    await wait(100);
    const delivered = window.received.length;
    const broken = state('probe.broken');
    const never = state('probe.never');
    // The working fragment's route still delivers after the others failed.
    window.SF.Composition.publishEffects([{type: 'collection-changed.v1', value: {collection: 'files', reason: 'created'}}], {origin: list});
    await wait(100);
    const after = window.received.length;
    // Retry: the error state's own button.
    await customElements.whenDefined('sf-empty-state');
    await wait(300);
    const retry = [...fragment('probe.broken').querySelectorAll('button')].find((button) => /Повторить/u.test(button.textContent));
    retry?.click();
    await wait(800);
    // Either form of a value type's name: the same output, the same value.
    const bareAnswer = window.SF.Composition.publishEffects([
      {type: 'record-removed', value: {collection: 'news', id: 5}},
      {type: 'record-removed.v1', value: {collection: 'news', id: 5}},
      {type: 'counter', value: {key: 'notifications', value: 2}},
      {type: 'counter.v1', value: {key: 'notifications', value: 2}},
      {type: 'record-removed.v2', value: {collection: 'news', id: 5}},
    ], {origin: list});
    await wait(100);
    const scope = document.querySelector('sf-composition-scope');
    return {answer, delivered, broken, never, after, retried: Boolean(retry), afterRetry: state('probe.broken'),
      routeState: scope.getRouteState('files-refresh'),
      bare: {answer: bareAnswer, received: window.receivedBare, removed: scope.getRouteState('removed'), counted: scope.getRouteState('counted'),
        routing: scope.getAttribute('data-sf-routing')}};
  });
  if (result.answer.published.join() !== 'collection-changed.v1' || result.answer.refused[0]?.reason !== 'value_invalid') note({case: 'effects are checked and published, a bad one refused', got: result.answer});
  if (result.delivered !== 1) note({case: 'the route delivers the published effect', got: result});
  if (result.broken.state !== 'error' || result.broken.emptyState !== 'error') note({case: 'a fragment that throws is replaced by the error state', got: result.broken});
  if (result.never.state !== 'error' || result.never.emptyState !== 'error') note({case: 'a fragment that never loads fails after its load time', got: result.never});
  if (result.after !== 2 || result.routeState?.status !== 'settled') note({case: 'the working fragment\'s route still delivers', got: result});
  if (!result.retried || result.afterRetry.state !== null || !result.afterRetry.drawn) note({case: '«Повторить» puts the fragment back', got: result});
  const bare = result.bare;
  const removed = {port: 'removed', value: {collection: 'news', id: 5}};
  const counted = {port: 'counted', value: {key: 'notifications', value: 2}};
  if (bare.routing !== 'connected') note({case: 'routes naming value types in either form are taken', got: bare});
  if (bare.answer.published.join() !== 'record-removed,record-removed.v1,counter,counter.v1'
    || bare.answer.refused.length !== 1 || bare.answer.refused[0].reason !== 'type_not_published') note({case: 'an effect named without its version is published as its older label is', got: bare.answer});
  if (JSON.stringify(bare.received) !== JSON.stringify([removed, removed, counted, counted])) note({case: 'record-removed and record-removed.v1 deliver the same value over a mixed route', got: bare.received});
  if (bare.removed?.status !== 'settled' || bare.counted?.status !== 'settled') note({case: 'the mixed routes settle', got: bare});
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('PAGE_HOST_AND_BOUNDARY_OK');
