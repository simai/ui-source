#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// The class progress bar's paused state is drawn and said as the Smart bar's
// (examples pass EX-2, C34): a paused bar with no status or a lower one is a
// warning (the track takes the warning role), an error stays an error, and the
// page's status comes back when the work goes on; a screen reader hears
// «35 %, на паузе» (en «35 %, paused»), and «на паузе» alone while the size is
// not known. The role, name and value are read from the accessibility tree (CDP), at 1440
// and 390, light and dark, on a Russian and an English page.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const bar = (id, attrs = '', cls = '') => `<div id="${id}" class="sf-progress-bar sf-progress-bar--size-1 ${cls} flex" ${attrs}><div class="sf-progress-bar-main"><div class="sf-progress-bar-progress transition"></div></div></div>`;
const page = (theme, lang) => `<!doctype html><html lang="${lang}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface)}main{display:flex;flex-direction:column;gap:16px;max-inline-size:480px}</style></head>
<body><main>
${bar('warning-ref', 'data-value="35" data-tone="warning" data-label="Образец"')}
${bar('error-ref', 'data-value="35" data-tone="error" data-label="Образец"')}
${bar('primary-ref', 'data-value="35" data-label="Образец"')}
${bar('paused', 'data-value="35" data-paused="true" data-label="Загрузка отчёта"')}
${bar('paused-class', 'data-value="35" data-tone="success" data-label="Выгрузка"', 'sf-progress-bar--paused')}
${bar('paused-error', 'data-value="35" data-tone="error" data-paused="true" data-label="Импорт"')}
${bar('paused-unknown', 'data-indeterminate="true" data-paused="true" data-label="Подготовка"')}
${bar('paused-own', 'data-value="35" data-paused="true" data-value-text="Ждёт сети" data-label="Синхронизация"')}
</main></body></html>`;
let html = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/favicon.ico') { response.writeHead(204); return response.end(); }
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(html);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const ok = (name, pass, detail = '') => results.push({name, pass: Boolean(pass), detail});
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const lang of ['ru', 'en']) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    if (lang === 'en' && width === 390) continue;
    const label = `${lang} ${width} ${theme}`;
    html = page(theme, lang);
    const context = await browser.newContext({viewport: {width, height: 800}, colorScheme: theme, locale: lang === 'ru' ? 'ru-RU' : 'en-US'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => [...document.querySelectorAll('.sf-progress-bar')].every((root) => root.getAttribute('role')), null, {timeout: 25000});
    await tab.waitForTimeout(300);
    const fill = (id) => tab.evaluate((one) => getComputedStyle(document.querySelector(`#${one} .sf-progress-bar-progress`)).backgroundColor, id);
    const cdp = await context.newCDPSession(tab);
    const said = async (id) => {
      const {root} = await cdp.send('DOM.getDocument', {depth: -1});
      const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: `#${id}`});
      const {nodes} = await cdp.send('Accessibility.getPartialAXTree', {nodeId, fetchRelatives: false});
      const node = nodes.find((one) => !one.ignored) || nodes[0];
      const prop = (name) => node.properties?.find((one) => one.name === name)?.value?.value;
      // Chrome's tree reports a progress bar's valuetext as empty whatever
      // the page says (checked on a plain role=progressbar), so the words are
      // read from the aria-valuetext the tree is built from; the role, the
      // name and the value come from the tree.
      const valuetext = await tab.evaluate((one) => document.querySelector(`#${one}`).getAttribute('aria-valuetext') ?? '', id);
      return {role: node.role?.value, name: node.name?.value || '', valuetext, now: node.value?.value};
    };
    const warning = await fill('warning-ref');
    const error = await fill('error-ref');
    const primary = await fill('primary-ref');
    ok(`${label}: the references differ`, warning !== primary && error !== warning, JSON.stringify({warning, error, primary}));
    ok(`${label}: a paused bar with no status draws the warning`, await fill('paused') === warning, await fill('paused'));
    ok(`${label}: a paused success bar (the class) draws the warning`, await fill('paused-class') === warning, await fill('paused-class'));
    ok(`${label}: a paused error stays an error`, await fill('paused-error') === error, await fill('paused-error'));
    const words = lang === 'ru' ? {value: '35\u00a0%, на паузе', unknown: 'на паузе'} : {value: '35\u00a0%, paused', unknown: 'paused'};
    const paused = await said('paused');
    ok(`${label}: the paused bar says «${words.value}»`, paused.role === 'progressbar' && paused.valuetext === words.value, JSON.stringify(paused));
    const unknown = await said('paused-unknown');
    ok(`${label}: a paused bar of unknown size says «${words.unknown}»`, unknown.valuetext === words.unknown && unknown.now === undefined, JSON.stringify(unknown));
    const own = await said('paused-own');
    ok(`${label}: the page's value text wins`, own.valuetext === 'Ждёт сети', JSON.stringify(own));
    const status = await tab.evaluate(() => {
      const root = document.querySelector('#paused-class');
      window.SF.ProgressBar.setState(root, {paused: false});
      return {tone: root.dataset.tone, classes: [...root.classList].filter((name) => /--(success|warning|paused)$/u.test(name))};
    });
    ok(`${label}: resumed, the bar takes the page's status back`, status.tone === 'success' && status.classes.join(' ') === 'sf-progress-bar--success', JSON.stringify(status));
    const resumed = await said('paused-class');
    ok(`${label}: resumed, the bar says its per cent`, resumed.valuetext === '35\u00a0%', JSON.stringify(resumed));
    ok(`${label}: console clean`, !errors.length, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
