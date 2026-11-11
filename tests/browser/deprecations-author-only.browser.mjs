#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// SF.deprecations counts the page's own uses of a former name, never the
// Framework's (pair ui-a0370c0c99fb acceptance, F3). A page of sf-button,
// sf-button-icon, closable sf-tags and an sf-slider with light arrows, all
// in current names, listed five «sf-button-icon appearance link -> ghost»
// uses: the tag drew its remove button with appearance="link", and the
// slider's light arrows asked for link too.
//
// Through the real Loader, light and dark:
//   1. a page in current names lists no deprecation;
//   2. a page that writes appearance="link" on one sf-button-icon itself
//      lists exactly that one use;
//   3. the console is clean (a deprecation warns only on request).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const BODY = `<sf-button text="Сохранить"></sf-button>
<sf-button-icon icon="edit" aria-label="Изменить" appearance="ghost"></sf-button-icon>
<sf-tag text="Метка" closable></sf-tag>
<sf-tag kind="icon" icon="label" text="С иконкой" closable></sf-tag>
<sf-tag kind="avatar" text="Гость" closable></sf-tag>
<sf-tag text="Маленькая" size="1/3" closable></sf-tag>
<sf-tag text="Большая" size="2" closable></sf-tag>
<div style="inline-size:20rem"><sf-slider arrows button-type="light"><div class="swiper-slide">1</div><div class="swiper-slide">2</div></sf-slider></div>`;
const page = (theme, extra) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--sf-surface-1)}</style>
</head><body>${BODY}${extra}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  const theme = /^\/(light|dark)$/u.exec(path)?.[1];
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    const extra = url.searchParams.has('author') ? '<sf-button-icon id="author" icon="close" aria-label="Закрыть" appearance="link"></sf-button-icon>' : '';
    return response.end(page(theme, extra));
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

const failures = [];
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const author of [false, true]) {
      const tab = await browser.newPage({viewport: {width: 1280, height: 600}});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}${author ? '?author' : ''}`);
      await tab.waitForFunction(() => document.querySelectorAll('sf-tag sf-button-close button').length >= 5
        && document.querySelectorAll('sf-slider sf-button-icon button').length >= 2, null, {timeout: 20000})
        .catch(() => errors.push('the tags and the slider never drew their buttons'));
      await tab.waitForTimeout(500);
      const notes = await tab.evaluate(() => (globalThis.SF?.deprecations?.list?.() ?? []).map((note) => `${note.component} ${note.attribute} ${note.from}->${note.to} x${note.count}`));
      const name = `${theme}${author ? ' with the author\'s link' : ''}`;
      const expected = author ? ['sf-button-icon appearance link->ghost x1'] : [];
      const link = notes.filter((note) => / link->/u.test(note));
      console.log(`${name}: ${notes.length ? notes.join('; ') : 'no deprecation'}`);
      if (JSON.stringify(link) !== JSON.stringify(expected)) failures.push(`${name}: listed ${JSON.stringify(link)}, expected ${JSON.stringify(expected)}`);
      if (!author && notes.length) failures.push(`${name}: a page in current names lists ${JSON.stringify(notes)}`);
      if (errors.length) failures.push(`${name}: ${errors.join(' | ')}`);
      await tab.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS deprecations-author-only');
