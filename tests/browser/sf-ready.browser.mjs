#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// SF.ready (simai/ui-source#16), on the built bytes, on Russian pages that
// link core.css:
//   - right after core.js it is on window.SF, a thenable, while SF.Loader and
//     SF.loadSmartBase are not there yet;
//   - it settles once, with window.SF, after the window event sf-loader-init
//     (which is sent as before), and SF.loadSmartBase is there when it does;
//   - a function queued before core.js (window.SF_ON_READY) runs once, with
//     window.SF, at the same moment;
//   - a module script added long after load gets it already settled, and
//     SF.loadSmartBase() brings the Smart base;
//   - the callback form SF.ready(fn) runs fn once;
//   - two core.js on one page share one SF.ready: the second keeps the first,
//     nothing runs twice, and an assignment does not replace it.
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

const head = (title) => `<!doctype html><html lang="ru" class="theme-light"><head>
<meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {
    cacheVersion: 'sf-ready-probe', pluginListVersion: 'sf-ready-probe',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: false}, theme: false,
  };
  window.__probe = {order: [], early: [], then: [], callback: 0, afterCore: null, errors: []};
  window.addEventListener('error', (event) => window.__probe.errors.push(String(event.message)));
  window.addEventListener('sf-loader-init', () => {
    window.__probe.order.push('sf-loader-init');
    window.__probe.initCount = (window.__probe.initCount || 0) + 1;
  });
  // A page script that runs before core.js: it has no SF.ready to read.
  (window.SF_ON_READY = window.SF_ON_READY || []).push((SF) => {
    window.__probe.order.push('early');
    window.__probe.early.push({isGlobal: SF === window.SF, loadSmartBase: typeof SF.loadSmartBase, sameReady: SF.ready === window.__probe.readyRef});
  });
</script></head>`;

const afterCore = `<script>
  (() => {
    const SF = window.SF;
    window.__probe.readyRef = SF.ready;
    window.__probe.afterCore = {
      ready: typeof SF.ready, then: typeof SF.ready?.then,
      loader: typeof SF.Loader, loadSmartBase: typeof SF.loadSmartBase,
    };
    SF.ready.then((value) => {
      window.__probe.order.push('then');
      window.__probe.then.push({isGlobal: value === window.SF, loadSmartBase: typeof value.loadSmartBase, loader: typeof value.Loader});
    });
    SF.ready(() => { window.__probe.callback += 1; });
  })();
</script>`;

const pages = {
  '/main.html': `${head('sf-ready')}<body><p>Готовность загрузчика</p>
<script src="/distr/core/js/core.js"></script>${afterCore}</body></html>`,
  '/two.html': `${head('sf-ready, two cores')}<body><p>Два ядра на странице</p>
<script src="/distr/core/js/core.js"></script>${afterCore}
<script>window.__probe.secondBefore = window.SF.ready;</script>
<script src="/distr/core/js/core.js?second"></script>
<script>window.__probe.secondAfter = window.SF.ready;</script></body></html>`,
};

