#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-include on the built bytes with the real Loader: the loading skeleton
// (three lines, the last shorter, aria-busy, the minimum block size), load now,
// load view (nothing fetched below the fold, one fetch within 200 px of the
// viewport, none on a second sighting), an error then Retry by keyboard with
// focus kept in the region, a Smart component in the part loaded and drawn
// while the part's script does not run, and the error row's geometry on rung 1
// of the ladder at 1280 px light and 375 px dark (one row wide; narrow, the
// message wraps in whole lines and Retry goes under it at the row's start).
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
const requests = [];
let flaky = 0;
let page = '';
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  requests.push(path);
  const html = (body, status = 200) => { response.writeHead(status, {'content-type': 'text/html; charset=utf-8'}); response.end(body); };
  if (path === '/page') return html(page);
  if (path.startsWith('/slow/')) { await new Promise((settle) => setTimeout(settle, 1500)); return html(`<p id="slow-done">Готово</p>`); }
  if (path === '/part/smart') return html('<p>Статус: <sf-badge id="inner" text="Новое" status="success" appearance="tonal"></sf-badge></p><script>window.__ran = true</script>');
  if (path.startsWith('/part/')) return html(`<p id="part-${path.slice(6)}">Часть ${path.slice(6)}</p>`);
  if (path === '/flaky') { flaky += 1; return flaky === 1 ? html('', 503) : html('<p id="flaky-ok">Со второго раза</p>'); }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;
const shell = (body, theme = 'light') => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px">${body}</body></html>`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({name, pass: Boolean(pass), detail}); };
const browser = await chromium.launch();

