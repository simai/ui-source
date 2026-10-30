#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.notify: one notification area for the page, in the top layer; at most
// four messages at a time, the rest waiting; the same message counts up; each
// message is announced with sf-notification for a notification centre; an
// error is an alert; closing one shows the next.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body><main>Страница</main></body></html>`;
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
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1200, height: 800}});
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => typeof window.SF?.notify === 'function', null, {timeout: 10000});
  const seen = await tab.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const heard = [];
    document.addEventListener('sf-notification', (event) => heard.push(event.detail));
    for (let at = 1; at <= 5; at += 1) window.SF.notify({status: 'success', title: `Сохранено ${at}`, duration: 0});
    window.SF.notify({status: 'error', title: 'Не удалось', text: 'Повторите попытку.', duration: 0});
    window.SF.notify({status: 'success', title: 'Сохранено 1', duration: 0});
    for (let tries = 0; tries < 50 && document.querySelectorAll('.sf-notifications .sf-toast').length < 4; tries += 1) await settle(100);
    await settle(200);
    const area = document.querySelector('.sf-notifications');
    const toasts = () => [...document.querySelectorAll('.sf-notifications .sf-toast')];
    const before = {count: toasts().length, open: area?.matches(':popover-open'),
      repeated: toasts().find((toast) => toast.textContent.includes('Сохранено 1'))?.dataset.count ?? null,
      label: area?.getAttribute('aria-label'), heard: heard.length,
      gap: (() => { const [a, b] = toasts(); return a && b ? Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) : null; })()};
    // Six messages (one counted up): four shown, «Сохранено 5» and the error
    // waiting. Closing two brings both in, in order.
    window.SF.Toast.dismiss(toasts()[0]);
    await settle(600);
    window.SF.Toast.dismiss(toasts()[0]);
    await settle(800);
    const after = {count: toasts().length, error: toasts().find((toast) => toast.textContent.includes('Не удалось'))?.getAttribute('role') ?? null};
    return {before, after, history: window.SF.notifications.history().length};
  });
  console.log(JSON.stringify(seen, null, 1));
  if (seen.before.count !== 4 || !seen.before.open) failures.push('four messages at once, in the top layer');
  if (seen.before.repeated !== '2') failures.push('the same message counts up instead of stacking');
  if (seen.before.heard !== 7 || seen.history !== 7) failures.push('every message is announced and kept');
  if (seen.before.label !== 'Уведомления') failures.push('the area is named in the page language');
  if (!(seen.before.gap > 0)) failures.push('messages stack with a gap');
  if (seen.after.count !== 4 || seen.after.error !== 'alert') failures.push('closing one shows the next; an error is an alert');

  // A string is the message's text; nothing to show is said, not swallowed.
  const warnings = [];
  tab.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
  const plain = await tab.evaluate(async () => {
    const handle = window.SF.notify('Товар в корзине');
    const nothing = [window.SF.notify(''), window.SF.notify({}), window.SF.notify(null)];
    await new Promise((done) => setTimeout(done, 300));
    return {
      handle: Boolean(handle?.id),
      kept: window.SF.notifications.history()[0]?.text,
      nothing,
    };
  });
  if (!plain.handle || plain.kept !== 'Товар в корзине') failures.push('a string is shown as the text');
  if (plain.nothing.some((one) => one !== null)) failures.push('nothing to show returns null');
  if (warnings.filter((one) => one.includes('SF.notify')).length !== 3) failures.push('nothing to show warns in the console');
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('NOTIFY_OK');