const types = new Map([['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.svg', 'image/svg+xml']]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (pages[url.pathname]) {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      response.end(pages[url.pathname]);
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
const fail = (name, got, expected) => failures.push({case: name, got, expected});
const report = {};
const browser = await chromium.launch();
try {
  // One page, one core.js.
  const tab = await browser.newPage();
  tab.on('pageerror', (error) => fail('page error (main)', error.message, 'none'));
  await tab.goto(`${origin}/main.html`);
  await tab.waitForFunction(() => window.__probe.then.length > 0, null, {timeout: 20000}).catch(() => {});
  await tab.waitForLoadState('load');
  await tab.waitForTimeout(1500);

  // A module script added long after load.
  report.late = await tab.evaluate(() => new Promise((done) => {
    window.__lateDone = done;
    setTimeout(() => done({timeout: true}), 15000);
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      try {
      let settled = false;
      window.SF.ready.then(() => { settled = true; });
      await new Promise((tick) => setTimeout(tick, 0));
      const SF = await window.SF.ready;
      const base = await Promise.race([SF.loadSmartBase(), new Promise((stop) => setTimeout(() => stop('timeout'), 8000))]);
      window.__lateDone({
        settledWithinATask: settled, isGlobal: SF === window.SF, sameReady: window.SF.ready === window.__probe.readyRef,
        loadSmartBase: typeof SF.loadSmartBase, base: base === 'timeout' ? 'timeout' : Boolean(window.SF.smart),
      });
      } catch (error) { window.__lateDone({threw: String(error)}); }`;
    document.body.append(script);
  }));
  await tab.waitForTimeout(100);
  report.main = await tab.evaluate(() => {
    const probe = window.__probe;
    return {
      afterCore: probe.afterCore, order: probe.order, early: probe.early, then: probe.then,
      callback: probe.callback, initCount: probe.initCount, errors: probe.errors,
      descriptor: (() => { const d = Object.getOwnPropertyDescriptor(window.SF, 'ready'); return {get: typeof d?.get, set: typeof d?.set, enumerable: d?.enumerable, configurable: d?.configurable}; })(),
      replaced: (() => { window.SF.ready = () => 'replaced'; return window.SF.ready !== probe.readyRef; })(),
    };
  });
  const main = report.main;
  if (main.afterCore?.ready !== 'function' || main.afterCore?.then !== 'function') fail('SF.ready right after core.js', main.afterCore, 'a callable thenable');
  if (main.afterCore?.loadSmartBase !== 'undefined' || main.afterCore?.loader !== 'undefined') fail('the Loader names right after core.js', main.afterCore, 'not yet there (else the case below proves nothing)');
  if (main.then.length !== 1 || !main.then[0].isGlobal || main.then[0].loadSmartBase !== 'function' || main.then[0].loader !== 'object') fail('SF.ready settles once, with window.SF, after the Loader', main.then, 'one call, window.SF with SF.loadSmartBase and SF.Loader');
  if (main.initCount !== 1) fail('sf-loader-init sent once', main.initCount, 1);
  const init = main.order.indexOf('sf-loader-init');
  if (init < 0 || main.order.indexOf('then') < init || main.order.indexOf('early') < init) fail('SF.ready settles at sf-loader-init, not before', main.order, 'sf-loader-init, then early and then');
  if (main.early.length !== 1 || !main.early[0].isGlobal || main.early[0].loadSmartBase !== 'function' || !main.early[0].sameReady) fail('a function queued before core.js', main.early, 'one call, window.SF, the same SF.ready');
  if (main.callback !== 1) fail('the callback form', main.callback, 1);
  if (main.replaced) fail('SF.ready is not replaced by assignment', main.replaced, false);
  if (main.descriptor.get !== 'function' || main.descriptor.configurable !== false || main.descriptor.enumerable !== true) fail('SF.ready property', main.descriptor, 'enumerable, non-configurable accessor');
  const late = report.late;
  if (!late.settledWithinATask || !late.isGlobal || !late.sameReady || late.loadSmartBase !== 'function' || late.base !== true) fail('a module script added long after load', late, 'already settled, window.SF, the same promise, the Smart base loads');
  if (main.errors.length) fail('errors on the main page', main.errors, []);
  await tab.close();

  // Two core.js on one page.
  const two = await browser.newPage();
  await two.goto(`${origin}/two.html`);
  await two.waitForFunction(() => window.__probe.then.length > 0, null, {timeout: 20000}).catch(() => {});
  await two.waitForLoadState('load');
  await two.waitForTimeout(1500);
  report.two = await two.evaluate(async () => {
    const probe = window.__probe;
    let later = 0;
    window.SF.ready.then(() => { later += 1; });
    await new Promise((tick) => setTimeout(tick, 0));
    return {
      kept: probe.secondBefore === probe.readyRef && probe.secondAfter === probe.readyRef && window.SF.ready === probe.readyRef,
      then: probe.then.length, early: probe.early.length, callback: probe.callback, later,
      initCount: probe.initCount, loadSmartBase: typeof window.SF.loadSmartBase,
    };
  });
  const twoCores = report.two;
  if (!twoCores.kept) fail('two core.js keep one SF.ready', twoCores, 'the second core.js keeps the first SF.ready');
  if (twoCores.then !== 1 || twoCores.early !== 1 || twoCores.callback !== 1 || twoCores.later !== 1) fail('two core.js: nothing runs twice', twoCores, 'each function once');
  if (twoCores.loadSmartBase !== 'function') fail('two core.js: the Loader is up', twoCores, 'SF.loadSmartBase');
  await two.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(JSON.stringify({failures, report}, null, 2));
  throw new Error(`${failures.length} SF.ready defect(s)`);
}
process.stdout.write(`SF.ready: PASS ${JSON.stringify(report)}\n`);
