#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// An inline style set on a Smart host reaches its markup (core.runtime 1.30.0).
// The host is display: contents and its style attribute was replaced by that
// alone; the author's style reached the markup only through a template that
// bound rootStyle on its root, and seventeen did not -- on sf-list-feed even
// `color` or a --var set on the element did nothing, set on its parent it
// worked. Now the host keeps what its markup inherits (custom properties,
// colour, the font but its size) beside display: contents. Checked here:
// - sf-list-feed (no rootStyle): el.style.color and el.style.setProperty('--…')
//   reach the markup and a host-drawn entry; sf-empty-state (no rootStyle, its
//   own ink on its root): the custom property reaches it, the colour as far as
//   one set on its parent does;
// - sf-button (binds rootStyle): a relative font-size is taken once, not
//   compounded by the host and the root;
// - the host stays display: contents, el.style reads back what was set, and a
//   width (no box to take it) is kept for the root rather than dropped;
// - moved to another parent the style survives, removed it is gone.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;color:rgb(10, 10, 10);font-size:16px}#box,#other{display:flex;flex-direction:column;block-size:240px}</style></head>
<body><div id="box"><sf-list-feed id="feed" label="Лента"></sf-list-feed></div><div id="other"></div>
<div id="empty-box"><sf-empty-state id="empty" heading="Пусто" text="Записей нет"></sf-empty-state></div>
<div id="button-box"><sf-button id="button" text="Сохранить"></sf-button></div></body></html>`;
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
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
const browser = await chromium.launch();
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 800}, locale: 'ru-RU', reducedMotion: 'reduce'});
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await tab.goto(`${base}/page`);
    await tab.waitForFunction(() => document.querySelector('#feed .sf-list-feed') && document.querySelector('#empty > *') && document.querySelector('#button > button'), null, {timeout: 25000});
    await tab.evaluate(async () => {
      const feed = document.querySelector('#feed');
      feed.renderItem = (entry) => {
        const node = document.createElement('article');
        node.className = 'probe-entry';
        node.style.borderInlineStartColor = 'var(--probe-ink)';
        node.style.borderInlineStartStyle = 'solid';
        node.textContent = entry.text;
        return node;
      };
      feed.setItems([{id: '1', text: 'Первая запись', author: 'a'}, {id: '2', text: 'Вторая запись', author: 'b'}]);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await tab.waitForFunction(() => document.querySelectorAll('#feed .probe-entry').length === 2, null, {timeout: 10000});

    const settle = () => tab.evaluate(() => new Promise((done) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(done)), 50)));
    const read = () => tab.evaluate(() => {
      const feed = document.querySelector('#feed');
      const root = feed.querySelector('.sf-list-feed');
      const entry = feed.querySelector('.probe-entry');
      const empty = document.querySelector('#empty');
      const emptyRoot = empty.firstElementChild;
      return {
        hostDisplay: getComputedStyle(feed).display,
        rootColor: getComputedStyle(root).color,
        entryColor: getComputedStyle(entry).color,
        entryInk: getComputedStyle(entry).borderInlineStartColor,
        rootVar: getComputedStyle(root).getPropertyValue('--probe-ink').trim(),
        readBack: feed.style.color,
        readBackVar: feed.style.getPropertyValue('--probe-ink').trim(),
        readBackWidth: feed.style.width,
        emptyDisplay: getComputedStyle(empty).display,
        emptyColor: getComputedStyle(emptyRoot).color,
        emptyVar: getComputedStyle(emptyRoot).getPropertyValue('--probe-ink').trim(),
        sideways: document.documentElement.scrollWidth > innerWidth,
      };
    });

    await tab.evaluate(() => {
      const feed = document.querySelector('#feed');
      feed.style.color = 'rgb(200, 0, 0)';
      feed.style.setProperty('--probe-ink', 'rgb(0, 128, 0)');
      feed.style.width = '300px';
      const empty = document.querySelector('#empty');
      empty.style.color = 'rgb(0, 0, 180)';
      empty.style.setProperty('--probe-ink', 'rgb(1, 2, 3)');
    });
    await settle();
    const set = await read();
    ok(`${width}: sf-list-feed host stays display: contents`, set.hostDisplay === 'contents', JSON.stringify(set));
    ok(`${width}: el.style.color on sf-list-feed reaches its markup and a host-drawn entry`, set.rootColor === 'rgb(200, 0, 0)' && set.entryColor === 'rgb(200, 0, 0)', JSON.stringify(set));
    ok(`${width}: a custom property set on sf-list-feed reaches its markup`, set.rootVar === 'rgb(0, 128, 0)' && set.entryInk === 'rgb(0, 128, 0)', JSON.stringify(set));
    ok(`${width}: el.style reads back what was set, a width included`, set.readBack === 'rgb(200, 0, 0)' && set.readBackVar === 'rgb(0, 128, 0)' && set.readBackWidth === '300px', JSON.stringify(set));
    // sf-empty-state paints its own ink on its root (a class), so a colour
    // inherited from above does not show there -- set on its parent it does not
    // either. The host now passes on what a parent would: the custom property,
    // and the colour exactly as far as the parent's reaches.
    const parentColor = await tab.evaluate(() => {
      const box = document.querySelector('#empty-box');
      const host = document.querySelector('#empty');
      const saved = host.style.color;
      host.style.removeProperty('color');
      box.style.color = 'rgb(0, 0, 180)';
      return new Promise((done) => setTimeout(() => requestAnimationFrame(() => {
        const value = getComputedStyle(host.firstElementChild).color;
        box.style.removeProperty('color');
        host.style.color = saved;
        done(value);
      }), 50));
    });
    await settle();
    ok(`${width}: sf-empty-state takes the custom property set on its host, and the colour as its parent's`, set.emptyDisplay === 'contents' && set.emptyVar === 'rgb(1, 2, 3)' && set.emptyColor === parentColor, JSON.stringify({set, parentColor}));

    // Moved to another parent: the whole author style survives the reconnect.
    await tab.evaluate(() => document.querySelector('#other').append(document.querySelector('#feed')));
    await settle();
    const moved = await read();
    ok(`${width}: moved to another parent, the style survives`, moved.rootColor === 'rgb(200, 0, 0)' && moved.rootVar === 'rgb(0, 128, 0)' && moved.readBackWidth === '300px', JSON.stringify(moved));

    await tab.evaluate(() => {
      const feed = document.querySelector('#feed');
      feed.style.removeProperty('color');
      feed.style.removeProperty('--probe-ink');
    });
    await settle();
    const removed = await read();
    ok(`${width}: removed, the colour and the property are gone from the markup`, removed.rootColor === 'rgb(10, 10, 10)' && removed.rootVar === '' && removed.readBackWidth === '300px', JSON.stringify(removed));

    // A template that binds rootStyle: a relative size is taken once.
    await tab.evaluate(() => {
      const button = document.querySelector('#button');
      button.style.fontSize = '1.5em';
      button.style.color = 'rgb(0, 100, 0)';
    });
    await settle();
    const button = await tab.evaluate(() => {
      const host = document.querySelector('#button');
      const control = host.querySelector(':scope > button');
      return {host: getComputedStyle(host).fontSize, root: getComputedStyle(control).fontSize, color: getComputedStyle(control).color, display: getComputedStyle(host).display};
    });
    ok(`${width}: sf-button's relative font-size is taken once, not compounded`, button.root === '24px' && button.host === '16px' && button.display === 'contents', JSON.stringify(button));
    ok(`${width}: sf-button keeps its colour on its root`, button.color === 'rgb(0, 100, 0)', JSON.stringify(button));
    ok(`${width}: no sideways scroll`, !set.sideways, JSON.stringify(set));
    ok(`${width}: no page errors`, !errors.length, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const one of results) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
console.log(`${results.filter((one) => one.pass).length}/${results.length} passed`);
if (results.some((one) => !one.pass)) process.exitCode = 1;
