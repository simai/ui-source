#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The JS API defects the public-API inventory found (2026-10-12), on a Russian
// page that loads through the Loader with the Smart base left to the bundles:
//   - a class component's state API exists when it says it is ready;
//   - SF.Toast.dismiss(null) answers false, and show() takes status (type still read);
//   - SF.ProgressBar takes and reports status;
//   - SF.smartBaseReady settles with the base a bundle brought, and is live;
//   - sf-loader-ready is stamped when it is sent;
//   - (legacy [sf-gallery] markup: SF.Search no longer constructs an absent
//     SF.Gallery; not driven here, because the attribute scan does not load
//     sf-system for [sf-gallery] on this page -- recorded as debt);
//   - the composition overlay follows SF.language.use().
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
<meta charset="utf-8"><title>js api readiness</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'js-api-readiness-probe', pluginListVersion: 'js-api-readiness-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: false}, theme: false,
  };
  window.__probe = {beforeCore: Date.now(), ready: {}, readyAt: [], readyEvent: null, errors: []};
  window.addEventListener('error', (event) => window.__probe.errors.push(String(event.message)));
  // What each class component's API looks like at the moment it says it is ready.
  document.addEventListener('component:ready', (event) => {
    const name = event.detail.name;
    window.__probe.readyAt.push(Date.now());
    window.__probe.ready[name] = {toastShow: typeof window.SF?.Toast?.show, progressSet: typeof window.SF?.ProgressBar?.setState};
  });
  window.addEventListener('sf-loader-ready', (event) => {
    window.__probe.readyEvent = {timestamp: event.detail.timestamp, heardAt: Date.now()};
  });
</script></head><body>
<div id="region"><div class="sf-toast"></div></div>
<div id="bar" class="sf-progress-bar" data-value="40"></div>
<sf-spinner></sf-spinner>
<sf-composition-overlay id="overlay"></sf-composition-overlay>
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
  await tab.waitForFunction(() => window.SF?.Toast?.show && window.SF?.ProgressBar?.setState && customElements.get('sf-spinner'), null, {timeout: 20000});
  await tab.waitForFunction(() => window.__probe.readyEvent, null, {timeout: 20000}).catch(() => {});
  await tab.waitForTimeout(300);

  report.ready = await tab.evaluate(() => window.__probe.ready);
  if (report.ready.Toast?.toastShow !== 'function') {
    failures.push({case: 'component:ready before the API', got: report.ready.Toast, expected: 'SF.Toast.show is a function when Toast says it is ready'});
  }
  if (report.ready.ProgressBar?.progressSet !== 'function') {
    failures.push({case: 'component:ready before the API', got: report.ready.ProgressBar, expected: 'SF.ProgressBar.setState is a function when ProgressBar says it is ready'});
  }

  report.toast = await tab.evaluate(() => {
    let dismissNull;
    try { dismissNull = window.SF.Toast.dismiss(null); } catch (error) { dismissNull = `threw ${error.message}`; }
    const shown = window.SF.Toast.show('#region', {status: 'error', title: 'x'});
    const legacy = window.SF.Toast.show('#region', {type: 'success', title: 'y'});
    return {dismissNull, status: shown?.className ?? '', legacy: legacy?.className ?? ''};
  });
  if (report.toast.dismissNull !== false) failures.push({case: 'toast dismiss(null)', got: report.toast.dismissNull, expected: false});
  if (!/sf-toast--error/u.test(report.toast.status)) failures.push({case: 'toast status', got: report.toast.status, expected: 'sf-toast--error'});
  if (!/sf-toast--success/u.test(report.toast.legacy)) failures.push({case: 'toast legacy type', got: report.toast.legacy, expected: 'sf-toast--success'});

  report.progress = await tab.evaluate(() => {
    const bar = document.querySelector('#bar');
    window.SF.ProgressBar.setState(bar, {status: 'error'});
    return window.SF.ProgressBar.getState(bar);
  });
  if (report.progress?.status !== 'error') failures.push({case: 'progress status', got: report.progress, expected: 'status error'});

  report.smartBase = await tab.evaluate(async () => {
    const base = await Promise.race([window.SF.smartBaseReady, new Promise((settle) => setTimeout(() => settle('timeout'), 5000))]);
    return {hasBase: Boolean(base?.SfBaseElement), live: window.SF.smartBaseReady === window.SF.Loader.smartBaseReady};
  });
  if (!report.smartBase.hasBase || !report.smartBase.live) failures.push({case: 'smartBaseReady', got: report.smartBase, expected: 'resolves with the base once a Smart bundle brings it, and is the Loader promise'});

  // Sent once the page's components are in, so stamped no earlier than the
  // last component that said it was ready before it; the old stamp was the
  // moment the Loader file ran.
  report.readyEvent = await tab.evaluate(() => {
    const event = window.__probe.readyEvent || {};
    const before = window.__probe.readyAt.filter((at) => at <= (event.heardAt ?? 0));
    return {...event, lastReadyBefore: before.length ? Math.max(...before) : null};
  });
  if (!report.readyEvent.timestamp || (report.readyEvent.lastReadyBefore !== null && report.readyEvent.timestamp < report.readyEvent.lastReadyBefore)) {
    failures.push({case: 'sf-loader-ready timestamp', got: report.readyEvent, expected: 'stamped when sent'});
  }

  report.language = await tab.evaluate(async () => {
    await customElements.whenDefined('sf-composition-overlay');
    const overlay = document.querySelector('#overlay');
    const russian = overlay.messages;
    window.SF.language.use('en');
    const english = overlay.messages;
    window.SF.language.use(null);
    return {ru: Object.values(russian)[0], en: Object.values(english)[0]};
  });
  if (!report.language.ru || report.language.ru === report.language.en) {
    failures.push({case: 'overlay language', got: report.language, expected: 'SF.language.use(en) changes the overlay words on a Russian page'});
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures, report}, null, 2));
  throw new Error(`${failures.length} JS API readiness defect(s)`);
}
process.stdout.write(`JS API readiness: PASS ${JSON.stringify(report)}\n`);
