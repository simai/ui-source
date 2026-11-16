#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The tooltip controller watched added nodes only: a trigger whose
// data-tooltip was taken away kept its pointerenter and focusin listeners and
// showed the cached surface, and one pointed at another surface, or whose
// surface was redrawn, kept showing the old text. Three cases: removed (no
// tooltip on hover or focus, aria-describedby back to the page's), changed
// (the new text, both by a new reference and by a redrawn surface), and put
// back (works again). Loaded three times.
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
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body, {theme = 'theme-light', boot = '{icons: {enabled: false}}'} = {}) => `<!doctype html><html lang="ru" class="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = ${boot};</script>
<script src="/distr/core/js/core.js"></script></head><body>${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
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

const tip = (id, text) => `<span id="${id}" class="sf-tooltip sf-tooltip--dark sf-tooltip--size-1 sf-tooltip--arrow-bottom-center" hidden>
    <span class="sf-tooltip-content"><span class="sf-tooltip-text">${text}</span><span class="sf-tooltip-tail"></span></span></span>`;
const trigger = (id, ref) => `<button id="${id}" class="sf-icon-button sf-icon-button--size-1" type="button" data-tooltip="${ref}"
    aria-label="${id}" style="inline-size:40px;block-size:40px"><i class="sf-icon" aria-hidden="true">save</i></button>`;
const pages = {
  '/tooltip.html': pageOf(`<div style="padding:80px;display:flex;gap:80px">
    <span class="sf-tooltip-anchor">${trigger('removed', 'removed-tip')}${tip('removed-tip', 'Первый')}</span>
    <span class="sf-tooltip-anchor">${trigger('changed', 'changed-tip')}${tip('changed-tip', 'Старый текст')}${tip('changed-tip-2', 'Новый текст')}</span>
    <span class="sf-tooltip-anchor">${trigger('replaced', 'replaced-tip')}${tip('replaced-tip', 'Старый текст')}</span>
    <span class="sf-tooltip-anchor">${trigger('readded', 'readded-tip')}${tip('readded-tip', 'Снова')}</span>
    <button id="away" type="button">away</button></div>`),
};

const LOADS = 3;
const failures = [];
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
try {
  for (let load = 0; load < LOADS; load += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${base}/tooltip.html`);
    await page.waitForFunction(() => document.getElementById('readded').getAttribute('aria-describedby') === 'readded-tip', null, {timeout: 15000});
    const shown = () => page.evaluate(() => [...document.querySelectorAll('.sf-tooltip')]
      .filter((node) => !node.hidden && node.isConnected).map((node) => node.textContent.trim()));
    const tick = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))));
    const away = async () => { await page.mouse.move(1, 1); await page.focus('#away'); await tick(); };
    const probe = async (id) => {
      await away();
      // C59: a hover opens the tooltip after 0.5 s.
      await page.hover(`#${id}`); await page.waitForTimeout(650); await tick();
      const hover = await shown();
      await away();
      await page.focus(`#${id}`); await tick();
      const focus = await shown();
      await away();
      return {hover, focus};
    };
    const result = {};
    // 1. removed: no tooltip on hover or focus, the description gone.
    await page.evaluate(() => document.getElementById('removed').removeAttribute('data-tooltip'));
    await tick();
    result.removed = {...await probe('removed'), describedby: await page.getAttribute('#removed', 'aria-describedby')};
    result.removed.ok = result.removed.hover.length === 0 && result.removed.focus.length === 0 && result.removed.describedby === null;
    // 2a. changed to name another surface: the new text.
    await page.evaluate(() => document.getElementById('changed').setAttribute('data-tooltip', 'changed-tip-2'));
    await tick();
    result.changed = {...await probe('changed'), describedby: await page.getAttribute('#changed', 'aria-describedby')};
    result.changed.ok = String(result.changed.hover) === 'Новый текст' && String(result.changed.focus) === 'Новый текст' && result.changed.describedby === 'changed-tip-2';
    // 2b. the surface redrawn with new text under the same id: the new text.
    await page.evaluate(() => {
      const old = document.getElementById('replaced-tip');
      const next = old.cloneNode(true);
      next.querySelector('.sf-tooltip-text').textContent = 'Новый текст';
      old.replaceWith(next);
    });
    await tick();
    result.replaced = await probe('replaced');
    result.replaced.ok = String(result.replaced.hover) === 'Новый текст' && String(result.replaced.focus) === 'Новый текст';
    // 3. removed, then put back: works again.
    await page.evaluate(() => document.getElementById('readded').removeAttribute('data-tooltip'));
    await tick();
    const gone = await probe('readded');
    await page.evaluate(() => document.getElementById('readded').setAttribute('data-tooltip', 'readded-tip'));
    await tick();
    result.readded = {gone, ...await probe('readded'), describedby: await page.getAttribute('#readded', 'aria-describedby')};
    result.readded.ok = gone.hover.length === 0 && gone.focus.length === 0 && String(result.readded.hover) === 'Снова' && String(result.readded.focus) === 'Снова' && result.readded.describedby === 'readded-tip';
    result.errors = errors;
    results.push(result);
    if (errors.length || !['removed', 'changed', 'replaced', 'readded'].every((key) => result[key].ok)) failures.push({load, ...result});
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({loads: LOADS, failures, sample: results[0]}, null, 2));
if (failures.length) {
  console.error(`${failures.length} of ${LOADS} load(s) failed`);
  process.exit(1);
}
