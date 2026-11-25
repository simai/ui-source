#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Group build 19 area C (DEV answer 5 on GB18, msg-cda157ebd00d44df8792): a
// press that needs a part the page has not loaded yet waits for it through
// SF.Loader.ensure(tags, {press: true}) (GB18 L2, 30 s while the load is in
// flight), not the 3 s default wait. The probe holds sf-menu-context's files
// until 5 s after the press, as a slow network does, and presses for real:
//   - a page button whose click calls SF.menu.open({anchor, entries}): the
//     menu opens with its rows once the part arrives, and a row chosen by a
//     click is the answer;
//   - sf-breadcrumbs' «…» (C93 item 1): its hidden crumbs open as a menu;
//   - Escape closes each one; no page error.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const HOLD_MS = 5000;
let releaseAt = Infinity;
const held = [];
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:24px;justify-items:start">
<button id="open" type="button">Действия</button>
<sf-breadcrumbs id="crumbs" max-items="4"><sf-breadcrumbs-item href="/">Главная</sf-breadcrumbs-item><sf-breadcrumbs-item href="/a">Раздел</sf-breadcrumbs-item><sf-breadcrumbs-item href="/b">Подраздел</sf-breadcrumbs-item><sf-breadcrumbs-item href="/c">Ещё</sf-breadcrumbs-item><sf-breadcrumbs-item href="/d">Глубже</sf-breadcrumbs-item><sf-breadcrumbs-item current>Страница</sf-breadcrumbs-item></sf-breadcrumbs>
<script>
document.getElementById('open').addEventListener('click', async (event) => {
  window.__choice = 'pending';
  const choice = await SF.menu.open({anchor: event.currentTarget, entries: [{id: 'one', text: 'Первое'}, {id: 'two', text: 'Второе'}], label: 'Действия'});
  window.__choice = choice?.id ?? null;
});
</script>
</body></html>`;

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const send = () => {
    const charset = ['.js', '.mjs', '.css', '.json', '.svg'].includes(extname(file)) ? '; charset=utf-8' : '';
    response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
    response.end(readFileSync(file));
  };
  // sf-menu-context's script and sheets come 5 s after the press.
  if (/\/menu-context\//u.test(path)) held.push(send);
  else send();
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const release = setInterval(() => { if (Date.now() >= releaseAt) while (held.length) held.shift()(); }, 50);
const base = `http://127.0.0.1:${server.address().port}/probe`;

const failures = [];
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const report = {};
const browser = await chromium.launch();
try {
  const fresh = async () => {
    releaseAt = Infinity;
    const context = await browser.newContext({viewport: {width: 1280, height: 800}});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(base, {waitUntil: 'load'});
    await tab.waitForFunction(() => globalThis.SF?.menu?.open && customElements.get('sf-breadcrumbs') && document.querySelector('#crumbs button'), null, {timeout: 20000});
    check('sf-menu-context is not on the page before the press', !(await tab.evaluate(() => Boolean(customElements.get('sf-menu-context')))));
    return {context, tab, errors};
  };

  // SF.menu.open from a real click.
  {
    const {context, tab, errors} = await fresh();
    await tab.click('#open');
    releaseAt = Date.now() + HOLD_MS;
    const shown = await tab.waitForFunction(() => [...document.querySelectorAll('[data-sf-menu-shared] [role="menuitem"]')].filter((row) => row.getBoundingClientRect().height > 0).length === 2, null, {timeout: 20000}).then(() => true, () => false);
    const waited = Date.now() - (releaseAt - HOLD_MS);
    report.menuOpen = {shown, waited};
    check('SF.menu.open: after a 5 s load the menu opens with its two rows', shown && waited >= HOLD_MS, report.menuOpen);
    if (shown) {
      await tab.locator('[data-sf-menu-shared] [role="menuitem"]').nth(1).click();
      const choice = await tab.waitForFunction(() => window.__choice !== 'pending' && window.__choice, null, {timeout: 5000}).then((handle) => handle.jsonValue(), () => null);
      check('SF.menu.open: the row clicked is the answer', choice === 'two', {choice});
    }
    check('SF.menu.open: no page error', errors.length === 0, {errors});
    await context.close();
  }

  // sf-breadcrumbs «…» from a real click.
  {
    const {context, tab, errors} = await fresh();
    await tab.click('#crumbs button');
    releaseAt = Date.now() + HOLD_MS;
    const shown = await tab.waitForFunction(() => {
      const menu = document.querySelector('#crumbs .sf-breadcrumbs-menu');
      return Boolean(menu?.isOpen) && (menu.entries?.length ?? 0) >= 2;
    }, null, {timeout: 20000}).then(() => true, () => false);
    const waited = Date.now() - (releaseAt - HOLD_MS);
    report.crumbs = {shown, waited, hidden: await tab.evaluate(() => document.querySelector('#crumbs .sf-breadcrumbs-menu')?.entries?.length ?? 0)};
    check('sf-breadcrumbs «…»: after a 5 s load the hidden crumbs open as a menu', shown && waited >= HOLD_MS, report.crumbs);
    if (shown) {
      await tab.keyboard.press('Escape');
      const closed = await tab.waitForFunction(() => !document.querySelector('#crumbs .sf-breadcrumbs-menu')?.isOpen, null, {timeout: 3000}).then(() => true, () => false);
      check('sf-breadcrumbs «…»: Escape closes the menu', closed);
    }
    check('sf-breadcrumbs: no page error', errors.length === 0, {errors});
    await context.close();
  }
} finally {
  clearInterval(release);
  while (held.length) held.shift()();
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report));
if (failures.length) {
  console.error(JSON.stringify({failures}, null, 1));
  process.exit(1);
}
console.log('PRESS_SLOW_LOAD_OK');
