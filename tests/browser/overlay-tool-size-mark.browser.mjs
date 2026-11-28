#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-editor-overlay 1.12.12 (GB21, msg-d96638bc): the toolbar's icon buttons
// -- the actions, «Ещё» and «+» -- carry data-sf-size-relative from the moment
// the overlay builds them, with no Smart host above to mark them, on every
// load, before and after the actions arrive, at a desktop and a phone width
// (where the tools step to size 2). Before 1.12.12 the mark came only from a
// Smart host above that drew after the toolbar was built (sf-mail-canvas), so
// a first-paint picture held it on some loads and not on others. Three loads
// each, the console read.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const parts = {core: join(out, 'core', 'core'), smart: join(out, 'smart', 'smart'), component: join(out, 'component', 'component'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`the output has no ${name}: ${path}`);

const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script><style>
  html, body { margin: 0 } #well { padding: 56px 24px 24px }
  #canvas { max-width: 640px; margin-inline: auto } #canvas p { margin: 0; padding: 16px; min-height: 60px }
</style></head><body><div id="well">
  <sf-editor-overlay id="ov" for="canvas" label="Страница"></sf-editor-overlay>
  <div id="canvas"><section data-sf-composition-id="root"><p data-sf-composition-id="a">Первый</p><p data-sf-composition-id="b">Второй</p></section></div>
</div></body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'access-control-allow-origin': '*'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const report = [];
const tools = (tab) => tab.evaluate(() => Array.from(document.querySelectorAll('#ov .sf-composition-overlay-tool > sf-button-icon'))
  .map((button) => ({icon: button.getAttribute('icon'), size: button.getAttribute('size'), relative: button.hasAttribute('data-sf-size-relative')})));
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [['desktop', {width: 1100, height: 760}], ['phone', {width: 390, height: 760}]]) {
    const context = await browser.newContext({locale: 'ru-RU', viewport, hasTouch: label === 'phone', isMobile: label === 'phone'});
    for (let load = 1; load <= 3; load += 1) {
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
      await tab.goto(`${base}/page`);
      await tab.waitForFunction(() => document.querySelector('#ov .sf-composition-overlay-tool > sf-button-icon'), null, {timeout: 25000});
      const built = await tools(tab);
      await tab.evaluate(() => {
        const overlay = document.getElementById('ov');
        overlay.setDocument({schema: 'simai.composition.document.v1', id: 'd', profile: 'ui-layout', root: {id: 'root', type: 'layout.section', slots: {default: [{id: 'a', type: 'content.paragraph'}, {id: 'b', type: 'content.paragraph'}]}}}, {describe: (node) => ({label: node.id})});
        overlay.setActions([{id: 'up', label: 'Выше', icon: 'arrow_upward'}, {id: 'remove', label: 'Удалить', icon: 'delete'}]);
      });
      const box = await tab.evaluate(() => document.querySelector('[data-sf-composition-id="a"]').getBoundingClientRect().toJSON());
      if (label === 'phone') await tab.touchscreen.tap(box.x + 30, box.y + 20);
      else await tab.mouse.click(box.x + 30, box.y + 20);
      await tab.waitForTimeout(300);
      const withActions = await tools(tab);
      const entry = {label, load, built, withActions, errors};
      report.push(entry);
      if (!built.length || !built.every((tool) => tool.relative)) failures.push({case: 'every tool is marked relative when the overlay builds it', ...entry});
      if (withActions.length < built.length + 2 || !withActions.every((tool) => tool.relative)) failures.push({case: 'the action tools are marked relative too', ...entry});
      const want = label === 'phone' ? '2' : '1/2';
      if (!withActions.every((tool) => tool.size === want)) failures.push({case: `tools stand at size ${want}`, ...entry});
      if (errors.length) failures.push({case: 'console clean', ...entry});
      await tab.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(report));
if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
console.log('OVERLAY_TOOL_SIZE_MARK_OK');
