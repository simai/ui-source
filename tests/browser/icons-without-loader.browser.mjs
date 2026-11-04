#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// A page with core.css and the icons sheet linked by hand, no Loader
// (2026-11-04): core.css holds every icon at font-size 0 until it is marked
// sf-icon-loaded, and only the Loader marks it, so these icons never drew.
// The icons sheet now lets them draw once the font is in when no Loader is on
// the page (no data-sf-loader on html):
//   - without the Loader an icon draws its glyph: a box of the icon size, the
//     ligature resolved (one glyph, not the name spelled out);
//   - with the Loader on the page the hold stays the Loader's: an icon it has
//     not marked loaded is still at font-size 0.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component')};
const pages = {
  plain: `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css"><link rel="stylesheet" href="/distr/component/icons/css/icons.css"></head>
<body><i class="sf-icon" id="star">star</i> <span id="word">star</span></body></html>`,
  loader: `<!doctype html><html lang="ru" data-sf-loader><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css"><link rel="stylesheet" href="/distr/component/icons/css/icons.css"></head>
<body><i class="sf-icon" id="star">star</i></body></html>`,
};
const types = {'.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (pages[path.slice(1)]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(pages[path.slice(1)]);
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
const measured = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 800, height: 400}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/plain`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForFunction(() => document.fonts.check('24px "Material Symbols Outlined"', 'star'), null, {timeout: 15000}).catch(() => failures.push({name: 'the icon font never loaded'}));
  measured.plain = await tab.evaluate(() => {
    const icon = document.getElementById('star');
    const range = document.createRange();
    range.selectNodeContents(icon);
    const glyph = range.getBoundingClientRect();
    return {fontSize: parseFloat(getComputedStyle(icon).fontSize), box: icon.getBoundingClientRect().width, glyph: glyph.width, loader: document.documentElement.hasAttribute('data-sf-loader')};
  });
  const m = measured.plain;
  if (!(m.fontSize >= 16)) failures.push({name: 'without the Loader an icon has its size', ...m});
  if (!(m.glyph > 0 && Math.abs(m.glyph - m.fontSize) <= 2)) failures.push({name: 'without the Loader the ligature draws one glyph, not the name', ...m});
  await tab.goto(`http://127.0.0.1:${server.address().port}/loader`);
  await tab.evaluate(() => document.fonts.ready);
  measured.loader = await tab.evaluate(() => ({fontSize: parseFloat(getComputedStyle(document.getElementById('star')).fontSize)}));
  if (measured.loader.fontSize !== 0) failures.push({name: 'with the Loader an icon it has not marked loaded stays held', ...measured.loader});
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({probe: 'icons-without-loader', passed: failures.length === 0, failures, measured}, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
