#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A modal waiting for its content says so in the page's language: «Загрузка…»
// on a Russian page, "Loading…" on an English one, in the text a reader sees
// and in the name the status region gives a screen reader. Both modals: the
// smart sf-modal and the ordinary one. They said "Loading..." on every page
// (simai/ui-source#11 follow-up). The content never arrives, so the loading
// state stays up to be read.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{preloaderActive:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<button type="button" data-sf-modal-open="ordinary-loading">open</button>
<sf-modal id="smart-loading" open mode="ajax" src="/never" title="Probe"></sf-modal>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const held = new Set();
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/ru' || path === '/en') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  // Content that never comes: the request is held open until the probe ends.
  if (path === '/never') {
    held.add(response);
    return undefined;
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const expected = {ru: 'Загрузка…', en: 'Loading…'};
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const lang of ['ru', 'en']) {
    const tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`http://127.0.0.1:${server.address().port}/${lang}`);
    const words = expected[lang];
    const read = async (kind, selector) => {
      const region = tab.locator(selector).first();
      try {
        await region.waitFor({state: 'attached', timeout: 15000});
      } catch {
        failures.push(`${lang} ${kind}: the loading state never appeared`);
        return;
      }
      const state = await region.evaluate((node) => ({
        text: node.querySelector('p')?.textContent.trim() ?? null,
        role: node.getAttribute('role'),
        label: node.getAttribute('aria-label'),
        all: node.textContent.replace(/\s+/gu, ' ').trim(),
      }));
      // The accessible name as the browser computes it, not as the attribute says.
      state.snapshot = await region.ariaSnapshot().catch((error) => `unavailable: ${error.message}`);
      seen[`${lang}-${kind}`] = state;
      if (state.text !== words) failures.push(`${lang} ${kind}: the loading state reads ${JSON.stringify(state.text)}, expected ${words}`);
      if (state.role !== 'status') failures.push(`${lang} ${kind}: the loading state is not a status region (${state.role})`);
      if (state.label !== words) failures.push(`${lang} ${kind}: the loading state is named ${JSON.stringify(state.label)}, expected ${words}`);
      if (!state.snapshot.includes(`status "${words}"`)) failures.push(`${lang} ${kind}: the browser names the status ${JSON.stringify(state.snapshot)}, expected ${words}`);
      if (/Loading\.\.\.|Loading(?!…)/u.test(state.all) && lang === 'ru') failures.push(`${lang} ${kind}: English on a Russian page: ${state.all}`);
    };

    // The window draws in its portal; its root no longer repeats the element's
    // id (simai/ui-source#42), so the portal names it.
    await read('smart', '[data-sf-modal-portal="smart-loading"] [data-sf-modal-state="loading"]');

    const opened = await tab.waitForFunction(() => !!window.SF?.Loader?.ComponentRegistry?.Modal, null, {timeout: 15000})
      .then(() => true, () => false);
    if (!opened) {
      failures.push(`${lang} ordinary: the Modal component never registered`);
    } else {
      await tab.evaluate(() => {
        const modal = new window.SF.Loader.ComponentRegistry.Modal({id: 'ordinary-loading', param: {title: 'Probe', mode: 'ajax', src: '/never'}});
        window.ordinaryLoading = modal;
        modal.open({animate: false});
      });
      // The ordinary modal waits half a second before it shows loading, so a
      // fast answer does not flash it.
      await read('ordinary', '.sf-modal-loading[data-sf-modal-state="loading"]:not([data-sf-modal-portal="smart-loading"] *)');
    }
    if (errors.length) failures.push(`${lang}: page errors: ${errors.join('; ')}`);
    await tab.close();
  }
} finally {
  await browser.close();
  for (const response of held) response.destroy();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
