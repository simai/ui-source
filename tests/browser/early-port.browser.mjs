#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// SF.EarlyPort on the built core (core/js/early-port.js; standard §4.9
// proposal, stand 27 variant c). A page declares the port of an element in a
// data-sf-port island; the element's code arrives late (800 ms). Checks:
//   one request   the first call leaves before the element is defined, the
//                 element is handed the port in its definition task, its first
//                 matching call takes the early answer: one host request;
//   changed       the element's first query differs (a kept page size): the
//                 early answer is refused and the host is asked again, never
//                 the early rows;
//   malformed     an island that is not JSON: a console warning, no request,
//                 no port; the page's own port works as without the island;
//   no island     nothing is sent and nothing connected;
//   first batch   on a page the Loader drives, the declared element's
//                 definition is a batch of its own, before the other queued
//                 definitions.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const QUERY = {filters: {}, search: '', sort: [], page: 1, per_page: 20};
const ISLAND = (query = QUERY) => JSON.stringify({
  port: 'simai.probe-port', version: '1.0.0', url: '/host/list', capabilities: ['row-actions'],
  first: {intent: 'query.change', payload: {query}},
});

// The element: takes its port by connect-port and sends its first query at
// once, as sf-data-view does (query from `data-query`, else the declared one).
const ELEMENT = `
  window.__probe = {raised: [], answers: [], warnings: []};
  const warn = console.warn.bind(console);
  console.warn = (...args) => { window.__probe.warnings.push(args.map(String).join(' ')); warn(...args); };
  window.defineList = () => {
    class ProbeList extends HTMLElement {
      connectPort(params) {
        const port = params && params.port && typeof params.port === 'object' ? params.port : params;
        this.port = port;
        window.__probe.connectedAt = performance.now();
        window.__probe.connectedIn = window.__probe.definedTask;
        const query = this.dataset.query ? JSON.parse(this.dataset.query) : ${JSON.stringify(QUERY)};
        port.raise('query.change', {sequence: 1, query, reason: 'connected'}).then((answer) => {
          window.__probe.answers.push(answer);
        });
        return {outcome: 'applied'};
      }
    }
    window.__probe.definedTask = 'define';
    customElements.define('sf-probe-list', ProbeList);
    window.__probe.definedAt = performance.now();
    window.__probe.definedTask = null;
  };`;

