#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The registry of universal properties says, per type, which field keys its
// renderers read (DEV, 2026-10-15: it listed keys nothing read). Here every
// type and variant is drawn in every mode with a field that records what is
// read, and each registered key must be among them. And a page with core.js
// alone gets the set from SF.whenFieldRenderers(), with nothing added by hand.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'smart', 'smart', 'field-renderers', 'js', 'field-renderers.js')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>field renderer params</title>
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'field-renderer-params', pluginListVersion: 'field-renderer-params',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body>
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
  await tab.waitForFunction(() => typeof window.SF?.whenFieldRenderers === 'function', null, {timeout: 10000});
  const result = await tab.evaluate(async () => {
    const set = await Promise.race([window.SF.whenFieldRenderers(), new Promise((done) => setTimeout(() => done(null), 8000))]);
    if (!set) return {ready: false};
    const again = await window.SF.whenFieldRenderers();
    const VALUES = {string: 'a', text: 'a', integer: 3, number: 3.5, date: '2026-10-15', datetime: '2026-10-15T10:00:00',
      boolean: true, choice: 'a', choices: ['a'], user: {value: '1', label: 'x'}, record: {value: '1', label: 'x'},
      relation: {value: '1', label: 'x'}, file: [{name: 'a.png', href: '/a.png'}], color: '#ff0000', include: 'x'};
    const host = new Proxy({
      setFieldValue() {}, getFieldOptionsPage: () => ({items: [], status: 'ready'}), getFieldOptionSearch: () => '',
      loadFieldOptions() {}, startFieldUpload() {}, getFieldUploads: () => [],
    }, {get: (target, key) => (key in target ? target[key] : (typeof key === 'string' ? () => undefined : undefined))});
    const report = [];
    for (const entry of set.registry) {
      const reads = new Set();
      for (const variant of [null, ...entry.variants.map((one) => one.id)]) {
        for (const extra of [{}, {required: true}, {readonly: true}, {multiple: true}]) {
          const field = new Proxy({key: 'k', label: 'L', propertyType: entry.type, ...(variant ? {variant} : {}), ...extra,
            options: [{value: 'a', label: 'A'}]}, {get(target, key) { if (typeof key === 'string') reads.add(key); return target[key]; }});
          for (const draw of [
            () => set.renderEditField(field, VALUES[entry.type], host),
            () => set.renderViewField(field, VALUES[entry.type], host),
            () => set.renderCellField(field, VALUES[entry.type], host),
            () => set.renderFilterField(field, host),
          ]) {
            try { draw(); } catch { /* a mode the type does not draw */ }
          }
        }
      }
      const unread = entry.params.filter((param) => !reads.has(param));
      if (unread.length) report.push({type: entry.type, unread});
    }
    return {ready: true, same: set === again, report, types: set.registry.length};
  });
  if (!result.ready) failures.push({case: 'SF.whenFieldRenderers() brings the set to a page with core.js alone', got: result});
  else {
    if (!result.same) failures.push({case: 'the promise settles with SF.fieldRenderers', got: result});
    if (result.report.length) failures.push({case: 'every registered key is read by its type\'s renderers', got: result.report});
  }
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('FIELD_RENDERER_PARAMS_OK');
