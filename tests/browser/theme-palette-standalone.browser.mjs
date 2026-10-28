#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.ThemePalette on its own: SF.Loader.ensurePlugin('theme-palette') loads
// it without the theme generator, SF.Loader.ready and theme-palette:ready hand
// it over, and applyTheme writes the primitives on <html> (ui-effects site,
// 2026-10-28).
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
<p>palette</p>
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

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  const requests = [];
  tab.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await tab.goto(`http://127.0.0.1:${server.address().port}/ru`);
  await tab.waitForFunction(() => window.SF?.Loader?.ensurePlugin, null, {timeout: 15000});
  seen.before = await tab.evaluate(() => Boolean(window.SF.ThemePalette));
  seen.result = await tab.evaluate(() => new Promise((done) => {
    let event = null;
    window.addEventListener('theme-palette:ready', (e) => { event = e.detail; }, {once: true});
    const asked = window.SF.Loader.ensurePlugin('theme-palette');
    window.SF.Loader.ready('theme-palette', (palette) => setTimeout(() => {
      const restore = palette.applyTheme(palette.themeFromColor('#3366ff'));
      const primary = getComputedStyle(document.documentElement).getPropertyValue('--sf-primary-40').trim();
      restore();
      done({asked, same: palette === window.SF.ThemePalette, event: event === palette, members: typeof palette.themeFromColor, primary});
    }, 50));
    setTimeout(() => done({timeout: true}), 8000);
  }));
  seen.generator = requests.filter((path) => path.includes('theme-generator'));
  seen.palette = requests.filter((path) => path.includes('theme-palette'));
  if (seen.before) failures.push('SF.ThemePalette was there before it was asked for');
  if (seen.result.timeout || !seen.result.asked || !seen.result.same || seen.result.members !== 'function') failures.push(`ready: ${JSON.stringify(seen.result)}`);
  if (!seen.result.event) failures.push('theme-palette:ready did not carry the palette');
  if (!seen.result.primary) failures.push('applyTheme wrote no --sf-primary-40');
  if (seen.generator.length) failures.push(`the theme generator was fetched: ${seen.generator.join(', ')}`);
  if (!seen.palette.length) failures.push('no theme-palette script was fetched');
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('THEME_PALETTE_STANDALONE_OK');
