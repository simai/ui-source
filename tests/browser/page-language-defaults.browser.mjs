#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Smart elements left without their text attributes speak the page's
// language. Their manifests declared English defaults the runtime never used,
// and a window with no title was headed and named «Modal» on every page. On a
// Russian page none of the English texts may appear, in text or attributes;
// on an English one the dictionary's English does.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<sf-spinner></sf-spinner>
<sf-spinner id="quiet" label=""></sf-spinner>
<sf-pagination total="120" page-size="10" page="3"></sf-pagination>
<sf-breadcrumbs><a href="/">Главная</a><a href="/a">Раздел</a><a href="/b">Подраздел</a><a href="/c">Ещё</a><span>Страница</span></sf-breadcrumbs>
<sf-steps><sf-step status="completed" text="Один"></sf-step><sf-step status="error" text="Два"></sf-step></sf-steps>
<sf-tags closable><sf-tag text="Метка"></sf-tag></sf-tags>
<sf-modal open></sf-modal>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/ru' || path === '/en') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
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

const english = ['Loading…', 'Result pages', 'Pages:', 'Previous page', 'Next page', 'Total:', 'Per page:',
  'Breadcrumb', 'Show hidden breadcrumbs', 'Steps', 'Completed', 'Remove', 'Modal', 'Close alert', 'Close message'];
const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  for (const lang of ['ru', 'en']) {
    const tab = await browser.newPage();
    await tab.goto(`http://127.0.0.1:${server.address().port}/${lang}`);
    await tab.waitForFunction(() => ['sf-spinner', 'sf-pagination', 'sf-modal'].every((tag) => customElements.get(tag)), null, {timeout: 15000})
      .catch(() => failures.push(`${lang}: the elements never defined`));
    await tab.waitForTimeout(800);
    const texts = await tab.evaluate(() => {
      const out = new Set();
      const walk = (root) => root.querySelectorAll('*').forEach((element) => {
        for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
          const value = element.getAttribute(name);
          if (value) out.add(value.trim());
        }
        element.childNodes.forEach((node) => { if (node.nodeType === 3 && node.textContent.trim()) out.add(node.textContent.trim()); });
        if (element.shadowRoot) walk(element.shadowRoot);
      });
      walk(document.body);
      return [...out];
    });
    seen[lang] = texts.filter((text) => /[A-Za-z]/u.test(text)).slice(0, 40);
    seen[`${lang}-modal`] = await tab.evaluate(() => { const d = document.querySelector('[role=dialog], dialog'); const h = d && (d.getAttribute('aria-labelledby') ? document.getElementById(d.getAttribute('aria-labelledby')) : null); return {heading: h?.textContent ?? null, label: d?.getAttribute('aria-label') ?? null, dialogs: document.querySelectorAll('[role=dialog], dialog').length}; });
    // label="" is a spinner with no words, not an unset label.
    const quiet = await tab.evaluate(() => document.querySelector('#quiet')?.textContent.trim() ?? null);
    if (quiet) failures.push(`${lang}: sf-spinner label="" shows ${JSON.stringify(quiet)}`);
    const untitled = {ru: 'Окно', en: 'Dialog'}[lang];
    if (seen[`${lang}-modal`].heading !== untitled) failures.push(`${lang}: an untitled window is headed ${JSON.stringify(seen[`${lang}-modal`].heading)}, expected ${untitled}`);
    const found = english.filter((text) => texts.includes(text));
    if (lang === 'ru' && found.length) failures.push(`ru: English text on a Russian page: ${found.join(', ')}`);
    if (lang === 'en' && !found.includes('Loading…')) failures.push(`en: the dictionary's English is missing (${found.join(', ') || 'none'})`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
