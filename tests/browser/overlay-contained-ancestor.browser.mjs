#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-composition-overlay draws its frames with position: fixed from page
// coordinates. An ancestor with `contain: layout` becomes the containing block
// for fixed descendants -- the Framework's own drawer gives it to
// [data-sf-drawer-container] -- and every frame then sat that ancestor's corner
// away from its node (simai/ui-source#58, found by ui-mail: 48 px under an app
// bar). The layer is inset: 0 of the same containing block, so its corner is
// the error, and the overlay now places everything relative to it.
//
// The page is the issue's own: an app bar, a contained scroller, the overlay
// and a same-origin frame of two blocks. Measured with the containment and
// without it: in both the frame sits on its node.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const page_html = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>
  body { margin: 0 }
  .bar { height: 48px; background: #eee }
  .well { height: 260px; overflow: auto }
  .contained { contain: layout }
</style></head><body>
<div class="bar"></div>
<div class="well contained" id="well">
  <sf-composition-overlay id="ov" frame="f" label="Письмо"></sf-composition-overlay>
  <iframe id="f" sandbox="allow-same-origin" width="400" height="300"
    srcdoc='<body style="margin:0"><div data-b="one" style="height:80px">one</div><div data-b="two" style="height:80px">two</div></body>'></iframe>
</div>
</body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page_html);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({locale: 'ru-RU', viewport: {width: 900, height: 700}});
  page.on('pageerror', (error) => failures.push({name: 'page error', said: error.message}));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
  await page.waitForFunction(() => customElements.get('sf-composition-overlay'), null, {timeout: 25000});
  await page.waitForTimeout(400);
  const read = async (contained) => page.evaluate(async (keep) => {
    const well = document.getElementById('well');
    well.classList.toggle('contained', keep);
    const overlay = document.getElementById('ov');
    const frame = document.getElementById('f');
    const nodes = [...frame.contentDocument.querySelectorAll('[data-b]')]
      .map((element) => ({id: element.dataset.b, kind: 'block', element, label: element.dataset.b}));
    overlay.setNodes(nodes);
    overlay.setActions([{id: 'up', label: 'Выше'}]);
    overlay.select('one');
    await new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(settle, 120))));
    const drawn = overlay.querySelector('.sf-composition-overlay-frame--selected') || overlay.querySelector('.sf-composition-overlay-frame');
    const node = frame.contentDocument.querySelector('[data-b="one"]').getBoundingClientRect();
    const inFrame = frame.getBoundingClientRect();
    const want = {top: inFrame.top + node.top, left: inFrame.left + node.left};
    const box = drawn?.getBoundingClientRect();
    return {
      contained: keep,
      drawn: Boolean(box),
      error: box ? [Math.round(box.left - want.left), Math.round(box.top - want.top)] : null,
    };
  }, contained);
  const inside = await read(true);
  const outside = await read(false);
  for (const one of [inside, outside]) {
    if (!one.drawn) failures.push({name: `contained ${one.contained}`, said: 'no frame was drawn'});
    else if (Math.abs(one.error[0]) > 1 || Math.abs(one.error[1]) > 1) failures.push({name: `contained ${one.contained}`, error: one.error});
  }
  console.log(JSON.stringify({inside, outside}));
  await page.close();
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('OVERLAY_CONTAINED_OK');