const pageOf = (body) => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {cacheVersion: 'early-port', pluginListVersion: 'early-port', preloader: {enabled: false}, icons: {enabled: false}, theme: false};${ELEMENT}</script>
  <script defer src="/distr/core/js/core.js"></script>
  </head><body>${body}
  <script>setTimeout(() => window.defineList(), 800);</script></body></html>`;

const failures = [];
const browser = await chromium.launch();
const run = async (label, body, check) => {
  const page = await browser.newPage();
  const host = [];
  page.on('pageerror', (error) => failures.push({label, said: `page error: ${error.message}`}));
  await page.route('http://probe.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: pageOf(body)});
    if (url.pathname === '/host/list') {
      const sent = JSON.parse(route.request().postData() || '{}');
      const at = await page.evaluate(() => performance.now()).catch(() => null);
      host.push({at, sent});
      await new Promise((settle) => setTimeout(settle, 300));
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
        answer: 'applied', sequence: sent.payload?.sequence ?? null, data: {query: sent.payload?.query, records: [{id: host.length}]},
      })});
    }
    const [product, ...rest] = url.pathname.replace(/^\/distr\//u, '').split('/');
    const file = join(out, product, product, ...rest);
    return existsSync(file)
      ? route.fulfill({status: 200, contentType: file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', body: readFileSync(file)})
      : route.fulfill({status: 404, body: ''});
  });
  await page.goto('http://probe.test/');
  await page.waitForFunction(() => window.__probe?.definedAt, null, {timeout: 10000});
  await page.waitForTimeout(900);
  const probe = await page.evaluate(() => ({...window.__probe, log: window.SF?.EarlyPort?.log ?? null}));
  try {
    check({host, probe, page});
  } catch (error) {
    failures.push({label, said: error.message, host: host.length, probe});
  }
  return page;
};
const expect = (ok, message) => { if (!ok) throw new Error(message); };

try {
  await run('one request', `<sf-probe-list id="list"><script type="application/json" data-sf-port>${ISLAND()}</script></sf-probe-list>`, ({host, probe}) => {
    expect(host.length === 1, `one host request, got ${host.length}`);
    expect(host[0].at < probe.definedAt, `the request left before the element was defined (${host[0].at} vs ${probe.definedAt})`);
    expect(host[0].sent.payload?.sequence === 0 && host[0].sent.intent === 'query.change', 'the early call is the declared one');
    expect(probe.connectedAt !== undefined && probe.connectedAt - probe.definedAt < 50, 'the port was handed when the element was defined');
    expect(probe.answers.length === 1 && probe.answers[0].sequence === 1, 'the early answer carries the element\'s sequence');
    expect(probe.log.some((entry) => entry.what === 'adopt'), 'the answer was adopted');
  });

  await run('changed', `<sf-probe-list id="list" data-query='${JSON.stringify({...QUERY, per_page: 40})}'><script type="application/json" data-sf-port>${ISLAND()}</script></sf-probe-list>`, ({host, probe}) => {
    expect(host.length === 2, `the host asked again, got ${host.length}`);
    expect(host[1].sent.payload.query.per_page === 40, 'the second request is the element\'s query');
    expect(probe.answers.length === 1 && probe.answers[0].data.query.per_page === 40, 'the element got the rows of its own query');
    expect(probe.log.some((entry) => entry.what === 'mismatch'), 'the early answer was refused');
  });

  await run('malformed', `<sf-probe-list id="list"><script type="application/json" data-sf-port>{"port": "simai.probe-port", </script></sf-probe-list>`, ({host, probe}) => {
    expect(host.length === 0, `no request, got ${host.length}`);
    expect(probe.connectedAt === undefined, 'no port handed');
    expect(probe.warnings.some((text) => text.includes('data-sf-port') && text.includes('not JSON')), 'a console warning');
  });

  await run('no island', '<sf-probe-list id="list"></sf-probe-list>', ({host, probe}) => {
    expect(host.length === 0, `no request, got ${host.length}`);
    expect(probe.connectedAt === undefined, 'no port handed');
    expect(Array.isArray(probe.log) && probe.log.length === 0, 'SF.EarlyPort did nothing');
    expect(!probe.warnings.some((text) => text.includes('early port')), 'no warning');
  });

  // First batch: the Smart base's definition queue on a page the Loader drives.
  const page = await run('first batch', `<sf-probe-list id="list"><script type="application/json" data-sf-port>${ISLAND()}</script></sf-probe-list><sf-probe-late id="late"></sf-probe-late><sf-probe-held id="held"><script type="application/json" data-sf-port>${ISLAND().replace('/host/list', '/host/held')}</script></sf-probe-held>`, () => {});
  const order = await page.evaluate(async () => {
    await new Promise((settle) => (window.SF?.Loader ? settle() : addEventListener('sf-loader-init', settle, {once: true})));
    const smart = await window.SF.loadSmartBase();
    const seen = [];
    customElements.whenDefined('sf-probe-held').then(() => seen.push(['held', Boolean(customElements.get('sf-probe-late'))]));
    customElements.whenDefined('sf-probe-late').then(() => seen.push(['late', Boolean(customElements.get('sf-probe-held'))]));
    // Queued in one task, the late one first.
    class Late extends smart.SfBaseElement {}
    class Held extends smart.SfBaseElement {}
    Late.define('sf-probe-late');
    Held.define('sf-probe-held');
    await customElements.whenDefined('sf-probe-late');
    await customElements.whenDefined('sf-probe-held');
    return seen;
  });
  try {
    expect(JSON.stringify(order) === JSON.stringify([['held', false], ['late', true]]),
      `the declared element is defined in a batch before the others: ${JSON.stringify(order)}`);
  } catch (error) {
    failures.push({label: 'first batch', said: error.message});
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Early port: PASS — one request, a changed query asks again, a malformed island and no island change nothing, the declared element is defined first\n');
