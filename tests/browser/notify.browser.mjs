#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.notify: one notification area for the page, in the top layer; at most
// four messages at a time, the rest waiting; the same message counts up; each
// message is announced with sf-notification for a notification centre; an
// error is an alert; closing one shows the next. The list is a setting; the
// default is the stack (C50): the newest in front, two before it peeking out
// by the gap and 5 % narrower each, open on hover and focus with every timer
// standing, Escape closing the message in focus and moving the focus on.
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
    window.SF.notifications.configure({layout: 'list'});
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
    const assertive = area?.querySelector('.sf-notifications-live[data-live="assertive"]');
    const after = {count: toasts().length, error: assertive?.getAttribute('aria-live') === 'assertive' && assertive.textContent.includes('Не удалось') ? 'alert' : null,
      toastRoles: toasts().filter((toast) => toast.hasAttribute('role')).length};
    return {before, after, history: window.SF.notifications.history().length};
  });
  console.log(JSON.stringify(seen, null, 1));
  if (seen.before.count !== 4 || !seen.before.open) failures.push('four messages at once, in the top layer');
  if (seen.before.repeated !== '2') failures.push('the same message counts up instead of stacking');
  if (seen.before.heard !== 7 || seen.history !== 7) failures.push('every message is announced and kept');
  if (seen.before.label !== 'Уведомления') failures.push('the area is named in the page language');
  if (!(seen.before.gap > 0)) failures.push('messages stack with a gap');
  if (seen.after.count !== 4 || seen.after.error !== 'alert') failures.push('closing one shows the next; an error is said at once by the area\'s live copy');
  if (seen.after.toastRoles !== 0) failures.push('the toasts of the area are not live regions of their own (said once, by the live copy)');

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

  // The stack, on a page of its own.
  const stack = await browser.newPage({viewport: {width: 1200, height: 800}});
  await stack.goto(`http://127.0.0.1:${server.address().port}/`);
  await stack.waitForFunction(() => typeof window.SF?.notify === 'function', null, {timeout: 10000});
  const closed = await stack.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    for (let at = 1; at <= 4; at += 1) window.SF.notify({status: 'info', title: `Сообщение ${at}`, text: 'Текст сообщения.', duration: 3000});
    for (let tries = 0; tries < 50 && document.querySelectorAll('.sf-notifications .sf-toast').length < 4; tries += 1) await settle(100);
    await settle(700);
    const area = document.querySelector('.sf-notifications');
    const toasts = [...area.querySelectorAll('.sf-toast')].reverse();
    const box = (toast) => toast.getBoundingClientRect();
    const [front, second, third, fourth] = toasts.map(box);
    return {
      layout: area.dataset.layout,
      peek: [Math.round(front.top - second.top), Math.round(second.top - third.top)],
      narrower: [Math.round((1 - second.width / front.width) * 100), Math.round((1 - third.width / front.width) * 100)],
      fourth: getComputedStyle(toasts[3]).visibility,
      area: Math.round(area.getBoundingClientRect().height),
      front: Math.round(front.height),
      gap: parseFloat(getComputedStyle(area).rowGap),
      fourthTop: Math.round(fourth.top),
    };
  });
  if (closed.layout !== 'stack') failures.push('the stack is the default');
  if (closed.peek.some((one) => one !== closed.gap)) failures.push(`older messages peek out by the gap: ${closed.peek}`);
  if (closed.narrower[0] !== 5 || closed.narrower[1] !== 10) failures.push(`each older message is 5 % narrower: ${closed.narrower}`);
  if (closed.fourth !== 'hidden') failures.push('a fourth message waits hidden');
  if (closed.area !== closed.front + 2 * closed.gap) failures.push('the area covers the stack');
  // Hover opens it and every timer stands (3 s timers, 2.5 s over it after about 1 s).
  const front = stack.locator('.sf-notifications .sf-toast').last();
  await front.hover();
  await stack.waitForTimeout(2500);
  const open = await stack.evaluate(() => {
    const area = document.querySelector('.sf-notifications');
    const toasts = [...area.querySelectorAll('.sf-toast:not(.closing)')].reverse();
    const gaps = toasts.slice(1).map((toast, at) => Math.round(toasts[at].getBoundingClientRect().top - toast.getBoundingClientRect().bottom));
    return {expanded: area.hasAttribute('data-expanded'), count: toasts.length, gaps, gap: parseFloat(getComputedStyle(area).rowGap),
      widths: toasts.map((toast) => Math.round(toast.getBoundingClientRect().width))};
  });
  if (!open.expanded || open.count !== 4) failures.push(`hover opens the stack and its timers stand: ${JSON.stringify(open)}`);
  if (open.gaps.some((one) => one !== open.gap)) failures.push(`an open stack is the list: ${open.gaps}`);
  if (new Set(open.widths).size !== 1) failures.push('an open stack is full width');
  await stack.mouse.move(5, 5);
  await stack.waitForTimeout(400);
  // Focus opens it; Escape closes the message in focus and moves on.
  const keys = await stack.evaluate(async () => {
    const settle = (ms) => new Promise((done) => setTimeout(done, ms));
    const button = document.createElement('button');
    button.textContent = 'На странице';
    document.querySelector('main').append(button);
    button.focus();
    const toasts = () => [...document.querySelectorAll('.sf-notifications .sf-toast:not(.closing)')].reverse();
    toasts()[0].querySelector('[data-close]').focus();
    await settle(50);
    const expanded = document.querySelector('.sf-notifications').hasAttribute('data-expanded');
    const before = toasts().length;
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
    await settle(50);
    const moved = document.activeElement?.closest('.sf-toast') === toasts()[0];
    return {expanded, before, after: toasts().length, moved};
  });
  if (!keys.expanded) failures.push('focus opens the stack');
  if (keys.after !== keys.before - 1 || !keys.moved) failures.push(`Escape closes the focused message and moves the focus: ${JSON.stringify(keys)}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('NOTIFY_OK');
