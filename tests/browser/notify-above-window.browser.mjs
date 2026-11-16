#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.notify's messages stand over every window (LY-13; the layer roles of
// C181 (3): window <= message). The area is in the browser's top layer; a
// window, a drawer or a popover that enters it later was drawn over the
// messages. Read at the middle of the toast, with the real Loader, at 1440
// and 390, three loads each:
//   - a message, then sf-modal opened: the toast is on top;
//   - sf-modal open, then a message: the toast is on top;
//   - a message, then a page's own <dialog> shown modal (top layer): on top;
//   - a message, then a popover (top layer): on top;
//   - a message, then sf-drawer: on top;
// and a window that closes leaves the toast in place. Console clean.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0"><main>Страница</main>
<sf-modal modal-id="m" heading="Окно" show-footer="false" width="100%"><div slot="content" style="block-size:2000px">Окно на весь экран</div></sf-modal>
<sf-drawer id="dr" placement="inline-end" heading="Панель" style="--sf-drawer-size:100vw"><p>Панель</p></sf-drawer>
<dialog id="dlg" style="inset:0;inline-size:100vw;max-inline-size:100vw;block-size:100vh;max-block-size:100vh;margin:0;padding:0;border:0;background:#888">Диалог страницы</dialog>
<div id="pop" popover="manual" style="inset:0;inline-size:100vw;block-size:100vh;margin:0;padding:0;border:0;background:#999">Поповер страницы</div>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
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

// What a person sees at the middle of the toast: the toast, or what covers it.
const onTop = () => {
  const toast = document.querySelector('.sf-notifications .sf-toast');
  if (!toast) return 'no toast';
  const box = toast.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (!hit) return 'nothing';
  if (toast.contains(hit)) return 'toast';
  return hit.closest('dialog, [popover], [data-sf-drawer-root], [data-sf-modal-root], .sf-modal, sf-modal')?.id || hit.closest('[id]')?.id || hit.tagName.toLowerCase();
};

const failures = [];
const rows = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (let load = 1; load <= 3; load++) {
    const tab = await browser.newPage({viewport: {width, height: 800}});
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`http://127.0.0.1:${server.address().port}/`);
    await tab.waitForFunction(() => typeof window.SF?.notify === 'function' && customElements.get('sf-modal') && customElements.get('sf-drawer'), null, {timeout: 20000});
    const say = async (title) => {
      await tab.evaluate((t) => window.SF.notify({status: 'info', title: t, duration: 0}), title);
      await tab.waitForFunction(() => document.querySelector('.sf-notifications .sf-toast')?.getBoundingClientRect().height > 0, null, {timeout: 8000}).catch(() => {});
      await tab.waitForTimeout(500);
    };
    const clear = async () => {
      await tab.evaluate(() => { for (const toast of document.querySelectorAll('.sf-notifications .sf-toast')) window.SF.Toast.dismiss(toast); });
      await tab.waitForTimeout(700);
    };
    const row = {width, load};
    // A message, then the window.
    await say('Сохранено');
    await tab.evaluate(() => document.querySelector('sf-modal').open());
    await tab.waitForTimeout(700);
    row.messageThenModal = await tab.evaluate(onTop);
    await clear();
    // The window open, then a message.
    await say('Сохранено ещё');
    row.modalThenMessage = await tab.evaluate(onTop);
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(600);
    row.afterModalClosed = await tab.evaluate(onTop);
    await clear();
    // A page's own modal dialog and popover: both top layer.
    await say('Диалог');
    await tab.evaluate(() => document.getElementById('dlg').showModal());
    await tab.waitForTimeout(300);
    row.messageThenDialog = await tab.evaluate(onTop);
    await tab.evaluate(() => document.getElementById('dlg').close());
    await tab.waitForTimeout(200);
    await tab.evaluate(() => document.getElementById('pop').showPopover());
    await tab.waitForTimeout(300);
    row.messageThenPopover = await tab.evaluate(onTop);
    await tab.evaluate(() => document.getElementById('pop').hidePopover());
    await clear();
    // A message, then the drawer.
    await say('Панель');
    await tab.evaluate(() => document.getElementById('dr').open());
    await tab.waitForTimeout(700);
    row.messageThenDrawer = await tab.evaluate(onTop);
    row.errors = errors;
    rows.push(row);
    for (const key of ['messageThenModal', 'modalThenMessage', 'afterModalClosed', 'messageThenDialog', 'messageThenPopover', 'messageThenDrawer']) {
      if (row[key] !== 'toast') failures.push(`${width} load ${load}: ${key}: the toast is under «${row[key]}»`);
    }
    if (errors.length) failures.push(`${width} load ${load}: console ${errors.join(' | ')}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(rows));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('NOTIFY_ABOVE_WINDOW_OK');
