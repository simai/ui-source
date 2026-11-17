#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// The card title on the first frame (#261 N3): core ships the card sheet's
// title rule, so a heading in .sf-card draws as the card title -- 16/24
// semibold on a desktop, 14/20 on a phone -- from the first frame, not as a
// bare heading (h3 24/28 bold, 18/24 on a phone) until the card sheet comes.
// The page loads the real Loader with core.css; the card sheet is held 800 ms.
// Every frame from the first is logged (requestAnimationFrame from the head)
// until the card sheet has drawn; each must match the last frame's title:
// size, line, weight and the heading's height. At 1440 and 390, light and
// dark, three loads each, console clean.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const HOLD_MS = 800;
const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>
window.__frames = [];
(function watch() {
  const h = document.querySelector('#card > h3');
  if (h) {
    const s = getComputedStyle(h);
    const card = getComputedStyle(h.parentElement);
    window.__frames.push({t: Math.round(performance.now()), size: s.fontSize, line: s.lineHeight, weight: s.fontWeight,
      height: Math.round(h.getBoundingClientRect().height * 100) / 100, sheet: card.display === 'flex'});
  }
  if (window.__frames.filter((f) => f.sheet).length < 3) requestAnimationFrame(watch);
})();
</script>
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:16px">
<div class="sf-card" id="card"><h3>Импорт прайса из файла</h3><p>Строки добавляются в каталог.</p></div>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  if (match[1] === 'component' && /^card\//u.test(match[2])) await new Promise((done) => setTimeout(done, HOLD_MS));
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const rows = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (let load = 1; load <= 3; load++) {
    const tab = await browser.newPage({viewport: {width, height: 800}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`http://127.0.0.1:${server.address().port}/page?theme=${theme}`);
    await tab.waitForFunction(() => window.__frames.filter((f) => f.sheet).length >= 3, null, {timeout: 15000}).catch(() => {});
    const frames = await tab.evaluate(() => window.__frames);
    const last = frames.at(-1);
    const before = frames.filter((f) => !f.sheet);
    const off = frames.filter((f) => f.size !== last?.size || f.line !== last?.line || f.weight !== last?.weight || Math.abs(f.height - last?.height) > 0.5);
    const want = width < 600 ? {size: '14px', line: '20px'} : {size: '16px', line: '24px'};
    const where = `${width} ${theme} load ${load}`;
    rows.push({where, frames: frames.length, before: before.length, first: frames[0], last, off: off.length});
    if (!last?.sheet) failures.push(`${where}: the card sheet never drew`);
    else if (last.size !== want.size || last.line !== want.line || last.weight !== '600') failures.push(`${where}: the drawn card title is ${last.size}/${last.line}/${last.weight}`);
    if (!before.length) failures.push(`${where}: no frame before the card sheet (the hold did not work)`);
    if (off.length) failures.push(`${where}: ${off.length} frame(s) draw another title, first ${JSON.stringify(off[0])}, drawn ${JSON.stringify(last)}`);
    if (errors.length) failures.push(`${where}: console ${errors.join(' | ')}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const row of rows) console.log(JSON.stringify(row));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('CARD_TITLE_FIRST_FRAME_OK');
