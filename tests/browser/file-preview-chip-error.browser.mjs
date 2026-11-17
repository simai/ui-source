#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// sf-file-preview appearance="chip" state="error" (defects-d12, found by the
// ui-pro chat, C149): a failed chip keeps a chip's width. The row's container
// query (C260) made every failed preview a size container, and a
// shrink-to-fit chip that is one has no width of its own: it drew 32 wide and
// about 520 high, alone and in a row. Now the failed chip is as high as a
// ready one (the size 2 control), at most --sf-f8 wide and not a sliver, its
// reason on one line inside it, «Повторить» as the icon named «Повторить
// <имя>», and the reason said by role alert (in a row as well; not in
// sf-file-upload's list, which says it in its own status line). Measured at
// 1440 and 390 (a touch phone), light and dark, three loads each.
import {resolve, join} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const failures = [];
const type = (path) => path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8';
const serve = (route, path) => existsSync(path) ? route.fulfill({status: 200, contentType: type(path), body: readFileSync(path)}) : route.fulfill({status: 404, body: ''});
const base = 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/';
const chip = (id, state) => `<sf-file-preview id="${id}" appearance="chip" file-name="Договор поставки.pdf" file-size="2516582"${state ? ` state="error" error-text="не похоже на документ"` : ''}></sf-file-preview>`;
const body = `
  <div id="alone">${chip('failed', true)}</div>
  <div id="ready-row">${chip('ready', false)}</div>
  <div id="plain">${chip('plain-1', true)} ${chip('plain-2', false)}</div>
  <div id="flex" style="display:flex;flex-wrap:wrap;gap:8px">${chip('flex-1', true)}${chip('flex-2', false)}</div>
  <sf-file-preview id="row" file-name="Устав.pdf" state="error" error-text="нет связи с сервером"></sf-file-preview>
  <sf-file-upload id="upload"></sf-file-upload>
  <script>customElements.whenDefined('sf-file-upload').then(() => { document.getElementById('upload').items = [{id: 'b', name: 'photo.png', fileSize: '3MB', state: 'error', errorMessage: 'Сеть недоступна'}]; });</script>`;

const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']]) {
    for (let load = 1; load <= 3; load += 1) {
      const view = `${width} ${theme} load ${load}`;
      const context = await browser.newContext({viewport: {width, height: 900}, isMobile: width < 768, hasTouch: width < 768});
      await context.route('http://probe.test/**', (route) => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="${base}core/css/core.css">
        <script>window.sfPath='${base}';</script>
        <script src="${base}core/lang/ru.js"></script>
        <script type="module" src="${base}core/js/core.js"></script></head>
        <body style="margin:16px">${body}</body></html>`}));
      await context.route('https://cdn.jsdelivr.net/gh/simai/ui@*/distr/**', (route) => {
        const [product, ...rest] = new URL(route.request().url()).pathname.replace(/^.*\/distr\//u, '').split('/');
        return serve(route, join(out, product, product, ...rest));
      });
      const page = await context.newPage();
      const said = [];
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) said.push(message.text()); });
      page.on('pageerror', (error) => failures.push({view, name: 'page error', said: error.message}));
      await page.goto('http://probe.test/');
      await page.waitForFunction(() => document.querySelectorAll('.sf-file-preview .sf-file-preview-holder').length === 8, null, {timeout: 15000});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const read = await page.evaluate(() => {
        const f8 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sf-f8')) * parseFloat(getComputedStyle(document.documentElement).fontSize);
        const shown = (element) => Boolean(element) && element.getBoundingClientRect().width > 0 && getComputedStyle(element).display !== 'none';
        const inUpload = document.querySelector('sf-file-upload .sf-file-preview-error');
        const uploadRole = inUpload ? inUpload.getAttribute('role') : 'missing';
        const chips = [...document.querySelectorAll('sf-file-preview:not(sf-file-upload sf-file-preview)')].map((host) => {
          const root = host.querySelector('.sf-file-preview');
          const box = root.getBoundingClientRect();
          const error = root.querySelector('.sf-file-preview-error');
          const words = root.querySelector('.sf-file-preview-retry > button');
          const icon = root.querySelector('.sf-file-preview-retry-icon');
          const errorBox = error?.getBoundingClientRect();
          return {
            id: host.id, width: box.width, height: box.height,
            error: error ? {
              role: error.getAttribute('role'), text: error.textContent.trim(), title: error.getAttribute('title'),
              height: errorBox.height, line: parseFloat(getComputedStyle(error).lineHeight),
              inside: errorBox.left >= box.left - 0.5 && errorBox.right <= box.right + 0.5,
            } : null,
            words: shown(words), icon: shown(icon), iconName: icon?.getAttribute('aria-label') || icon?.querySelector('button')?.getAttribute('aria-label') || '',
          };
        });
        return {f8, chips, uploadRole, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth};
      });
      const ready = read.chips.find((item) => item.id === 'ready');
      for (const item of read.chips) {
        if (!item.error) continue;
        const where = `${view} ${item.id}`;
        if (item.error.role !== 'alert') failures.push({view: where, name: 'the reason is said when it appears (role alert)', role: item.error.role});
        if (!item.error.text.includes('не похоже на документ') && !item.error.text.includes('нет связи с сервером')) failures.push({view: where, name: 'the reason names the host error-text', text: item.error.text});
        if (item.id === 'row') continue;
        if (item.width < 160) failures.push({view: where, name: 'a failed chip keeps a chip\'s width (it was 32)', width: item.width});
        if (item.width > read.f8 + 0.5) failures.push({view: where, name: 'a failed chip is at most --sf-f8 wide', width: item.width, f8: read.f8});
        if (Math.abs(item.height - ready.height) > 0.5) failures.push({view: where, name: 'a failed chip is as high as a ready one', height: item.height, ready: ready.height});
        if (item.error.height > item.error.line + 0.5) failures.push({view: where, name: 'the reason stands on its one line', height: item.error.height, line: item.error.line});
        if (!item.error.inside) failures.push({view: where, name: 'the reason stays inside the chip'});
        if (item.error.title !== item.error.text) failures.push({view: where, name: 'the whole reason is the line\'s title', title: item.error.title, text: item.error.text});
        if (item.words || !item.icon) failures.push({view: where, name: '«Повторить» is the icon in a chip', words: item.words, icon: item.icon});
        if (!item.iconName.startsWith('Повторить')) failures.push({view: where, name: 'the icon is named «Повторить <имя>»', iconName: item.iconName});
      }
      if (read.uploadRole !== null) failures.push({view, name: 'in sf-file-upload the reason is not said twice (the upload\'s status line says it)', role: read.uploadRole});
      if (read.overflow) failures.push({view, name: 'nothing spills past the page'});
      if (said.length) failures.push({view, name: 'console', said});
      console.log(JSON.stringify({view, f8: read.f8, chips: read.chips.map(({id, width, height, error}) => ({id, width, height, line: error?.height}))}));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  console.error(`file-preview chip error: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('file-preview chip error: pass');