async function open(body, {width = 1280, height = 800, theme = 'light'} = {}) {
  page = shell(body, theme);
  const context = await browser.newContext({viewport: {width, height}, locale: 'ru-RU', colorScheme: theme});
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await tab.goto(`${base}/page`);
  await tab.waitForFunction(() => customElements.get('sf-include'), null, {timeout: 20000});
  tab.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`); });
  return {tab, context, errors};
}

// 1. The loading skeleton, then load now.
{
  const {tab, context, errors} = await open('<sf-include id="a" src="/slow/one" style="--sf-include-min-block-size: 120px"></sf-include>');
  await tab.waitForSelector('#a sf-skeleton .sf-skeleton-text');
  const loading = await tab.evaluate(() => {
    const host = document.querySelector('#a');
    const root = host.querySelector(':scope > .sf-include');
    const bars = [...host.querySelectorAll('.sf-skeleton-text')].map((bar) => bar.getBoundingClientRect());
    return {busy: root.getAttribute('aria-busy'), flag: host.hasAttribute('data-loading'), bars: bars.map((r) => [Math.round(r.width), Math.round(r.height)]), block: root.getBoundingClientRect().height, hidden: host.querySelector('.sf-include-placeholder').getAttribute('aria-hidden')};
  });
  ok('loading: three skeleton lines, last 60 %', loading.bars.length === 3 && loading.bars[2][0] < loading.bars[0][0] * 0.65 && loading.bars.every((bar) => bar[1] > 0), JSON.stringify(loading.bars));
  ok('loading: aria-busy, data-loading, placeholder aria-hidden', loading.busy === 'true' && loading.flag && loading.hidden === 'true', JSON.stringify(loading));
  ok('loading: min block size holds', loading.block >= 120, `block ${loading.block}`);
  await tab.waitForSelector('#a #slow-done', {timeout: 5000});
  const done = await tab.evaluate(() => ({busy: document.querySelector('#a > .sf-include').getAttribute('aria-busy'), flag: document.querySelector('#a').hasAttribute('data-loading'), skeleton: Boolean(document.querySelector('#a sf-skeleton'))}));
  ok('load now: part in place, not busy, skeleton gone', done.busy === 'false' && !done.flag && !done.skeleton, JSON.stringify(done));
  ok('load now: no page errors', !errors.length, errors.join(' | '));
  await context.close();
}

// 2. load view below the fold.
{
  requests.length = 0;
  const {tab, context, errors} = await open('<div style="block-size: 2400px"></div><sf-include id="v" src="/part/view" load="view"></sf-include><div style="block-size: 400px"></div>');
  await tab.waitForTimeout(1500);
  ok('load view: nothing fetched below the fold', !requests.includes('/part/view') && await tab.evaluate(() => Boolean(document.querySelector('#v sf-skeleton'))));
  // Within 200 px of the viewport: scroll so the region's top is 150 px under the fold.
  await tab.evaluate(() => { const top = document.querySelector('#v > .sf-include').getBoundingClientRect().top + scrollY; scrollTo(0, top - innerHeight - 150); });
  await tab.waitForSelector('#v #part-view', {timeout: 5000}).catch(() => null);
  ok('load view: fetched once within 200 px of the viewport', requests.filter((one) => one === '/part/view').length === 1 && await tab.evaluate(() => Boolean(document.querySelector('#v #part-view'))));
  await tab.evaluate(() => scrollTo(0, 0));
  await tab.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await tab.waitForTimeout(500);
  ok('load view: not fetched again on a second sighting', requests.filter((one) => one === '/part/view').length === 1);
  ok('load view: no page errors', !errors.length, errors.join(' | '));
  await context.close();
}

// 3. Error, then Retry succeeds; focus kept.
for (const [width, theme] of [[1280, 'light'], [375, 'dark']]) {
  flaky = 0;
  const {tab, context, errors} = await open('<p>Текст до</p><sf-include id="e" src="/flaky"></sf-include><p>Текст после</p>', {width, height: 700, theme});
  await tab.waitForSelector('#e .sf-include-retry button', {timeout: 8000});
  await tab.waitForTimeout(300);
  const geometry = await tab.evaluate(() => {
    const host = document.querySelector('#e');
    const row = host.querySelector('.sf-include-error');
    const button = host.querySelector('.sf-include-retry button');
    const message = host.querySelector('.sf-include-message');
    const icon = host.querySelector('.sf-include-error-icon');
    const style = getComputedStyle(row);
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;inline-size:var(--sf-ui-1--control-height);block-size:var(--sf-text-height-1);padding:var(--sf-ui-1--space-y) var(--sf-ui-1--space-x);gap:var(--sf-ui-1--text-space-x)';
    document.body.append(probe);
    const ladder = getComputedStyle(probe);
    const want = {control: parseFloat(ladder.inlineSize), line: parseFloat(ladder.blockSize), padY: parseFloat(ladder.paddingTop), padX: parseFloat(ladder.paddingLeft), gap: parseFloat(ladder.columnGap)};
    probe.remove();
    const r = (el) => el.getBoundingClientRect();
    const b = r(button); const m = r(message); const i = r(icon); const w = r(row);
    return {
      want,
      button: b.height, message: parseFloat(getComputedStyle(message).lineHeight), icon: [i.width, i.height],
      padY: parseFloat(style.paddingTop), padX: parseFloat(style.paddingLeft), gap: parseFloat(style.columnGap),
      rowHeight: w.height, buttonCentre: b.top + b.height / 2 - w.top, messageCentre: m.top + m.height / 2 - w.top, iconCentre: i.top + i.height / 2 - w.top,
      overflow: document.documentElement.scrollWidth > innerWidth,
      status: message.getAttribute('role'), text: message.textContent.trim(), retry: host.querySelector('.sf-include-retry .sf-button-text-container')?.textContent.trim(), buttonStart: b.left - w.left, messageStart: m.left - w.left, iconStart: i.left - w.left,
      failed: host.hasAttribute('data-failed'), border: style.borderTopColor, color: getComputedStyle(message).color,
    };
  });
  const near = (a, b) => Math.abs(a - b) < 0.6;
  ok(`error ${width} ${theme}: Retry is the rung-1 control height`, near(geometry.button, geometry.want.control), `${geometry.button} vs ${geometry.want.control}`);
  ok(`error ${width} ${theme}: message on the rung-1 text line, icon that line`, near(geometry.message, geometry.want.line) && near(geometry.icon[0], geometry.want.line) && near(geometry.icon[1], geometry.want.line), JSON.stringify([geometry.message, geometry.icon, geometry.want.line]));
  ok(`error ${width} ${theme}: inset and gap are the rung's space`, near(geometry.padY, geometry.want.padY) && near(geometry.padX, geometry.want.padX) && near(geometry.gap, geometry.want.gap), JSON.stringify(geometry));
  if (width >= 768) ok(`error ${width} ${theme}: one row, centres on one axis`, near(geometry.rowHeight, geometry.want.control + 2 * geometry.want.padY + 2) && Math.abs(geometry.buttonCentre - geometry.messageCentre) < 1 && Math.abs(geometry.iconCentre - geometry.messageCentre) < 1, JSON.stringify(geometry));
  else {
    // Narrow: the message wraps in whole lines, Retry goes under it at the row's start, one gap between.
    const lines = (geometry.rowHeight - 2 - 2 * geometry.want.padY - geometry.want.gap - geometry.want.control) / geometry.want.line;
    ok(`error ${width} ${theme}: wraps on the ladder (whole text lines, one gap, Retry at the start)`, Math.abs(lines - Math.round(lines)) < 0.05 && lines >= 1 && near(geometry.buttonStart, geometry.iconStart), JSON.stringify({lines, geometry}));
  }
  ok(`error ${width} ${theme}: polite status, words, data-failed, no sideways scroll`, geometry.status === 'status' && geometry.text === 'Не удалось загрузить эту часть страницы.' && geometry.retry === 'Повторить' && geometry.failed && !geometry.overflow, JSON.stringify(geometry));
  await tab.focus('#e .sf-include-retry button');
  await tab.keyboard.press('Enter');
  await tab.waitForSelector('#e #flaky-ok', {timeout: 5000}).catch(() => null);
  const after = await tab.evaluate(() => ({loaded: Boolean(document.querySelector('#e #flaky-ok')), failed: document.querySelector('#e').hasAttribute('data-failed'), focus: document.activeElement === document.querySelector('#e > .sf-include')}));
  ok(`retry ${width} ${theme}: Enter on Retry loads; focus stays in the region`, after.loaded && !after.failed && after.focus, JSON.stringify(after));
  ok(`error ${width} ${theme}: no page errors`, errors.every((one) => /503|Failed to load resource/u.test(one)), errors.join(' | '));
  await context.close();
}

// 4. An inserted Smart component is upgraded; scripts do not run.
{
  const {tab, context, errors} = await open('<sf-include id="s" src="/part/smart"></sf-include>');
  await tab.waitForFunction(() => document.querySelector('#inner')?.isRendered === true, null, {timeout: 8000}).catch(() => null);
  const seen = await tab.evaluate(() => ({defined: Boolean(customElements.get('sf-badge')), rendered: document.querySelector('#inner')?.isRendered === true, box: document.querySelector('#inner .sf-badge')?.getBoundingClientRect().width ?? 0, ran: window.__ran === true}));
  ok('inserted sf-badge is loaded, defined and drawn', seen.defined && seen.rendered && seen.box > 0, JSON.stringify(seen));
  ok('the part\'s script did not run', !seen.ran);
  ok('smart: no page errors', !errors.length, errors.join(' | '));
  await context.close();
}

await browser.close();
server.close();
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
